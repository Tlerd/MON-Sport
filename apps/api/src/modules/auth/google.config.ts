import { type CanActivate, Inject, Injectable, NotFoundException } from '@nestjs/common';

export const GOOGLE_CONFIG = Symbol('GOOGLE_CONFIG');
export const GOOGLE_OIDC_CONFIGURATION = Symbol('GOOGLE_OIDC_CONFIGURATION');

export interface GoogleConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function assertGoogleConfig(env: NodeJS.ProcessEnv = process.env): void {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = env.GOOGLE_REDIRECT_URI?.trim();

  const count = (clientId ? 1 : 0) + (clientSecret ? 1 : 0) + (redirectUri ? 1 : 0);
  if (count > 0 && count < 3) {
    throw new Error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI must all be set if any is set.');
  }
}

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
