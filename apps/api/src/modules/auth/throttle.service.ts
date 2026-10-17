import { Injectable } from '@nestjs/common';
import { isIP } from 'node:net';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { keyedDigest } from './session.js';

// Brief F-006, BR-30. Each counter is a fixed window that its first attempt opens.
export const LIMITS = {
  'login-phone': { max: 10, windowMs: 15 * 60_000 },
  'login-ip': { max: 30, windowMs: 15 * 60_000 },
  'register-ip': { max: 20, windowMs: 60 * 60_000 },
} as const;
type Counter = keyof typeof LIMITS;

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
  async login(phone: string, ip: string | undefined): Promise<number | null> {
    return (await this.hit('login-ip', ipBucket(ip))) ?? (await this.hit('login-phone', phone));
  }

  /** A correct password clears the phone counter, so it counts failures in a row. The IP counter stays. */
  async loginSucceeded(phone: string): Promise<void> {
    await this.prisma.authThrottle.deleteMany({ where: { key: this.key('login-phone', phone) } });
  }

  /** Counts a sign-up attempt by IP before the argon2 hash. Returns the seconds to wait, or null. */
  register(ip: string | undefined): Promise<number | null> {
    return this.hit('register-ip', ipBucket(ip));
  }

  private key(counter: Counter, value: string): string {
    return `${counter}:${keyedDigest(value)}`;
  }

  /**
   * One atomic upsert adds the attempt, so both Cloud Run instances and parallel requests share one count.
   * A window that has ended starts again at 1. LEAST keeps the count inside int4 under a flood.
   */
  private async hit(counter: Counter, value: string): Promise<number | null> {
    const { max, windowMs } = LIMITS[counter];
    const now = this.clock.now();
    const ended = new Date(now.getTime() - windowMs);
    const [row] = await this.prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
      INSERT INTO "AuthThrottle" (key, count, "windowStart") VALUES (${this.key(counter, value)}, 1, ${now})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN "AuthThrottle"."windowStart" <= ${ended} THEN 1 ELSE LEAST("AuthThrottle".count + 1, 1000000) END,
        "windowStart" = CASE WHEN "AuthThrottle"."windowStart" <= ${ended} THEN ${now} ELSE "AuthThrottle"."windowStart" END
      RETURNING count, "windowStart"`;
    // A new window is a good time to drop the rows of past days, so the table keeps one day of counters.
    if (row.count === 1)
      await this.prisma.authThrottle.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - DAY_MS) } } });
    if (row.count <= max) return null;
    return Math.max(1, Math.ceil((row.windowStart.getTime() + windowMs - now.getTime()) / 1000));
  }
}
