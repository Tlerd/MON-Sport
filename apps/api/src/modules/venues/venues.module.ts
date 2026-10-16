import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OwnerVenuesController, VenuesController } from './venues.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [VenuesController, OwnerVenuesController],
})
export class VenuesModule {}
