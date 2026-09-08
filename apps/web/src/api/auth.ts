import { z } from 'zod';
import {
  AuthCandidateSchema,
  LoginRequestSchema,
  SessionUserSchema,
  type AuthCandidate,
  type SessionUser,
} from '@monsport/shared';
import { apiFetch, ApiRequestError } from './http';

export async function fetchCandidates(): Promise<AuthCandidate[]> {
  const data = await apiFetch<unknown>('/auth/candidates');
  return z.array(AuthCandidateSchema).parse(data);
}

export async function login(zaloId: string): Promise<SessionUser> {
  const payload = LoginRequestSchema.parse({ zaloId });
  const data = await apiFetch<unknown>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return SessionUserSchema.parse(data);
}

export async function logout(): Promise<void> {
  await apiFetch<unknown>('/auth/logout', { method: 'POST' });
}

// 401 o /auth/me nghia la "chua dang nhap", khong phai loi — tra ve null de
// useSession bieu dien trang thai do gon gang, khong throw lam noisy console.
export async function fetchSession(): Promise<SessionUser | null> {
  try {
    const data = await apiFetch<unknown>('/auth/me');
    return SessionUserSchema.parse(data);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      return null;
    }
    throw error;
  }
}
