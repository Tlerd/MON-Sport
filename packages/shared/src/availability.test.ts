import { describe, expect, it } from 'vitest';
import { AvailabilityQuery, freeRanges } from './availability.ts';

// Data of brief F-008: "Cầu lông A" opens 06:00-23:00. Now is 20/11/2026 10:00 unless a test says otherwise.
const at = (day: string, hhmm: string) => new Date(`2026-11-${day}T${hhmm}:00+07:00`);
const NOW = at('20', '10:00');
const range = (day: string, from: string, to: string) => ({ startAt: at(day, from).toISOString(), endAt: at(day, to).toISOString() });
const busy = (day: string, from: string, to: string) => ({ startAt: at(day, from), endAt: at(day, to) });
const free = (date: string, opensAt: number, closesAt: number, now: Date, held: ReturnType<typeof busy>[] = []) =>
  freeRanges({ date, opensAt, closesAt, now, busy: held });

describe('freeRanges', () => {
  it('AC-1: a day without bookings is one range from opening to closing, in UTC', () => {
    expect(free('2026-11-21', 360, 1380, NOW)).toEqual([{ startAt: '2026-11-20T23:00:00.000Z', endAt: '2026-11-21T16:00:00.000Z' }]);
  });

  it('AC-2: today starts at the first 30-minute mark after now, and a booking cuts the day', () => {
    expect(free('2026-11-20', 360, 1380, NOW, [busy('20', '19:00', '20:00')])).toEqual([
      range('20', '10:30', '19:00'),
      range('20', '20:00', '23:00'),
    ]);
  });

  it('AC-2: now on a mark does not start at that mark, because a booking starts after now', () => {
    expect(free('2026-11-20', 360, 1380, at('20', '10:30'))).toEqual([range('20', '11:00', '23:00')]);
    expect(free('2026-11-20', 360, 1380, new Date(at('20', '10:30').getTime() + 1))).toEqual([range('20', '11:00', '23:00')]);
  });

  it('AC-5: two adjacent bookings leave no gap between them', () => {
    expect(free('2026-11-20', 360, 1380, NOW, [busy('20', '19:00', '20:00'), busy('20', '20:00', '21:00')])).toEqual([
      range('20', '10:30', '19:00'),
      range('20', '21:00', '23:00'),
    ]);
  });

  it('AC-5: unsorted and overlapping bookings give the same result', () => {
    const held = [busy('20', '20:00', '21:00'), busy('20', '19:00', '20:30')];
    expect(free('2026-11-20', 360, 1380, NOW, held)).toEqual([range('20', '10:30', '19:00'), range('20', '21:00', '23:00')]);
  });

  it('AC-6: a range shorter than 1 hour is dropped, and 1 hour is kept', () => {
    expect(free('2026-11-21', 360, 1380, NOW, [busy('21', '06:00', '09:30'), busy('21', '10:00', '23:00')])).toEqual([]);
    expect(free('2026-11-21', 360, 1380, NOW, [busy('21', '06:00', '09:00'), busy('21', '10:00', '23:00')])).toEqual([range('21', '09:00', '10:00')]);
  });

  it('AC-7: a past day, and a day whose earliest start is after closing, give no range', () => {
    expect(free('2026-11-19', 360, 1380, NOW)).toEqual([]);
    expect(free('2026-11-20', 360, 1380, at('20', '23:10'))).toEqual([]);
    expect(free('2026-11-20', 360, 1380, at('20', '22:00'))).toEqual([]);
  });

  it('AC-7: the earliest start at exactly 1 hour before closing keeps a 1-hour range', () => {
    expect(free('2026-11-20', 360, 1380, at('20', '21:30'))).toEqual([range('20', '22:00', '23:00')]);
  });

  it('AC-8: closing at 24:00 ends at 00:00 of the next day', () => {
    expect(free('2026-11-21', 480, 1440, NOW)).toEqual([{ startAt: '2026-11-21T01:00:00.000Z', endAt: '2026-11-21T17:00:00.000Z' }]);
  });

  it('AC-8: a booking of the next day, or of the day before, does not cut this day', () => {
    const held = [busy('20', '22:00', '23:00'), busy('22', '06:00', '07:00')];
    expect(free('2026-11-21', 360, 1380, NOW, held)).toEqual([range('21', '06:00', '23:00')]);
  });

  it('AC-3: the busy time of a pending request ends at its deadline, and the earliest start follows now', () => {
    const held = [busy('20', '20:00', '21:00')];
    expect(free('2026-11-20', 360, 1380, at('20', '12:00'), held)).toEqual([range('20', '12:30', '20:00'), range('20', '21:00', '23:00')]);
    expect(free('2026-11-20', 360, 1380, at('20', '12:01'))).toEqual([range('20', '12:30', '23:00')]);
  });

  it('a booking that ends before the window cannot cut it', () => {
    expect(free('2026-11-21', 360, 1380, NOW, [busy('21', '05:00', '06:00')])).toEqual([range('21', '06:00', '23:00')]);
  });

  it('a booking that starts before now and ends inside the window cuts its start', () => {
    expect(free('2026-11-20', 360, 1380, NOW, [busy('20', '09:00', '12:00')])).toEqual([range('20', '12:00', '23:00')]);
  });

  it('a booking that crosses closing, or starts after it, cuts nothing more', () => {
    expect(free('2026-11-21', 360, 1380, NOW, [busy('21', '22:00', '23:30')])).toEqual([range('21', '06:00', '22:00')]);
    expect(free('2026-11-21', 360, 1380, NOW, [busy('21', '23:30', '23:59')])).toEqual([range('21', '06:00', '23:00')]);
  });

  it('a booking that crosses midnight from the day before cuts the start of the day', () => {
    const overnight = { startAt: at('20', '23:30'), endAt: at('21', '08:00') };
    expect(free('2026-11-21', 0, 1440, NOW, [overnight])).toEqual([{ startAt: at('21', '08:00').toISOString(), endAt: '2026-11-21T17:00:00.000Z' }]);
  });

  it('a day before opening starts at opening, and closing at 24:00 with a booking to 24:00 ends the range there', () => {
    expect(free('2026-11-20', 360, 1380, at('20', '03:00'))).toEqual([range('20', '06:00', '23:00')]);
    expect(free('2026-11-21', 480, 1440, NOW, [{ startAt: at('21', '20:00'), endAt: new Date('2026-11-21T17:00:00.000Z') }])).toEqual([range('21', '08:00', '20:00')]);
  });

  it('does not change the busy array', () => {
    const held = [busy('20', '20:00', '21:00'), busy('20', '19:00', '20:00')];
    const copy = held.map((b) => ({ ...b }));
    free('2026-11-20', 360, 1380, NOW, held);
    expect(held).toEqual(copy);
  });
});

describe('AvailabilityQuery', () => {
  it('AC-9: accepts a real date', () => {
    expect(AvailabilityQuery.safeParse({ date: '2026-11-21' }).success).toBe(true);
    expect(AvailabilityQuery.safeParse({ date: '2028-02-29' }).success).toBe(true);
  });

  it('AC-9: refuses a month 13, a day-first date, a missing date, a date with a time, and an extra key', () => {
    for (const query of [
      { date: '2026-13-45' },
      { date: '2026-11-31' },
      { date: '2027-02-29' },
      { date: '21-11-2026' },
      { date: '2026-11-21T00:00:00Z' },
      {},
      { date: 20261121 },
      { date: '2026-11-21', x: '1' },
    ]) {
      expect(AvailabilityQuery.safeParse(query).success, JSON.stringify(query)).toBe(false);
    }
  });
});
