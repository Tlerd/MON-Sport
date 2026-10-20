import { describe, expect, it } from 'vitest';
import {
  addDaysYmd,
  bookingPrice,
  confirmDeadline,
  isLongEnough,
  isOnGrid,
  isRealDate,
  minuteOfDayVN,
  userCancelDecision,
  vnDateString,
  vnWeekRange,
} from './booking-time.ts';

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

// Brief F-009. A booking starts at 20:00.
describe('userCancelDecision', () => {
  const at2000 = vn('20:00');
  const decide = (status: Parameters<typeof userCancelDecision>[0]['status'], now: Date, startAt = at2000) =>
    userCancelDecision({ status, startAt }, now);

  it('AC-3: a confirmed booking with 7 hours left may be cancelled', () => {
    expect(decide('CONFIRMED', vn('13:00'))).toBe('ALLOW');
  });

  it('AC-4: a confirmed booking with 5 hours left asks for a call to the owner', () => {
    expect(decide('CONFIRMED', vn('15:00'))).toBe('CALL_OWNER');
  });

  it('AC-5: exactly 6 hours left is allowed, and 1 ms less is not', () => {
    expect(decide('CONFIRMED', new Date(vn('14:00').getTime()))).toBe('ALLOW');
    expect(decide('CONFIRMED', new Date(vn('14:00').getTime() + 1))).toBe('CALL_OWNER');
  });

  it('AC-2: a pending request may be cancelled at any time before the start, and not at the start', () => {
    expect(decide('PENDING', vn('19:59'))).toBe('ALLOW');
    expect(decide('PENDING', at2000)).toBe('NONE');
  });

  it('AC-6: a started booking and the other statuses cannot be cancelled', () => {
    expect(decide('CONFIRMED', at2000)).toBe('NONE');
    expect(decide('CONFIRMED', vn('21:00'))).toBe('NONE');
    for (const status of ['REJECTED', 'EXPIRED', 'CANCELLED'] as const) expect(decide(status, vn('10:00'))).toBe('NONE');
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

// Brief F-016, Contract item 1. All dates are in Asia/Ho_Chi_Minh (BR-27).
describe('vnDateString', () => {
  it('F-016 week helper for AC-2: 17:30Z on 15/11 is 00:30 on 16/11 in Vietnam', () => {
    expect(vnDateString(new Date('2026-11-15T17:30:00Z'))).toBe('2026-11-16');
  });

  it('F-016 week helper for AC-11: 16:59:59Z on 22/11 is still Sunday 22/11, and 17:00:00Z is Monday 23/11', () => {
    expect(vnDateString(new Date('2026-11-22T16:59:59Z'))).toBe('2026-11-22');
    expect(vnDateString(new Date('2026-11-22T17:00:00Z'))).toBe('2026-11-23');
  });
});

describe('isRealDate', () => {
  it('F-016 week helper for AC-9: accepts real dates, including a leap day', () => {
    expect(isRealDate('2026-11-20')).toBe(true);
    expect(isRealDate('2028-02-29')).toBe(true);
    expect(isRealDate('2026-12-31')).toBe(true);
  });

  it('F-016 week helper for AC-9: refuses a day or a month that does not exist', () => {
    expect(isRealDate('2026-02-30')).toBe(false);
    expect(isRealDate('2027-02-29')).toBe(false);
    expect(isRealDate('2026-04-31')).toBe(false);
    expect(isRealDate('2026-13-45')).toBe(false);
    expect(isRealDate('2026-00-10')).toBe(false);
    expect(isRealDate('2026-11-00')).toBe(false);
  });

  it('F-016 week helper for AC-9: returns false and never throws for any other string', () => {
    for (const text of ['abc', '', ' ', '2026-1-1', '20261120', '2026-11-20T00:00:00Z', '2026-11-20 ', '\u0000', '9'.repeat(10_000)]) {
      expect(() => isRealDate(text)).not.toThrow();
      expect(isRealDate(text)).toBe(false);
    }
  });
});

describe('addDaysYmd', () => {
  it('adds and subtracts days', () => {
    expect(addDaysYmd('2026-11-20', 7)).toBe('2026-11-27');
    expect(addDaysYmd('2026-11-20', -7)).toBe('2026-11-13');
    expect(addDaysYmd('2026-11-20', 0)).toBe('2026-11-20');
  });

  it('rolls over a month and a year', () => {
    expect(addDaysYmd('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysYmd('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('knows the leap day', () => {
    expect(addDaysYmd('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysYmd('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDaysYmd('2027-02-28', 1)).toBe('2027-03-01');
  });
});

describe('vnWeekRange', () => {
  it('F-016 week helper for AC-12: Monday 23/11 starts its own week 23/11 to 29/11', () => {
    const week = vnWeekRange('2026-11-23');
    expect([week.weekStart, week.weekEnd]).toEqual(['2026-11-23', '2026-11-29']);
  });

  it('F-016 week helper for AC-2: Sunday 22/11 belongs to the week 16/11 to 22/11', () => {
    const week = vnWeekRange('2026-11-22');
    expect([week.weekStart, week.weekEnd]).toEqual(['2026-11-16', '2026-11-22']);
  });

  it('F-016 week helper for AC-1: a day in the middle of the week gives the same week', () => {
    const week = vnWeekRange('2026-11-20');
    expect([week.weekStart, week.weekEnd]).toEqual(['2026-11-16', '2026-11-22']);
  });

  it('F-016 week helper for AC-11: from is Monday 00:00 in Vietnam, and to is the next Monday 00:00, not included', () => {
    const { from, to } = vnWeekRange('2026-11-20');
    expect(from).toEqual(new Date('2026-11-16T00:00:00+07:00'));
    expect(from.toISOString()).toBe('2026-11-15T17:00:00.000Z');
    expect(to).toEqual(new Date('2026-11-23T00:00:00+07:00'));
    // 23:30 on Sunday is in the week. 00:00 on the next Monday is not.
    const inWeek = new Date('2026-11-22T23:30:00+07:00').getTime();
    const nextMonday = new Date('2026-11-23T00:00:00+07:00').getTime();
    expect(inWeek >= from.getTime() && inWeek < to.getTime()).toBe(true);
    expect(nextMonday >= from.getTime() && nextMonday < to.getTime()).toBe(false);
  });

  it('rolls over a month and a year', () => {
    const month = vnWeekRange('2026-12-02');
    expect([month.weekStart, month.weekEnd]).toEqual(['2026-11-30', '2026-12-06']);
    const year = vnWeekRange('2027-01-01');
    expect([year.weekStart, year.weekEnd]).toEqual(['2026-12-28', '2027-01-03']);
    expect(year.to).toEqual(new Date('2027-01-04T00:00:00+07:00'));
  });

  it('keeps the leap day inside its week', () => {
    const week = vnWeekRange('2028-02-29');
    expect([week.weekStart, week.weekEnd]).toEqual(['2028-02-28', '2028-03-05']);
  });

  it('every day of a week maps to its Monday', () => {
    for (let i = 0; i < 7; i++) {
      const day = addDaysYmd('2026-11-16', i);
      expect(vnWeekRange(day).weekStart).toBe('2026-11-16');
    }
  });
});
