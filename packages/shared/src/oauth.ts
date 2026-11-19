import { z } from 'zod';
import { AccessTokenScope } from './access-token.ts';

export const OAUTH_ACCESS_TOKEN_PREFIX = 'mot_';
export const OAUTH_REFRESH_TOKEN_PREFIX = 'mor_';
export const OAUTH_ACCESS_TTL_SECONDS = 3600;
export const OAUTH_REFRESH_IDLE_DAYS = 30;
export const OAUTH_CONNECTION_MAX_DAYS = 90;
export const MAX_ACTIVE_OAUTH_CONNECTIONS = 10;

export const OAuthScope = z.enum(['read', 'book', 'offline_access']);
export type OAuthScope = z.infer<typeof OAuthScope>;

export function parseScope(scope: string): { access: AccessTokenScope; offline: boolean } {
  const parts = new Set(scope.split(/\s+/).filter(Boolean));
  return { access: parts.has('book') ? 'BOOK' : 'READ', offline: parts.has('offline_access') };
}

const ConsentScope = z.enum(['read', 'book']);

export const OAuthConsentView = z.object({
  clientName: z.string(),
  clientHost: z.string(),
  scopes: z.array(ConsentScope),
  dataRead: z.array(z.string()),
});
export type OAuthConsentView = z.infer<typeof OAuthConsentView>;

export const OAuthDecisionRequest = z.object({ scopes: z.array(ConsentScope).min(1) }).strict();
export type OAuthDecisionRequest = z.infer<typeof OAuthDecisionRequest>;

export const OAuthDecisionResponse = z.object({ redirectTo: z.url() });
export type OAuthDecisionResponse = z.infer<typeof OAuthDecisionResponse>;

export const OAuthConnectionView = z.object({
  id: z.uuid(),
  clientName: z.string(),
  scope: AccessTokenScope,
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
});
export type OAuthConnectionView = z.infer<typeof OAuthConnectionView>;

export const OAuthConnectionList = z.object({ connections: z.array(OAuthConnectionView) });
export type OAuthConnectionList = z.infer<typeof OAuthConnectionList>;
