import type { OAuthConnectionList, OAuthConsentView, OAuthDecisionRequest, OAuthDecisionResponse } from '@monsport/shared';
import { api } from './api.ts';

const request = (id: string) => `/api/oauth/requests/${encodeURIComponent(id)}`;

export function getConsent(id: string): Promise<OAuthConsentView> {
  return api<OAuthConsentView>(request(id));
}

export function approveConsent(id: string, input: OAuthDecisionRequest): Promise<OAuthDecisionResponse> {
  return api<OAuthDecisionResponse>(`${request(id)}/approve`, { method: 'POST', json: input });
}

export function denyConsent(id: string): Promise<OAuthDecisionResponse> {
  return api<OAuthDecisionResponse>(`${request(id)}/deny`, { method: 'POST' });
}

export function listOAuthConnections(): Promise<OAuthConnectionList> {
  return api<OAuthConnectionList>('/api/me/oauth-connections');
}

export async function revokeOAuthConnection(id: string): Promise<void> {
  await api<void>(`/api/me/oauth-connections/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
