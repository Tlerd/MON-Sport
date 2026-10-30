import { describe, expect, it } from 'vitest';
import type { MatchView, MyBookingView } from '@monsport/shared';
import { joinedByOthers, sortHistory, sortUpcoming, splitMine } from './my-bookings.ts';

// @monsport/client has no Node types, so reach process through globalThis.
const proc = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process;

const VALID_COURT_ID = '00000000-0000-4000-8000-0000000000c1';
const VALID_BOOKING_ID = '00000000-0000-4000-8000-0000000000b1';
const VALID_HOST_ID = '00000000-0000-4000-8000-0000000000h1';

function makeBooking(idSuffix: number, overrides: Partial<MyBookingView> = {}): MyBookingView {
  const pad = String(idSuffix).padStart(12, '0');
  return {
    id: `00000000-0000-4000-8000-${pad}`,
    courtId: VALID_COURT_ID,
    startAt: '2026-11-02T10:00:00+07:00',
    endAt: '2026-11-02T11:00:00+07:00',
    status: 'CONFIRMED',
    source: 'APP',
    priceTotal: 100_000,
    confirmDeadline: null,
    confirmedAt: null,
    cancelledAt: null,
    createdAt: '2026-11-01T10:00:00+07:00',
    courtName: 'Sân 1',
    venueName: 'Cầu lông An Phú',
    venuePhone: '0901234567',
    sport: 'BADMINTON',
    match: null,
    ...overrides,
  };
}

function makeMatch(idSuffix: number, overrides: Partial<MatchView> = {}): MatchView {
  const pad = String(idSuffix).padStart(12, '0');
  return {
    id: `00000000-0000-4000-8000-${pad}`,
    bookingId: VALID_BOOKING_ID,
    hostId: VALID_HOST_ID,
    hostName: 'Nguyễn Văn A',
    sport: 'BADMINTON',
    capacity: 10,
    joinedCount: 1,
    pricePerSlot: 50_000,
    status: 'OPEN',
    bookingStatus: 'CONFIRMED',
    startAt: '2026-11-02T10:00:00+07:00',
    endAt: '2026-11-02T11:00:00+07:00',
    courtName: 'Sân 1',
    venueName: 'Cầu lông An Phú',
    venueAddress: '123 Đường Số 1',
    createdAt: '2026-11-01T10:00:00+07:00',
    ...overrides,
  };
}

describe('my bookings helpers', () => {
  it('AC-3: splitMine separates upcoming and history regardless of timezone', () => {
    const now = new Date('2026-11-02T10:00:00+07:00');
    const a = makeBooking(1, { status: 'PENDING', startAt: '2026-11-02T20:00:00+07:00', endAt: '2026-11-02T21:00:00+07:00' });
    const b = makeBooking(2, { status: 'CONFIRMED', startAt: '2026-11-02T08:00:00+07:00', endAt: '2026-11-02T09:00:00+07:00' });
    const c = makeBooking(3, { status: 'CANCELLED', startAt: '2026-11-03T09:00:00+07:00', endAt: '2026-11-03T10:00:00+07:00' });
    const d = makeBooking(4, { status: 'REJECTED', startAt: '2026-11-03T10:00:00+07:00', endAt: '2026-11-03T11:00:00+07:00' });
    const e = makeBooking(5, { status: 'EXPIRED', startAt: '2026-11-03T11:00:00+07:00', endAt: '2026-11-03T12:00:00+07:00' });
    const f = makeBooking(6, { status: 'CONFIRMED', startAt: '2026-11-02T09:30:00+07:00', endAt: '2026-11-02T10:30:00+07:00' });

    const before = proc.env.TZ;
    try {
      for (const tz of ['UTC', 'America/New_York']) {
        proc.env.TZ = tz;
        const rows = [a, b, c, d, e, f];
        const originalRows = [...rows];
        const { upcoming, history } = splitMine(rows, now);

        expect(upcoming).toEqual([a]);
        expect(new Set(history.map((r) => r.id))).toEqual(new Set([b.id, c.id, d.id, e.id, f.id]));
        expect(rows).toEqual(originalRows);
      }
    } finally {
      if (before === undefined) delete proc.env.TZ;
      else proc.env.TZ = before;
    }
  });

  it('AC-4: sortUpcoming and sortHistory sort by startAt then createdAt', () => {
    const u18 = makeBooking(1, { startAt: '2026-11-02T18:00:00+07:00' });
    const u07 = makeBooking(2, { startAt: '2026-11-02T07:00:00+07:00' });
    const u12 = makeBooking(3, { startAt: '2026-11-02T12:00:00+07:00' });

    const upcomingInput = [u18, u07, u12];
    expect(sortUpcoming(upcomingInput)).toEqual([u07, u12, u18]);
    expect(upcomingInput).toEqual([u18, u07, u12]);

    const hDay1 = makeBooking(4, { startAt: '2026-10-30T10:00:00+07:00' });
    const hDay2 = makeBooking(5, { startAt: '2026-11-01T10:00:00+07:00' });
    const hDay3 = makeBooking(6, { startAt: '2026-10-25T10:00:00+07:00' });

    const historyInput = [hDay1, hDay2, hDay3];
    expect(sortHistory(historyInput)).toEqual([hDay2, hDay1, hDay3]);
    expect(historyInput).toEqual([hDay1, hDay2, hDay3]);

    const tieUp1 = makeBooking(7, { startAt: '2026-11-02T10:00:00+07:00', createdAt: '2026-11-01T15:00:00+07:00' });
    const tieUp2 = makeBooking(8, { startAt: '2026-11-02T10:00:00+07:00', createdAt: '2026-11-01T09:00:00+07:00' });
    expect(sortUpcoming([tieUp1, tieUp2])).toEqual([tieUp2, tieUp1]);

    const tieHist1 = makeBooking(9, { startAt: '2026-10-20T10:00:00+07:00', createdAt: '2026-10-15T09:00:00+07:00' });
    const tieHist2 = makeBooking(10, { startAt: '2026-10-20T10:00:00+07:00', createdAt: '2026-10-15T15:00:00+07:00' });
    expect(sortHistory([tieHist1, tieHist2])).toEqual([tieHist2, tieHist1]);
  });

  it('AC-10: joinedByOthers filters and sorts matches not hosted by user', () => {
    const now = new Date('2026-11-02T10:00:00+07:00');
    const userId = '00000000-0000-4000-8000-000000000001';
    const otherHostId = '00000000-0000-4000-8000-000000000002';

    const t1 = makeMatch(1, { hostId: userId, status: 'OPEN', startAt: '2026-11-03T10:00:00+07:00' });
    const t2 = makeMatch(2, { hostId: otherHostId, status: 'OPEN', joinedCount: 4, capacity: 10, startAt: '2026-11-03T20:00:00+07:00' });
    const t3 = makeMatch(3, { hostId: otherHostId, status: 'FULL', joinedCount: 10, capacity: 10, startAt: '2026-11-04T18:00:00+07:00' });
    const t4 = makeMatch(4, { hostId: otherHostId, status: 'CANCELLED', startAt: '2026-11-03T09:00:00+07:00' });
    const t5 = makeMatch(5, { hostId: otherHostId, status: 'OPEN', startAt: '2026-11-02T08:00:00+07:00' });

    const matches = [t3, t1, t5, t2, t4];
    const originalMatches = [...matches];

    const result = joinedByOthers(matches, userId, now);
    expect(result).toEqual([t2, t3]);
    expect(matches).toEqual(originalMatches);
  });
});
