import { z } from 'zod';
import { Messages, PRICE_MAX } from './account.ts';
import { BookingStatus, MatchStatus, MatchSummary, Phone, Sport } from './booking.ts';

// Brief F-011 and F-012 (UC-7, UC-8, UC-9): matches in the lobby. Names follow docs/requirements/data-dictionary.md.
export { MatchStatus, MatchSummary };

export const MatchPlayerStatus = z.enum(['ACTIVE', 'LEFT']);
export type MatchPlayerStatus = z.infer<typeof MatchPlayerStatus>;

export const MATCH_CAPACITY_MESSAGE = 'Số suất từ 2 đến 30';
export const MATCH_PRICE_MESSAGE = 'Giá mỗi suất không hợp lệ';

// Brief F-012 (UC-8, BR-15, BR-18): join and leave error messages.
export const MATCH_FULL_MESSAGE = 'Trận đã đủ người';
export const ALREADY_IN_MATCH_MESSAGE = 'Bạn đã ở trong trận này';
export const NOT_JOINABLE_MESSAGE = 'Trận này không vào được nữa';
export const HOST_CANNOT_LEAVE_MESSAGE = 'Host không rời trận được. Hãy hủy trận';
export const NOT_IN_MATCH_MESSAGE = 'Bạn không ở trong trận này';
export const LEAVE_STARTED_MESSAGE = 'Đã tới giờ bắt đầu, không rời trận được nữa';
export const NOT_LEAVABLE_MESSAGE = 'Trận này không rời được nữa';

const known = new Set<string>([MATCH_CAPACITY_MESSAGE, MATCH_PRICE_MESSAGE]);

/** The Vietnamese error text for a match request, or the generic text when Zod gave an English one. */
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
  })
  .strict();
export type CreateMatchRequest = z.infer<typeof CreateMatchRequest>;

export const MatchLobbyQuery = z
  .object({
    sport: Sport.optional(),
    date: z.iso.date().optional(),
  })
  .strict();
export type MatchLobbyQuery = z.infer<typeof MatchLobbyQuery>;

/**
 * Brief F-011 (BR-20): shown in the public lobby and after opening or cancelling a match.
 * It carries the host's display name and never carries a phone number.
 */
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

/**
 * Brief F-012 (UC-8, BR-20): match detail with active players.
 * `phone` is non-null only when `viewerRole === 'HOST'`.
 */
export const MatchDetailView = MatchView.extend({
  players: z.array(MatchPlayerView),
  viewerRole: MatchViewerRole,
}).refine((m) => m.players.every((p) => (m.viewerRole === 'HOST' ? p.phone !== null : p.phone === null)));
export type MatchDetailView = z.infer<typeof MatchDetailView>;
