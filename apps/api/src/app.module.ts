import { Module } from '@nestjs/common';
import { AccessTokensModule } from './modules/access-tokens/access-tokens.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { DatabaseModule } from './modules/database/database.module.js';
import { FinanceModule } from './modules/finance/finance.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MatchesModule } from './modules/matches/matches.module.js';
import { McpModule } from './modules/mcp/mcp.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OtpModule } from './modules/otp/otp.module.js';
import { PushModule } from './modules/push/push.module.js';
import { StaffModule } from './modules/staff/staff.module.js';
import { VenuesModule } from './modules/venues/venues.module.js';

@Module({
  imports: [DatabaseModule, HealthModule, AuthModule, VenuesModule, BookingsModule, MatchesModule, AdminModule, NotificationsModule, FinanceModule, PushModule, OtpModule, StaffModule, McpModule, AccessTokensModule],
})
export class AppModule {}
