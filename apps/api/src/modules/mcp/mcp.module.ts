import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { VenuesModule } from '../venues/venues.module.js';
import { McpService } from './mcp.service.js';

// Brief F-036: no controller. Nothing outside the process can call a tool yet (AC-14).
@Module({
  imports: [VenuesModule, BookingsModule, MatchesModule],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
