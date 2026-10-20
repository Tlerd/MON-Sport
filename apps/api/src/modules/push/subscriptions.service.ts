import { ConflictException, HttpException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import type { PushSubscribeRequest } from '@monsport/shared';
import { Clock } from '../database/clock.js';
import { isDeadlock, PrismaService } from '../database/prisma.service.js';

/** Brief F-014, Assumption 3: each user keeps at most 5 devices. */
export const MAX_SUBSCRIPTIONS = 5;
const BUSY = 'Yêu cầu đang được xử lý, hãy thử lại';
const ATTEMPTS = 3;

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
   * Lock order: the User row of the caller (FOR NO KEY UPDATE), then PushSubscription rows. The lock serializes the writes of one
   * user, so the limit of 5 holds under parallel calls. It does not conflict with the key share lock of a foreign key insert, so
   * a booking or a notification of the same user does not wait for it. This transaction takes no Venue, Court, or Booking lock.
   */
  async subscribe(userId: string, input: PushSubscribeRequest): Promise<boolean> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.save(userId, input);
      } catch (error) {
        // A deadlock needs two users who swap devices at the same moment. The work can run again.
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
      await tx.$executeRaw`SELECT 1 FROM "User" WHERE "id" = ${userId}::uuid FOR NO KEY UPDATE`;
      const existing = await tx.pushSubscription.findUnique({ where: { endpoint }, select: { userId: true } });
      await tx.pushSubscription.upsert({
        where: { endpoint },
        create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, createdAt: now },
        update: { userId, p256dh: keys.p256dh, auth: keys.auth, ...(existing && existing.userId !== userId ? { createdAt: now } : {}) },
      });
      const excess = await tx.pushSubscription.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: MAX_SUBSCRIPTIONS,
        select: { id: true },
      });
      if (excess.length > 0) await tx.pushSubscription.deleteMany({ where: { id: { in: excess.map((row) => row.id) } } });
      return !existing;
    });
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
