import { randomBytes } from 'node:crypto';
import { ConflictException, HttpException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import type { PushSubscribeRequest } from '@monsport/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { Clock } from '../database/clock.js';
import { isDeadlock, PrismaService } from '../database/prisma.service.js';

export const MAX_SUBSCRIPTIONS = 5;
const BUSY = 'Yêu cầu đang được xử lý, hãy thử lại';
const ATTEMPTS = 3;

class OwnerChanged extends Error {}

let lastMs = 0;
let sequence = 0;

function uuidV7(): string {
  let ms = Date.now();
  if (ms <= lastMs) {
    sequence++;
    if (sequence > 0xfff) {
      lastMs++;
      sequence = 0;
    }
    ms = lastMs;
  } else {
    lastMs = ms;
    sequence = 0;
  }
  const bytes = randomBytes(16);
  bytes.writeUIntBE(ms, 0, 6);
  bytes[6] = 0x70 | (sequence >> 8);
  bytes[7] = sequence & 0xff;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async subscribe(userId: string, input: PushSubscribeRequest): Promise<boolean> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.save(userId, input);
      } catch (error) {
        const again = error instanceof OwnerChanged || isDeadlock(error);
        if (again && attempt < ATTEMPTS) continue;
        throw this.safe(error, again);
      }
    }
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    try {
      await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
    } catch (error) {
      throw this.safe(error, false);
    }
  }

  private save(userId: string, input: PushSubscribeRequest): Promise<boolean> {
    const now = this.clock.now();
    const { endpoint, keys } = input;
    return this.prisma.$transaction(async (tx) => {
      const owner = await this.ownerOf(tx, endpoint);
      const wanted = [...new Set([userId, ...(owner ? [owner] : [])])].sort();
      const ids = Prisma.join(wanted.map((id) => Prisma.sql`${id}::uuid`));
      await tx.$executeRaw`SELECT 1 FROM "User" WHERE "id" IN (${ids}) ORDER BY "id" FOR NO KEY UPDATE`;
      const after = await this.ownerOf(tx, endpoint);
      if (after !== null && !wanted.includes(after)) throw new OwnerChanged();

      const rows = await tx.$queryRaw<{ created: boolean }[]>`
        INSERT INTO "PushSubscription" ("id", "userId", "endpoint", "p256dh", "auth", "createdAt")
        VALUES (${uuidV7()}::uuid, ${userId}::uuid, ${endpoint}, ${keys.p256dh}, ${keys.auth}, ${now}::timestamptz)
        ON CONFLICT ("endpoint") DO UPDATE SET
          "userId" = EXCLUDED."userId",
          "p256dh" = EXCLUDED."p256dh",
          "auth" = EXCLUDED."auth",
          "createdAt" = CASE WHEN "PushSubscription"."userId" <> EXCLUDED."userId" THEN EXCLUDED."createdAt" ELSE "PushSubscription"."createdAt" END
        RETURNING (xmax = 0) AS created`;

      const excess = await tx.pushSubscription.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: MAX_SUBSCRIPTIONS,
        select: { id: true },
      });
      if (excess.length > 0) await tx.pushSubscription.deleteMany({ where: { id: { in: excess.map((row) => row.id) } } });
      return rows[0]?.created === true;
    });
  }

  private async ownerOf(tx: Prisma.TransactionClient, endpoint: string): Promise<string | null> {
    const row = await tx.pushSubscription.findUnique({ where: { endpoint }, select: { userId: true } });
    return row?.userId ?? null;
  }

  private safe(error: unknown, busy: boolean): HttpException {
    if (error instanceof HttpException) return error;
    if (busy) return new ConflictException(BUSY);
    const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : 'unknown';
    this.logger.error(`Push subscription write failed (code ${code})`);
    return new InternalServerErrorException();
  }
}
