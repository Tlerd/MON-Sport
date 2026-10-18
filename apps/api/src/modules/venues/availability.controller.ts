import { BadRequestException, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { type Availability, AvailabilityQuery, freeRanges, Messages, startOfDayVN } from '@monsport/shared';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

// A malformed id gets the Vietnamese generic text, not the English text of the pipe.
const Id = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException(Messages.invalid) });
const MINUTE = 60_000;

/**
 * Brief F-008 (UC-2): the free hours of one court on one day. The route needs no login, as GET /api/venues.
 * It only reads: it takes no lock and does not expire a request. A request past its deadline no longer holds its
 * time (BR-8), and a booking that a user sends at once still meets the EXCLUDE constraint (BR-1), so the answer is
 * a hint, not a promise. The query selects the two times and nothing else, because the table holds the name and the
 * phone of customers (BR-20).
 */
@Controller('courts')
export class AvailabilityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  @Get(':id/availability')
  async availability(@Param('id', Id) id: string, @Query() query: unknown): Promise<Availability> {
    const parsed = AvailabilityQuery.safeParse(query);
    if (!parsed.success) throw new BadRequestException(Messages.invalid);
    const { date } = parsed.data;
    const court = await this.prisma.court.findUnique({ where: { id }, select: { id: true, venue: { select: { opensAt: true, closesAt: true } } } });
    if (!court) throw new NotFoundException('Không tìm thấy sân');
    const { opensAt, closesAt } = court.venue;
    const now = this.clock.now();
    const dayStart = startOfDayVN(date).getTime();
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
