import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import { AuthController } from './auth.controller.js';
import { SessionGuard } from './session.guard.js';

@Module({
  controllers: [AuthController],
  providers: [SessionGuard, AccountsService],
  exports: [SessionGuard, AccountsService],
})
export class AuthModule {}
