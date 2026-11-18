import type { MatchDetailView, MatchView, MatchViewerRole } from '@monsport/shared';
import type { Prisma } from '../../generated/prisma/client.js';

export const WITH_RELATIONS = {
  host: { select: { name: true, skillLevel: true } },
  booking: {
    include: {
      court: {
        include: { venue: true },
      },
    },
  },
} satisfies Prisma.MatchInclude;

export const WITH_DETAIL_RELATIONS = {
  ...WITH_RELATIONS,
  players: {
    where: { status: 'ACTIVE' },
    orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
    include: {
      user: { select: { name: true, phone: true } },
    },
  },
} satisfies Prisma.MatchInclude;

export type MatchRow = Prisma.MatchGetPayload<{ include: typeof WITH_RELATIONS }>;
export type MatchDetailRow = Prisma.MatchGetPayload<{ include: typeof WITH_DETAIL_RELATIONS }>;
export type RequestRow = { userId: string; status: 'PENDING' | 'REJECTED' };

export async function loadRequests(
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
    hostSkillLevel: m.host.skillLevel ?? null,
  };
}

export function toMatchDetailView(m: MatchDetailRow, viewerId: string, now: Date, requests: RequestRow[] = []): MatchDetailView {
  const viewerRole: MatchViewerRole =
    m.hostId === viewerId
      ? 'HOST'
      : m.players.some((p) => p.userId === viewerId)
        ? 'PLAYER'
        : 'NONE';
  const requestsLive = (m.status === 'OPEN' || m.status === 'FULL') && m.booking.startAt > now;
  const mine = requests.find((r) => r.userId === viewerId);
  const myRequest = mine && (mine.status === 'REJECTED' || requestsLive) ? mine.status : null;
  const pending = requestsLive ? requests.filter((r) => r.status === 'PENDING').length : 0;
  return {
    ...toMatchView(m),
    viewerRole,
    myRequest,
    ...(viewerRole === 'HOST' ? { pendingCount: pending } : {}),
    players: m.players.map((p) => ({
      userId: p.userId,
      name: p.user.name,
      phone: viewerRole === 'HOST' ? p.user.phone : null,
      joinedAt: p.joinedAt.toISOString(),
    })),
  };
}
