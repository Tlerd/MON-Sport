import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { LobbyEvents } from './lobby-events.service.js';
import { MatchPlayersService } from './match-players.service.js';
import { MatchRatingsService } from './match-ratings.service.js';
import { MatchesController } from './matches.controller.js';
import { MatchesService } from './matches.service.js';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [MatchesController],
  providers: [MatchesService, MatchPlayersService, MatchRatingsService, LobbyEvents],
  exports: [MatchesService, MatchPlayersService, MatchRatingsService],
})
export class MatchesModule {}
