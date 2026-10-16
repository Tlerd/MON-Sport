import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminAccountsController } from './accounts.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminAccountsController],
})
export class AdminModule {}
