import type { AccessTokenList, CreateAccessTokenRequest, CreateAccessTokenResponse } from '@monsport/shared';
import { api } from './api.ts';

export function listAccessTokens(): Promise<AccessTokenList> {
  return api<AccessTokenList>('/api/me/access-tokens');
}

export function createAccessToken(input: CreateAccessTokenRequest): Promise<CreateAccessTokenResponse> {
  return api<CreateAccessTokenResponse>('/api/me/access-tokens', { method: 'POST', json: input });
}

export async function revokeAccessToken(id: string): Promise<void> {
  await api<void>(`/api/me/access-tokens/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
