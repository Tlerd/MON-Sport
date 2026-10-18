import { z } from 'zod';
import { Messages, PRICE_MAX } from './account.ts';
import { BookingStatus, MatchStatus, MatchSummary, Sport } from './booking.ts';

// Brief F-011 (UC-7, UC-8, UC-9): matches in the lobby. Names follow docs/requirements/data-dictionary.md.
export { MatchStatus, MatchSummary };

export const MatchPlayerStatus = z.enum(['ACTIVE', 'LEFT']);
export type MatchPlayerStatus = z.infer<typeof MatchPlayerStatus>;

export const MATCH_CAPACITY_MESSAGE = 'Số suất từ 2 đến 30';
export const MATCH_PRICE_MESSAGE = 'Giá mỗi suất không hợp lệ';

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
