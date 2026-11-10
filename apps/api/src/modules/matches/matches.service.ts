import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ALREADY_IN_MATCH_MESSAGE,
  CALL_OWNER_MESSAGE,
  type CreateMatchRequest,
  HOST_CANNOT_LEAVE_MESSAGE,
  JOIN_REJECTED_MESSAGE,
  LEAVE_STARTED_MESSAGE,
  MATCH_FULL_MESSAGE,
  type MatchDetailView,
  type MatchLobbyQuery,
  type MatchRequestView,
  type MatchView,
  type MatchViewerRole,
  NOT_IN_MATCH_MESSAGE,
  NOT_JOINABLE_MESSAGE,
  NOT_LEAVABLE_MESSAGE,
  REQUEST_EXPIRED_MESSAGE,
  REQUEST_NOT_PENDING_MESSAGE,
  startOfDayVN,
  userCancelDecision,
} from '@monsport/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { expireBookings, finishPastMatches, lockVenueOf } from '../bookings/bookings.service.js';
import { Clock } from '../database/clock.js';
import { isDeadlock, PrismaService } from '../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

const ALREADY_HAS_MATCH = 'Booking này đã có trận';
const NOT_OPENABLE = 'Chỉ mở được trận trên booking đang chờ xác nhận hoặc đã xác nhận';
const BOOKING_NOT_FOUND = 'Không tìm thấy booking';
const MATCH_NOT_FOUND = 'Không tìm thấy trận';
const NOT_CANCELLABLE = 'Trận này không hủy được nữa';
const NOT_HOST = 'Bạn không có quyền làm việc này';
const REQUEST_NOT_FOUND = 'Không tìm thấy yêu cầu';
const BUSY = 'Yêu cầu đang được xử lý, hãy thử lại';
const DAY_MS = 24 * 60 * 60_000;

const WITH_RELATIONS = {
  // BR-20: select only the host name so no phone number reaches the lobby response.
  host: { select: { name: true } },
  booking: {
    include: {
      court: {
        include: { venue: true },
      },
    },
  },
} satisfies Prisma.MatchInclude;

const WITH_DETAIL_RELATIONS = {
  ...WITH_RELATIONS,
  players: {
    where: { status: 'ACTIVE' },
    orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
    include: {
      user: { select: { name: true, phone: true } },
    },
  },
} satisfies Prisma.MatchInclude;

type MatchRow = Prisma.MatchGetPayload<{ include: typeof WITH_RELATIONS }>;
type MatchDetailRow = Prisma.MatchGetPayload<{ include: typeof WITH_DETAIL_RELATIONS }>;
/** A non-ACTIVE MatchPlayer row that matters to the detail: any PENDING row, and the REJECTED row of the viewer. */
type RequestRow = { userId: string; status: 'PENDING' | 'REJECTED' };

async function loadRequests(
  client: Pick<Prisma.TransactionClient, 'matchPlayer'>,
  matchId: string,
  viewerId: string,
): Promise<RequestRow[]> {
  const rows = await client.matchPlayer.findMany({
    where: { matchId, OR: [{ status: 'PENDING' }, { status: 'REJECTED', userId: viewerId }] },
    select: { userId: true, status: true },
  });
  return rows as RequestRow[];
}

export function toMatchView(m: MatchRow): MatchView {
  return {
    id: m.id,
    bookingId: m.bookingId,
    hostId: m.hostId,
    hostName: m.host.name,
    sport: m.sport,
    capacity: m.capacity,
    joinedCount: m.joinedCount,
    pricePerSlot: m.pricePerSlot,
    status: m.status,
    bookingStatus: m.booking.status,
    startAt: m.booking.startAt.toISOString(),
    endAt: m.booking.endAt.toISOString(),
    courtName: m.booking.court.name,
    venueName: m.booking.court.venue.name,
    venueAddress: m.booking.court.venue.address,
    createdAt: m.createdAt.toISOString(),
    joinMode: m.joinMode,
  };
}

export function toMatchDetailView(m: MatchDetailRow, viewerId: string, now: Date, requests: RequestRow[] = []): MatchDetailView {
  const viewerRole: MatchViewerRole =
    m.hostId === viewerId
      ? 'HOST'
      : m.players.some((p) => p.userId === viewerId)
        ? 'PLAYER'
        : 'NONE';
  // BR-52: a PENDING request is expired when the match is not OPEN or FULL, or the booking has started.
  const requestsLive = (m.status === 'OPEN' || m.status === 'FULL') && m.booking.startAt > now;
  const mine = requests.find((r) => r.userId === viewerId);
  const myRequest = mine && (mine.status === 'REJECTED' || requestsLive) ? mine.status : null;
  const pending = requestsLive ? requests.filter((r) => r.status === 'PENDING').length : 0;
  return {
    ...toMatchView(m),
    viewerRole,
    myRequest,
    ...(viewerRole === 'HOST' ? { pendingCount: pending } : {}),
    // BR-20: only the host of the match sees the phone numbers of players.
    players: m.players.map((p) => ({
      userId: p.userId,
      name: p.user.name,
      phone: viewerRole === 'HOST' ? p.user.phone : null,
      joinedAt: p.joinedAt.toISOString(),
    })),
  };
}

function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e && typeof e === 'object' && depth < 5; depth++) {
    const o = e as {
      code?: unknown;
      originalCode?: unknown;
      meta?: { code?: unknown; driverAdapterError?: { cause?: { originalCode?: unknown } } };
      cause?: unknown;
    };
    if ([o.code, o.originalCode, o.meta?.code, o.meta?.driverAdapterError?.cause?.originalCode].some((c) => c === '23505' || c === 'P2002')) {
      return true;
    }
    e = o.cause;
  }
  return /23505|Match_bookingId_key/.test(String((error as Error)?.message ?? ''));
}

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly notifications?: NotificationsService,
  ) {}

  /** UC-7 (brief F-011): the host opens a match on their own PENDING or CONFIRMED app booking. */
  async create(userId: string, input: CreateMatchRequest): Promise<MatchView> {
    const found = await this.prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: { courtId: true, createdById: true, source: true },
    });
    if (!found || found.createdById !== userId || found.source !== 'APP') {
      throw new NotFoundException(BOOKING_NOT_FOUND);
    }
    const now = this.clock.now();
    let outcome:
      | { kind: 'already_has_match' }
      | { kind: 'not_openable' }
      | { kind: 'created'; match: MatchRow };
    try {
      outcome = await this.prisma.$transaction(async (tx) => {
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
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException(ALREADY_HAS_MATCH);
      if (isDeadlock(error)) throw new ConflictException(BUSY);
      throw error;
    }
    // 409 is thrown after the transaction commits so an overdue booking expired above stays EXPIRED (AC-4).
    if (outcome.kind === 'already_has_match') throw new ConflictException(ALREADY_HAS_MATCH);
    if (outcome.kind === 'not_openable') throw new ConflictException(NOT_OPENABLE);
    return toMatchView(outcome.match);
  }

  /** UC-8 steps 1-2 (brief F-011): public lobby list of OPEN matches starting in the future, ordered by startAt asc. */
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
    await syncLobby().catch((error: unknown) => {
      if (!isDeadlock(error)) throw error;
      return syncLobby().catch((again: unknown) => {
        throw isDeadlock(again) ? new ConflictException(BUSY) : again;
      });
    });
    const rows = await this.prisma.match.findMany({
      where: {
        status: 'OPEN',
        ...(query.sport ? { sport: query.sport } : {}),
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

  /** UC-8 flow 8.2 (brief F-012): list matches where the caller has an ACTIVE MatchPlayer row, ordered by startAt desc. */
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
    await syncJoined().catch((error: unknown) => {
      if (!isDeadlock(error)) throw error;
      return syncJoined().catch((again: unknown) => {
        throw isDeadlock(again) ? new ConflictException(BUSY) : again;
      });
    });
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

  /** UC-8 step 3 (brief F-012): match detail with ACTIVE players and BR-20 phone visibility. */
  async detail(userId: string, matchId: string): Promise<MatchDetailView> {
    const found = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { bookingId: true },
    });
    if (!found) {
      throw new NotFoundException(MATCH_NOT_FOUND);
    }
    const now = this.clock.now();
    const syncMatch = async () => {
      await expireBookings(this.prisma, Prisma.sql`id = ${found.bookingId}::uuid`, now);
      await finishPastMatches(this.prisma, Prisma.sql`b.id = ${found.bookingId}::uuid`, now);
    };
    await syncMatch().catch((error: unknown) => {
      if (!isDeadlock(error)) throw error;
      return syncMatch().catch((again: unknown) => {
        throw isDeadlock(again) ? new ConflictException(BUSY) : again;
      });
    });
    const row = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: WITH_DETAIL_RELATIONS,
    });
    if (!row) {
      throw new NotFoundException(MATCH_NOT_FOUND);
    }
    return toMatchDetailView(row, userId, now, await loadRequests(this.prisma, matchId, userId));
  }

  /** UC-8 step 4 (brief F-012): a user joins an OPEN match. */
  async join(userId: string, matchId: string): Promise<MatchDetailView> {
    const found = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { bookingId: true, booking: { select: { courtId: true } } },
    });
    if (!found) {
      throw new NotFoundException(MATCH_NOT_FOUND);
    }
    const now = this.clock.now();
    let outcome:
      | { kind: 'not_joinable' }
      | { kind: 'already_in_match' }
      | { kind: 'match_full' }
      | { kind: 'join_rejected' }
      | { kind: 'joined'; match: MatchDetailRow; requests: RequestRow[] };
    try {
      outcome = await this.prisma.$transaction(async (tx) => {
        await lockVenueOf(tx, found.booking.courtId);
        await tx.$executeRaw`SELECT 1 FROM "Court" WHERE "id" = ${found.booking.courtId}::uuid FOR UPDATE`;
        await expireBookings(tx, Prisma.sql`id = ${found.bookingId}::uuid`, now);
        await finishPastMatches(tx, Prisma.sql`b.id = ${found.bookingId}::uuid`, now);
        const locked = await tx.$executeRaw`SELECT 1 FROM "Match" WHERE "id" = ${matchId}::uuid FOR UPDATE`;
        if (!locked) {
          throw new NotFoundException(MATCH_NOT_FOUND);
        }
        const current = await tx.match.findUniqueOrThrow({
          where: { id: matchId },
          include: {
            booking: { select: { status: true, startAt: true } },
            players: { where: { userId }, select: { status: true } },
          },
        });
        if (
          (current.status !== 'OPEN' && current.status !== 'FULL') ||
          (current.booking.status !== 'PENDING' && current.booking.status !== 'CONFIRMED') ||
          current.booking.startAt <= now
        ) {
          return { kind: 'not_joinable' };
        }
        if (current.players[0]?.status === 'ACTIVE') {
          return { kind: 'already_in_match' };
        }
        if (current.joinMode === 'APPROVAL') {
          // BR-50: a request takes no slot, so a FULL match still takes requests.
          const mine = current.players[0]?.status;
          if (mine === 'REJECTED') {
            return { kind: 'join_rejected' };
          }
          if (mine !== 'PENDING') {
            await tx.matchPlayer.upsert({
              where: { matchId_userId: { matchId, userId } },
              create: { matchId, userId, status: 'PENDING', joinedAt: now, leftAt: null },
              update: { status: 'PENDING', joinedAt: now, leftAt: null },
            });
            // AC-11: the host gets one notification for each new request, none for a repeated join.
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
        if (current.joinedCount >= current.capacity || current.status === 'FULL') {
          return { kind: 'match_full' };
        }
        await tx.matchPlayer.upsert({
          where: { matchId_userId: { matchId, userId } },
          create: { matchId, userId, status: 'ACTIVE', joinedAt: now, leftAt: null },
          update: { status: 'ACTIVE', joinedAt: now, leftAt: null },
        });
        const nextJoined = current.joinedCount + 1;
        const updated = await tx.match.update({
          where: { id: matchId },
          data: {
            joinedCount: nextJoined,
            status: nextJoined >= current.capacity ? 'FULL' : 'OPEN',
          },
          include: WITH_DETAIL_RELATIONS,
        });
        return { kind: 'joined', match: updated, requests: await loadRequests(tx, matchId, userId) };
      });
    } catch (error) {
      if (isDeadlock(error)) throw new ConflictException(BUSY);
      throw error;
    }
    // 409 is thrown after the transaction commits so lazy EXPIRED/CANCELLED/FINISHED updates stay persisted (AC-5).
    if (outcome.kind === 'not_joinable') throw new ConflictException(NOT_JOINABLE_MESSAGE);
    if (outcome.kind === 'already_in_match') throw new ConflictException(ALREADY_IN_MATCH_MESSAGE);
    if (outcome.kind === 'match_full') throw new ConflictException(MATCH_FULL_MESSAGE);
    if (outcome.kind === 'join_rejected') throw new ConflictException(JOIN_REJECTED_MESSAGE);
    return toMatchDetailView(outcome.match, userId, now, outcome.requests);
  }

  /** UC-8 flow 8.1 (brief F-012): a non-host ACTIVE player leaves a match before startAt (BR-18). */
  async leave(userId: string, matchId: string): Promise<MatchDetailView> {
    const found = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { bookingId: true, booking: { select: { courtId: true } } },
    });
    if (!found) {
      throw new NotFoundException(MATCH_NOT_FOUND);
    }
    const now = this.clock.now();
    let outcome:
      | { kind: 'host_cannot_leave' }
      | { kind: 'not_in_match' }
      | { kind: 'not_leavable' }
      | { kind: 'leave_started' }
      | { kind: 'left'; match: MatchDetailRow; requests: RequestRow[] };
    try {
      outcome = await this.prisma.$transaction(async (tx) => {
        await lockVenueOf(tx, found.booking.courtId);
        await tx.$executeRaw`SELECT 1 FROM "Court" WHERE "id" = ${found.booking.courtId}::uuid FOR UPDATE`;
        await expireBookings(tx, Prisma.sql`id = ${found.bookingId}::uuid`, now);
        await finishPastMatches(tx, Prisma.sql`b.id = ${found.bookingId}::uuid`, now);
        const locked = await tx.$executeRaw`SELECT 1 FROM "Match" WHERE "id" = ${matchId}::uuid FOR UPDATE`;
        if (!locked) {
          throw new NotFoundException(MATCH_NOT_FOUND);
        }
        const current = await tx.match.findUniqueOrThrow({
          where: { id: matchId },
          include: {
            booking: { select: { status: true, startAt: true } },
            players: { where: { userId }, select: { status: true } },
          },
        });
        if (current.hostId === userId) {
          return { kind: 'host_cannot_leave' };
        }
        if (current.players[0]?.status === 'PENDING') {
          // AC-9: cancel the request. The row is deleted so a new request starts clean.
          await tx.matchPlayer.delete({ where: { matchId_userId: { matchId, userId } } });
          await tx.$executeRaw`SELECT pg_notify('lobby', ${matchId})`;
          const unchanged = await tx.match.findUniqueOrThrow({ where: { id: matchId }, include: WITH_DETAIL_RELATIONS });
          return { kind: 'left', match: unchanged, requests: await loadRequests(tx, matchId, userId) };
        }
        if (current.players[0]?.status !== 'ACTIVE') {
          return { kind: 'not_in_match' };
        }
        if (current.status !== 'OPEN' && current.status !== 'FULL') {
          return { kind: 'not_leavable' };
        }
        if (current.booking.startAt <= now) {
          return { kind: 'leave_started' };
        }
        await tx.matchPlayer.update({
          where: { matchId_userId: { matchId, userId } },
          data: { status: 'LEFT', leftAt: now },
        });
        const nextJoined = current.joinedCount - 1;
        const updated = await tx.match.update({
          where: { id: matchId },
          data: {
            joinedCount: nextJoined,
            status: 'OPEN',
          },
          include: WITH_DETAIL_RELATIONS,
        });
        return { kind: 'left', match: updated, requests: await loadRequests(tx, matchId, userId) };
      });
    } catch (error) {
      if (isDeadlock(error)) throw new ConflictException(BUSY);
      throw error;
    }
    // 409 is thrown after the transaction commits so lazy EXPIRED/CANCELLED/FINISHED updates stay persisted (AC-6).
    if (outcome.kind === 'host_cannot_leave') throw new ConflictException(HOST_CANNOT_LEAVE_MESSAGE);
    if (outcome.kind === 'not_in_match') throw new ConflictException(NOT_IN_MATCH_MESSAGE);
    if (outcome.kind === 'not_leavable') throw new ConflictException(NOT_LEAVABLE_MESSAGE);
    if (outcome.kind === 'leave_started') throw new ConflictException(LEAVE_STARTED_MESSAGE);
    return toMatchDetailView(outcome.match, userId, now, outcome.requests);
  }

  /** Brief F-028 (UC-15, BR-20): the host reads the waiting requests, oldest first. It runs the same lazy sync as `detail` first (BR-52), so it can write expired states. */
  async listRequests(userId: string, matchId: string): Promise<MatchRequestView[]> {
    const found = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { hostId: true, bookingId: true },
    });
    if (!found) {
      throw new NotFoundException(MATCH_NOT_FOUND);
    }
    if (found.hostId !== userId) {
      throw new ForbiddenException(NOT_HOST);
    }
    const now = this.clock.now();
    const syncMatch = async () => {
      await expireBookings(this.prisma, Prisma.sql`id = ${found.bookingId}::uuid`, now);
      await finishPastMatches(this.prisma, Prisma.sql`b.id = ${found.bookingId}::uuid`, now);
    };
    await syncMatch().catch((error: unknown) => {
      if (!isDeadlock(error)) throw error;
      return syncMatch().catch((again: unknown) => {
        throw isDeadlock(again) ? new ConflictException(BUSY) : again;
      });
    });
    const fresh = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { status: true, booking: { select: { startAt: true } } },
    });
    // BR-52: requests of a closed or started match are expired.
    if (!fresh || (fresh.status !== 'OPEN' && fresh.status !== 'FULL') || fresh.booking.startAt <= now) {
      return [];
    }
    const rows = await this.prisma.matchPlayer.findMany({
      where: { matchId, status: 'PENDING' },
      orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
      include: { user: { select: { name: true, phone: true } } },
    });
    return rows.map((r) => ({ userId: r.userId, name: r.user.name, phone: r.user.phone, requestedAt: r.joinedAt.toISOString() }));
  }

  /** Brief F-028 (UC-15, BR-50): the host approves a PENDING request. The player takes a slot when the match has room. */
  approveRequest(hostId: string, matchId: string, targetUserId: string): Promise<MatchDetailView> {
    return this.decideRequest('approve', hostId, matchId, targetUserId);
  }

  /** Brief F-028 (UC-15, BR-51): the host rejects a PENDING request. */
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
    if (!found) {
      throw new NotFoundException(MATCH_NOT_FOUND);
    }
    if (found.hostId !== hostId) {
      throw new ForbiddenException(NOT_HOST);
    }
    const now = this.clock.now();
    let outcome:
      | { kind: 'expired' }
      | { kind: 'not_pending' }
      | { kind: 'match_full' }
      | { kind: 'done'; match: MatchDetailRow; requests: RequestRow[] };
    try {
      outcome = await this.prisma.$transaction(async (tx) => {
        await lockVenueOf(tx, found.booking.courtId);
        await tx.$executeRaw`SELECT 1 FROM "Court" WHERE "id" = ${found.booking.courtId}::uuid FOR UPDATE`;
        await expireBookings(tx, Prisma.sql`id = ${found.bookingId}::uuid`, now);
        await finishPastMatches(tx, Prisma.sql`b.id = ${found.bookingId}::uuid`, now);
        const locked = await tx.$executeRaw`SELECT 1 FROM "Match" WHERE "id" = ${matchId}::uuid FOR UPDATE`;
        if (!locked) {
          throw new NotFoundException(MATCH_NOT_FOUND);
        }
        const current = await tx.match.findUniqueOrThrow({
          where: { id: matchId },
          include: {
            booking: { select: { status: true, startAt: true } },
            players: { where: { userId: targetUserId }, select: { status: true } },
          },
        });
        // BR-52: a request of a closed or started match is expired.
        if (
          (current.status !== 'OPEN' && current.status !== 'FULL') ||
          (current.booking.status !== 'PENDING' && current.booking.status !== 'CONFIRMED') ||
          current.booking.startAt <= now
        ) {
          return { kind: 'expired' };
        }
        const target = current.players[0];
        if (!target) {
          throw new NotFoundException(REQUEST_NOT_FOUND);
        }
        if (target.status !== 'PENDING') {
          return { kind: 'not_pending' };
        }
        const key = { matchId_userId: { matchId, userId: targetUserId } };
        if (action === 'reject') {
          await tx.matchPlayer.update({ where: key, data: { status: 'REJECTED' } });
          await this.notifications?.createNotification(tx, {
            userId: targetUserId,
            type: 'MATCH_JOIN_REJECTED',
            bookingId: found.bookingId,
            matchId,
          });
          // The Match trigger does not fire here, so the lobby event is sent by hand.
          await tx.$executeRaw`SELECT pg_notify('lobby', ${matchId})`;
          const unchanged = await tx.match.findUniqueOrThrow({ where: { id: matchId }, include: WITH_DETAIL_RELATIONS });
          return { kind: 'done', match: unchanged, requests: await loadRequests(tx, matchId, hostId) };
        }
        if (current.joinedCount >= current.capacity) {
          return { kind: 'match_full' };
        }
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
      });
    } catch (error) {
      if (isDeadlock(error)) throw new ConflictException(BUSY);
      throw error;
    }
    // 409 is thrown after the transaction commits so lazy EXPIRED/CANCELLED/FINISHED updates stay persisted.
    if (outcome.kind === 'expired') throw new ConflictException(REQUEST_EXPIRED_MESSAGE);
    if (outcome.kind === 'not_pending') throw new ConflictException(REQUEST_NOT_PENDING_MESSAGE);
    if (outcome.kind === 'match_full') throw new ConflictException(MATCH_FULL_MESSAGE);
    return toMatchDetailView(outcome.match, hostId, now, outcome.requests);
  }

  /** UC-9 (brief F-011): the host cancels their match, which also cancels the underlying booking (BR-17). */
  async cancel(userId: string, matchId: string): Promise<MatchView> {
    const found = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { hostId: true, booking: { select: { courtId: true } } },
    });
    if (!found || found.hostId !== userId) {
      throw new NotFoundException(MATCH_NOT_FOUND);
    }
    const now = this.clock.now();
    let outcome:
      | { kind: 'call_owner' }
      | { kind: 'not_cancellable' }
      | { kind: 'cancelled'; match: MatchRow };
    try {
      outcome = await this.prisma.$transaction(async (tx) => {
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
      });
    } catch (error) {
      if (isDeadlock(error)) throw new ConflictException(BUSY);
      throw error;
    }
    // 409 is thrown after the transaction commits so an overdue or finished match stays updated in DB (AC-12).
    if (outcome.kind === 'call_owner') throw new ConflictException(CALL_OWNER_MESSAGE);
    if (outcome.kind === 'not_cancellable') throw new ConflictException(NOT_CANCELLABLE);
    return toMatchView(outcome.match);
  }
}
