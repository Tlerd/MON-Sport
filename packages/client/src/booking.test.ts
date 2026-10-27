import { describe, expect, it } from 'vitest';
import type { CourtView } from '@monsport/shared';
import { dayChipLabel, dayHeading, durationsAt, priceRangeK, startableMinutes } from './booking.ts';

const NOW = new Date('2026-10-29T10:00:00+07:00');
const range = (date: string, from: string, to: string) => ({ startAt: `${date}T${from}:00+07:00`, endAt: `${date}T${to}:00+07:00` });
const court = (priceNormal: number, pricePeak: number) =>
  ({ id: 'c', name: 'Sân', sport: 'BADMINTON', priceNormal, pricePeak }) as CourtView;

// @monsport/client has no Node types, so reach process through globalThis.
const proc = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process;

describe('booking helpers', () => {
  it('AC-1: formats days and prices, whatever the TZ of the machine', () => {
    const before = proc.env.TZ;
    proc.env.TZ = 'America/New_York';
    try {
      expect(dayChipLabel('2026-10-30')).toBe('T6 30/10');
      expect(dayHeading('2026-10-30')).toBe('Thứ Sáu, 30/10/2026');
      expect(priceRangeK([court(80000, 120000), court(70000, 100000)])).toBe('70k–120k');
      expect(priceRangeK([court(100000, 100000)])).toBe('100k');
      expect(priceRangeK([])).toBe('—');
    } finally {
      if (before === undefined) delete proc.env.TZ;
      else proc.env.TZ = before;
    }
  });

  const date = '2026-10-30';
  const free = [range(date, '18:00', '20:00'), range(date, '21:00', '23:00')];

  it('AC-2: startableMinutes needs 60 free minutes after the start', () => {
    expect(startableMinutes(date, free, NOW)).toEqual([1080, 1110, 1140, 1260, 1290, 1320]);
  });

  it('AC-3: durationsAt lists the durations that fit the free range', () => {
    expect(durationsAt(date, 1080, free, NOW)).toEqual([60, 90, 120]);
    expect(durationsAt(date, 1140, free, NOW)).toEqual([60]);
    expect(durationsAt(date, 1200, free, NOW)).toEqual([]);
  });

  it('AC-20: a start must be later than now + 60 minutes (BR-9)', () => {
    const today = '2026-10-29';
    const todayFree = [range(today, '10:30', '13:00')];
    expect(startableMinutes(today, todayFree, NOW)).toEqual([690, 720]);
    expect(durationsAt(today, 690, todayFree, NOW)).toEqual([60, 90]);
    expect(durationsAt(today, 660, todayFree, NOW)).toEqual([]);
  });
});
