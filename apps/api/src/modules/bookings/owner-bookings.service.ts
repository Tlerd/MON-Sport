import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ALL_WEEKS_TAKEN,
  bookingPrice,
  type BookingView,
  type CreatePhoneBookingRequest,
  isLongEnough,
  isOnGrid,
  type OwnerBookingView,
  type PaidAtVenueResponse,
  type RecurringPhoneBookingRequest,
  type RecurringPhoneBookingResponse,
} from '@monsport/shared';
import { type Booking, Prisma } from '../../generated/prisma/client.js';
import { Clock } from '../database/clock.js';
import { isDeadlock, PrismaService, retryOnDeadlock } from '../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  assertOpen,
  BUSY,
  cancelMatchOfBooking,
  cancelUnderLock,
  expireBookings,
  findCourt,
  type InsertBookingFields,
  insertUnderLock,
  lockVenueOf,
  NOT_CANCELLABLE,
  takenOnOverlap,
} from './booking-sync.js';
import { toOwnerView, toView } from './booking-views.js';
import { assertScope, matchesScope, type VenueScope } from './venue-scope.js';

@Injectable()
export class OwnerBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly notifications?: NotificationsService,
  ) {}

  async enterPhoneBooking(scope: VenueScope, creatorId: string, input: CreatePhoneBookingRequest): Promise<OwnerBookingView> {
    const now = this.clock.now();
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (!isOnGrid(startAt) || !isOnGrid(endAt)) throw new BadRequestException('Giờ phải theo bước 30 phút');
    if (!isLongEnough(startAt, endAt)) throw new BadRequestException('Mỗi booking dài ít nhất 1 giờ');
    assertOpen(assertScope(await findCourt(this.prisma, input.courtId), scope), startAt, endAt);
    if (startAt <= now) throw new BadRequestException('Giờ bắt đầu đã qua');

    const booking = await this.insertUnderLock(input.courtId, startAt, endAt, now, scope, {
      status: 'CONFIRMED',
      source: 'PHONE',
      createdById: creatorId,
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
      confirmedAt: now,
    });
    return toOwnerView({ ...booking, createdBy: null });
  }

  async enterRecurringPhoneBooking(
    scope: VenueScope,
    creatorId: string,
    input: RecurringPhoneBookingRequest,
  ): Promise<RecurringPhoneBookingResponse> {
    const now = this.clock.now();
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (!isOnGrid(startAt) || !isOnGrid(endAt)) throw new BadRequestException('Giờ phải theo bước 30 phút');
    if (!isLongEnough(startAt, endAt)) throw new BadRequestException('Mỗi booking dài ít nhất 1 giờ');
    assertOpen(assertScope(await findCourt(this.prisma, input.courtId), scope), startAt, endAt);
    if (startAt <= now) throw new BadRequestException('Giờ bắt đầu đã qua');

    return retryOnDeadlock(
      () => this.recurringTransaction(scope, creatorId, input, startAt, endAt, now).catch(takenOnOverlap),
      BUSY,
    );
  }

  private recurringTransaction(
    scope: VenueScope,
    creatorId: string,
    input: RecurringPhoneBookingRequest,
    firstStart: Date,
    firstEnd: Date,
    now: Date,
  ): Promise<RecurringPhoneBookingResponse> {
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const occurrences = Array.from({ length: input.weeks }, (_, k) => ({
      startAt: new Date(firstStart.getTime() + k * ONE_WEEK_MS),
      endAt: new Date(firstEnd.getTime() + k * ONE_WEEK_MS),
    }));

    return this.prisma.$transaction(async (tx) => {
      await lockVenueOf(tx, input.courtId, scope);
      await tx.$executeRaw`SELECT 1 FROM "Court" WHERE "id" = ${input.courtId}::uuid FOR UPDATE`;
      const court = await findCourt(tx, input.courtId);
      assertScope(court, scope);
      assertOpen(court, firstStart, firstEnd);
      await expireBookings(tx, Prisma.sql`"courtId" = ${court.id}::uuid`, now);

      const activeBookings = await tx.booking.findMany({
        where: {
          courtId: court.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startAt: { lt: occurrences[occurrences.length - 1].endAt },
          endAt: { gt: occurrences[0].startAt },
        },
      });

      const toInsert: { startAt: Date; endAt: Date }[] = [];
      const skipped: { startAt: string; endAt: string }[] = [];

      for (const occ of occurrences) {
        const overlap = activeBookings.some((b) => b.startAt < occ.endAt && b.endAt > occ.startAt);
        if (overlap) {
          skipped.push({ startAt: occ.startAt.toISOString(), endAt: occ.endAt.toISOString() });
        } else {
          toInsert.push(occ);
        }
      }

      if (toInsert.length === 0) throw new ConflictException(ALL_WEEKS_TAKEN);

      const seriesId = randomUUID();
      const createdBookings: Booking[] = [];

      for (const occ of toInsert) {
        const created = await tx.booking.create({
          data: {
            courtId: court.id,
            seriesId,
            startAt: occ.startAt,
            endAt: occ.endAt,
            status: 'CONFIRMED',
            source: 'PHONE',
            createdById: creatorId,
            customerName: input.customerName ?? null,
            customerPhone: input.customerPhone ?? null,
            priceTotal: bookingPrice(occ.startAt, occ.endAt, court.priceNormal, court.pricePeak),
            confirmedAt: now,
            createdAt: now,
          },
        });
        createdBookings.push(created);
      }

      return {
        seriesId,
        created: createdBookings.map((b) => toOwnerView({ ...b, createdBy: null })),
        skipped,
      };
    });
  }

  private insertUnderLock(
    courtId: string,
    startAt: Date,
    endAt: Date,
    now: Date,
    scope: VenueScope | null,
    fields: InsertBookingFields,
  ): Promise<Booking> {
    return insertUnderLock(this.prisma, this.notifications, courtId, startAt, endAt, now, scope, fields);
  }

  async cancelAsOwner(ownerId: string, bookingId: string): Promise<BookingView> {
    const now = this.clock.now();
    const { count, booking } = await cancelUnderLock(
      this.prisma,
      this.notifications,
      bookingId,
      now,
      (b) => b.court.venue.ownerId === ownerId,
      { status: 'CONFIRMED', startAt: { gt: now }, court: { venue: { ownerId } } },
    );
    if (count === 0) {
      throw new ConflictException(booking.status === 'PENDING' ? 'Yêu cầu đang chờ xác nhận. Hãy từ chối yêu cầu này' : NOT_CANCELLABLE);
    }
    return toView(booking);
  }

  async forOwner(scope: VenueScope, status: Booking['status']): Promise<OwnerBookingView[]> {
    const courts = scope.venueId
      ? Prisma.sql`SELECT c.id FROM "Court" c WHERE c."venueId" = ${scope.venueId}::uuid`
      : Prisma.sql`SELECT c.id FROM "Court" c JOIN "Venue" v ON v.id = c."venueId" WHERE v."ownerId" = ${scope.ownerId}::uuid`;
    const expireAll = () => expireBookings(this.prisma, Prisma.sql`"courtId" IN (${courts})`, this.clock.now());
    await retryOnDeadlock(expireAll, BUSY);
    const where = scope.venueId
      ? { status, court: { venueId: scope.venueId } }
      : { status, court: { venue: { ownerId: scope.ownerId } } };
    const rows = await this.prisma.booking.findMany({ where, include: { createdBy: true }, orderBy: { startAt: 'asc' } });
    return rows.map(toOwnerView);
  }

  async decide(scope: VenueScope, bookingId: string, decision: 'CONFIRMED' | 'REJECTED'): Promise<BookingView> {
    const found = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { courtId: true } });
    if (!found) throw new NotFoundException('Không tìm thấy booking');
    const now = this.clock.now();
    let outcome: { count: number; booking: Booking & { court: { venue: { id: string; ownerId: string } } } };
    try {
      outcome = await this.prisma.$transaction(async (tx) => {
        await lockVenueOf(tx, found.courtId);
        await tx.$executeRaw`SELECT 1 FROM "Court" WHERE "id" = ${found.courtId}::uuid FOR UPDATE`;
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { court: { include: { venue: true } } } });
        if (!matchesScope(booking.court.venue, scope)) throw new ForbiddenException('Bạn không có quyền làm việc này');
        await expireBookings(tx, Prisma.sql`id = ${bookingId}::uuid`, now);
        const result = await tx.booking.updateMany({
          where: { id: bookingId, status: 'PENDING', confirmDeadline: { gte: now } },
          data: decision === 'CONFIRMED' ? { status: 'CONFIRMED', confirmedAt: now } : { status: 'REJECTED' },
        });
        if (result.count > 0) {
          if (decision === 'CONFIRMED') {
            await this.notifications?.createNotification(tx, { userId: booking.createdById, type: 'BOOKING_CONFIRMED', bookingId });
          } else {
            await this.notifications?.createNotification(tx, { userId: booking.createdById, type: 'BOOKING_REJECTED', bookingId });
            await cancelMatchOfBooking(tx, this.notifications, bookingId);
          }
        }
        return { count: result.count, booking: await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { court: { include: { venue: true } } } }) };
      });
    } catch (error) {
      if (isDeadlock(error)) throw new ConflictException(BUSY);
      throw error;
    }
    if (outcome.count === 0) {
      throw new ConflictException(outcome.booking.status === 'EXPIRED' ? 'Yêu cầu đã hết hạn' : 'Yêu cầu không còn chờ xác nhận');
    }
    return toView(outcome.booking);
  }

  async markPaidAtVenue(ownerId: string, bookingId: string, paidAtVenue: boolean): Promise<PaidAtVenueResponse> {
    const found = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { courtId: true, court: { select: { venue: { select: { ownerId: true } } } } },
    });
    if (!found || found.court.venue.ownerId !== ownerId) throw new NotFoundException('Không tìm thấy booking');

    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockVenueOf(tx, found.courtId);
        await tx.$executeRaw`SELECT 1 FROM "Court" WHERE "id" = ${found.courtId}::uuid FOR UPDATE`;
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { court: { include: { venue: true } } } });
        if (booking.court.venue.ownerId !== ownerId) throw new NotFoundException('Không tìm thấy booking');
        if (booking.status !== 'CONFIRMED') throw new BadRequestException('Chỉ đánh dấu thu tiền cho booking đã xác nhận');
        const updated = await tx.booking.updateMany({ where: { id: bookingId, status: 'CONFIRMED' }, data: { paidAtVenue } });
        if (updated.count === 0) throw new BadRequestException('Chỉ đánh dấu thu tiền cho booking đã xác nhận');
        return { id: bookingId, paidAtVenue };
      });
    } catch (error) {
      if (isDeadlock(error)) throw new ConflictException(BUSY);
      throw error;
    }
  }
}
