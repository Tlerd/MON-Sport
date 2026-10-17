import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  bookingPrice,
  type BookingView,
  confirmDeadline,
  type CreateBookingRequest,
  type CreatePhoneBookingRequest,
  isLongEnough,
  isOnGrid,
  minuteOfDayVN,
  type OwnerBookingView,
} from '@monsport/shared';
import { type Booking, Prisma } from '../../generated/prisma/client.js';
import { Clock } from '../database/clock.js';
import { isExclusionViolation, PrismaService } from '../database/prisma.service.js';

const TAKEN = 'Khung giờ này vừa có người đặt';
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

/**
 * BR-20: the owner of the booking's venue sees the customer. A phone booking keeps its own name and phone;
 * an app booking shows the account that made it.
 */
function toOwnerView(b: Booking & { createdBy: { name: string; phone: string } | null }): OwnerBookingView {
  const customer = b.source === 'PHONE' || !b.createdBy
    ? { name: b.customerName ?? '', phone: b.customerPhone }
    : { name: b.createdBy.name, phone: b.createdBy.phone };
  return { ...toView(b), customer };
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
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (ownerId) await this.lockVenueOf(tx, courtId, ownerId);
        await tx.$executeRaw`SELECT 1 FROM "Court" WHERE "id" = ${courtId}::uuid FOR UPDATE`;
        const court = await this.findCourt(tx, courtId);
        if (ownerId) assertOwner(court, ownerId);
        assertOpen(court, startAt, endAt);
        // BR-8 without a job: expired requests on this court stop holding their time before the insert.
        await this.expire(tx, Prisma.sql`"courtId" = ${court.id}::uuid`, now);
        return tx.booking.create({
          data: {
            ...fields,
            courtId: court.id,
            startAt,
            endAt,
            priceTotal: bookingPrice(startAt, endAt, court.priceNormal, court.pricePeak), // BR-5, BR-6
            createdAt: now,
          },
        });
      });
    } catch (error) {
      if (isExclusionViolation(error)) throw new ConflictException(TAKEN); // BR-1
      throw error;
    }
  }

  /**
   * Brief F-007: an owner cancels a phone booking of their venue until it starts. One conditional update decides,
   * so a cancel cannot pass a start time or a parallel cancel. A refused cancel reads the booking to pick the error.
   * The venue row is locked FOR SHARE first, as in insertUnderLock, so an admin move of the venue waits.
   */
  async cancelPhoneBooking(ownerId: string, bookingId: string): Promise<BookingView> {
    const now = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.booking.findUnique({ where: { id: bookingId }, select: { courtId: true } });
      if (!found) throw new NotFoundException('Không tìm thấy booking');
      await this.lockVenueOf(tx, found.courtId);
      const result = await tx.booking.updateMany({
        where: { id: bookingId, source: 'PHONE', status: 'CONFIRMED', startAt: { gt: now }, court: { venue: { ownerId } } },
        data: { status: 'CANCELLED', cancelledAt: now },
      });
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { court: { include: { venue: true } } } });
      if (booking.court.venue.ownerId !== ownerId) throw new NotFoundException('Không tìm thấy booking'); // BR-23
      if (result.count === 0) {
        if (booking.source === 'APP') throw new ConflictException('Chỉ hủy được booking bạn nhập cho khách gọi điện'); // until F-009
        throw new ConflictException('Booking này không hủy được nữa');
      }
      return toView(booking);
    });
  }

  /**
   * Court.venueId never changes, so it is safe to read before the lock. With an ownerId, a venue that moved to
   * another owner answers 404 before the court lock (brief F-007, contract step 4).
   */
  private async lockVenueOf(tx: Pick<PrismaService, 'court' | 'venue' | '$queryRaw'>, courtId: string, ownerId?: string): Promise<void> {
    const court = await tx.court.findUnique({ where: { id: courtId }, select: { venueId: true } });
    if (!court) throw new NotFoundException('Không tìm thấy sân');
    await tx.$queryRaw`SELECT id FROM "Venue" WHERE id = ${court.venueId}::uuid FOR SHARE`;
    if (!ownerId) return;
    const venue = await tx.venue.findUnique({ where: { id: court.venueId }, select: { ownerId: true } });
    if (venue?.ownerId !== ownerId) throw new NotFoundException('Không tìm thấy sân');
  }

  private async findCourt(db: Pick<PrismaService, 'court'>, courtId: string) {
    const court = await db.court.findUnique({ where: { id: courtId }, include: { venue: true } });
    if (!court) throw new NotFoundException('Không tìm thấy sân');
    return court;
  }

  async mine(userId: string): Promise<BookingView[]> {
    const rows = await this.prisma.booking.findMany({ where: { createdById: userId }, orderBy: { createdAt: 'desc' } });
    return rows.map(toView);
  }

  /** UC-4: the requests on the venues of one owner (BR-23). */
  async forOwner(ownerId: string, status: Booking['status']): Promise<OwnerBookingView[]> {
    const courts = Prisma.sql`SELECT c.id FROM "Court" c JOIN "Venue" v ON v.id = c."venueId" WHERE v."ownerId" = ${ownerId}::uuid`;
    await this.expire(this.prisma, Prisma.sql`"courtId" IN (${courts})`, this.clock.now());
    const rows = await this.prisma.booking.findMany({
      where: { status, court: { venue: { ownerId } } },
      include: { createdBy: true },
      orderBy: { startAt: 'asc' },
    });
    return rows.map(toOwnerView);
  }

  /** UC-4: confirm or reject one request. */
  async decide(ownerId: string, bookingId: string, decision: 'CONFIRMED' | 'REJECTED'): Promise<BookingView> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { court: { include: { venue: true } } } });
    if (!booking) throw new NotFoundException('Không tìm thấy booking');
    if (booking.court.venue.ownerId !== ownerId) throw new ForbiddenException('Bạn không có quyền làm việc này'); // BR-23
    const now = this.clock.now();
    await this.expire(this.prisma, Prisma.sql`id = ${bookingId}::uuid`, now);
    // The deadline is in the condition too, so a confirm cannot pass between the expire and this update.
    const result = await this.prisma.booking.updateMany({
      where: { id: bookingId, status: 'PENDING', confirmDeadline: { gte: now } },
      data: decision === 'CONFIRMED' ? { status: 'CONFIRMED', confirmedAt: now } : { status: 'REJECTED' },
    });
    if (result.count === 0) {
      const current = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
      throw new ConflictException(current.status === 'EXPIRED' ? 'Yêu cầu đã hết hạn' : 'Yêu cầu không còn chờ xác nhận');
    }
    return toView(await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }));
  }

  // BR-8: a request past its deadline becomes EXPIRED. The conditional update is safe to run twice.
  // The rows are locked in id order first. The owner list and an insert expire the same rows, and two updates
  // that lock them in different orders can end one with 40P01 (review of PR #40, finding 3).
  private async expire(db: Pick<PrismaService, '$executeRaw'>, scope: Prisma.Sql, now: Date): Promise<void> {
    await db.$executeRaw`
      UPDATE "Booking" SET status = 'EXPIRED' WHERE id IN (
        SELECT id FROM "Booking" WHERE ${scope} AND status = 'PENDING' AND "confirmDeadline" < ${now}
        ORDER BY id FOR UPDATE
      )`;
  }
}
