import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { BookingsController, OwnerBookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { OwnerBookingsService } from './owner-bookings.service.js';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [BookingsController, OwnerBookingsController],
  providers: [BookingsService, OwnerBookingsService],
  exports: [BookingsService, OwnerBookingsService],
})
export class BookingsModule {}
