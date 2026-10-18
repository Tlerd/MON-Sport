import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  bookingPrice,
  type BookingView,
  CALL_OWNER_MESSAGE,
  confirmDeadline,
  type CreateBookingRequest,
  type CreatePhoneBookingRequest,
  isLongEnough,
  isOnGrid,
  minuteOfDayVN,
  type MyBookingView,
  type OwnerBookingView,
  type PaidAtVenueResponse,
  USER_CANCEL_WINDOW_MS,
  userCancelDecision,
} from '@monsport/shared';
import { type Booking, Prisma } from '../../generated/prisma/client.js';
import { Clock } from '../database/clock.js';
import { isDeadlock, isExclusionViolation, PrismaService } from '../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

const TAKEN = 'Khung giờ này vừa có người đặt';
const BUSY = 'Yêu cầu đang được xử lý, hãy thử lại'; // 40P01 is a 409, not a 500
const NOT_CANCELLABLE = 'Booking này không hủy được nữa';
const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toView(b: Booking): BookingView {
  return {
    id: b.id,
    courtId: b.courtId,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    status: b.status,
    source: b.source,
    priceTotal: b.priceTotal,
    confirmDeadline: iso(b.confirmDeadline),
    confirmedAt: iso(b.confirmedAt),
    cancelledAt: iso(b.cancelledAt),
    createdAt: b.createdAt.toISOString(),
  };
}

type BookingWithVenue = Prisma.BookingGetPayload<{ include: { court: { include: { venue: true } }; match: true } }>;

function toMyView(b: BookingWithVenue): MyBookingView {
  const match = b.match
    ? {
        id: b.match.id,
        status: b.match.status,
        capacity: b.match.capacity,
        joinedCount: b.match.joinedCount,
        pricePerSlot: b.match.pricePerSlot,
      }
    : null;
  return { ...toView(b), courtName: b.court.name, venueName: b.court.venue.name, venuePhone: b.court.venue.phone, sport: b.court.sport, match };
}

/**
 * BR-20: the owner of the booking's venue sees the customer. A phone booking keeps its own name and phone;
 * an app booking shows the account that made it.
 */
function toOwnerView(b: Booking & { createdBy: { name: string; phone: string } | null }): OwnerBookingView {
  const customer = b.source === 'PHONE' || !b.createdBy
    ? { name: b.customerName ?? '', phone: b.customerPhone }
    : { name: b.createdBy.name, phone: b.createdBy.phone };
  return { ...toView(b), paidAtVenue: b.paidAtVenue, customer };
}

/** A booking stays on one day inside the opening hours. 23:00-24:00 ends on minute 1440. */
function assertOpen(court: { venue: { opensAt: number; closesAt: number } }, startAt: Date, endAt: Date): void {
  const startMinute = minuteOfDayVN(startAt);
  const endMinute = startMinute + (endAt.getTime() - startAt.getTime()) / 60_000;
  if (startMinute < court.venue.opensAt || endMinute > court.venue.closesAt) throw new BadRequestException('Ngoài giờ mở cửa');
}

/** BR-23: a court of another owner answers as if it did not exist. */
function assertOwner<T extends { venue: { ownerId: string } }>(court: T, ownerId: string): T {
  if (court.venue.ownerId !== ownerId) throw new NotFoundException('Không tìm thấy sân');
  return court;
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly notifications?: NotificationsService,
  ) {}

  /** UC-3: a user asks for a time slot on a court. */
  async request(userId: string, input: CreateBookingRequest): Promise<BookingView> {
    const now = this.clock.now();
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (!isOnGrid(startAt) || !isOnGrid(endAt)) throw new BadRequestException('Giờ phải theo bước 30 phút'); // BR-2
    if (!isLongEnough(startAt, endAt)) throw new BadRequestException('Mỗi booking dài ít nhất 1 giờ'); // BR-3
    // A first check without the lock keeps the order of the errors. The transaction checks the hours again.
    assertOpen(await this.findCourt(this.prisma, input.courtId), startAt, endAt);

    const deadline = confirmDeadline(now, startAt); // BR-7
    if (deadline < now) throw new BadRequestException('Đã quá hạn đặt trong app. Hãy gọi chủ sân'); // BR-9

    const booking = await this.insertUnderLock(input.courtId, startAt, endAt, now, null, {
      status: 'PENDING',
      source: 'APP',
      createdById: userId,
      confirmDeadline: deadline,
    });
    return toView(booking);
  }

  /** UC-5 (brief F-007): an owner enters the booking of a customer who phoned. It is confirmed at once (BR-10). */
  async enterPhoneBooking(ownerId: string, input: CreatePhoneBookingRequest): Promise<OwnerBookingView> {
    const now = this.clock.now();
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (!isOnGrid(startAt) || !isOnGrid(endAt)) throw new BadRequestException('Giờ phải theo bước 30 phút'); // BR-2
    if (!isLongEnough(startAt, endAt)) throw new BadRequestException('Mỗi booking dài ít nhất 1 giờ'); // BR-3
    assertOpen(assertOwner(await this.findCourt(this.prisma, input.courtId), ownerId), startAt, endAt);
    if (startAt <= now) throw new BadRequestException('Giờ bắt đầu đã qua');

    const booking = await this.insertUnderLock(input.courtId, startAt, endAt, now, ownerId, {
      status: 'CONFIRMED',
      source: 'PHONE',
      createdById: ownerId,
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
      confirmedAt: now,
    });
    return toOwnerView({ ...booking, createdBy: null });
  }

  // Bookings on one court queue on its row lock before they insert. Without the lock, overlapping
  // inserts wait on each other inside the EXCLUDE check and Postgres ends some with 40P01 (review of PR #7).
  // EXCLUDE stays the last guard: the booking after the winner gets 23P01, and the caller gets 409.
  // The court and its venue are read after the lock, so a price that an owner writes first is the price of this
  // booking (brief F-005, AC-4, BR-6). An owner price update locks the same row. With an ownerId, the venue row is
  // locked FOR SHARE first, so an admin cannot move the venue to another owner before the commit (BR-23). The order
  // Venue, then Court is the order of the owner price edit (brief F-007, lock order table).
  private async insertUnderLock(
    courtId: string,
    startAt: Date,
    endAt: Date,
    now: Date,
    ownerId: string | null,
    fields: Pick<Prisma.BookingUncheckedCreateInput, 'status' | 'source' | 'createdById' | 'customerName' | 'customerPhone' | 'confirmDeadline' | 'confirmedAt'>,
  ): Promise<Booking> {
    // The rare cycle named on expire can end this insert instead of the owner list. The rollback undoes all of it,
    // so the insert runs once more; a second 40P01 answers 409 (review of PR #49, finding 1).
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.insertTransaction(courtId, startAt, endAt, now, ownerId, fields);
      } catch (error) {
        if (isExclusionViolation(error)) throw new ConflictException(TAKEN); // BR-1
        if (!isDeadlock(error)) throw error;
        if (attempt > 0) throw new ConflictException(BUSY);
      }
    }
  }

  private insertTransaction(
    courtId: string,
    startAt: Date,
    endAt: Date,
    now: Date,
    ownerId: string | null,
    fields: Pick<Prisma.BookingUncheckedCreateInput, 'status' | 'source' | 'createdById' | 'customerName' | 'customerPhone' | 'confirmDeadline' | 'confirmedAt'>,
  ): Promise<Booking> {
    return this.prisma.$transaction(async (tx) => {
      if (ownerId) await this.lockVenueOf(tx, courtId, ownerId);
      await tx.$executeRaw`SELECT 1 FROM "Court" WHERE "id" = ${courtId}::uuid FOR UPDATE`;
      const court = await this.findCourt(tx, courtId);
      if (ownerId) assertOwner(court, ownerId);
      assertOpen(court, startAt, endAt);
      // BR-8 without a job: expired requests on this court stop holding their time before the insert.
      await this.expire(tx, Prisma.sql`"courtId" = ${court.id}::uuid`, now);
      const created = await tx.booking.create({
        data: {
          ...fields,
          courtId: court.id,
          startAt,
          endAt,
          priceTotal: bookingPrice(startAt, endAt, court.priceNormal, court.pricePeak), // BR-5, BR-6
          createdAt: now,
        },
      });
      if (created.source === 'APP') {
        await this.notifications?.createNotification(tx, {
          userId: court.venue.ownerId,
          type: 'BOOKING_REQUESTED',
          bookingId: created.id,
        });
      }
      return created;
    });
  }

  /**
   * Brief F-009: an owner cancels a confirmed booking of their venue, of any source, until it starts. There is no
   * 6-hour mark: a user who is too late calls the owner, and the owner cancels here (intake 6.0.E1). A pending
   * request is rejected with UC-4, not cancelled.
   */
  async cancelAsOwner(ownerId: string, bookingId: string): Promise<BookingView> {
    const now = this.clock.now();
    const { count, booking } = await this.cancelUnderLock(
      bookingId,
      now,
      (b) => b.court.venue.ownerId === ownerId, // BR-23
      { status: 'CONFIRMED', startAt: { gt: now }, court: { venue: { ownerId } } },
    );
    if (count === 0) {
      throw new ConflictException(booking.status === 'PENDING' ? 'Yêu cầu đang chờ xác nhận. Hãy từ chối yêu cầu này' : NOT_CANCELLABLE);
    }
    return toView(booking);
  }

  /**
   * Brief F-009 (UC-6): a user cancels their own app booking. BR-12 and BR-11 are in the condition of the update, so a
   * cancel cannot pass the start time, the 6-hour mark, or a parallel cancel or confirm. The decision for a refused
   * cancel comes from userCancelDecision, the function that the web uses to show the button.
   */
  async cancelOwn(userId: string, bookingId: string): Promise<MyBookingView> {
    const now = this.clock.now();
    const { count, booking } = await this.cancelUnderLock(
      bookingId,
      now,
      (b) => b.createdById === userId && b.source === 'APP', // a phone booking answers as if it did not exist
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

  /**
   * The cancel of an owner and of a user share one transaction. The lock order is Venue (FOR SHARE), Court (FOR UPDATE),
   * then the Booking row, as in decide. The caller picks the 409 after the commit, because a 409 inside the transaction
   * would roll back the expire of this booking (BR-8). A transaction that Postgres ends with 40P01 does not commit.
   */
  private async cancelUnderLock(
    bookingId: string,
    now: Date,
    visible: (booking: BookingWithVenue) => boolean,
    condition: Prisma.BookingWhereInput,
  ): Promise<{ count: number; booking: BookingWithVenue }> {
    const found = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { courtId: true } });
    if (!found) throw new NotFoundException('Không tìm thấy booking');
    const include = { court: { include: { venue: true } }, match: true } as const;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockVenueOf(tx, found.courtId);
        await tx.$executeRaw`SELECT 1 FROM "Court" WHERE "id" = ${found.courtId}::uuid FOR UPDATE`;
        // The check comes before the expire, so a stranger writes nothing on the booking of another (BR-23).
        const before = await tx.booking.findUnique({ where: { id: bookingId }, include });
        if (!before || !visible(before)) throw new NotFoundException('Không tìm thấy booking');
        await this.expire(tx, Prisma.sql`id = ${bookingId}::uuid`, now);
        const result = await tx.booking.updateMany({
          where: { id: bookingId, ...condition },
          data: { status: 'CANCELLED', cancelledAt: now },
        });
        if (result.count > 0) {
          const match = await tx.match.findUnique({
            where: { bookingId },
            include: { players: { where: { status: 'ACTIVE' } } },
          });
          if (match && (match.status === 'OPEN' || match.status === 'FULL')) {
            await tx.match.update({
              where: { id: match.id },
              data: { status: 'CANCELLED' },
            });
            for (const player of match.players) {
              await this.notifications?.createNotification(tx, {
                userId: player.userId,
                type: 'MATCH_CANCELLED',
                bookingId,
                matchId: match.id,
              });
            }
          }
        }
        return { count: result.count, booking: await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include }) };
      });
    } catch (error) {
      if (isDeadlock(error)) throw new ConflictException(BUSY);
      throw error;
    }
  }

  private lockVenueOf(tx: Pick<PrismaService, 'court' | 'venue' | '$queryRaw'>, courtId: string, ownerId?: string): Promise<void> {
    return lockVenueOf(tx, courtId, ownerId);
  }

  private async findCourt(db: Pick<PrismaService, 'court'>, courtId: string) {
    const court = await db.court.findUnique({ where: { id: courtId }, include: { venue: true } });
    if (!court) throw new NotFoundException('Không tìm thấy sân');
    return court;
  }

  /** UC-6 (brief F-009 & F-011): the history of the user, newest first. Their overdue requests expire and past matches finish first (BR-8, BR-16, BR-19). */
  async mine(userId: string): Promise<MyBookingView[]> {
    const syncMine = async () => {
      const now = this.clock.now();
      await this.expire(this.prisma, Prisma.sql`"createdById" = ${userId}::uuid`, now);
      await finishPastMatches(this.prisma, Prisma.sql`b."createdById" = ${userId}::uuid`, now);
    };
    // The rare cycle named on expire ends this statement alone, and the statement is safe to run twice (brief F-009, AC-14).
    // A second 40P01 answers 409, as in the cancel routes.
    await syncMine().catch((error: unknown) => {
      if (!isDeadlock(error)) throw error;
      return syncMine().catch((again: unknown) => {
        throw isDeadlock(again) ? new ConflictException(BUSY) : again;
      });
    });
    const rows = await this.prisma.booking.findMany({
      where: { createdById: userId },
      include: { court: { include: { venue: true } }, match: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toMyView);
  }

  /** UC-4: the requests on the venues of one owner (BR-23). */
  async forOwner(ownerId: string, status: Booking['status']): Promise<OwnerBookingView[]> {
    const courts = Prisma.sql`SELECT c.id FROM "Court" c JOIN "Venue" v ON v.id = c."venueId" WHERE v."ownerId" = ${ownerId}::uuid`;
    const expireAll = () => this.expire(this.prisma, Prisma.sql`"courtId" IN (${courts})`, this.clock.now());
    // The rare cycle named on expire ends this statement alone, and the statement is safe to run twice (PR #45).
    await expireAll().catch((error: unknown) => {
      if (!isDeadlock(error)) throw error;
      return expireAll();
    });
    const rows = await this.prisma.booking.findMany({
      where: { status, court: { venue: { ownerId } } },
      include: { createdBy: true },
      orderBy: { startAt: 'asc' },
    });
    return rows.map(toOwnerView);
  }

  /** UC-4: confirm or reject one request. */
  async decide(ownerId: string, bookingId: string, decision: 'CONFIRMED' | 'REJECTED'): Promise<BookingView> {
    const found = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { courtId: true } });
    if (!found) throw new NotFoundException('Không tìm thấy booking');
    const now = this.clock.now();
    let outcome: { count: number; booking: Booking & { court: { venue: { ownerId: string } } } };
    try {
      outcome = await this.prisma.$transaction(async (tx) => {
        // The lock order of insertUnderLock: Venue (FOR SHARE), then Court. An insert holds the Court lock and may wait in
        // the EXCLUDE check on this row, so a decision that skipped the Court lock could wait on that insert (PR #40, AG-LOCKS).
        await this.lockVenueOf(tx, found.courtId);
        await tx.$executeRaw`SELECT 1 FROM "Court" WHERE "id" = ${found.courtId}::uuid FOR UPDATE`;
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { court: { include: { venue: true } } } });
        if (booking.court.venue.ownerId !== ownerId) throw new ForbiddenException('Bạn không có quyền làm việc này'); // BR-23
        await this.expire(tx, Prisma.sql`id = ${bookingId}::uuid`, now);
        // The deadline is in the condition too, so a confirm cannot pass between the expire and this update.
        const result = await tx.booking.updateMany({
          where: { id: bookingId, status: 'PENDING', confirmDeadline: { gte: now } },
          data: decision === 'CONFIRMED' ? { status: 'CONFIRMED', confirmedAt: now } : { status: 'REJECTED' },
        });
        if (result.count > 0) {
          if (decision === 'CONFIRMED') {
            await this.notifications?.createNotification(tx, {
              userId: booking.createdById,
              type: 'BOOKING_CONFIRMED',
              bookingId,
            });
          } else {
            await this.notifications?.createNotification(tx, {
              userId: booking.createdById,
              type: 'BOOKING_REJECTED',
              bookingId,
            });
            const match = await tx.match.findUnique({
              where: { bookingId },
              include: { players: { where: { status: 'ACTIVE' } } },
            });
            if (match && (match.status === 'OPEN' || match.status === 'FULL')) {
              await tx.match.update({
                where: { id: match.id },
                data: { status: 'CANCELLED' },
              });
              for (const player of match.players) {
                await this.notifications?.createNotification(tx, {
                  userId: player.userId,
                  type: 'MATCH_CANCELLED',
                  bookingId,
                  matchId: match.id,
                });
              }
            }
          }
        }
        return { count: result.count, booking: await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { court: { include: { venue: true } } } }) };
      });
    } catch (error) {
      if (isDeadlock(error)) throw new ConflictException(BUSY);
      throw error;
    }
    // The answer comes after the commit, so an expire that this call wrote stays.
    if (outcome.count === 0) {
      throw new ConflictException(outcome.booking.status === 'EXPIRED' ? 'Yêu cầu đã hết hạn' : 'Yêu cầu không còn chờ xác nhận');
    }
    return toView(outcome.booking);
  }

  /** Brief F-015 (UC-12): mark booking as paid at venue. */
  async markPaidAtVenue(ownerId: string, bookingId: string, paidAtVenue: boolean): Promise<PaidAtVenueResponse> {
    const found = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { courtId: true, court: { select: { venue: { select: { ownerId: true } } } } },
    });
    if (!found || found.court.venue.ownerId !== ownerId) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockVenueOf(tx, found.courtId);
        await tx.$executeRaw`SELECT 1 FROM "Court" WHERE "id" = ${found.courtId}::uuid FOR UPDATE`;
        const booking = await tx.booking.findUniqueOrThrow({
          where: { id: bookingId },
          include: { court: { include: { venue: true } } },
        });
        if (booking.court.venue.ownerId !== ownerId) {
          throw new NotFoundException('Không tìm thấy booking');
        }
        if (booking.status !== 'CONFIRMED') {
          throw new BadRequestException('Chỉ đánh dấu thu tiền cho booking đã xác nhận');
        }
        const updated = await tx.booking.updateMany({
          where: { id: bookingId, status: 'CONFIRMED' },
          data: { paidAtVenue },
        });
        if (updated.count === 0) {
          throw new BadRequestException('Chỉ đánh dấu thu tiền cho booking đã xác nhận');
        }
        return { id: bookingId, paidAtVenue };
      });
    } catch (error) {
      if (isDeadlock(error)) throw new ConflictException(BUSY);
      throw error;
    }
  }

  // BR-8 & BR-16: a request past its deadline becomes EXPIRED, and its open/full match becomes CANCELLED.
  private expire(db: Pick<PrismaService, '$executeRaw'>, scope: Prisma.Sql, now: Date): Promise<void> {
    return expireBookings(db, scope, now);
  }
}

/**
 * Court.venueId never changes, so it is safe to read before the lock. With an ownerId, a venue that moved to
 * another owner answers 404 before the court lock (brief F-007, contract step 4).
 */
export async function lockVenueOf(tx: Pick<PrismaService, 'court' | 'venue' | '$queryRaw'>, courtId: string, ownerId?: string): Promise<void> {
  const court = await tx.court.findUnique({ where: { id: courtId }, select: { venueId: true } });
  if (!court) throw new NotFoundException('Không tìm thấy sân');
  await tx.$queryRaw`SELECT id FROM "Venue" WHERE id = ${court.venueId}::uuid FOR SHARE`;
  if (!ownerId) return;
  const venue = await tx.venue.findUnique({ where: { id: court.venueId }, select: { ownerId: true } });
  if (venue?.ownerId !== ownerId) throw new NotFoundException('Không tìm thấy sân');
}

/**
 * BR-8 & BR-16: a request past its deadline becomes EXPIRED, and any OPEN or FULL match on it becomes CANCELLED.
 * The CTE locks Booking rows in id order first, then Match rows in id order, preserving Booking -> Match lock order.
 */
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

/**
 * BR-19 (models.md Fig 6): an OPEN or FULL match whose CONFIRMED booking has ended (endAt <= now) becomes FINISHED.
 * Run after expireBookings so an overdue PENDING booking cancels its match instead of finishing it.
 */
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
