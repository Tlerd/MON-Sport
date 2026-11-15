import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AvailabilityController } from './availability.controller.js';
import { AvailabilityService } from './availability.service.js';
import { OwnerCourtsController, OwnerVenuesController, VenuesController } from './venues.controller.js';
import { VenuesService } from './venues.service.js';

@Module({
  imports: [AuthModule],
  controllers: [VenuesController, AvailabilityController, OwnerVenuesController, OwnerCourtsController],
  providers: [VenuesService, AvailabilityService],
  exports: [VenuesService, AvailabilityService],
})
export class VenuesModule {}
