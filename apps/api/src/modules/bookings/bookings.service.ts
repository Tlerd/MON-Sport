import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  bookingPrice,
  type BookingView,
  confirmDeadline,
  type CreateBookingRequest,
  isLongEnough,
  isOnGrid,
  minuteOfDayVN,
  type OwnerBookingView,
} from '@monsport/shared';
import type { Booking } from '../../generated/prisma/client.js';
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
    createdAt: b.createdAt.toISOString(),
  };
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

    const court = await this.prisma.court.findUnique({ where: { id: input.courtId }, include: { venue: true } });
    if (!court) throw new NotFoundException('Không tìm thấy sân');
    // A booking stays on one day inside the opening hours. 23:00-24:00 ends on minute 1440.
    const startMinute = minuteOfDayVN(startAt);
    const endMinute = startMinute + (endAt.getTime() - startAt.getTime()) / 60_000;
    if (startMinute < court.venue.opensAt || endMinute > court.venue.closesAt) throw new BadRequestException('Ngoài giờ mở cửa');

    const deadline = confirmDeadline(now, startAt); // BR-7
    if (deadline < now) throw new BadRequestException('Đã quá hạn đặt trong app. Hãy gọi chủ sân'); // BR-9

    try {
      return toView(await this.insertRequest(userId, court, startAt, endAt, deadline, now));
    } catch (error) {
      if (isExclusionViolation(error)) throw new ConflictException(TAKEN); // BR-1
      throw error;
    }
  }

  // Requests on one court queue on its row lock before they insert. Without the lock, overlapping
  // inserts wait on each other inside the EXCLUDE check and Postgres ends some with 40P01 (review of PR #7).
  // EXCLUDE stays the last guard: the request after the winner gets 23P01.
  private insertRequest(userId: string, court: { id: string; priceNormal: number; pricePeak: number }, startAt: Date, endAt: Date, deadline: Date, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "Court" WHERE "id" = ${court.id}::uuid FOR UPDATE`;
      // BR-8 without a job: expired requests on this court stop holding their time before the insert.
      await tx.booking.updateMany({
        where: { courtId: court.id, status: 'PENDING', confirmDeadline: { lt: now } },
        data: { status: 'EXPIRED' },
      });
      return tx.booking.create({
        data: {
          courtId: court.id,
          startAt,
          endAt,
          status: 'PENDING',
          source: 'APP',
          createdById: userId,
          priceTotal: bookingPrice(startAt, endAt, court.priceNormal, court.pricePeak), // BR-5, BR-6
          confirmDeadline: deadline,
          createdAt: now,
        },
      });
    });
  }

  async mine(userId: string): Promise<BookingView[]> {
    const rows = await this.prisma.booking.findMany({ where: { createdById: userId }, orderBy: { createdAt: 'desc' } });
    return rows.map(toView);
  }

  /** UC-4: the requests on the venues of one owner (BR-23). */
  async forOwner(ownerId: string, status: Booking['status']): Promise<OwnerBookingView[]> {
    await this.expire({ court: { venue: { ownerId } } }, this.clock.now());
    const rows = await this.prisma.booking.findMany({
      where: { status, court: { venue: { ownerId } } },
      include: { createdBy: true },
      orderBy: { startAt: 'asc' },
    });
    return rows.map((b) => ({
      ...toView(b),
      // BR-20: the owner of the booking's venue sees the phone number.
      customer: b.source === 'PHONE'
        ? { name: b.customerName ?? '', phone: b.customerPhone }
        : { name: b.createdBy.name, phone: b.createdBy.phone },
    }));
  }

  /** UC-4: confirm or reject one request. */
  async decide(ownerId: string, bookingId: string, decision: 'CONFIRMED' | 'REJECTED'): Promise<BookingView> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { court: { include: { venue: true } } } });
    if (!booking) throw new NotFoundException('Không tìm thấy booking');
    if (booking.court.venue.ownerId !== ownerId) throw new ForbiddenException('Bạn không có quyền làm việc này'); // BR-23
    const now = this.clock.now();
    await this.expire({ id: bookingId }, now);
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
  private async expire(where: object, now: Date): Promise<void> {
    await this.prisma.booking.updateMany({
      where: { ...where, status: 'PENDING', confirmDeadline: { lt: now } },
      data: { status: 'EXPIRED' },
    });
  }
}
