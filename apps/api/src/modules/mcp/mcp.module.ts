import { Module } from '@nestjs/common';
import { AccessTokensModule } from '../access-tokens/access-tokens.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { VenuesModule } from '../venues/venues.module.js';
import { McpController } from './mcp.controller.js';
import { McpService } from './mcp.service.js';

// Brief F-037, step 3: `POST /api/mcp` takes a personal access token. AuthModule gives the shared BR-58 counter.
@Module({
  imports: [AuthModule, AccessTokensModule, VenuesModule, BookingsModule, MatchesModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
