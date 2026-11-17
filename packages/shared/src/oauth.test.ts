import { describe, expect, it } from 'vitest';
import {
  OAUTH_ACCESS_TOKEN_PREFIX,
  OAUTH_REFRESH_TOKEN_PREFIX,
  OAuthConnectionView,
  OAuthConsentView,
  OAuthDecisionRequest,
  OAuthScope,
  parseScope,
} from './oauth.ts';

describe('OAuth contract (brief F-038, Contract)', () => {
  it('AC-1: OAuthScope accepts read, book and offline_access and rejects admin', () => {
    for (const scope of ['read', 'book', 'offline_access']) expect(OAuthScope.safeParse(scope).success).toBe(true);
    expect(OAuthScope.safeParse('admin').success).toBe(false);
  });

  it('AC-1: parseScope maps "book offline_access" to BOOK with offline, and "" to READ without offline', () => {
    expect(parseScope('book offline_access')).toEqual({ access: 'BOOK', offline: true });
    expect(parseScope('')).toEqual({ access: 'READ', offline: false });
    expect(parseScope('read')).toEqual({ access: 'READ', offline: false });
    expect(parseScope('  read   offline_access ')).toEqual({ access: 'READ', offline: true });
  });

  it('AC-1: OAuthConnectionView has exactly the keys id, clientName, scope, createdAt, lastUsedAt', () => {
    expect(Object.keys(OAuthConnectionView.shape).sort()).toEqual(['clientName', 'createdAt', 'id', 'lastUsedAt', 'scope']);
  });

  it('AC-1: OAuthConsentView has exactly the keys clientName, clientHost, scopes, dataRead', () => {
    expect(Object.keys(OAuthConsentView.shape).sort()).toEqual(['clientHost', 'clientName', 'dataRead', 'scopes']);
  });

  it('AC-1: the token prefixes are "mot_" and "mor_"', () => {
    expect(OAUTH_ACCESS_TOKEN_PREFIX).toBe('mot_');
    expect(OAUTH_REFRESH_TOKEN_PREFIX).toBe('mor_');
  });

  it('AC-1: OAuthDecisionRequest needs at least one of read or book, and no extra key', () => {
    expect(OAuthDecisionRequest.safeParse({ scopes: ['read'] }).success).toBe(true);
    expect(OAuthDecisionRequest.safeParse({ scopes: [] }).success).toBe(false);
    expect(OAuthDecisionRequest.safeParse({ scopes: ['offline_access'] }).success).toBe(false);
    expect(OAuthDecisionRequest.safeParse({ scopes: ['read'], userId: 'x' }).success).toBe(false);
  });
});
