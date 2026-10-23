import { createHmac, timingSafeEqual } from 'node:crypto';

// A session cookie value is "<userId>.<expiry in ms>.<HMAC-SHA256>". Sessions last 30 days (brief F-002).
export const SESSION_COOKIE = 'session';
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export const GOOGLE_FLOW_COOKIE = 'google_flow';
export const GOOGLE_PENDING_COOKIE = 'google_pending';
export const GOOGLE_VERIFY_COOKIE = 'google_verify';

export const GOOGLE_FLOW_MS = 10 * 60 * 1000;
export const GOOGLE_PENDING_MS = 30 * 60 * 1000;
export const GOOGLE_VERIFY_MS = 10 * 60 * 1000;
export const GOOGLE_COOKIE_PATH = '/api/auth/google';

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

/**
 * Derives a dedicated HMAC key for a given cookie name from SESSION_SECRET (brief F-004, AC-21).
 * Each cookie signs with its own key HMAC-SHA256(SESSION_SECRET, '<cookie name>'), including 'session' itself.
 * Note: existing cookies issued with the old un-derived key become invalid after this change: that is accepted,
 * and users log in again after this deploy.
 */
export function cookieKey(name: string): Buffer {
  return createHmac('sha256', secret()).update(name).digest();
}

const signWithKey = (payload: string, key: Buffer) => createHmac('sha256', key).update(payload).digest('base64url');

/**
 * A keyed digest of a phone number or an IP, so a counter row holds neither in readable form (brief F-006).
 * Its key derives from the session secret, so the cookie key signs nothing else.
 */
export function keyedDigest(value: string): string {
  const key = createHmac('sha256', secret()).update('auth-throttle').digest();
  return createHmac('sha256', key).update(value).digest('hex');
}

export function issueSession(userId: string, now: Date): string {
  const payload = `${userId}.${now.getTime() + SESSION_MS}`;
  return `${payload}.${signWithKey(payload, cookieKey(SESSION_COOKIE))}`;
}

/**
 * Returns the user id and the issue time, or null when the value is forged or expired.
 * The issue time is the expiry less 30 days, so the cookie format stays the same (brief F-006).
 * A change of SESSION_MS moves the issue time of every older cookie, so it needs a new cookie format.
 */
export function readSession(value: string | undefined, now: Date): { userId: string; issuedAt: Date } | null {
  const parts = value?.split('.');
  if (!parts || parts.length !== 3) return null;
  const [userId, expiry, mac] = parts;
  const expected = Buffer.from(signWithKey(`${userId}.${expiry}`, cookieKey(SESSION_COOKIE)));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const expiresAt = Number(expiry);
  return expiresAt > now.getTime() ? { userId, issuedAt: new Date(expiresAt - SESSION_MS) } : null;
}

export interface GoogleFlowPayload {
  typ: 'google_flow';
  state: string;
  nonce: string;
  codeVerifier: string;
  mode: 'login' | 'link';
  userId?: string;
  exp: number;
}

export interface GooglePendingPayload {
  typ: 'google_pending';
  sub: string;
  email: string | null;
  name: string;
  exp: number;
}

export interface GoogleVerifyPayload {
  typ: 'google_verify';
  userId: string;
  sub: string;
  exp: number;
}

/**
 * Issues a signed cookie containing base64url-encoded JSON with typ = cookieName.
 */
export function issueSignedJson<T extends { typ: string; exp: number }>(cookieName: string, payload: T): string {
  const json = JSON.stringify(payload);
  const data = Buffer.from(json, 'utf8').toString('base64url');
  const mac = signWithKey(data, cookieKey(cookieName));
  return `${data}.${mac}`;
}

/**
 * Reads and verifies a signed JSON cookie. Rejects wrong signature, malformed JSON, wrong typ, or expired timestamp.
 */
export function readSignedJson<T extends { typ: string; exp: number }>(
  cookieName: string,
  value: string | undefined,
  now: Date,
): T | null {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const [data, mac] = parts;
  const expected = Buffer.from(signWithKey(data, cookieKey(cookieName)));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const json = Buffer.from(data, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.typ !== cookieName) return null;
    if (typeof parsed.exp !== 'number' || parsed.exp <= now.getTime()) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

export function googleCookieOptions(maxAgeMs: number): {
  httpOnly: boolean;
  sameSite: 'lax';
  secure: boolean;
  maxAge: number;
  path: string;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAgeMs,
    path: GOOGLE_COOKIE_PATH,
  };
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
