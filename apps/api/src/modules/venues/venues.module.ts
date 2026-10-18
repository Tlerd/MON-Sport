import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AvailabilityController } from './availability.controller.js';
import { OwnerCourtsController, OwnerVenuesController, VenuesController } from './venues.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [VenuesController, AvailabilityController, OwnerVenuesController, OwnerCourtsController],
})
export class VenuesModule {}
