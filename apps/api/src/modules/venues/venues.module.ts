import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OwnerCourtsController, OwnerVenuesController, VenuesController } from './venues.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [VenuesController, OwnerVenuesController, OwnerCourtsController],
})
export class VenuesModule {}
