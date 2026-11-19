import { z } from 'zod';
import { Availability, AvailabilityQuery } from './availability.ts';
import { BookingView, CreateBookingRequest, MyBookingView, Phone, Sport, VenueView } from './booking.ts';
import { CreateMatchRequest, MatchDetailView, MatchLobbyQuery, MatchView } from './match.ts';

export const MCP_TOOL_NAMES = [
  'search_venues',
  'get_availability',
  'request_booking',
  'list_my_bookings',
  'cancel_booking',
  'list_matches',
  'open_match',
  'join_match',
  'leave_match',
] as const;
export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

export const MCP_WRITE_TOOLS = ['request_booking', 'cancel_booking', 'open_match', 'join_match', 'leave_match'] as const;
export const MCP_READ_TOOLS = ['search_venues', 'get_availability', 'list_my_bookings', 'list_matches'] as const;

export const SearchVenuesInput = z.object({ sport: Sport.optional(), name: z.string().trim().min(1).max(100).optional() }).strict();
export type SearchVenuesInput = z.infer<typeof SearchVenuesInput>;
export const GetAvailabilityInput = AvailabilityQuery.extend({ courtId: z.uuid() }).strict();
export type GetAvailabilityInput = z.infer<typeof GetAvailabilityInput>;
export const RequestBookingInput = CreateBookingRequest.strict();
export type RequestBookingInput = z.infer<typeof RequestBookingInput>;
export const ListMyBookingsInput = z.object({}).strict();
export type ListMyBookingsInput = z.infer<typeof ListMyBookingsInput>;
export const CancelBookingInput = z.object({ bookingId: z.uuid() }).strict();
export type CancelBookingInput = z.infer<typeof CancelBookingInput>;
export const ListMatchesInput = MatchLobbyQuery;
export type ListMatchesInput = z.infer<typeof ListMatchesInput>;
export const OpenMatchInput = CreateMatchRequest;
export type OpenMatchInput = z.infer<typeof OpenMatchInput>;
export const JoinMatchInput = z.object({ matchId: z.uuid() }).strict();
export type JoinMatchInput = z.infer<typeof JoinMatchInput>;
export const LeaveMatchInput = JoinMatchInput;
export type LeaveMatchInput = z.infer<typeof LeaveMatchInput>;

export const SearchVenuesOutput = z.object({ venues: z.array(VenueView) });
export type SearchVenuesOutput = z.infer<typeof SearchVenuesOutput>;
export const GetAvailabilityOutput = Availability;
export type GetAvailabilityOutput = z.infer<typeof GetAvailabilityOutput>;
export const RequestBookingOutput = z.object({
  booking: BookingView,
  venueName: z.string(),
  courtName: z.string(),
  venuePhone: Phone,
  message: z.string(),
});
export type RequestBookingOutput = z.infer<typeof RequestBookingOutput>;
export const ListMyBookingsOutput = z.object({ bookings: z.array(MyBookingView) });
export type ListMyBookingsOutput = z.infer<typeof ListMyBookingsOutput>;
export const CancelBookingOutput = z.object({ booking: MyBookingView });
export type CancelBookingOutput = z.infer<typeof CancelBookingOutput>;
export const ListMatchesOutput = z.object({ matches: z.array(MatchView) });
export type ListMatchesOutput = z.infer<typeof ListMatchesOutput>;
export const OpenMatchOutput = z.object({ match: MatchView });
export type OpenMatchOutput = z.infer<typeof OpenMatchOutput>;
export const JoinMatchOutput = z.object({ match: MatchDetailView });
export type JoinMatchOutput = z.infer<typeof JoinMatchOutput>;
export const LeaveMatchOutput = JoinMatchOutput;
export type LeaveMatchOutput = z.infer<typeof LeaveMatchOutput>;
