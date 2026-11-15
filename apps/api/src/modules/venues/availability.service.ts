import { Injectable, NotFoundException } from '@nestjs/common';
import { type Availability, freeRanges, startOfDayVN } from '@monsport/shared';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

const MINUTE = 60_000;

/**
 * Brief F-008 (UC-2): the free hours of one court on one day. It only reads: it takes no lock and does not expire a
 * request. A request past its deadline no longer holds its time (BR-8), and a booking that a user sends at once still
 * meets the EXCLUDE constraint (BR-1), so the answer is a hint, not a promise. The query selects the two times and
 * nothing else, because the table holds the name and the phone of customers (BR-20).
 */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async get(courtId: string, date: string): Promise<Availability> {
    const court = await this.prisma.court.findUnique({ where: { id: courtId }, select: { id: true, venue: { select: { opensAt: true, closesAt: true } } } });
    if (!court) throw new NotFoundException('Không tìm thấy sân');
    const { opensAt, closesAt } = court.venue;
    const now = this.clock.now();
    const dayStart = startOfDayVN(date).getTime();
    // A day that is over has no free time (AC-7). Returning here also keeps a year such as 0000 away from the driver,
    // which cannot write it as a timestamp (review of PR #53, finding 1).
    if (dayStart + closesAt * MINUTE <= now.getTime()) return { courtId: court.id, date, opensAt, closesAt, free: [] };
    const busy = await this.prisma.booking.findMany({
      where: {
        courtId: court.id,
        startAt: { lt: new Date(dayStart + closesAt * MINUTE) },
        endAt: { gt: new Date(dayStart + opensAt * MINUTE) },
        OR: [{ status: 'CONFIRMED' }, { status: 'PENDING', confirmDeadline: { gte: now } }],
      },
      select: { startAt: true, endAt: true },
    });
    return { courtId: court.id, date, opensAt, closesAt, free: freeRanges({ date, opensAt, closesAt, now, busy }) };
  }
}
