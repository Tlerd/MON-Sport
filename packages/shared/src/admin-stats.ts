import { z } from 'zod';
import { isRealDate } from './booking-time.ts';

export const AdminStatsQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo định dạng YYYY-MM-DD')
    .refine(isRealDate, 'Ngày không có thật')
    // Years outside this range make toISOString() write a longer year, so the week helpers would return a broken date.
    .refine((d) => d >= '2000-01-01' && d <= '2999-12-31', 'Ngày ngoài khoảng 2000 đến 2999')
    .optional(),
});
export type AdminStatsQuery = z.infer<typeof AdminStatsQuerySchema>;

export const AdminVenueStat = z.object({
  venueId: z.string().uuid(),
  venueName: z.string(),
  bookingCount: z.number().int().nonnegative(),
  matchCount: z.number().int().nonnegative(),
});
export type AdminVenueStat = z.infer<typeof AdminVenueStat>;

const Count = z.number().int().nonnegative();

export const AdminStatsView = z.object({
  date: z.string(), // YYYY-MM-DD, the day in use
  weekStart: z.string(), // YYYY-MM-DD, Monday
  weekEnd: z.string(), // YYYY-MM-DD, Sunday
  accounts: z.object({ ADMIN: Count, OWNER: Count, USER: Count, STAFF: Count }),
  newUsers: Count,
  activeUsers: Count,
  avgConfirmMinutes: Count.nullable(),
  expiryRate: z.number().min(0).max(1),
  venues: z.array(AdminVenueStat), // sorted by venueName
});
export type AdminStatsView = z.infer<typeof AdminStatsView>;
