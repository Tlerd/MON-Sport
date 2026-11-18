import { HttpException, HttpStatus } from '@nestjs/common';
import { Messages } from '@monsport/shared';
import { hash } from '@node-rs/argon2';
import type { Response } from 'express';
import { issueSession, SESSION_COOKIE, SESSION_MS } from './session.js';

export const NO_USER_HASH = hash('no-user-has-this-phone');

export const KNOWN_GOOGLE_ERRORS = new Set(['access_denied', 'state', 'token', 'taken', 'session', 'locked', 'config']);

export function errorRedirect(code: string): string {
  return `/?google_error=${KNOWN_GOOGLE_ERRORS.has(code) ? code : 'unknown'}`;
}

export function startSession(res: Response, userId: string, now: Date): void {
  res.cookie(SESSION_COOKIE, issueSession(userId, now), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MS,
    path: '/',
  });
}

export function refuseWhenThrottled(res: Response, retryAfter: number | null): void {
  if (retryAfter === null) return;
  res.setHeader('Retry-After', String(retryAfter));
  throw new HttpException(Messages.tooManyAttempts, HttpStatus.TOO_MANY_REQUESTS);
}
