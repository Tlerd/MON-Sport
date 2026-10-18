import { z } from 'zod';

export const FinancialPeriod = z.enum(['day', 'week', 'month']);
export type FinancialPeriod = z.infer<typeof FinancialPeriod>;

export const FinancialQuerySchema = z.object({
  period: FinancialPeriod.default('week'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo định dạng YYYY-MM-DD').optional(),
});
export type FinancialQuery = z.infer<typeof FinancialQuerySchema>;

export const FinancialChartPoint = z.object({
  label: z.string(),
  revenue: z.number().int().nonnegative(),
  bookedHours: z.number().nonnegative(),
  bookingCount: z.number().int().nonnegative(),
});
export type FinancialChartPoint = z.infer<typeof FinancialChartPoint>;

export const FinancialDashboardView = z.object({
  venueId: z.string().uuid(),
  venueName: z.string(),
  period: FinancialPeriod,
  date: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  revenue: z.number().int().nonnegative(),
  totalBookings: z.number().int().nonnegative(),
  paidBookings: z.number().int().nonnegative(),
  unpaidBookings: z.number().int().nonnegative(),
  bookedHours: z.number().nonnegative(),
  openingHours: z.number().nonnegative(),
  occupancyRate: z.number().min(0).max(1),
  peakHours: z.number().nonnegative(),
  normalHours: z.number().nonnegative(),
  cancelledBookings: z.number().int().nonnegative(),
  rejectedBookings: z.number().int().nonnegative(),
  cancellationRate: z.number().min(0).max(1),
  rejectionRate: z.number().min(0).max(1),
  totalCustomers: z.number().int().nonnegative(),
  returningCustomers: z.number().int().nonnegative(),
  chartData: z.array(FinancialChartPoint),
});
export type FinancialDashboardView = z.infer<typeof FinancialDashboardView>;

export const UpdatePaidAtVenueSchema = z.object({
  paidAtVenue: z.boolean(),
});
export type UpdatePaidAtVenue = z.infer<typeof UpdatePaidAtVenueSchema>;

export const PaidAtVenueResponse = z.object({
  id: z.string().uuid(),
  paidAtVenue: z.boolean(),
});
export type PaidAtVenueResponse = z.infer<typeof PaidAtVenueResponse>;
