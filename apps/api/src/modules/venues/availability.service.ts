import { Injectable, NotFoundException } from '@nestjs/common';
import { type Availability, freeRanges, startOfDayVN } from '@monsport/shared';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

const MINUTE = 60_000;

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
