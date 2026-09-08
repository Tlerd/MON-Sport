import { describe, expect, it } from 'vitest';
import { UpdateProfileRequestSchema, UserProfileSchema } from './user.schema';

describe('UpdateProfileRequestSchema', () => {
  it('chap nhan object rong (khong sua gi)', () => {
    expect(UpdateProfileRequestSchema.safeParse({}).success).toBe(true);
  });

  it('chap nhan sua ten + trinh do nhieu mon', () => {
    const result = UpdateProfileRequestSchema.safeParse({
      name: 'Trần Thị Bình',
      skills: [
        { sport: 'FOOTBALL', level: 'GOOD' },
        { sport: 'BADMINTON', level: 'NEW' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('tu choi ten rong', () => {
    expect(UpdateProfileRequestSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('tu choi sport khong hop le trong skills', () => {
    const result = UpdateProfileRequestSchema.safeParse({
      skills: [{ sport: 'TENNIS', level: 'GOOD' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('UserProfileSchema', () => {
  it('chap nhan ho so day du', () => {
    const result = UserProfileSchema.safeParse({
      id: 'u1',
      name: 'Nguyễn Văn Quân',
      phone: null,
      avatarUrl: null,
      role: 'ADMIN',
      skills: [{ sport: 'FOOTBALL', level: 'STRONG' }],
    });
    expect(result.success).toBe(true);
  });
});
