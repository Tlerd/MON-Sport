import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type PlayerRatingView,
  RATE_CANCELLED,
  RATE_NOT_PLAYER,
  RATE_TOO_EARLY,
  RATE_TOO_LATE,
  RATE_WINDOW_DAYS,
  type RatePlayerRequest,
} from '@monsport/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { expireBookings, finishPastMatches } from '../bookings/booking-sync.js';
import { Clock } from '../database/clock.js';
import { PrismaService, retryOnDeadlock } from '../database/prisma.service.js';
import { BUSY, DAY_MS, isUniqueViolation, MATCH_NOT_FOUND, NOT_HOST } from './match-messages.js';

@Injectable()
export class MatchRatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async listRatings(callerId: string, matchId: string): Promise<PlayerRatingView[]> {
    const found = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { hostId: true, bookingId: true },
    });
    if (!found) {
      throw new NotFoundException(MATCH_NOT_FOUND);
    }
    if (found.hostId !== callerId) {
      throw new ForbiddenException(NOT_HOST);
    }
    const now = this.clock.now();
    const syncMatch = async () => {
      await expireBookings(this.prisma, Prisma.sql`id = ${found.bookingId}::uuid`, now);
      await finishPastMatches(this.prisma, Prisma.sql`b.id = ${found.bookingId}::uuid`, now);
    };
    await retryOnDeadlock(syncMatch, BUSY);

    const activePlayers = await this.prisma.matchPlayer.findMany({
      where: {
        matchId,
        status: 'ACTIVE',
        userId: { not: found.hostId },
      },
      orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
      include: {
        user: { select: { name: true } },
      },
    });

    const ratings = await this.prisma.playerRating.findMany({
      where: { matchId },
    });
    const ratingByPlayerId = new Map(ratings.map((r) => [r.playerId, r]));

    return activePlayers.map((p) => {
      const r = ratingByPlayerId.get(p.userId);
      return {
        userId: p.userId,
        name: p.user.name,
        stars: r?.stars ?? null,
        noShow: r?.noShow ?? null,
      };
    });
  }

  async ratePlayer(
    callerId: string,
    matchId: string,
    targetUserId: string,
    body: RatePlayerRequest,
  ): Promise<PlayerRatingView> {
    const found = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { hostId: true, bookingId: true },
    });
    if (!found) {
      throw new NotFoundException(MATCH_NOT_FOUND);
    }
    const now = this.clock.now();
    const syncMatch = async () => {
      await expireBookings(this.prisma, Prisma.sql`id = ${found.bookingId}::uuid`, now);
      await finishPastMatches(this.prisma, Prisma.sql`b.id = ${found.bookingId}::uuid`, now);
    };
    await retryOnDeadlock(syncMatch, BUSY);

    if (found.hostId !== callerId) {
      throw new ForbiddenException(NOT_HOST);
    }

    const fresh = await this.prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      select: {
        status: true,
        booking: { select: { status: true, startAt: true } },
      },
    });

    if (fresh.status === 'CANCELLED' || fresh.booking.status !== 'CONFIRMED') {
      throw new BadRequestException(RATE_CANCELLED);
    }

    if (now < fresh.booking.startAt) {
      throw new BadRequestException(RATE_TOO_EARLY);
    }

    const RATE_WINDOW_MS = RATE_WINDOW_DAYS * DAY_MS;
    if (now.getTime() > fresh.booking.startAt.getTime() + RATE_WINDOW_MS) {
      throw new BadRequestException(RATE_TOO_LATE);
    }

    if (targetUserId === found.hostId) {
      throw new BadRequestException(RATE_NOT_PLAYER);
    }

    const targetPlayer = await this.prisma.matchPlayer.findUnique({
      where: { matchId_userId: { matchId, userId: targetUserId } },
      include: { user: { select: { name: true } } },
    });
    if (!targetPlayer || targetPlayer.status !== 'ACTIVE') {
      throw new BadRequestException(RATE_NOT_PLAYER);
    }

    const upsertRating = () =>
      this.prisma.playerRating.upsert({
        where: { matchId_playerId: { matchId, playerId: targetUserId } },
        create: {
          matchId,
          raterId: found.hostId,
          playerId: targetUserId,
          stars: body.stars,
          noShow: body.noShow,
        },
        update: {
          raterId: found.hostId,
          stars: body.stars,
          noShow: body.noShow,
        },
      });

    const saved = await upsertRating().catch((error: unknown) => {
      if (isUniqueViolation(error)) return upsertRating();
      throw error;
    });

    return {
      userId: targetUserId,
      name: targetPlayer.user.name,
      stars: saved.stars,
      noShow: saved.noShow,
    };
  }
}
