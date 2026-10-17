import { createHmac, timingSafeEqual } from 'node:crypto';

// A session cookie value is "<userId>.<expiry in ms>.<HMAC-SHA256>". Sessions last 30 days (brief F-002).
export const SESSION_COOKIE = 'session';
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

const DEV_SECRET = 'local-development-only';

function secret(): string {
  return process.env.SESSION_SECRET || DEV_SECRET;
}

/**
 * Called at start-up (review of PR #7, item 3). In production the secret must be set, be long,
 * and not be the development value, because anyone who knows it can forge a session cookie.
 */
export function assertSessionSecret(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  const value = env.SESSION_SECRET ?? '';
  if (value.length < 32 || value === DEV_SECRET)
    throw new Error('SESSION_SECRET must be set to a random value of 32 characters or more in production.');
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function issueSession(userId: string, now: Date): string {
  const payload = `${userId}.${now.getTime() + SESSION_MS}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Returns the user id and the issue time, or null when the value is forged or expired.
 * The issue time is the expiry less 30 days, so the cookie format stays the same (brief F-006).
 */
export function readSession(value: string | undefined, now: Date): { userId: string; issuedAt: Date } | null {
  const parts = value?.split('.');
  if (!parts || parts.length !== 3) return null;
  const [userId, expiry, mac] = parts;
  const expected = Buffer.from(sign(`${userId}.${expiry}`));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const expiresAt = Number(expiry);
  return expiresAt > now.getTime() ? { userId, issuedAt: new Date(expiresAt - SESSION_MS) } : null;
}

export function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const [key, ...rest] = part.trim().split('=');
    if (key !== name) continue;
    try {
      return decodeURIComponent(rest.join('='));
    } catch {
      return undefined; // A malformed value is no session: the guard answers 401, not 500.
    }
  }
  return undefined;
}
