import { describe, expect, it } from 'vitest';
import { percent, periodHeading, shiftPeriodDate } from './owner-revenue.ts';

describe('owner revenue helpers', () => {
  it('AC-15: shiftPeriodDate shifts day, week, and month in UTC and clamps month-end days', () => {
    expect(shiftPeriodDate('2026-11-06', 'day', -1)).toBe('2026-11-05');
    expect(shiftPeriodDate('2026-11-06', 'week', 1)).toBe('2026-11-13');
    expect(shiftPeriodDate('2026-11-06', 'month', -1)).toBe('2026-10-06');
    expect(shiftPeriodDate('2026-03-31', 'month', -1)).toBe('2026-02-28');
  });

  it('AC-16: periodHeading converts week UTC instants with vnDateString and formats day and month', () => {
    expect(
      periodHeading({
        period: 'week',
        startDate: '2026-11-01T17:00:00.000Z',
        endDate: '2026-11-08T16:59:59.999Z',
      }),
    ).toBe('Tuần 02/11–08/11/2026');
    expect(periodHeading({ period: 'day', date: '2026-11-06' })).toBe('Thứ Sáu, 06/11/2026');
    expect(periodHeading({ period: 'month', date: '2026-11-06' })).toBe('Tháng 11/2026');
  });

  it('AC-18: percent formats rates as rounded whole percentages', () => {
    expect(percent(0)).toBe('0%');
    expect(percent(0.25)).toBe('25%');
    expect(percent(0.125)).toBe('13%');
    expect(percent(1)).toBe('100%');
  });
});
