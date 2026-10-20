import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminAccountsController } from './accounts.controller.js';
import { AdminStatsController } from './stats.controller.js';
import { StatsService } from './stats.service.js';
import { AdminVenuesController } from './venues.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminAccountsController, AdminVenuesController, AdminStatsController],
  providers: [StatsService],
})
export class AdminModule {}
