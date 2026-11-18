import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ALREADY_IN_MATCH_MESSAGE,
  HOST_CANNOT_LEAVE_MESSAGE,
  JOIN_REJECTED_MESSAGE,
  LEAVE_STARTED_MESSAGE,
  MATCH_FULL_MESSAGE,
  type MatchDetailView,
  type MatchRequestView,
  NOT_IN_MATCH_MESSAGE,
  NOT_JOINABLE_MESSAGE,
  NOT_LEAVABLE_MESSAGE,
  type PlayerReputation,
  REQUEST_EXPIRED_MESSAGE,
  REQUEST_NOT_PENDING_MESSAGE,
} from '@monsport/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { expireBookings, finishPastMatches, lockVenueOf } from '../bookings/booking-sync.js';
import { Clock } from '../database/clock.js';
import { conflictOnDeadlock, PrismaService, retryOnDeadlock } from '../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { BUSY, MATCH_NOT_FOUND, NOT_HOST, REQUEST_NOT_FOUND } from './match-messages.js';
import { loadRequests, type MatchDetailRow, type RequestRow, toMatchDetailView, WITH_DETAIL_RELATIONS } from './match-views.js';

@Injectable()
export class MatchPlayersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly notifications?: NotificationsService,
  ) {}

  private async lockMatchForPlayer(
    tx: Prisma.TransactionClient,
    courtId: string,
    bookingId: string,
    matchId: string,
    userId: string,
    now: Date,
  ) {
    await lockVenueOf(tx, courtId);
    await tx.$executeRaw`SELECT 1 FROM "Court" WHERE "id" = ${courtId}::uuid FOR UPDATE`;
    await expireBookings(tx, Prisma.sql`id = ${bookingId}::uuid`, now);
    await finishPastMatches(tx, Prisma.sql`b.id = ${bookingId}::uuid`, now);
    const locked = await tx.$executeRaw`SELECT 1 FROM "Match" WHERE "id" = ${matchId}::uuid FOR UPDATE`;
    if (!locked) throw new NotFoundException(MATCH_NOT_FOUND);
    return tx.match.findUniqueOrThrow({
      where: { id: matchId },
      include: {
        booking: { select: { status: true, startAt: true } },
        players: { where: { userId }, select: { status: true } },
      },
    });
  }

  private isMatchLive(current: { status: string; booking: { status: string; startAt: Date } }, now: Date): boolean {
    return (
      (current.status === 'OPEN' || current.status === 'FULL') &&
      (current.booking.status === 'PENDING' || current.booking.status === 'CONFIRMED') &&
      current.booking.startAt > now
    );
  }

  async join(userId: string, matchId: string): Promise<MatchDetailView> {
    const found = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { bookingId: true, booking: { select: { courtId: true } } },
    });
    if (!found) throw new NotFoundException(MATCH_NOT_FOUND);
    const now = this.clock.now();
    const outcome:
      | { kind: 'not_joinable' } | { kind: 'already_in_match' } | { kind: 'match_full' } | { kind: 'join_rejected' }
      | { kind: 'joined'; match: MatchDetailRow; requests: RequestRow[] } = await conflictOnDeadlock(
      () =>
        this.prisma.$transaction(async (tx) => {
          const current = await this.lockMatchForPlayer(tx, found.booking.courtId, found.bookingId, matchId, userId, now);
          if (!this.isMatchLive(current, now)) return { kind: 'not_joinable' };
          if (current.players[0]?.status === 'ACTIVE') return { kind: 'already_in_match' };
          if (current.joinMode === 'APPROVAL') {
            const mine = current.players[0]?.status;
            if (mine === 'REJECTED') return { kind: 'join_rejected' };
            if (mine !== 'PENDING') {
              await tx.matchPlayer.upsert({
                where: { matchId_userId: { matchId, userId } },
                create: { matchId, userId, status: 'PENDING', joinedAt: now, leftAt: null },
                update: { status: 'PENDING', joinedAt: now, leftAt: null },
              });
              await this.notifications?.createNotification(tx, {
                userId: current.hostId,
                type: 'MATCH_JOIN_REQUESTED',
                bookingId: found.bookingId,
                matchId,
              });
              await tx.$executeRaw`SELECT pg_notify('lobby', ${matchId})`;
            }
            const unchanged = await tx.match.findUniqueOrThrow({ where: { id: matchId }, include: WITH_DETAIL_RELATIONS });
            return { kind: 'joined', match: unchanged, requests: await loadRequests(tx, matchId, userId) };
          }
          if (current.joinedCount >= current.capacity || current.status === 'FULL') return { kind: 'match_full' };
          await tx.matchPlayer.upsert({
            where: { matchId_userId: { matchId, userId } },
            create: { matchId, userId, status: 'ACTIVE', joinedAt: now, leftAt: null },
            update: { status: 'ACTIVE', joinedAt: now, leftAt: null },
          });
          const nextJoined = current.joinedCount + 1;
          const updated = await tx.match.update({
            where: { id: matchId },
            data: { joinedCount: nextJoined, status: nextJoined >= current.capacity ? 'FULL' : 'OPEN' },
            include: WITH_DETAIL_RELATIONS,
          });
          return { kind: 'joined', match: updated, requests: await loadRequests(tx, matchId, userId) };
        }),
      BUSY,
    );
    if (outcome.kind === 'not_joinable') throw new ConflictException(NOT_JOINABLE_MESSAGE);
    if (outcome.kind === 'already_in_match') throw new ConflictException(ALREADY_IN_MATCH_MESSAGE);
    if (outcome.kind === 'match_full') throw new ConflictException(MATCH_FULL_MESSAGE);
    if (outcome.kind === 'join_rejected') throw new ConflictException(JOIN_REJECTED_MESSAGE);
    return toMatchDetailView(outcome.match, userId, now, outcome.requests);
  }

  async leave(userId: string, matchId: string): Promise<MatchDetailView> {
    const found = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { bookingId: true, booking: { select: { courtId: true } } },
    });
    if (!found) throw new NotFoundException(MATCH_NOT_FOUND);
    const now = this.clock.now();
    const outcome:
      | { kind: 'host_cannot_leave' } | { kind: 'not_in_match' } | { kind: 'not_leavable' } | { kind: 'leave_started' }
      | { kind: 'left'; match: MatchDetailRow; requests: RequestRow[] } = await conflictOnDeadlock(
      () =>
        this.prisma.$transaction(async (tx) => {
          const current = await this.lockMatchForPlayer(tx, found.booking.courtId, found.bookingId, matchId, userId, now);
          if (current.hostId === userId) return { kind: 'host_cannot_leave' };
          if (current.players[0]?.status === 'PENDING') {
            await tx.matchPlayer.delete({ where: { matchId_userId: { matchId, userId } } });
            await tx.$executeRaw`SELECT pg_notify('lobby', ${matchId})`;
            const unchanged = await tx.match.findUniqueOrThrow({ where: { id: matchId }, include: WITH_DETAIL_RELATIONS });
            return { kind: 'left', match: unchanged, requests: await loadRequests(tx, matchId, userId) };
          }
          if (current.players[0]?.status !== 'ACTIVE') return { kind: 'not_in_match' };
          if (current.status !== 'OPEN' && current.status !== 'FULL') return { kind: 'not_leavable' };
          if (current.booking.startAt <= now) return { kind: 'leave_started' };
          await tx.matchPlayer.update({
            where: { matchId_userId: { matchId, userId } },
            data: { status: 'LEFT', leftAt: now },
          });
          const updated = await tx.match.update({
            where: { id: matchId },
            data: { joinedCount: current.joinedCount - 1, status: 'OPEN' },
            include: WITH_DETAIL_RELATIONS,
          });
          return { kind: 'left', match: updated, requests: await loadRequests(tx, matchId, userId) };
        }),
      BUSY,
    );
    if (outcome.kind === 'host_cannot_leave') throw new ConflictException(HOST_CANNOT_LEAVE_MESSAGE);
    if (outcome.kind === 'not_in_match') throw new ConflictException(NOT_IN_MATCH_MESSAGE);
    if (outcome.kind === 'not_leavable') throw new ConflictException(NOT_LEAVABLE_MESSAGE);
    if (outcome.kind === 'leave_started') throw new ConflictException(LEAVE_STARTED_MESSAGE);
    return toMatchDetailView(outcome.match, userId, now, outcome.requests);
  }

  async listRequests(userId: string, matchId: string): Promise<MatchRequestView[]> {
    const found = await this.prisma.match.findUnique({ where: { id: matchId }, select: { hostId: true, bookingId: true } });
    if (!found) throw new NotFoundException(MATCH_NOT_FOUND);
    if (found.hostId !== userId) throw new ForbiddenException(NOT_HOST);
    const now = this.clock.now();
    const syncMatch = async () => {
      await expireBookings(this.prisma, Prisma.sql`id = ${found.bookingId}::uuid`, now);
      await finishPastMatches(this.prisma, Prisma.sql`b.id = ${found.bookingId}::uuid`, now);
    };
    await retryOnDeadlock(syncMatch, BUSY);
    const fresh = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { status: true, booking: { select: { startAt: true } } },
    });
    if (!fresh || (fresh.status !== 'OPEN' && fresh.status !== 'FULL') || fresh.booking.startAt <= now) return [];
    const rows = await this.prisma.matchPlayer.findMany({
      where: { matchId, status: 'PENDING' },
      orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
      include: { user: { select: { name: true, phone: true } } },
    });
    if (rows.length === 0) return [];
    const userIds = rows.map((r) => r.userId);
    const repRows = await this.prisma.$queryRaw<
      { playerId: string; ratingAvg: number | null; ratingCount: number; noShowCount: number }[]
    >`
      SELECT
        "playerId",
        ROUND(AVG("stars")::numeric, 1)::float8 AS "ratingAvg",
        COUNT("stars")::int AS "ratingCount",
        COUNT(*) FILTER (WHERE "noShow")::int AS "noShowCount"
      FROM "PlayerRating"
      WHERE "playerId" IN (${Prisma.join(userIds.map((id) => Prisma.sql`${id}::uuid`))})
      GROUP BY "playerId"
    `;
    const repMap = new Map<string, PlayerReputation>();
    for (const r of repRows) {
      repMap.set(r.playerId, {
        ratingAvg: r.ratingAvg !== null ? Math.round(Number(r.ratingAvg) * 10) / 10 : null,
        ratingCount: Number(r.ratingCount),
        noShowCount: Number(r.noShowCount),
      });
    }
    return rows.map((r) => ({
      userId: r.userId,
      name: r.user.name,
      phone: r.user.phone,
      requestedAt: r.joinedAt.toISOString(),
      reputation: repMap.get(r.userId) ?? { ratingAvg: null, ratingCount: 0, noShowCount: 0 },
    }));
  }

  approveRequest(hostId: string, matchId: string, targetUserId: string): Promise<MatchDetailView> {
    return this.decideRequest('approve', hostId, matchId, targetUserId);
  }

  rejectRequest(hostId: string, matchId: string, targetUserId: string): Promise<MatchDetailView> {
    return this.decideRequest('reject', hostId, matchId, targetUserId);
  }

  private async decideRequest(
    action: 'approve' | 'reject',
    hostId: string,
    matchId: string,
    targetUserId: string,
  ): Promise<MatchDetailView> {
    const found = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { hostId: true, bookingId: true, booking: { select: { courtId: true } } },
    });
    if (!found) throw new NotFoundException(MATCH_NOT_FOUND);
    if (found.hostId !== hostId) throw new ForbiddenException(NOT_HOST);
    const now = this.clock.now();
    const outcome:
      | { kind: 'expired' } | { kind: 'not_pending' } | { kind: 'match_full' }
      | { kind: 'done'; match: MatchDetailRow; requests: RequestRow[] } = await conflictOnDeadlock(
      () =>
        this.prisma.$transaction(async (tx) => {
          const current = await this.lockMatchForPlayer(tx, found.booking.courtId, found.bookingId, matchId, targetUserId, now);
          if (!this.isMatchLive(current, now)) return { kind: 'expired' };
          const target = current.players[0];
          if (!target) throw new NotFoundException(REQUEST_NOT_FOUND);
          if (target.status !== 'PENDING') return { kind: 'not_pending' };
          const key = { matchId_userId: { matchId, userId: targetUserId } };
          if (action === 'reject') {
            await tx.matchPlayer.update({ where: key, data: { status: 'REJECTED' } });
            await this.notifications?.createNotification(tx, {
              userId: targetUserId,
              type: 'MATCH_JOIN_REJECTED',
              bookingId: found.bookingId,
              matchId,
            });
            await tx.$executeRaw`SELECT pg_notify('lobby', ${matchId})`;
            const unchanged = await tx.match.findUniqueOrThrow({ where: { id: matchId }, include: WITH_DETAIL_RELATIONS });
            return { kind: 'done', match: unchanged, requests: await loadRequests(tx, matchId, hostId) };
          }
          if (current.joinedCount >= current.capacity || current.status === 'FULL') return { kind: 'match_full' };
          await tx.matchPlayer.update({ where: key, data: { status: 'ACTIVE', joinedAt: now, leftAt: null } });
          const nextJoined = current.joinedCount + 1;
          const updated = await tx.match.update({
            where: { id: matchId },
            data: { joinedCount: nextJoined, status: nextJoined >= current.capacity ? 'FULL' : 'OPEN' },
            include: WITH_DETAIL_RELATIONS,
          });
          await this.notifications?.createNotification(tx, {
            userId: targetUserId,
            type: 'MATCH_JOIN_APPROVED',
            bookingId: found.bookingId,
            matchId,
          });
          return { kind: 'done', match: updated, requests: await loadRequests(tx, matchId, hostId) };
        }),
      BUSY,
    );
    if (outcome.kind === 'expired') throw new ConflictException(REQUEST_EXPIRED_MESSAGE);
    if (outcome.kind === 'not_pending') throw new ConflictException(REQUEST_NOT_PENDING_MESSAGE);
    if (outcome.kind === 'match_full') throw new ConflictException(MATCH_FULL_MESSAGE);
    return toMatchDetailView(outcome.match, hostId, now, outcome.requests);
  }
}
