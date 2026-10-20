import { randomBytes } from 'node:crypto';
import { ConflictException, HttpException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import type { PushSubscribeRequest } from '@monsport/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { Clock } from '../database/clock.js';
import { isDeadlock, PrismaService } from '../database/prisma.service.js';

/** Brief F-014, Assumption 3: each user keeps at most 5 devices. */
export const MAX_SUBSCRIPTIONS = 5;
const BUSY = 'Yêu cầu đang được xử lý, hãy thử lại';
const ATTEMPTS = 3;
const OWNER_LOOPS = 3;

let lastMs = 0;
let sequence = 0;

/**
 * A UUID v7 for a raw insert, as Prisma makes for `@default(uuid(7))`. It rises with each call, so the id breaks a tie
 * between two rows with the same createdAt (RFC 9562, method 1: a 12-bit counter in the first random field).
 */
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

  /**
   * Saves the device of the caller. The endpoint is unique, so a browser belongs to one user: a new caller takes the row over
   * (Assumption 2). The row of a new owner counts as new for the limit, so the limit never deletes the row that was just saved.
   * Returns true when the row is new.
   *
   * Lock order: the User rows involved, in ascending id (FOR NO KEY UPDATE), then PushSubscription rows. The caller and the
   * current owner of the endpoint are both locked, in one statement with ORDER BY id. So two users who swap devices at the
   * same moment lock in the same order and cannot deadlock. The lock serializes the writes of one user, so the limit of 5
   * holds under parallel calls. It does not conflict with the key share lock of a foreign key insert, so a booking or a
   * notification of the same user does not wait for it. This transaction takes no Venue, Court, or Booking lock.
   */
  async subscribe(userId: string, input: PushSubscribeRequest): Promise<boolean> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.save(userId, input);
      } catch (error) {
        // A deadlock or a serialization failure can run again.
        if (isDeadlock(error) && attempt < ATTEMPTS) continue;
        throw this.safe(error, isDeadlock(error));
      }
    }
  }

  /** Deletes the row of the caller only. A row of another user, or no row, gives the same result (no leak). */
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
      // Read the owner without a lock, lock the users, then read it again. The owner can change between the two reads.
      const locked = new Set<string>();
      let settled = false;
      for (let loop = 0; loop < OWNER_LOOPS && !settled; loop++) {
        const owner = await this.ownerOf(tx, endpoint);
        const wanted = [...new Set([userId, ...(owner ? [owner] : [])])].filter((id) => !locked.has(id)).sort();
        if (wanted.length > 0) {
          const ids = Prisma.join(wanted.map((id) => Prisma.sql`${id}::uuid`));
          await tx.$executeRaw`SELECT 1 FROM "User" WHERE "id" IN (${ids}) ORDER BY "id" FOR NO KEY UPDATE`;
          wanted.forEach((id) => locked.add(id));
        }
        const after = await this.ownerOf(tx, endpoint);
        settled = after === null || locked.has(after);
      }
      if (!settled) throw new ConflictException(BUSY);

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

  /**
   * A Prisma error text can hold the query arguments, which would put the endpoint and the keys of a device in the log.
   * So an unknown error becomes a 500 with no cause, and the log gets the error code only.
   */
  private safe(error: unknown, busy: boolean): HttpException {
    if (error instanceof HttpException) return error;
    if (busy) return new ConflictException(BUSY);
    const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : 'unknown';
    this.logger.error(`Push subscription write failed (code ${code})`);
    return new InternalServerErrorException();
  }
}
