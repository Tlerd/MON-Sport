import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClientMetadataFetcher } from './client-metadata.fetcher.js';
import { OAuthConnectionsController } from './oauth-connections.controller.js';
import { OAuthTokenService } from './oauth-token.service.js';
import { OAuthController } from './oauth.controller.js';
import { OAuthService } from './oauth.service.js';
import { WellKnownController } from './well-known.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [WellKnownController, OAuthController, OAuthConnectionsController],
  providers: [OAuthService, OAuthTokenService, ClientMetadataFetcher],
  exports: [OAuthService, OAuthTokenService],
})
export class OAuthModule {}
