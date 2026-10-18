import { describe, expect, it } from 'vitest';
import {
  FinancialChartPoint,
  FinancialDashboardView,
  FinancialPeriod,
  FinancialQuerySchema,
  PaidAtVenueResponse,
  UpdatePaidAtVenueSchema,
} from './finance.ts';

describe('finance contract, brief F-015', () => {
  it('validates FinancialPeriod with day, week, month', () => {
    expect(FinancialPeriod.parse('day')).toBe('day');
    expect(FinancialPeriod.parse('week')).toBe('week');
    expect(FinancialPeriod.parse('month')).toBe('month');
    expect(FinancialPeriod.safeParse('year').success).toBe(false);
  });

  it('validates FinancialQuerySchema with defaults', () => {
    expect(FinancialQuerySchema.parse({})).toEqual({ period: 'week' });
    expect(FinancialQuerySchema.parse({ period: 'day', date: '2026-11-20' })).toEqual({
      period: 'day',
      date: '2026-11-20',
    });
    expect(FinancialQuerySchema.safeParse({ date: '20-11-2026' }).success).toBe(false);
  });

  it('validates FinancialChartPoint', () => {
    const point = {
      label: 'T2 16/11',
      revenue: 960_000,
      bookedHours: 8,
      bookingCount: 8,
    };
    expect(FinancialChartPoint.parse(point)).toEqual(point);
    expect(FinancialChartPoint.safeParse({ ...point, revenue: -1 }).success).toBe(false);
  });

  it('validates FinancialDashboardView', () => {
    const view = {
      venueId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
      venueName: 'Cầu lông A',
      period: 'week',
      date: '2026-11-20',
      startDate: '2026-11-16T00:00:00.000Z',
      endDate: '2026-11-22T23:59:59.999Z',
      revenue: 960_000,
      totalBookings: 10,
      paidBookings: 8,
      unpaidBookings: 2,
      bookedHours: 10,
      openingHours: 238,
      occupancyRate: 0.042,
      peakHours: 6,
      normalHours: 4,
      cancelledBookings: 0,
      rejectedBookings: 0,
      cancellationRate: 0,
      rejectionRate: 0,
      totalCustomers: 5,
      returningCustomers: 2,
      chartData: [
        {
          label: 'T2 16/11',
          revenue: 120_000,
          bookedHours: 1,
          bookingCount: 1,
        },
      ],
    };
    expect(FinancialDashboardView.parse(view)).toEqual(view);
    expect(FinancialDashboardView.safeParse({ ...view, occupancyRate: 1.5 }).success).toBe(false);
  });

  it('validates UpdatePaidAtVenueSchema and PaidAtVenueResponse', () => {
    expect(UpdatePaidAtVenueSchema.parse({ paidAtVenue: true })).toEqual({ paidAtVenue: true });
    expect(UpdatePaidAtVenueSchema.safeParse({ paidAtVenue: 'true' }).success).toBe(false);

    const res = {
      id: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
      paidAtVenue: true,
    };
    expect(PaidAtVenueResponse.parse(res)).toEqual(res);
  });
});
