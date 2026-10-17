import { describe, expect, it } from 'vitest';
import { assertSessionSecret, cookieValue, issueSession, readSession, SESSION_MS } from './session.js';

const now = new Date('2026-11-20T10:00:00+07:00');
const USER = '0199a1b2-0000-7000-8000-000000000001';

describe('session cookie', () => {
  it('reads back the user of a cookie it issued', () => {
    expect(readSession(issueSession(USER, now), now)).toEqual({ userId: USER, issuedAt: now });
  });

  it('refuses a forged signature', () => {
    const [id, expiry] = issueSession(USER, now).split('.');
    expect(readSession(`${id}.${expiry}.forged`, now)).toBeNull();
  });

  it('refuses a cookie after 30 days', () => {
    expect(readSession(issueSession(USER, now), new Date(now.getTime() + SESSION_MS + 1))).toBeNull();
  });

  it('reads a malformed cookie as no cookie', () => {
    expect(cookieValue('session=%E0%A4%A', 'session')).toBeUndefined();
  });
});

describe('assertSessionSecret', () => {
  it('refuses a missing, short, or development secret in production', () => {
    for (const SESSION_SECRET of [undefined, 'short', 'local-development-only'])
      expect(() => assertSessionSecret({ NODE_ENV: 'production', SESSION_SECRET })).toThrow();
  });

  it('accepts a long secret in production, and any secret outside production', () => {
    expect(() => assertSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) })).not.toThrow();
    expect(() => assertSessionSecret({ NODE_ENV: 'development' })).not.toThrow();
  });
});
