import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { type AdminStatsView, vnDateString, vnWeekRange } from '@monsport/shared';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

/**
 * Brief F-016 (UC-13). This service only reads, and it returns totals only: no phone and no name (POST-13, BR-20).
 * It never calls expireBookings. "Overdue" comes from the formula in Assumption 7.
 */
@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async getStats(date?: string): Promise<AdminStatsView> {
    const now = this.clock.now();
    const day = date ?? vnDateString(now);
    const { weekStart, weekEnd, from, to } = vnWeekRange(day);
    const inWeek = { gte: from, lt: to };

    // Overdue: stored as EXPIRED, or still PENDING with a deadline that has passed.
    const overdue: Prisma.BookingWhereInput = { OR: [{ status: 'EXPIRED' }, { status: 'PENDING', confirmDeadline: { lt: now } }] };
    // Not overdue: the complement of the formula, written positively so a null deadline does not drop the row.
    const notOverdue: Prisma.BookingWhereInput = {
      OR: [
        { status: { in: ['CONFIRMED', 'REJECTED', 'CANCELLED'] } },
        { status: 'PENDING', OR: [{ confirmDeadline: null }, { confirmDeadline: { gte: now } }] },
      ],
    };
    // Answered by the owner or past the deadline: the requests that can show a confirm rate.
    const decided: Prisma.BookingWhereInput = { OR: [{ status: { in: ['CONFIRMED', 'REJECTED'] } }, overdue] };

    const [
      accountRows,
      newUsers,
      [{ n: activeUsers }],
      [{ minutes }],
      expired,
      decidedCount,
      venues,
      courts,
      bookingRows,
      matchRows,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], where: { deletedAt: null }, _count: { _all: true } }),
      this.prisma.user.count({ where: { role: 'USER', deletedAt: null, createdAt: inWeek } }),
      this.prisma.$queryRaw<{ n: number }[]>`
        SELECT COUNT(DISTINCT a."userId")::int AS n
        FROM (
          SELECT "createdById" AS "userId" FROM "Booking"
            WHERE "source" = 'APP' AND "createdAt" >= ${from}::timestamptz AND "createdAt" < ${to}::timestamptz
          UNION
          SELECT "userId" FROM "MatchPlayer"
            WHERE "status" IN ('ACTIVE', 'LEFT') AND "joinedAt" >= ${from}::timestamptz AND "joinedAt" < ${to}::timestamptz
          UNION
          SELECT "hostId" AS "userId" FROM "Match"
            WHERE "createdAt" >= ${from}::timestamptz AND "createdAt" < ${to}::timestamptz
        ) a
        JOIN "User" u ON u."id" = a."userId"
        WHERE u."role" = 'USER'`,
      this.prisma.$queryRaw<{ minutes: number | null }[]>`
        SELECT (AVG(EXTRACT(EPOCH FROM ("confirmedAt" - "createdAt"))) / 60)::float8 AS minutes
        FROM "Booking"
        WHERE "source" = 'APP' AND "confirmedAt" IS NOT NULL
          AND "createdAt" >= ${from}::timestamptz AND "createdAt" < ${to}::timestamptz`,
      this.prisma.booking.count({ where: { source: 'APP', createdAt: inWeek, ...overdue } }),
      this.prisma.booking.count({ where: { source: 'APP', createdAt: inWeek, ...decided } }),
      this.prisma.venue.findMany({ select: { id: true, name: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
      this.prisma.court.findMany({ select: { id: true, venueId: true } }),
      this.prisma.booking.groupBy({
        by: ['courtId'],
        where: { status: 'CONFIRMED', startAt: inWeek },
        _count: { _all: true },
      }),
      this.prisma.booking.groupBy({
        by: ['courtId'],
        where: { startAt: inWeek, match: { is: { status: { not: 'CANCELLED' } } }, ...notOverdue },
        _count: { _all: true },
      }),
    ]);

    const accounts: Record<'ADMIN' | 'OWNER' | 'USER' | 'STAFF', number> = { ADMIN: 0, OWNER: 0, USER: 0, STAFF: 0 };
    for (const row of accountRows) {
      accounts[row.role] = row._count._all;
    }

    const venueOfCourt = new Map(courts.map((c) => [c.id, c.venueId]));
    const sumByVenue = (rows: { courtId: string; _count: { _all: number } }[]) => {
      const totals = new Map<string, number>();
      for (const row of rows) {
        const venueId = venueOfCourt.get(row.courtId);
        if (venueId) totals.set(venueId, (totals.get(venueId) ?? 0) + row._count._all);
      }
      return totals;
    };
    const bookingsByVenue = sumByVenue(bookingRows);
    const matchesByVenue = sumByVenue(matchRows);

    return {
      date: day,
      weekStart,
      weekEnd,
      accounts,
      newUsers,
      activeUsers,
      avgConfirmMinutes: minutes === null ? null : Math.max(0, Math.round(minutes)),
      expiryRate: decidedCount === 0 ? 0 : Number((expired / decidedCount).toFixed(4)),
      venues: venues.map((v) => ({
        venueId: v.id,
        venueName: v.name,
        bookingCount: bookingsByVenue.get(v.id) ?? 0,
        matchCount: matchesByVenue.get(v.id) ?? 0,
      })),
    };
  }
}
