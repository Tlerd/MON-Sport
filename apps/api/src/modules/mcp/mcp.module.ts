import { Module } from '@nestjs/common';
import { AccessTokensModule } from '../access-tokens/access-tokens.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { OAuthModule } from '../oauth/oauth.module.js';
import { VenuesModule } from '../venues/venues.module.js';
import { McpController } from './mcp.controller.js';
import { McpService } from './mcp.service.js';

// Brief F-037, step 3: `POST /api/mcp` takes a personal access token. AuthModule gives the shared BR-58 counter.
// Brief F-038, step 3: it also takes an OAuth access token through OAuthModule.
@Module({
  imports: [AuthModule, AccessTokensModule, OAuthModule, VenuesModule, BookingsModule, MatchesModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
