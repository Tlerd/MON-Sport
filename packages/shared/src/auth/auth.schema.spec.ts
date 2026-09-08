import { describe, expect, it } from 'vitest';
import { AuthCandidateSchema, LoginRequestSchema, SessionUserSchema } from './auth.schema';

describe('LoginRequestSchema', () => {
  it('chap nhan zaloId hop le', () => {
    expect(LoginRequestSchema.safeParse({ zaloId: 'mock-admin' }).success).toBe(true);
  });

  it('tu choi zaloId rong', () => {
    expect(LoginRequestSchema.safeParse({ zaloId: '' }).success).toBe(false);
  });

  it('tu choi thieu zaloId', () => {
    expect(LoginRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('AuthCandidateSchema', () => {
  it('chap nhan candidate hop le', () => {
    const result = AuthCandidateSchema.safeParse({
      id: 'u1',
      zaloId: 'mock-admin',
      name: 'Nguyễn Văn Quân',
      avatarUrl: null,
      role: 'ADMIN',
    });
    expect(result.success).toBe(true);
  });

  it('tu choi role khong hop le', () => {
    const result = AuthCandidateSchema.safeParse({
      id: 'u1',
      zaloId: 'mock-admin',
      name: 'Nguyễn Văn Quân',
      avatarUrl: null,
      role: 'SUPERADMIN',
    });
    expect(result.success).toBe(false);
  });
});

describe('SessionUserSchema', () => {
  it('chap nhan session user hop le', () => {
    expect(
      SessionUserSchema.safeParse({ id: 'u1', name: 'Trần Thị Bình', role: 'PLAYER' }).success,
    ).toBe(true);
  });
});
