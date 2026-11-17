import { Injectable } from '@nestjs/common';
import { isIP } from 'node:net';
import { vnDateString } from '@monsport/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { keyedDigest } from './session.js';

// Brief F-006, BR-30 and F-004, O5. Each counter is a fixed window that its first attempt opens.
export const LIMITS = {
  'login-phone': { max: 10, windowMs: 15 * 60_000 },
  'login-ip': { max: 30, windowMs: 15 * 60_000 },
  'register-ip': { max: 20, windowMs: 60 * 60_000 },
  'otp-ip': { max: 10, windowMs: 60 * 60_000 },
  'otp-sub': { max: 5, windowMs: 60 * 60_000 },
  'otp-phone': { max: 5, windowMs: 60 * 60_000 },
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

/**
 * The counter key of a client address: an IPv4 address as it is (also when IPv6 maps it),
 * and an IPv6 address by its /64 block, because one subscriber usually gets a whole /64.
 */
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

  /**
   * Counts a login attempt by IP, then by phone, before the password check, so a blocked attempt runs no argon2.
   * Returns the seconds to wait when a limit is passed, else null. F-004 `link-start` calls this too.
   */
  async consumeLogin(phone: string, ip: string | undefined): Promise<number | null> {
    const retryAfter = (await this.hit('login-ip', ipBucket(ip))) ?? (await this.hit('login-phone', phone));
    await this.cleanupOld();
    return retryAfter;
  }

  /**
   * BR-58, brief F-037 step 3: counts an MCP tool call per user, and a write call also in the write counter.
   * A refused call still counts. Returns true when every counter is within its limit.
   */
  async consumeMcpCall(userId: string, write: boolean): Promise<boolean> {
    const callRefused = await this.hit('mcp-call', userId);
    const writeRefused = write ? await this.hit('mcp-write', userId) : null;
    await this.cleanupOld();
    return callRefused === null && writeRefused === null;
  }

  /** Brief F-038: counts an OAuth request by IP before any fetch or read. Returns true when it is within the limit. */
  async consumeOAuth(counter: 'oauth-authorize-ip' | 'oauth-token-ip', ip: string | undefined): Promise<boolean> {
    const refused = await this.hit(counter, ipBucket(ip));
    await this.cleanupOld();
    return refused === null;
  }

  /** A correct password clears the phone counter, so it counts failures in a row. The IP counter stays. */
  async loginSucceeded(phone: string): Promise<void> {
    await this.prisma.authThrottle.deleteMany({ where: { key: this.key('login-phone', phone) } });
  }

  /** Counts a sign-up attempt by IP before the argon2 hash. Returns the seconds to wait, or null. */
  async consumeRegister(ip: string | undefined): Promise<number | null> {
    const retryAfter = await this.hit('register-ip', ipBucket(ip));
    await this.cleanupOld();
    return retryAfter;
  }

  /**
   * Brief F-004, O5: Rate limit check before sending OTP request.
   * Counts otp-ip then otp-sub. Returns retryAfter seconds or null.
   */
  async consumeOtpRequest(ip: string | undefined, sub: string): Promise<number | null> {
    const retryAfter = (await this.hit('otp-ip', ipBucket(ip))) ?? (await this.hit('otp-sub', sub));
    await this.cleanupOld();
    return retryAfter;
  }

  /**
   * Reads otp-ip and otp-sub without counting. Returns the seconds to wait when either is at its limit, else null.
   * /google/complete calls it on every request, so a blocked caller gets 429 for every phone (no existence oracle).
   */
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

  /**
   * Brief F-004, O5: Inside a transaction, counts otp-phone then the daily counter otp-day:<yyyy-mm-dd>.
   * Daily max comes from OTP_DAILY_CAP (default 200). Returns which keys were counted.
   */
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

  /**
   * Brief F-004, O8 and BR-48: Takes 1 off given keys, never below 0.
   */
  async decrementCounters(tx: Prisma.TransactionClient, keys: string[]): Promise<void> {
    for (const key of keys) {
      await tx.$executeRaw`
        UPDATE "AuthThrottle"
        SET count = GREATEST(count - 1, 0)
        WHERE key = ${key}
      `;
    }
  }

  /** Drops counter rows older than 24 hours. Callers run this after committing their hit. */
  async cleanupOld(client: DbClient = this.prisma): Promise<void> {
    const now = this.clock.now();
    await client.authThrottle.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - DAY_MS) } } });
  }

  private key(counter: Counter, value: string): string {
    return `${counter}:${keyedDigest(value)}`;
  }

  /**
   * One atomic upsert adds the attempt, so both Cloud Run instances and parallel requests share one count.
   * A window that has ended starts again at 1. LEAST keeps the count inside int4 under a flood.
   */
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
