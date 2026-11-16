import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { LobbyEvents } from './lobby-events.service.js';
import { MatchesController } from './matches.controller.js';
import { MatchesService } from './matches.service.js';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [MatchesController],
  providers: [MatchesService, LobbyEvents],
  exports: [MatchesService],
})
export class MatchesModule {}
