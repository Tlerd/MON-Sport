import { Injectable } from '@nestjs/common';
import { isIP } from 'node:net';
import { vnDateString } from '@monsport/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { keyedDigest } from './session.js';

export const LIMITS = {
  'login-phone': { max: 10, windowMs: 15 * 60_000 },
  'login-ip': { max: 30, windowMs: 15 * 60_000 },
  'register-ip': { max: 20, windowMs: 60 * 60_000 },
  'otp-ip': { max: 10, windowMs: 60 * 60_000 },
  'otp-sub': { max: 5, windowMs: 60 * 60_000 },
  'otp-phone': { max: 5, windowMs: 60 * 60_000 },
  'complete-ip': { max: 30, windowMs: 15 * 60_000 },
  'complete-sub': { max: 25, windowMs: 60 * 60_000 },
  'mcp-call': { max: 60, windowMs: 60_000 },
  'mcp-write': { max: 10, windowMs: 60_000 },
  'oauth-authorize-ip': { max: 60, windowMs: 60_000 },
  'oauth-token-ip': { max: 60, windowMs: 60_000 },
} as const;
type Counter = keyof typeof LIMITS;

type DbClient = PrismaService | Prisma.TransactionClient;

export type OtpCountResult =
  | { ok: true; countedKeys: string[] }
  | { ok: false; refusal: 'phone'; retryAfter: number }
  | { ok: false; refusal: 'day' };

const DAY_MS = 24 * 60 * 60_000;

export function ipBucket(ip: string | undefined): string {
  if (!ip) return 'unknown';
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  const address = ip.split('%')[0];
  if (isIP(address) !== 6) return address;
  const [head, tail] = address.split('::');
  const groups = (part: string | undefined) => (part ? part.split(':') : []);
  const width = (part: string[]) => part.reduce((n, g) => n + (g.includes('.') ? 2 : 1), 0);
  const all = tail === undefined ? groups(head) : [...groups(head), ...Array<string>(8 - width(groups(head)) - width(groups(tail))).fill('0'), ...groups(tail)];
  return `${all.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(':')}::/64`;
}

@Injectable()
export class ThrottleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async consumeLogin(phone: string, ip: string | undefined): Promise<number | null> {
    const retryAfter = (await this.hit('login-ip', ipBucket(ip))) ?? (await this.hit('login-phone', phone));
    await this.cleanupOld();
    return retryAfter;
  }

  async consumeMcpCall(userId: string, write: boolean): Promise<boolean> {
    const callRefused = await this.hit('mcp-call', userId);
    const writeRefused = write ? await this.hit('mcp-write', userId) : null;
    await this.cleanupOld();
    return callRefused === null && writeRefused === null;
  }

  async consumeOAuth(counter: 'oauth-authorize-ip' | 'oauth-token-ip', ip: string | undefined): Promise<boolean> {
    const refused = await this.hit(counter, ipBucket(ip));
    await this.cleanupOld();
    return refused === null;
  }

  async loginSucceeded(phone: string): Promise<void> {
    await this.prisma.authThrottle.deleteMany({ where: { key: this.key('login-phone', phone) } });
  }

  async consumeRegister(ip: string | undefined): Promise<number | null> {
    const retryAfter = await this.hit('register-ip', ipBucket(ip));
    await this.cleanupOld();
    return retryAfter;
  }

  async consumeOtpRequest(ip: string | undefined, sub: string): Promise<number | null> {
    const retryAfter = (await this.hit('otp-ip', ipBucket(ip))) ?? (await this.hit('otp-sub', sub));
    await this.cleanupOld();
    return retryAfter;
  }

  async consumeGoogleComplete(ip: string | undefined, sub: string): Promise<number | null> {
    const retryAfter = (await this.hit('complete-ip', ipBucket(ip))) ?? (await this.hit('complete-sub', sub));
    await this.cleanupOld();
    return retryAfter;
  }

  async otpRequestBlocked(ip: string | undefined, sub: string): Promise<number | null> {
    const now = this.clock.now();
    for (const [counter, value] of [['otp-ip', ipBucket(ip)], ['otp-sub', sub]] as const) {
      const { max, windowMs } = LIMITS[counter];
      const row = await this.prisma.authThrottle.findUnique({ where: { key: this.key(counter, value) } });
      if (row && row.windowStart.getTime() + windowMs > now.getTime() && row.count >= max)
        return Math.max(1, Math.ceil((row.windowStart.getTime() + windowMs - now.getTime()) / 1000));
    }
    return null;
  }

  async countOtpPhoneAndDay(tx: Prisma.TransactionClient, phone: string): Promise<OtpCountResult> {
    const phoneRetryAfter = await this.hit('otp-phone', phone, tx);
    const phoneKey = this.key('otp-phone', phone);
    if (phoneRetryAfter !== null) {
      return { ok: false, refusal: 'phone', retryAfter: phoneRetryAfter };
    }

    const now = this.clock.now();
    const dayKey = `otp-day:${vnDateString(now)}`;
    const dailyCap = Number(process.env.OTP_DAILY_CAP || '200') || 200;

    const [dayRow] = await tx.$queryRaw<{ count: number }[]>`
      INSERT INTO "AuthThrottle" (key, count, "windowStart") VALUES (${dayKey}, 1, ${now})
      ON CONFLICT (key) DO UPDATE SET
        count = LEAST("AuthThrottle".count + 1, 1000000)
      RETURNING count`;

    if (dayRow.count > dailyCap) {
      return { ok: false, refusal: 'day' };
    }

    return { ok: true, countedKeys: [phoneKey, dayKey] };
  }

  async decrementCounters(tx: Prisma.TransactionClient, keys: string[]): Promise<void> {
    for (const key of keys) {
      await tx.$executeRaw`
        UPDATE "AuthThrottle"
        SET count = GREATEST(count - 1, 0)
        WHERE key = ${key}
      `;
    }
  }

  async cleanupOld(client: DbClient = this.prisma): Promise<void> {
    const now = this.clock.now();
    await client.authThrottle.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - DAY_MS) } } });
  }

  private key(counter: Counter, value: string): string {
    return `${counter}:${keyedDigest(value)}`;
  }

  private async hit(
    counter: Counter,
    value: string,
    client: DbClient = this.prisma,
    maxOverride?: number,
  ): Promise<number | null> {
    const { max: defaultMax, windowMs } = LIMITS[counter];
    const max = maxOverride ?? defaultMax;
    const now = this.clock.now();
    const cutoff = new Date(now.getTime() - windowMs);
    const [row] = await client.$queryRaw<{ count: number; windowStart: Date }[]>`
      INSERT INTO "AuthThrottle" (key, count, "windowStart") VALUES (${this.key(counter, value)}, 1, ${now})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN "AuthThrottle"."windowStart" <= ${cutoff} THEN 1 ELSE LEAST("AuthThrottle".count + 1, 1000000) END,
        "windowStart" = CASE WHEN "AuthThrottle"."windowStart" <= ${cutoff} THEN ${now} ELSE "AuthThrottle"."windowStart" END
      RETURNING count, "windowStart"`;
    if (row.count <= max) return null;
    return Math.max(1, Math.ceil((row.windowStart.getTime() + windowMs - now.getTime()) / 1000));
  }
}
