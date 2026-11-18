import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { bookingPrice, minuteOfDayVN } from '@monsport/shared';
import { type Booking, Prisma } from '../../generated/prisma/client.js';
import { conflictOnDeadlock, isExclusionViolation, type PrismaService, retryOnDeadlock } from '../database/prisma.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { BookingWithVenue } from './booking-views.js';
import { assertScope, matchesScope, type VenueScope } from './venue-scope.js';

export const TAKEN = 'Khung giờ này vừa có người đặt';
export const BUSY = 'Yêu cầu đang được xử lý, hãy thử lại';
export const NOT_CANCELLABLE = 'Booking này không hủy được nữa';

export type InsertBookingFields = Pick<
  Prisma.BookingUncheckedCreateInput,
  'status' | 'source' | 'createdById' | 'customerName' | 'customerPhone' | 'confirmDeadline' | 'confirmedAt'
>;

export function assertOpen(court: { venue: { opensAt: number; closesAt: number } }, startAt: Date, endAt: Date): void {
  const startMinute = minuteOfDayVN(startAt);
  const endMinute = startMinute + (endAt.getTime() - startAt.getTime()) / 60_000;
  if (startMinute < court.venue.opensAt || endMinute > court.venue.closesAt) throw new BadRequestException('Ngoài giờ mở cửa');
}

export async function findCourt(db: Pick<PrismaService, 'court'>, courtId: string) {
  const court = await db.court.findUnique({ where: { id: courtId }, include: { venue: true } });
  if (!court) throw new NotFoundException('Không tìm thấy sân');
  return court;
}

export async function insertUnderLock(
  prisma: PrismaService,
  notifications: NotificationsService | undefined,
  courtId: string,
  startAt: Date,
  endAt: Date,
  now: Date,
  scope: VenueScope | null,
  fields: InsertBookingFields,
): Promise<Booking> {
  return retryOnDeadlock(
    () => insertTransaction(prisma, notifications, courtId, startAt, endAt, now, scope, fields).catch(takenOnOverlap),
    BUSY,
  );
}

export function takenOnOverlap(error: unknown): never {
  if (isExclusionViolation(error)) throw new ConflictException(TAKEN);
  throw error;
}

function insertTransaction(
  prisma: PrismaService,
  notifications: NotificationsService | undefined,
  courtId: string,
  startAt: Date,
  endAt: Date,
  now: Date,
  scope: VenueScope | null,
  fields: InsertBookingFields,
): Promise<Booking> {
  return prisma.$transaction(async (tx) => {
    if (scope) await lockVenueOf(tx, courtId, scope);
    await tx.$executeRaw`SELECT 1 FROM "Court" WHERE "id" = ${courtId}::uuid FOR UPDATE`;
    const court = await findCourt(tx, courtId);
    if (scope) assertScope(court, scope);
    assertOpen(court, startAt, endAt);
    await expireBookings(tx, Prisma.sql`"courtId" = ${court.id}::uuid`, now);
    const created = await tx.booking.create({
      data: {
        ...fields,
        courtId: court.id,
        startAt,
        endAt,
        priceTotal: bookingPrice(startAt, endAt, court.priceNormal, court.pricePeak),
        createdAt: now,
      },
    });
    if (created.source === 'APP') {
      await notifications?.createNotification(tx, {
        userId: court.venue.ownerId,
        type: 'BOOKING_REQUESTED',
        bookingId: created.id,
      });
    }
    return created;
  });
}

export async function cancelMatchOfBooking(
  tx: Prisma.TransactionClient,
  notifications: NotificationsService | undefined,
  bookingId: string,
): Promise<void> {
  const match = await tx.match.findUnique({
    where: { bookingId },
    include: { players: { where: { status: 'ACTIVE' } } },
  });
  if (match && (match.status === 'OPEN' || match.status === 'FULL')) {
    await tx.match.update({ where: { id: match.id }, data: { status: 'CANCELLED' } });
    for (const player of match.players) {
      await notifications?.createNotification(tx, {
        userId: player.userId,
        type: 'MATCH_CANCELLED',
        bookingId,
        matchId: match.id,
      });
    }
  }
}

export async function cancelUnderLock(
  prisma: PrismaService,
  notifications: NotificationsService | undefined,
  bookingId: string,
  now: Date,
  visible: (booking: BookingWithVenue) => boolean,
  condition: Prisma.BookingWhereInput,
): Promise<{ count: number; booking: BookingWithVenue }> {
  const found = await prisma.booking.findUnique({ where: { id: bookingId }, select: { courtId: true } });
  if (!found) throw new NotFoundException('Không tìm thấy booking');
  const include = { court: { include: { venue: true } }, match: true } as const;
  return conflictOnDeadlock(
    () =>
      prisma.$transaction(async (tx) => {
        await lockVenueOf(tx, found.courtId);
        await tx.$executeRaw`SELECT 1 FROM "Court" WHERE "id" = ${found.courtId}::uuid FOR UPDATE`;
        const before = await tx.booking.findUnique({ where: { id: bookingId }, include });
        if (!before || !visible(before)) throw new NotFoundException('Không tìm thấy booking');
        await expireBookings(tx, Prisma.sql`id = ${bookingId}::uuid`, now);
        const result = await tx.booking.updateMany({
          where: { id: bookingId, ...condition },
          data: { status: 'CANCELLED', cancelledAt: now },
        });
        if (result.count > 0) await cancelMatchOfBooking(tx, notifications, bookingId);
        return { count: result.count, booking: await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include }) };
      }),
    BUSY,
  );
}

export async function lockVenueOf(tx: Pick<PrismaService, 'court' | 'venue' | '$queryRaw'>, courtId: string, scope?: VenueScope): Promise<void> {
  const court = await tx.court.findUnique({ where: { id: courtId }, select: { venueId: true } });
  if (!court) throw new NotFoundException('Không tìm thấy sân');
  await tx.$queryRaw`SELECT id FROM "Venue" WHERE id = ${court.venueId}::uuid FOR SHARE`;
  if (!scope) return;
  const venue = await tx.venue.findUnique({ where: { id: court.venueId }, select: { id: true, ownerId: true } });
  if (!venue || !matchesScope(venue, scope)) throw new NotFoundException('Không tìm thấy sân');
}

export async function expireBookings(db: Pick<PrismaService, '$executeRaw'>, scope: Prisma.Sql, now: Date): Promise<void> {
  await db.$executeRaw`
    WITH expired AS (
      UPDATE "Booking" SET status = 'EXPIRED'
      WHERE id IN (
        SELECT id FROM "Booking" WHERE ${scope} AND status = 'PENDING' AND "confirmDeadline" < ${now}
        ORDER BY id FOR UPDATE
      )
      RETURNING id
    )
    UPDATE "Match" SET status = 'CANCELLED'
    WHERE id IN (
      SELECT m.id FROM "Match" m
      WHERE m."bookingId" IN (SELECT id FROM expired) AND m.status IN ('OPEN', 'FULL')
      ORDER BY m.id FOR UPDATE
    )`;
}

export async function finishPastMatches(db: Pick<PrismaService, '$executeRaw'>, scope: Prisma.Sql, now: Date): Promise<void> {
  await db.$executeRaw`
    UPDATE "Match" SET status = 'FINISHED'
    WHERE id IN (
      SELECT m.id FROM "Match" m
      JOIN "Booking" b ON b.id = m."bookingId"
      WHERE ${scope} AND b.status = 'CONFIRMED' AND b."endAt" <= ${now} AND m.status IN ('OPEN', 'FULL')
      ORDER BY m.id FOR UPDATE
    )`;
}
