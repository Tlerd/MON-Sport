import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PushSender, WebPushSender } from './push-sender.js';
import { PushController } from './push.controller.js';
import { PushService } from './push.service.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PushController],
  providers: [SubscriptionsService, PushService, { provide: PushSender, useClass: WebPushSender }],
  exports: [SubscriptionsService],
})
export class PushModule {}
