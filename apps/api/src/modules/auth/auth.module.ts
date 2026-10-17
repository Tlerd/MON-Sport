import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import { AuthController } from './auth.controller.js';
import { Passwords } from './passwords.js';
import { SessionGuard } from './session.guard.js';
import { ThrottleService } from './throttle.service.js';

@Module({
  controllers: [AuthController],
  providers: [SessionGuard, AccountsService, ThrottleService, Passwords],
  exports: [SessionGuard, AccountsService, ThrottleService],
})
export class AuthModule {}
