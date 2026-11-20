import { describe, expect, it } from 'vitest';
import type { MatchView } from '@monsport/shared';
import { lobbyChips, lobbyMatches, matchesForDay } from './lobby.ts';

// @monsport/client has no Node types, so reach process through globalThis.
const proc = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process;

const HOST_ID = '00000000-0000-4000-8000-0000000000a1';
const USER_ID = '00000000-0000-4000-8000-0000000000a2';

function makeMatch(n: number, overrides: Partial<MatchView> = {}): MatchView {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    bookingId: '00000000-0000-4000-8000-0000000000b1',
    hostId: HOST_ID,
    hostName: 'Host',
    sport: 'BADMINTON',
    capacity: 10,
    joinedCount: 4,
    pricePerSlot: 40_000,
    status: 'OPEN',
    bookingStatus: 'CONFIRMED',
    startAt: '2026-11-03T20:00:00+07:00',
    endAt: '2026-11-03T21:00:00+07:00',
    courtName: 'San 1',
    venueName: 'Venue',
    venueAddress: 'Address',
    createdAt: '2026-11-01T10:00:00+07:00',
    ...overrides,
  } as MatchView;
}

const now = new Date('2026-11-02T10:00:00+07:00');
const m1 = makeMatch(1);
const m2 = makeMatch(2, {
  sport: 'FOOTBALL',
  joinedCount: 6,
  capacity: 14,
  bookingStatus: 'PENDING',
  startAt: '2026-11-04T18:00:00+07:00',
  endAt: '2026-11-04T19:00:00+07:00',
});
const m3 = makeMatch(3, { startAt: '2026-11-02T07:00:00+07:00', endAt: '2026-11-02T08:00:00+07:00' });
const m4 = makeMatch(4, {
  sport: 'FOOTBALL',
  status: 'FULL',
  startAt: '2026-11-03T19:00:00+07:00',
  endAt: '2026-11-03T20:00:00+07:00',
});

function inEachTz(fn: () => void) {
  const before = proc.env.TZ;
  try {
    for (const tz of ['UTC', 'America/New_York']) {
      proc.env.TZ = tz;
      fn();
    }
  } finally {
    if (before === undefined) delete proc.env.TZ;
    else proc.env.TZ = before;
  }
}

const ids = (cards: { match: MatchView }[]) => cards.map((c) => c.match.id);

describe('lobby helpers', () => {
  it('AC-1: merges feed and joined rows, hides past rows, sorts by startAt', () => {
    inEachTz(() => {
      const cards = lobbyMatches([m1, m2, m3], [m4], now, {});
      expect(ids(cards)).toEqual([m4.id, m1.id, m2.id]);
      expect(cards.map((c) => c.joined)).toEqual([true, false, false]);
    });
  });

  it('AC-1: drops duplicates by id and marks the joined row', () => {
    const cards = lobbyMatches([m1, m2], [m1, m4], now, {});
    expect(ids(cards)).toEqual([m4.id, m1.id, m2.id]);
    expect(cards.find((c) => c.match.id === m1.id)?.joined).toBe(true);
  });

  it('AC-1: ignores joined rows that are not OPEN or FULL, or already started', () => {
    const cancelled = makeMatch(5, { status: 'CANCELLED' });
    const past = makeMatch(6, { status: 'OPEN', startAt: '2026-11-02T09:00:00+07:00' });
    expect(ids(lobbyMatches([], [cancelled, past], now, {}))).toEqual([]);
  });

  it('AC-1: sorts ties by createdAt ascending and flags the host', () => {
    const a = makeMatch(7, { createdAt: '2026-11-01T12:00:00+07:00' });
    const b = makeMatch(8, { createdAt: '2026-11-01T11:00:00+07:00', hostId: USER_ID });
    const cards = lobbyMatches([a, b], [], now, {}, USER_ID);
    expect(ids(cards)).toEqual([b.id, a.id]);
    expect(cards.map((c) => c.isHost)).toEqual([true, false]);
  });

  it('AC-1: does not mutate the inputs', () => {
    const rows = [m2, m1, m3];
    const joined = [m4];
    const rowsCopy = structuredClone(rows);
    const joinedCopy = structuredClone(joined);
    lobbyMatches(rows, joined, now, { sport: 'FOOTBALL' });
    expect(rows).toEqual(rowsCopy);
    expect(joined).toEqual(joinedCopy);
  });

  it('AC-2: applies sport and Asia/Ho_Chi_Minh date to joined rows too', () => {
    inEachTz(() => {
      expect(ids(lobbyMatches([m1, m2], [m4], now, { sport: 'FOOTBALL' }))).toEqual([m4.id, m2.id]);
      expect(ids(lobbyMatches([m1, m2], [m4], now, { sport: 'BADMINTON' }))).toEqual([m1.id]);
      expect(ids(lobbyMatches([m1, m2], [m4], now, { sport: 'FOOTBALL', date: '2026-11-03' }))).toEqual([m4.id]);
      expect(ids(lobbyMatches([m1, m2], [m4], now, { sport: 'FOOTBALL', date: '2026-11-04' }))).toEqual([m2.id]);
      expect(ids(lobbyMatches([m1, m2], [m4], now, { date: '2026-11-05' }))).toEqual([]);
    });
  });

  it('AC-5: applies the host level to joined rows too, and a host without a level shows only without a filter', () => {
    const khá = makeMatch(10, { hostSkillLevel: 'ADVANCED' });
    const trungBinh = makeMatch(11, { hostSkillLevel: 'INTERMEDIATE' });
    const none = makeMatch(12, { hostSkillLevel: null });
    expect(ids(lobbyMatches([khá], [trungBinh, none], now, { level: 'ADVANCED' }))).toEqual([khá.id]);
    expect(ids(lobbyMatches([khá], [trungBinh, none], now, {})).sort()).toEqual([khá.id, trungBinh.id, none.id].sort());
  });

  it('AC-2: a late night match belongs to its Asia/Ho_Chi_Minh date', () => {
    inEachTz(() => {
      const late = makeMatch(9, { startAt: '2026-11-03T23:30:00+07:00' });
      expect(ids(lobbyMatches([late], [], now, { date: '2026-11-03' }))).toEqual([late.id]);
      expect(ids(lobbyMatches([late], [], now, { date: '2026-11-04' }))).toEqual([]);
      expect(matchesForDay([late, m2], '2026-11-03')).toEqual([late]);
    });
  });

  it('AC-2: lobbyChips gives 7 days from today in Asia/Ho_Chi_Minh', () => {
    inEachTz(() => {
      // 22:00 UTC on 1 Nov is already 2 Nov in Vietnam.
      const chips = lobbyChips(new Date('2026-11-01T22:00:00Z'));
      expect(chips).toHaveLength(7);
      expect(chips[0]).toEqual({ ymd: '2026-11-02', label: 'T2 02/11' });
      expect(chips[6]?.ymd).toBe('2026-11-08');
    });
  });
});
