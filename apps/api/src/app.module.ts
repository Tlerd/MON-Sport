import { Module } from '@nestjs/common';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { DatabaseModule } from './modules/database/database.module.js';
import { FinanceModule } from './modules/finance/finance.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MatchesModule } from './modules/matches/matches.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { VenuesModule } from './modules/venues/venues.module.js';

@Module({
  imports: [DatabaseModule, HealthModule, AuthModule, VenuesModule, BookingsModule, MatchesModule, AdminModule, NotificationsModule, FinanceModule],
})
export class AppModule {}
