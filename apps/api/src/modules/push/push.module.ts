import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PushController } from './push.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PushController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class PushModule {}
