import { type CanActivate, Inject, Injectable, NotFoundException } from '@nestjs/common';

export const GOOGLE_CONFIG = Symbol('GOOGLE_CONFIG');
export const GOOGLE_OIDC_CONFIGURATION = Symbol('GOOGLE_OIDC_CONFIGURATION');

export interface GoogleConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Asserts Google OAuth configuration at start-up (AC-20).
 * If any of GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI is set,
 * then all three must be set.
 */
export function assertGoogleConfig(env: NodeJS.ProcessEnv = process.env): void {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = env.GOOGLE_REDIRECT_URI?.trim();

  const count = (clientId ? 1 : 0) + (clientSecret ? 1 : 0) + (redirectUri ? 1 : 0);
  if (count > 0 && count < 3) {
    throw new Error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI must all be set if any is set.');
  }
}

/**
 * Google is enabled only when all three GOOGLE_* variables are set AND OTP_PROVIDER is set (brief: 'không đặt' row, AC-19).
 */
export function isGoogleEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = env.GOOGLE_REDIRECT_URI?.trim();
  const otpProvider = env.OTP_PROVIDER?.trim();
  return Boolean(clientId && clientSecret && redirectUri && otpProvider);
}

@Injectable()
export class GoogleEnabledGuard implements CanActivate {
  constructor(@Inject(GOOGLE_CONFIG) private readonly config: GoogleConfig) {}

  canActivate(): boolean {
    if (!this.config.enabled) {
      throw new NotFoundException();
    }
    return true;
  }
}
