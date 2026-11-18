import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  type BookingView,
  CALL_OWNER_MESSAGE,
  confirmDeadline,
  type CreateBookingRequest,
  isLongEnough,
  isOnGrid,
  type MyBookingView,
  USER_CANCEL_WINDOW_MS,
  userCancelDecision,
} from '@monsport/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { Clock } from '../database/clock.js';
import { PrismaService, retryOnDeadlock } from '../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  assertOpen,
  BUSY,
  cancelUnderLock,
  expireBookings,
  findCourt,
  finishPastMatches,
  insertUnderLock,
  NOT_CANCELLABLE,
} from './booking-sync.js';
import { toMyView, toView } from './booking-views.js';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly notifications?: NotificationsService,
  ) {}

  async request(userId: string, input: CreateBookingRequest): Promise<BookingView> {
    const now = this.clock.now();
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (!isOnGrid(startAt) || !isOnGrid(endAt)) throw new BadRequestException('Giờ phải theo bước 30 phút');
    if (!isLongEnough(startAt, endAt)) throw new BadRequestException('Mỗi booking dài ít nhất 1 giờ');
    assertOpen(await findCourt(this.prisma, input.courtId), startAt, endAt);

    const deadline = confirmDeadline(now, startAt);
    if (deadline < now) throw new BadRequestException('Đã quá hạn đặt trong app. Hãy gọi chủ sân');

    const booking = await insertUnderLock(this.prisma, this.notifications, input.courtId, startAt, endAt, now, null, {
      status: 'PENDING',
      source: 'APP',
      createdById: userId,
      confirmDeadline: deadline,
    });
    return toView(booking);
  }

  async cancelOwn(userId: string, bookingId: string): Promise<MyBookingView> {
    const now = this.clock.now();
    const { count, booking } = await cancelUnderLock(
      this.prisma,
      this.notifications,
      bookingId,
      now,
      (b) => b.createdById === userId && b.source === 'APP',
      {
        createdById: userId,
        source: 'APP',
        startAt: { gt: now },
        OR: [{ status: 'PENDING' }, { status: 'CONFIRMED', startAt: { gte: new Date(now.getTime() + USER_CANCEL_WINDOW_MS) } }],
      },
    );
    if (count === 0) {
      throw new ConflictException(userCancelDecision(booking, now) === 'CALL_OWNER' ? CALL_OWNER_MESSAGE : NOT_CANCELLABLE);
    }
    return toMyView(booking);
  }

  async mine(userId: string): Promise<MyBookingView[]> {
    const syncMine = async () => {
      const now = this.clock.now();
      await expireBookings(this.prisma, Prisma.sql`"createdById" = ${userId}::uuid`, now);
      await finishPastMatches(this.prisma, Prisma.sql`b."createdById" = ${userId}::uuid`, now);
    };
    await retryOnDeadlock(syncMine, BUSY);
    const rows = await this.prisma.booking.findMany({
      where: { createdById: userId },
      include: { court: { include: { venue: true } }, match: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toMyView);
  }
}
