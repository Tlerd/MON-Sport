import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminAccountsController } from './accounts.controller.js';
import { AdminVenuesController } from './venues.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminAccountsController, AdminVenuesController],
})
export class AdminModule {}
