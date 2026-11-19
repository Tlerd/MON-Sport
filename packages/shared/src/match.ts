import { z } from 'zod';
import { Messages, PRICE_MAX, SkillLevel } from './account.ts';
import { BookingStatus, MatchStatus, MatchSummary, Phone, Sport } from './booking.ts';
import { PlayerReputation } from './rating.ts';

export { MatchStatus, MatchSummary };

export const JoinMode = z.enum(['INSTANT', 'APPROVAL']);
export type JoinMode = z.infer<typeof JoinMode>;

export const MatchPlayerStatus = z.enum(['ACTIVE', 'LEFT', 'PENDING', 'REJECTED']);
export type MatchPlayerStatus = z.infer<typeof MatchPlayerStatus>;

export const MATCH_CAPACITY_MESSAGE = 'Số suất từ 2 đến 30';
export const MATCH_PRICE_MESSAGE = 'Giá mỗi suất không hợp lệ';

export const MATCH_FULL_MESSAGE = 'Trận đã đủ người';
export const ALREADY_IN_MATCH_MESSAGE = 'Bạn đã ở trong trận này';
export const NOT_JOINABLE_MESSAGE = 'Trận này không vào được nữa';
export const HOST_CANNOT_LEAVE_MESSAGE = 'Host không rời trận được. Hãy hủy trận';
export const NOT_IN_MATCH_MESSAGE = 'Bạn không ở trong trận này';
export const LEAVE_STARTED_MESSAGE = 'Đã tới giờ bắt đầu, không rời trận được nữa';
export const NOT_LEAVABLE_MESSAGE = 'Trận này không rời được nữa';

export const JOIN_REJECTED_MESSAGE = 'Host đã từ chối yêu cầu của bạn';
export const REQUEST_EXPIRED_MESSAGE = 'Yêu cầu này đã hết hạn';
export const REQUEST_NOT_PENDING_MESSAGE = 'Yêu cầu này không còn chờ duyệt';

const known = new Set<string>([MATCH_CAPACITY_MESSAGE, MATCH_PRICE_MESSAGE]);

export function matchErrorMessage(error: z.ZodError): string {
  const message = error.issues[0]?.message ?? '';
  return known.has(message) ? message : Messages.invalid;
}

const Instant = z.iso.datetime({ offset: true });

export const CreateMatchRequest = z
  .object({
    bookingId: z.uuid(),
    capacity: z.int(MATCH_CAPACITY_MESSAGE).min(2, MATCH_CAPACITY_MESSAGE).max(30, MATCH_CAPACITY_MESSAGE),
    pricePerSlot: z.int(MATCH_PRICE_MESSAGE).min(0, MATCH_PRICE_MESSAGE).max(PRICE_MAX, MATCH_PRICE_MESSAGE),
    joinMode: JoinMode.optional(),
  })
  .strict();
export type CreateMatchRequest = z.infer<typeof CreateMatchRequest>;

export const MatchLobbyQuery = z
  .object({
    sport: Sport.optional(),
    date: z.iso.date().optional(),
    level: SkillLevel.optional(),
  })
  .strict();
export type MatchLobbyQuery = z.infer<typeof MatchLobbyQuery>;

export const MatchView = z.object({
  id: z.uuid(),
  bookingId: z.uuid(),
  hostId: z.uuid(),
  hostName: z.string(),
  sport: Sport,
  capacity: z.int().min(2).max(30),
  joinedCount: z.int().nonnegative(),
  pricePerSlot: z.int().nonnegative(),
  status: MatchStatus,
  bookingStatus: BookingStatus,
  startAt: Instant,
  endAt: Instant,
  courtName: z.string(),
  venueName: z.string(),
  venueAddress: z.string(),
  createdAt: Instant,
  joinMode: JoinMode.optional(),
  hostSkillLevel: SkillLevel.nullable().optional(),
});
export type MatchView = z.infer<typeof MatchView>;

export const MatchViewerRole = z.enum(['HOST', 'PLAYER', 'NONE']);
export type MatchViewerRole = z.infer<typeof MatchViewerRole>;

export const MatchPlayerView = z.object({
  userId: z.uuid(),
  name: z.string(),
  phone: Phone.nullable(),
  joinedAt: Instant,
});
export type MatchPlayerView = z.infer<typeof MatchPlayerView>;

export const MatchDetailView = MatchView.extend({
  players: z.array(MatchPlayerView),
  viewerRole: MatchViewerRole,
  myRequest: z.enum(['PENDING', 'REJECTED']).nullable().optional(),
  pendingCount: z.int().nonnegative().optional(),
}).refine((m) => m.players.every((p) => (m.viewerRole === 'HOST' ? p.phone !== null : p.phone === null)));
export type MatchDetailView = z.infer<typeof MatchDetailView>;

export const MatchRequestView = z.object({
  userId: z.uuid(),
  name: z.string(),
  phone: Phone,
  requestedAt: Instant,
  reputation: PlayerReputation.optional(),
});
export type MatchRequestView = z.infer<typeof MatchRequestView>;

export const MatchRequestListView = z.array(MatchRequestView);
export type MatchRequestListView = z.infer<typeof MatchRequestListView>;
