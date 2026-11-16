import { describe, expect, it } from 'vitest';
import { ACCESS_TOKEN_PREFIX, AccessTokenView, CreateAccessTokenRequest, MAX_ACTIVE_ACCESS_TOKENS } from './access-token.ts';

describe('access token contract (brief F-037, Contract)', () => {
  it('AC-1: CreateAccessTokenRequest accepts a valid request and trims the name', () => {
    const ok = CreateAccessTokenRequest.safeParse({ name: 'Claude Code', scope: 'BOOK', expiresInDays: 30 });
    expect(ok.success).toBe(true);
    const trimmed = CreateAccessTokenRequest.safeParse({ name: '  Claude Code  ', scope: 'READ', expiresInDays: 90 });
    expect(trimmed.success && trimmed.data.name).toBe('Claude Code');
  });

  it('AC-1: CreateAccessTokenRequest rejects expiresInDays 365', () => {
    expect(CreateAccessTokenRequest.safeParse({ name: 'a', scope: 'BOOK', expiresInDays: 365 }).success).toBe(false);
  });

  it('AC-1: CreateAccessTokenRequest rejects a name that is empty after trim and a name of 51 characters', () => {
    expect(CreateAccessTokenRequest.safeParse({ name: '   ', scope: 'BOOK', expiresInDays: 30 }).success).toBe(false);
    expect(CreateAccessTokenRequest.safeParse({ name: 'a'.repeat(50), scope: 'BOOK', expiresInDays: 30 }).success).toBe(true);
    expect(CreateAccessTokenRequest.safeParse({ name: 'a'.repeat(51), scope: 'BOOK', expiresInDays: 30 }).success).toBe(false);
  });

  it('AC-1: CreateAccessTokenRequest rejects scope ADMIN and the extra key userId', () => {
    expect(CreateAccessTokenRequest.safeParse({ name: 'a', scope: 'ADMIN', expiresInDays: 30 }).success).toBe(false);
    const extra = { name: 'a', scope: 'BOOK', expiresInDays: 30, userId: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b' };
    expect(CreateAccessTokenRequest.safeParse(extra).success).toBe(false);
  });

  it('AC-1: AccessTokenView has exactly the keys id, name, scope, prefix, createdAt, expiresAt, lastUsedAt', () => {
    expect(Object.keys(AccessTokenView.shape).sort()).toEqual(
      ['createdAt', 'expiresAt', 'id', 'lastUsedAt', 'name', 'prefix', 'scope'].sort(),
    );
  });

  it('AC-1: ACCESS_TOKEN_PREFIX is mst_ and MAX_ACTIVE_ACCESS_TOKENS is 5', () => {
    expect(ACCESS_TOKEN_PREFIX).toBe('mst_');
    expect(MAX_ACTIVE_ACCESS_TOKENS).toBe(5);
  });
});
