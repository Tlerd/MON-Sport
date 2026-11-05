import { describe, expect, it } from 'vitest';
import { bookingsOfDay, ownerDurationsAt, ownerStartableMinutes } from './owner-schedule.ts';

const NOW = new Date('2026-11-06T15:10:00+07:00');
const range = (date: string, from: string, to: string) => ({
  startAt: `${date}T${from}:00+07:00`,
  endAt: `${date}T${to}:00+07:00`,
});

describe('owner schedule helpers', () => {
  it('AC-13: ownerStartableMinutes includes slots after now with at least 60 free minutes', () => {
    const free = [range('2026-11-06', '15:30', '22:00')];
    expect(ownerStartableMinutes('2026-11-06', free, NOW)).toEqual([
      930, 960, 990, 1020, 1050, 1080, 1110, 1140, 1170, 1200, 1230, 1260,
    ]);
    expect(ownerStartableMinutes('2026-11-06', free, new Date('2026-11-06T21:05:00+07:00'))).toEqual([]);
    expect(ownerStartableMinutes('2026-11-07', [range('2026-11-07', '08:00', '10:00')], NOW)).toEqual([
      480, 510, 540,
    ]);
  });

  it('AC-14: ownerDurationsAt returns durations that fit the free range from a startable minute', () => {
    const free = [range('2026-11-06', '15:30', '18:00')];
    expect(ownerDurationsAt('2026-11-06', 960, free, NOW)).toEqual([60, 90, 120]);
    expect(ownerDurationsAt('2026-11-06', 1020, free, NOW)).toEqual([60]);
    expect(ownerDurationsAt('2026-11-06', 900, free, NOW)).toEqual([]);
  });

  it('AC-15: bookingsOfDay filters by VN calendar date and courtIds and sorts by startAt ascending', () => {
    const bookings = [
      { id: 'b3', courtId: 'c1', startAt: '2026-11-06T23:30:00+07:00' },
      { id: 'b4', courtId: 'c1', startAt: '2026-11-07T00:00:00+07:00' },
      { id: 'b2', courtId: 'c2', startAt: '2026-11-06T18:00:00+07:00' },
      { id: 'b5', courtId: 'c3', startAt: '2026-11-06T17:00:00+07:00' },
      { id: 'b1', courtId: 'c1', startAt: '2026-11-06T16:00:00+07:00' },
    ];
    expect(bookingsOfDay(bookings, '2026-11-06', ['c1', 'c2'])).toEqual([
      { id: 'b1', courtId: 'c1', startAt: '2026-11-06T16:00:00+07:00' },
      { id: 'b2', courtId: 'c2', startAt: '2026-11-06T18:00:00+07:00' },
      { id: 'b3', courtId: 'c1', startAt: '2026-11-06T23:30:00+07:00' },
    ]);
  });
});
