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

export function otpDerivedKey(): Buffer {
  return createHmac('sha256', secret()).update('otp').digest();
}

export function hashOtpCode(phone: string, code: string): string {
  return createHmac('sha256', otpDerivedKey()).update(`${phone}:${code}`).digest('hex');
}

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

  async issue(phone: string, purpose: string, channel: 'sms' | 'zalo' = 'sms'): Promise<{ resendAfter: number }> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = hashOtpCode(phone, code);
    const phoneKey = keyedDigest(phone);
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + 5 * 60_000);
    const resendCutoff = new Date(now.getTime() - 60_000);

    let countedKeys: string[] = [];

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

    try {
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60_000);
      await this.prisma.phoneOtp.deleteMany({
        where: { expiresAt: { lt: oneDayAgo } },
      });
      await this.throttle.cleanupOld();
    } catch (cleanupErr) {
      this.logger.error('Cleanup failed', cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr));
    }

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
          where: { phoneKey, purpose, codeHash },
        });
      }
      throw new HttpException('Mã không đúng', HttpStatus.BAD_REQUEST);
    }

    return codeHash;
  }

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

  async consume(tx: DbClient, phone: string, purpose: string, code: string): Promise<void> {
    const codeHash = await this.verifyCode(phone, purpose, code);
    await this.deleteCode(tx, phone, purpose, codeHash);
  }
}
