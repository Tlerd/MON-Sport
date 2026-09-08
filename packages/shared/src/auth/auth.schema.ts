import { z } from 'zod';

// Mirror dung 3 gia tri enum Role trong apps/api/prisma/schema.prisma.
export const RoleSchema = z.enum(['PLAYER', 'ORGANIZER', 'ADMIN']);
export type Role = z.infer<typeof RoleSchema>;

export const LoginRequestSchema = z.object({
  zaloId: z.string().min(1, 'Thieu zaloId de dang nhap.'),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// Danh sach user de chon o trang dang nhap mock (GET /auth/candidates).
export const AuthCandidateSchema = z.object({
  id: z.string(),
  zaloId: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  role: RoleSchema,
});
export type AuthCandidate = z.infer<typeof AuthCandidateSchema>;

// Thong tin toi thieu de biet "dang dang nhap la ai" (GET /auth/me).
export const SessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: RoleSchema,
});
export type SessionUser = z.infer<typeof SessionUserSchema>;
