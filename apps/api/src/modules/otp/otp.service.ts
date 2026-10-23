import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Messages } from '@monsport/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { keyedDigest } from '../auth/session.js';
import { ThrottleService } from '../auth/throttle.service.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { OTP_SENDER, type OtpSender } from './otp-sender.js';

type DbClient = PrismaService | Prisma.TransactionClient;

const DEV_SECRET = 'local-development-only';

function secret(): string {
  return process.env.SESSION_SECRET || DEV_SECRET;
}

/** Derives the HMAC key for OTP hashing from SESSION_SECRET, the same way session.ts derives keys (O2). */
export function otpDerivedKey(): Buffer {
  return createHmac('sha256', secret()).update('otp').digest();
}

/** Computes HMAC-SHA256 of phone + ':' + code using the derived 'otp' key (O2). */
export function hashOtpCode(phone: string, code: string): string {
  return createHmac('sha256', otpDerivedKey()).update(`${phone}:${code}`).digest('hex');
}

/** Thrown when an OTP rate limit (resend within 60s or otp-phone hourly limit) is hit. */
export class OtpThrottleException extends HttpException {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super({ message: Messages.tooManyAttempts, retryAfter }, HttpStatus.TOO_MANY_REQUESTS);
    this.retryAfter = retryAfter;
  }
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly throttle: ThrottleService,
    private readonly clock: Clock,
    @Inject(OTP_SENDER) private readonly sender: OtpSender,
  ) {}

  /**
   * Issues a new 6-digit OTP code for the given phone and purpose (O1 to O3, O5, O5b, O8, O10).
   * Lock order in the transaction: PhoneOtp, otp-phone, otp-day; nothing else written in the transaction.
   */
  async issue(phone: string, purpose: string, channel: 'sms' | 'zalo' = 'sms'): Promise<{ resendAfter: number }> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = hashOtpCode(phone, code);
    const phoneKey = keyedDigest(phone);
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + 5 * 60_000);
    const resendCutoff = new Date(now.getTime() - 60_000);

    let countedKeys: string[] = [];

    // In ONE transaction: upsert O3, then count otp-phone and otp-day.
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ sentAt: Date }[]>`
        INSERT INTO "PhoneOtp" ("phoneKey", purpose, "codeHash", attempts, "sentAt", "expiresAt")
        VALUES (${phoneKey}, ${purpose}, ${codeHash}, 0, ${now}, ${expiresAt})
        ON CONFLICT ("phoneKey", purpose) DO UPDATE SET
          "codeHash" = EXCLUDED."codeHash",
          attempts = 0,
          "sentAt" = EXCLUDED."sentAt",
          "expiresAt" = EXCLUDED."expiresAt"
        WHERE "PhoneOtp"."sentAt" <= ${resendCutoff}
        RETURNING "sentAt"
      `;

      if (rows.length === 0) {
        const existing = await tx.phoneOtp.findUnique({
          where: { phoneKey_purpose: { phoneKey, purpose } },
          select: { sentAt: true },
        });
        const existingSentAt = existing?.sentAt ?? now;
        const retryAfter = Math.max(1, Math.ceil((existingSentAt.getTime() + 60_000 - now.getTime()) / 1000));
        throw new OtpThrottleException(retryAfter);
      }

      const countResult = await this.throttle.countOtpPhoneAndDay(tx, phone);
      if (!countResult.ok) {
        if (countResult.refusal === 'phone') {
          throw new OtpThrottleException(countResult.retryAfter);
        }
        if (countResult.refusal === 'day') {
          this.logger.warn('otp daily cap reached');
          throw new HttpException('Không gửi được mã. Thử lại sau', HttpStatus.SERVICE_UNAVAILABLE);
        }
      }
      countedKeys = countResult.countedKeys;
    });

    // After commit: run cleanups catching and logging their own errors without the phone.
    try {
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60_000);
      await this.prisma.phoneOtp.deleteMany({
        where: { expiresAt: { lt: oneDayAgo } },
      });
      await this.throttle.cleanupOld();
    } catch (cleanupErr) {
      this.logger.error('Cleanup failed', cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr));
    }

    // Call sender.send. On failure, delete new code and decrement counters in one transaction.
    try {
      await this.sender.send(phone, code, channel);
    } catch {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.phoneOtp.deleteMany({
            where: {
              phoneKey,
              purpose,
              codeHash,
            },
          });
          await this.throttle.decrementCounters(tx, countedKeys);
        });
      } catch (rollbackErr) {
        this.logger.error('Rollback after send failure failed', rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr));
      }
      throw new HttpException('Không gửi được mã. Thử lại sau', HttpStatus.SERVICE_UNAVAILABLE);
    }

    return { resendAfter: 60 };
  }

  /**
   * Verifies and records attempts for an OTP code (O4).
   * Runs as a single atomic UPDATE statement outside any caller transaction.
   * Throws 400 when expired, canceled, or incorrect. Deletes code on 5th failure.
   * Returns codeHash on success.
   */
  async verifyCode(phone: string, purpose: string, code: string): Promise<string> {
    const phoneKey = keyedDigest(phone);
    const now = this.clock.now();

    const rows = await this.prisma.$queryRaw<{ codeHash: string; attempts: number }[]>`
      UPDATE "PhoneOtp"
      SET attempts = attempts + 1
      WHERE "phoneKey" = ${phoneKey}
        AND purpose = ${purpose}
        AND attempts < 5
        AND "expiresAt" > ${now}
      RETURNING "codeHash", attempts
    `;

    if (rows.length === 0) {
      throw new HttpException('Mã đã hết hạn. Hãy xin mã mới', HttpStatus.BAD_REQUEST);
    }

    const { codeHash, attempts } = rows[0];
    const expectedHash = hashOtpCode(phone, code);
    const expectedBuf = Buffer.from(expectedHash, 'hex');
    const actualBuf = Buffer.from(codeHash, 'hex');
    const match = expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);

    if (!match) {
      if (attempts >= 5) {
        await this.prisma.phoneOtp.deleteMany({
          where: { phoneKey, purpose },
        });
      }
      throw new HttpException('Mã không đúng', HttpStatus.BAD_REQUEST);
    }

    return codeHash;
  }

  /**
   * Deletes a verified code within the caller's transaction (O6).
   * Rolls back with caller's transaction on failure, keeping the code usable.
   */
  async deleteCode(tx: DbClient, phone: string, purpose: string, codeHash: string): Promise<void> {
    const phoneKey = keyedDigest(phone);
    const deleted = await tx.phoneOtp.deleteMany({
      where: {
        phoneKey,
        purpose,
        codeHash,
      },
    });

    if (deleted.count === 0) {
      throw new HttpException('Mã đã hết hạn. Hãy xin mã mới', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Verifies and consumes an OTP code (O4, O6).
   */
  async consume(tx: DbClient, phone: string, purpose: string, code: string): Promise<void> {
    const codeHash = await this.verifyCode(phone, purpose, code);
    await this.deleteCode(tx, phone, purpose, codeHash);
  }
}
