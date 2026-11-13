import { describe, expect, it } from 'vitest';
import type { CourtView } from '@monsport/shared';
import {
  dayChipLabel,
  dayHeading,
  durationsAt,
  fitsAnyDuration,
  priceRangeK,
  rangeHolding,
  slotAt,
  startableMinutes,
} from './booking.ts';

const NOW = new Date('2026-10-29T10:00:00+07:00');
const range = (date: string, from: string, to: string) => ({ startAt: `${date}T${from}:00+07:00`, endAt: `${date}T${to}:00+07:00` });
const court = (priceNormal: number, pricePeak: number) =>
  ({ id: 'c', name: 'Sân', sport: 'BADMINTON', priceNormal, pricePeak }) as CourtView;

// @monsport/client has no Node types, so reach process through globalThis.
const proc = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process;

describe('booking helpers', () => {
  it('AC-1: formats days and prices, whatever the TZ of the machine', () => {
    const before = proc.env.TZ;
    try {
      for (const tz of ['America/New_York', 'Pacific/Kiritimati', 'EST5EDT', 'KRT-14']) {
        proc.env.TZ = tz;
        expect(dayChipLabel('2026-10-30')).toBe('T6 30/10');
        expect(dayHeading('2026-10-30')).toBe('Thứ Sáu, 30/10/2026');
        expect(
          startableMinutes('2026-10-29', [range('2026-10-29', '08:00', '10:00')], new Date('2026-10-29T00:30:00Z')),
        ).toEqual([540]);
      }
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

  it('AC-2: rangeHolding returns the free range that holds [start, end], undefined when too short, and compares instants across midnight', () => {
    expect(rangeHolding(date, free, 1080, 1200)).toEqual(free[0]);
    expect(rangeHolding(date, free, 1080, 1230)).toBeUndefined();
    const midnightRange = {
      startAt: '2026-10-30T22:00:00+07:00',
      endAt: '2026-10-31T00:00:00+07:00',
    };
    expect(rangeHolding(date, [midnightRange], 1320, 1440)).toEqual(midnightRange);
  });

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

describe('slotAt', () => {
  it('builds the instant of a minute of the day in Asia/Ho_Chi_Minh', () => {
    expect(slotAt('2026-11-20', 17 * 60 + 30)).toBe('2026-11-20T17:30:00+07:00');
  });

  it('turns 24:00 into 00:00 of the next day, so a venue that closes at 24:00 takes its last hour', () => {
    expect(slotAt('2026-11-20', 1440)).toBe('2026-11-21T00:00:00+07:00');
    expect(slotAt('2026-12-31', 1440)).toBe('2027-01-01T00:00:00+07:00');
  });
});

describe('fitsAnyDuration', () => {
  it('returns true when at least one duration fits before closesAt', () => {
    expect(fitsAnyDuration(360, 480)).toBe(true);
    expect(fitsAnyDuration(1320, 1380)).toBe(true);
  });

  it('returns false when no duration fits before closesAt', () => {
    expect(fitsAnyDuration(1350, 1380)).toBe(false);
    expect(fitsAnyDuration(1380, 1380)).toBe(false);
    expect(fitsAnyDuration(1400, 1380)).toBe(false);
  });
});
