import { describe, expect, it } from 'vitest';
import {
  CancelBookingInput,
  GetAvailabilityInput,
  JoinMatchInput,
  LeaveMatchInput,
  ListMatchesInput,
  ListMyBookingsInput,
  MCP_TOOL_NAMES,
  MCP_WRITE_TOOLS,
  OpenMatchInput,
  RequestBookingInput,
  SearchVenuesInput,
} from './mcp.ts';

const ID = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';

describe('MCP contract (brief F-036, Contract)', () => {
  it('AC-1: MCP_TOOL_NAMES has exactly the 9 tool names', () => {
    expect([...MCP_TOOL_NAMES]).toEqual([
      'search_venues',
      'get_availability',
      'request_booking',
      'list_my_bookings',
      'cancel_booking',
      'list_matches',
      'open_match',
      'join_match',
      'leave_match',
    ]);
    for (const name of MCP_WRITE_TOOLS) expect(MCP_TOOL_NAMES).toContain(name);
    expect(MCP_WRITE_TOOLS).toHaveLength(5);
  });

  it('AC-1: RequestBookingInput rejects the extra key userId', () => {
    const ok = { courtId: ID, startAt: '2026-12-01T11:00:00Z', endAt: '2026-12-01T12:30:00Z' };
    expect(RequestBookingInput.safeParse(ok).success).toBe(true);
    expect(RequestBookingInput.safeParse({ ...ok, userId: ID }).success).toBe(false);
  });

  it('AC-1: GetAvailabilityInput rejects the date 2026-13-40', () => {
    expect(GetAvailabilityInput.safeParse({ courtId: ID, date: '2026-12-01' }).success).toBe(true);
    expect(GetAvailabilityInput.safeParse({ courtId: ID, date: '2026-13-40' }).success).toBe(false);
  });

  it('AC-1: SearchVenuesInput rejects sport TENNIS and a name of 101 characters', () => {
    expect(SearchVenuesInput.safeParse({}).success).toBe(true);
    expect(SearchVenuesInput.safeParse({ sport: 'FOOTBALL', name: 'an' }).success).toBe(true);
    expect(SearchVenuesInput.safeParse({ name: 'a'.repeat(100) }).success).toBe(true);
    expect(SearchVenuesInput.safeParse({ sport: 'TENNIS' }).success).toBe(false);
    expect(SearchVenuesInput.safeParse({ name: 'a'.repeat(101) }).success).toBe(false);
  });

  it('AC-1: JoinMatchInput rejects the matchId abc', () => {
    expect(JoinMatchInput.safeParse({ matchId: ID }).success).toBe(true);
    expect(JoinMatchInput.safeParse({ matchId: 'abc' }).success).toBe(false);
    expect(LeaveMatchInput.safeParse({ matchId: 'abc' }).success).toBe(false);
  });

  it('AC-1: every input schema is strict and none accepts userId', () => {
    const inputs = [
      [SearchVenuesInput, {}],
      [GetAvailabilityInput, { courtId: ID, date: '2026-12-01' }],
      [RequestBookingInput, { courtId: ID, startAt: '2026-12-01T11:00:00Z', endAt: '2026-12-01T12:30:00Z' }],
      [ListMyBookingsInput, {}],
      [CancelBookingInput, { bookingId: ID }],
      [ListMatchesInput, {}],
      [OpenMatchInput, { bookingId: ID, capacity: 10, pricePerSlot: 50000 }],
      [JoinMatchInput, { matchId: ID }],
      [LeaveMatchInput, { matchId: ID }],
    ] as const;
    for (const [schema, valid] of inputs) {
      expect(schema.safeParse(valid).success).toBe(true);
      expect(schema.safeParse({ ...valid, userId: ID }).success).toBe(false);
      expect(schema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
    }
  });
});
