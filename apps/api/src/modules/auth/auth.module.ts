import { Module } from '@nestjs/common';
import * as client from 'openid-client';
import { AccountsService } from './accounts.service.js';
import { AuthController } from './auth.controller.js';
import {
  GOOGLE_CONFIG,
  GOOGLE_OIDC_CONFIGURATION,
  GoogleEnabledGuard,
  type GoogleConfig,
  isGoogleEnabled,
} from './google.config.js';
import { Passwords } from './passwords.js';
import { SessionGuard } from './session.guard.js';
import { ThrottleService } from './throttle.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    SessionGuard,
    GoogleEnabledGuard,
    AccountsService,
    ThrottleService,
    Passwords,
    {
      provide: GOOGLE_CONFIG,
      useFactory: (): GoogleConfig => {
        const clientId = (process.env.GOOGLE_CLIENT_ID ?? '').trim();
        const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? '').trim();
        const redirectUri = (process.env.GOOGLE_REDIRECT_URI ?? '').trim();
        const enabled = isGoogleEnabled();
        return { enabled, clientId, clientSecret, redirectUri };
      },
    },
    {
      provide: GOOGLE_OIDC_CONFIGURATION,
      useFactory: async (config: GoogleConfig): Promise<client.Configuration | null> => {
        if (!config.enabled) return null;
        return await client.discovery(new URL('https://accounts.google.com'), config.clientId, config.clientSecret);
      },
      inject: [GOOGLE_CONFIG],
    },
  ],
  exports: [SessionGuard, AccountsService, ThrottleService, GOOGLE_CONFIG, GOOGLE_OIDC_CONFIGURATION],
})
export class AuthModule {}
