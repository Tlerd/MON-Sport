import { z } from 'zod';

export const RATE_WINDOW_DAYS = 7;
export const RATE_TOO_EARLY = 'Trận chưa bắt đầu, chưa chấm điểm được';
export const RATE_TOO_LATE = 'Đã quá 7 ngày sau trận, không chấm điểm được nữa';
export const RATE_CANCELLED = 'Trận đã hủy, không chấm điểm được';
export const RATE_NOT_PLAYER = 'Người này không có suất trong trận';

export const RatePlayerRequest = z
  .object({ stars: z.int().min(1).max(5).nullable(), noShow: z.boolean() })
  .strict()
  .refine((r) => (r.noShow ? r.stars === null : r.stars !== null), { message: 'Chọn số sao, hoặc chọn Vắng mặt' });
export type RatePlayerRequest = z.infer<typeof RatePlayerRequest>;

export const PlayerRatingView = z.object({
  userId: z.uuid(),
  name: z.string(),
  stars: z.int().min(1).max(5).nullable(),
  noShow: z.boolean().nullable(),
});
export type PlayerRatingView = z.infer<typeof PlayerRatingView>;

export const PlayerReputation = z.object({
  ratingAvg: z.number().nullable(),
  ratingCount: z.int().nonnegative(),
  noShowCount: z.int().nonnegative(),
});
export type PlayerReputation = z.infer<typeof PlayerReputation>;
