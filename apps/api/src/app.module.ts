import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { DatabaseModule } from './modules/database/database.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { VenuesModule } from './modules/venues/venues.module.js';

@Module({
  imports: [DatabaseModule, HealthModule, AuthModule, VenuesModule, BookingsModule],
})
export class AppModule {}
