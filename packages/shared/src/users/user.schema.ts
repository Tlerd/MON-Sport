import { z } from 'zod';
import { RoleSchema } from '../auth/auth.schema';

// Mirror dung enum Sport / SkillLevel trong apps/api/prisma/schema.prisma.
export const SportSchema = z.enum(['FOOTBALL', 'BADMINTON', 'VOLLEYBALL', 'PICKLEBALL']);
export type Sport = z.infer<typeof SportSchema>;

export const SkillLevelSchema = z.enum(['NEW', 'AVERAGE', 'GOOD', 'STRONG']);
export type SkillLevel = z.infer<typeof SkillLevelSchema>;

export const PlayerSkillSchema = z.object({
  sport: SportSchema,
  level: SkillLevelSchema,
});
export type PlayerSkill = z.infer<typeof PlayerSkillSchema>;

export const UpdateProfileRequestSchema = z.object({
  name: z.string().min(1, 'Ten khong duoc de trong.').optional(),
  phone: z.string().min(1, 'So dien thoai khong duoc de trong.').optional(),
  avatarUrl: z.string().optional(),
  skills: z.array(PlayerSkillSchema).optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const UserProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: RoleSchema,
  skills: z.array(PlayerSkillSchema),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;
