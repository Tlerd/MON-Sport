import { z } from 'zod';

// Khop dung hinh dang ma apps/api/src/common/filters/http-exception.filter.ts
// tra ve — khai mot lan o day de apps/web khong phai doan lai kieu loi.
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
