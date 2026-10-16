import { createHmac, timingSafeEqual } from 'node:crypto';

// A session cookie value is "<userId>.<expiry in ms>.<HMAC-SHA256>". Sessions last 30 days (brief F-002).
export const SESSION_COOKIE = 'session';
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is not set.');
  return 'local-development-only';
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function issueSession(userId: string, now: Date): string {
  const payload = `${userId}.${now.getTime() + SESSION_MS}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the user id, or null when the value is forged or expired. */
export function readSession(value: string | undefined, now: Date): string | null {
  const parts = value?.split('.');
  if (!parts || parts.length !== 3) return null;
  const [userId, expiry, mac] = parts;
  const expected = Buffer.from(sign(`${userId}.${expiry}`));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return Number(expiry) > now.getTime() ? userId : null;
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
