import { describe, expect, it } from 'vitest';
import { bookingPrice, confirmDeadline, isLongEnough, isOnGrid, minuteOfDayVN } from './booking-time.ts';

// "Sân 1" of "Cầu lông A" in brief F-002: 80.000đ normal, 120.000đ peak, per hour.
const NORMAL = 80_000;
const PEAK = 120_000;
const vn = (hhmm: string) => new Date(`2026-11-20T${hhmm}:00+07:00`);

describe('bookingPrice', () => {
  it('AC-4: 16:30–18:00 costs 160.000đ', () => {
    expect(bookingPrice(vn('16:30'), vn('18:00'), NORMAL, PEAK)).toBe(160_000);
  });

  it('AC-5: 21:30–22:30 costs 100.000đ, and 22:00–22:30 is normal', () => {
    expect(bookingPrice(vn('21:30'), vn('22:30'), NORMAL, PEAK)).toBe(100_000);
  });
});

describe('confirmDeadline', () => {
  it('AC-8: a request at 10:00 for 20:00 has its deadline at 12:00', () => {
    expect(confirmDeadline(vn('10:00'), vn('20:00'))).toEqual(vn('12:00'));
  });

  it('AC-9: a request at 18:30 for 20:00 has its deadline at 19:00', () => {
    expect(confirmDeadline(vn('18:30'), vn('20:00'))).toEqual(vn('19:00'));
  });
});

describe('grid and length', () => {
  it('reads the minute of day in Asia/Ho_Chi_Minh', () => {
    expect(minuteOfDayVN(new Date('2026-11-20T12:00:00Z'))).toBe(19 * 60);
  });

  it('accepts 19:00 and 19:30 on the grid, and refuses 19:15', () => {
    expect([isOnGrid(vn('19:00')), isOnGrid(vn('19:30')), isOnGrid(vn('19:15'))]).toEqual([true, true, false]);
  });

  it('needs 1 hour or more', () => {
    expect([isLongEnough(vn('19:00'), vn('20:00')), isLongEnough(vn('19:00'), vn('19:30'))]).toEqual([true, false]);
  });
});
