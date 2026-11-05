import type { OwnerBookingView } from '@monsport/shared';
import { describe, expect, it } from 'vitest';
import { percent, periodHeading, shiftPeriodDate, unpaidInPeriod } from './owner-revenue.ts';

const C1 = '00000000-0000-4000-8000-000000000001';
const C2 = '00000000-0000-4000-8000-000000000002';
const OTHER_COURT = '00000000-0000-4000-8000-000000000099';

function mkBooking(
  id: string,
  over: Partial<OwnerBookingView> & { courtId: string; startAt: string; endAt: string },
): OwnerBookingView {
  return {
    id,
    status: 'CONFIRMED',
    source: 'PHONE',
    priceTotal: 150000,
    confirmDeadline: null,
    confirmedAt: '2026-11-01T10:00:00.000Z',
    cancelledAt: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    paidAtVenue: false,
    customer: { name: 'Khách', phone: '0901234567' },
    ...over,
  };
}

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

  it('AC-17: unpaidInPeriod filters CONFIRMED unpaid bookings within [startDate, endDate] by instant and courtIds, sorts by startAt ascending, and does not mutate input', () => {
    const startDate = '2026-11-01T17:00:00.000Z';
    const endDate = '2026-11-08T16:59:59.999Z';

    const laterInPeriod = mkBooking('b-later', {
      courtId: C2,
      startAt: '2026-11-05T11:00:00.000Z',
      endAt: '2026-11-05T12:00:00.000Z',
    });
    const atStartBoundary = mkBooking('b-boundary', {
      courtId: C1,
      startAt: '2026-11-01T17:00:00.000Z',
      endAt: '2026-11-01T18:00:00.000Z',
    });
    const beforePeriod = mkBooking('b-before', {
      courtId: C1,
      startAt: '2026-11-01T16:59:00.000Z',
      endAt: '2026-11-01T17:59:00.000Z',
    });
    const paidBooking = mkBooking('b-paid', {
      courtId: C1,
      startAt: '2026-11-03T10:00:00.000Z',
      endAt: '2026-11-03T11:00:00.000Z',
      paidAtVenue: true,
    });
    const otherCourtBooking = mkBooking('b-other-court', {
      courtId: OTHER_COURT,
      startAt: '2026-11-04T10:00:00.000Z',
      endAt: '2026-11-04T11:00:00.000Z',
    });
    const pendingBooking = mkBooking('b-pending', {
      courtId: C1,
      startAt: '2026-11-04T12:00:00.000Z',
      endAt: '2026-11-04T13:00:00.000Z',
      status: 'PENDING',
    });
    const afterPeriod = mkBooking('b-after', {
      courtId: C1,
      startAt: '2026-11-08T17:00:00.000Z',
      endAt: '2026-11-08T18:00:00.000Z',
    });

    const input = [
      laterInPeriod,
      beforePeriod,
      atStartBoundary,
      paidBooking,
      otherCourtBooking,
      pendingBooking,
      afterPeriod,
    ];
    const snapshot = [...input];

    const result = unpaidInPeriod(input, startDate, endDate, [C1, C2]);
    expect(result.map((b) => b.id)).toEqual(['b-boundary', 'b-later']);
    expect(input).toEqual(snapshot);
  });

  it('AC-18: percent formats rates as rounded whole percentages', () => {
    expect(percent(0)).toBe('0%');
    expect(percent(0.25)).toBe('25%');
    expect(percent(0.125)).toBe('13%');
    expect(percent(1)).toBe('100%');
  });
});
