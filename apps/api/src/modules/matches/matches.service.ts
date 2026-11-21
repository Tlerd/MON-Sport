import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CALL_OWNER_MESSAGE,
  type CreateMatchRequest,
  type MatchDetailView,
  type MatchLobbyQuery,
  type MatchView,
  startOfDayVN,
  userCancelDecision,
} from '@monsport/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { expireBookings, finishPastMatches, lockVenueOf, syncMatchByBooking } from '../bookings/booking-sync.js';
import { Clock } from '../database/clock.js';
import { conflictOnDeadlock, PrismaService, retryOnDeadlock } from '../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  ALREADY_HAS_MATCH,
  BOOKING_NOT_FOUND,
  BUSY,
  DAY_MS,
  isUniqueViolation,
  MATCH_NOT_FOUND,
  NOT_CANCELLABLE,
  NOT_OPENABLE,
} from './match-messages.js';
import {
  loadRequests,
  type MatchRow,
  toMatchDetailView,
  toMatchView,
  WITH_DETAIL_RELATIONS,
  WITH_RELATIONS,
} from './match-views.js';

type CreateOutcome = { kind: 'already_has_match' } | { kind: 'not_openable' } | { kind: 'created'; match: MatchRow };

function alreadyHasMatchOnUnique(error: unknown): never {
  if (isUniqueViolation(error)) throw new ConflictException(ALREADY_HAS_MATCH);
  throw error;
}

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly notifications?: NotificationsService,
  ) {}

  async create(userId: string, input: CreateMatchRequest): Promise<MatchView> {
    const found = await this.prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: { courtId: true, createdById: true, source: true },
    });
    if (!found || found.createdById !== userId || found.source !== 'APP') {
      throw new NotFoundException(BOOKING_NOT_FOUND);
    }
    const now = this.clock.now();
    const outcome = await conflictOnDeadlock(
      () =>
        this.prisma
          .$transaction(async (tx): Promise<CreateOutcome> => {
            await lockVenueOf(tx, found.courtId);
            await tx.$executeRaw`SELECT 1 FROM "Court" WHERE "id" = ${found.courtId}::uuid FOR UPDATE`;
            const booking = await tx.booking.findUnique({
              where: { id: input.bookingId },
              include: { court: true, match: { select: { id: true } } },
            });
            if (!booking || booking.createdById !== userId || booking.source !== 'APP') {
              throw new NotFoundException(BOOKING_NOT_FOUND);
            }
            await expireBookings(tx, Prisma.sql`id = ${input.bookingId}::uuid`, now);
            if (booking.match) {
              return { kind: 'already_has_match' };
            }
            const current = await tx.booking.findUniqueOrThrow({
              where: { id: input.bookingId },
              select: { status: true, startAt: true },
            });
            if ((current.status !== 'PENDING' && current.status !== 'CONFIRMED') || current.startAt <= now) {
              return { kind: 'not_openable' };
            }
            const created = await tx.match.create({
              data: {
                bookingId: booking.id,
                hostId: userId,
                sport: booking.court.sport,
                capacity: input.capacity,
                joinMode: input.joinMode ?? 'INSTANT',
                pricePerSlot: input.pricePerSlot,
                status: 'OPEN',
                joinedCount: 1,
                createdAt: now,
                players: {
                  create: {
                    userId,
                    status: 'ACTIVE',
                    joinedAt: now,
                  },
                },
              },
              include: WITH_RELATIONS,
            });
            return { kind: 'created', match: created };
          })
          .catch(alreadyHasMatchOnUnique),
      BUSY,
    );
    if (outcome.kind === 'already_has_match') throw new ConflictException(ALREADY_HAS_MATCH);
    if (outcome.kind === 'not_openable') throw new ConflictException(NOT_OPENABLE);
    return toMatchView(outcome.match);
  }

  async list(query: MatchLobbyQuery): Promise<MatchView[]> {
    const now = this.clock.now();
    const startAtFilter: Prisma.DateTimeFilter = { gt: now };
    if (query.date) {
      const dayStart = startOfDayVN(query.date);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      if (dayEnd <= now) return [];
      if (dayStart > now) startAtFilter.gte = dayStart;
      startAtFilter.lt = dayEnd;
    }
    const syncLobby = async () => {
      await expireBookings(
        this.prisma,
        Prisma.sql`id IN (SELECT "bookingId" FROM "Match" WHERE status IN ('OPEN', 'FULL'))`,
        now,
      );
      await finishPastMatches(this.prisma, Prisma.sql`TRUE`, now);
    };
    await retryOnDeadlock(syncLobby, BUSY);
    const rows = await this.prisma.match.findMany({
      where: {
        status: 'OPEN',
        ...(query.sport ? { sport: query.sport } : {}),
        ...(query.level ? { host: { skillLevel: query.level } } : {}),
        booking: {
          status: { in: ['PENDING', 'CONFIRMED'] },
          startAt: startAtFilter,
        },
      },
      include: WITH_RELATIONS,
      orderBy: [{ booking: { startAt: 'asc' } }, { id: 'asc' }],
    });
    return rows.map(toMatchView);
  }

  async joined(userId: string): Promise<MatchView[]> {
    const now = this.clock.now();
    const syncJoined = async () => {
      await expireBookings(
        this.prisma,
        Prisma.sql`id IN (SELECT m."bookingId" FROM "Match" m JOIN "MatchPlayer" mp ON mp."matchId" = m.id WHERE mp."userId" = ${userId}::uuid AND mp.status = 'ACTIVE')`,
        now,
      );
      await finishPastMatches(
        this.prisma,
        Prisma.sql`m.id IN (SELECT "matchId" FROM "MatchPlayer" WHERE "userId" = ${userId}::uuid AND status = 'ACTIVE')`,
        now,
      );
    };
    await retryOnDeadlock(syncJoined, BUSY);
    const rows = await this.prisma.match.findMany({
      where: {
        players: {
          some: { userId, status: 'ACTIVE' },
        },
      },
      include: WITH_RELATIONS,
      orderBy: [{ booking: { startAt: 'desc' } }, { id: 'desc' }],
    });
    return rows.map(toMatchView);
  }

  async detail(userId: string, matchId: string): Promise<MatchDetailView> {
    const found = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { bookingId: true },
    });
    if (!found) {
      throw new NotFoundException(MATCH_NOT_FOUND);
    }
    const now = this.clock.now();
    await syncMatchByBooking(this.prisma, found.bookingId, now);
    const row = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: WITH_DETAIL_RELATIONS,
    });
    if (!row) {
      throw new NotFoundException(MATCH_NOT_FOUND);
    }
    return toMatchDetailView(row, userId, now, await loadRequests(this.prisma, matchId, userId));
  }

  async cancel(userId: string, matchId: string): Promise<MatchView> {
    const found = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { hostId: true, booking: { select: { courtId: true } } },
    });
    if (!found || found.hostId !== userId) {
      throw new NotFoundException(MATCH_NOT_FOUND);
    }
    const now = this.clock.now();
    const outcome:
      | { kind: 'call_owner' }
      | { kind: 'not_cancellable' }
      | { kind: 'cancelled'; match: MatchRow } = await conflictOnDeadlock(
      () =>
        this.prisma.$transaction(async (tx) => {
          await lockVenueOf(tx, found.booking.courtId);
          await tx.$executeRaw`SELECT 1 FROM "Court" WHERE "id" = ${found.booking.courtId}::uuid FOR UPDATE`;
          const before = await tx.match.findUnique({
            where: { id: matchId },
            select: { id: true, hostId: true, bookingId: true },
          });
          if (!before || before.hostId !== userId) {
            throw new NotFoundException(MATCH_NOT_FOUND);
          }
          await expireBookings(tx, Prisma.sql`id = ${before.bookingId}::uuid`, now);
          await finishPastMatches(tx, Prisma.sql`b.id = ${before.bookingId}::uuid`, now);
          const current = await tx.match.findUniqueOrThrow({
            where: { id: matchId },
            include: { booking: { select: { id: true, status: true, startAt: true } } },
          });
          if (current.status !== 'OPEN' && current.status !== 'FULL') {
            return { kind: 'not_cancellable' };
          }
          const decision = userCancelDecision(current.booking, now);
          if (decision === 'CALL_OWNER') {
            return { kind: 'call_owner' };
          }
          if (decision !== 'ALLOW') {
            return { kind: 'not_cancellable' };
          }
          await tx.booking.update({
            where: { id: current.booking.id },
            data: { status: 'CANCELLED', cancelledAt: now },
          });
          const updated = await tx.match.update({
            where: { id: matchId },
            data: { status: 'CANCELLED' },
            include: WITH_RELATIONS,
          });
          const players = await tx.matchPlayer.findMany({
            where: { matchId, status: 'ACTIVE' },
            select: { userId: true },
          });
          for (const p of players) {
            await this.notifications?.createNotification(tx, {
              userId: p.userId,
              type: 'MATCH_CANCELLED',
              bookingId: current.booking.id,
              matchId,
            });
          }
          return { kind: 'cancelled', match: updated };
        }),
      BUSY,
    );
    if (outcome.kind === 'call_owner') throw new ConflictException(CALL_OWNER_MESSAGE);
    if (outcome.kind === 'not_cancellable') throw new ConflictException(NOT_CANCELLABLE);
    return toMatchView(outcome.match);
  }
}
