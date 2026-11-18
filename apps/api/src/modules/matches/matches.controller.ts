import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  type MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  CreateMatchRequest,
  type MatchDetailView,
  matchErrorMessage,
  MatchLobbyQuery,
  type MatchRequestView,
  type MatchView,
  Messages,
  type PlayerRatingView,
  RatePlayerRequest,
} from '@monsport/shared';
import type { Observable } from 'rxjs';
import { type AuthedRequest, Roles, SessionGuard } from '../auth/session.guard.js';
import { LobbyEvents } from './lobby-events.service.js';
import { MatchPlayersService } from './match-players.service.js';
import { MatchRatingsService } from './match-ratings.service.js';
import { MatchesService } from './matches.service.js';

const Id = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException(Messages.invalid) });

@Controller('matches')
export class MatchesController {
  constructor(
    private readonly matches: MatchesService,
    private readonly matchPlayers: MatchPlayersService,
    private readonly matchRatings: MatchRatingsService,
    private readonly lobbyEvents: LobbyEvents,
  ) {}

  @Get()
  list(@Query() query: unknown): Promise<MatchView[]> {
    const parsed = MatchLobbyQuery.safeParse(query);
    if (!parsed.success) throw new BadRequestException(Messages.invalid);
    return this.matches.list(parsed.data);
  }

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.lobbyEvents.stream();
  }

  @Get('joined')
  @UseGuards(SessionGuard)
  @Roles('USER')
  joined(@Req() req: AuthedRequest): Promise<MatchView[]> {
    return this.matches.joined(req.user.id);
  }

  @Get(':id')
  @UseGuards(SessionGuard)
  @Roles('USER')
  detail(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<MatchDetailView> {
    return this.matches.detail(req.user.id, id);
  }

  @Get(':id/requests')
  @UseGuards(SessionGuard)
  @Roles('USER')
  requests(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<MatchRequestView[]> {
    return this.matchPlayers.listRequests(req.user.id, id);
  }

  @Get(':id/ratings')
  @UseGuards(SessionGuard)
  @Roles('USER')
  ratings(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<PlayerRatingView[]> {
    return this.matchRatings.listRatings(req.user.id, id);
  }

  @Put(':id/ratings/:userId')
  @UseGuards(SessionGuard)
  @Roles('USER')
  ratePlayer(
    @Req() req: AuthedRequest,
    @Param('id', Id) id: string,
    @Param('userId', Id) userId: string,
    @Body() body: unknown,
  ): Promise<PlayerRatingView> {
    const parsed = RatePlayerRequest.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const msg = issue?.code === 'custom' ? issue.message : Messages.invalid;
      throw new BadRequestException(msg);
    }
    return this.matchRatings.ratePlayer(req.user.id, id, userId, parsed.data);
  }

  @Post()
  @UseGuards(SessionGuard)
  @Roles('USER')
  create(@Req() req: AuthedRequest, @Body() body: unknown): Promise<MatchView> {
    const parsed = CreateMatchRequest.safeParse(body);
    if (!parsed.success) throw new BadRequestException(matchErrorMessage(parsed.error));
    return this.matches.create(req.user.id, parsed.data);
  }

  @Post(':id/join')
  @UseGuards(SessionGuard)
  @Roles('USER')
  @HttpCode(200)
  join(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<MatchDetailView> {
    return this.matchPlayers.join(req.user.id, id);
  }

  @Post(':id/leave')
  @UseGuards(SessionGuard)
  @Roles('USER')
  @HttpCode(200)
  leave(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<MatchDetailView> {
    return this.matchPlayers.leave(req.user.id, id);
  }

  @Post(':id/requests/:userId/approve')
  @UseGuards(SessionGuard)
  @Roles('USER')
  @HttpCode(200)
  approveRequest(
    @Req() req: AuthedRequest,
    @Param('id', Id) id: string,
    @Param('userId', Id) userId: string,
  ): Promise<MatchDetailView> {
    return this.matchPlayers.approveRequest(req.user.id, id, userId);
  }

  @Post(':id/requests/:userId/reject')
  @UseGuards(SessionGuard)
  @Roles('USER')
  @HttpCode(200)
  rejectRequest(
    @Req() req: AuthedRequest,
    @Param('id', Id) id: string,
    @Param('userId', Id) userId: string,
  ): Promise<MatchDetailView> {
    return this.matchPlayers.rejectRequest(req.user.id, id, userId);
  }

  @Post(':id/cancel')
  @UseGuards(SessionGuard)
  @Roles('USER')
  @HttpCode(200)
  cancel(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<MatchView> {
    return this.matches.cancel(req.user.id, id);
  }
}
