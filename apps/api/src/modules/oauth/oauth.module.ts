import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClientMetadataFetcher } from './client-metadata.fetcher.js';
import { OAuthController } from './oauth.controller.js';
import { OAuthService } from './oauth.service.js';
import { WellKnownController } from './well-known.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [WellKnownController, OAuthController],
  providers: [OAuthService, ClientMetadataFetcher],
  exports: [OAuthService],
})
export class OAuthModule {}
