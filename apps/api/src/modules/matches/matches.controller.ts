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
import { MatchesService } from './matches.service.js';

const Id = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException(Messages.invalid) });

@Controller('matches')
export class MatchesController {
  constructor(
    private readonly matches: MatchesService,
    private readonly lobbyEvents: LobbyEvents,
  ) {}

  /** UC-8 steps 1-2 (brief F-011): public lobby list of OPEN matches. */
  @Get()
  list(@Query() query: unknown): Promise<MatchView[]> {
    const parsed = MatchLobbyQuery.safeParse(query);
    if (!parsed.success) throw new BadRequestException(Messages.invalid);
    return this.matches.list(parsed.data);
  }

  /** UC-8 steps 4-5 (brief F-012): public SSE stream of match updates via PostgreSQL LISTEN/NOTIFY. */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.lobbyEvents.stream();
  }

  /** UC-8 flow 8.2 (brief F-012): list matches where the caller has an ACTIVE MatchPlayer row. */
  @Get('joined')
  @UseGuards(SessionGuard)
  @Roles('USER')
  joined(@Req() req: AuthedRequest): Promise<MatchView[]> {
    return this.matches.joined(req.user.id);
  }

  /** UC-8 step 3 (brief F-012): match detail with ACTIVE players and BR-20 phone visibility. */
  @Get(':id')
  @UseGuards(SessionGuard)
  @Roles('USER')
  detail(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<MatchDetailView> {
    return this.matches.detail(req.user.id, id);
  }

  /** Brief F-028 (UC-15, BR-20): the host reads the waiting requests with phone numbers. */
  @Get(':id/requests')
  @UseGuards(SessionGuard)
  @Roles('USER')
  requests(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<MatchRequestView[]> {
    return this.matches.listRequests(req.user.id, id);
  }

  /** Brief F-032 (UC-19, BR-56): the host reads ratings for all active members except themselves. */
  @Get(':id/ratings')
  @UseGuards(SessionGuard)
  @Roles('USER')
  ratings(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<PlayerRatingView[]> {
    return this.matches.listRatings(req.user.id, id);
  }

  /** Brief F-032 (UC-19, BR-56): the host rates an active member. */
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
    return this.matches.ratePlayer(req.user.id, id, userId, parsed.data);
  }

  /** UC-7 (brief F-011): a user opens a match on their own app booking. BR-22: OWNER and ADMIN get 403. */
  @Post()
  @UseGuards(SessionGuard)
  @Roles('USER')
  create(@Req() req: AuthedRequest, @Body() body: unknown): Promise<MatchView> {
    const parsed = CreateMatchRequest.safeParse(body);
    if (!parsed.success) throw new BadRequestException(matchErrorMessage(parsed.error));
    return this.matches.create(req.user.id, parsed.data);
  }

  /** UC-8 step 4 (brief F-012): a user joins an OPEN match. */
  @Post(':id/join')
  @UseGuards(SessionGuard)
  @Roles('USER')
  @HttpCode(200)
  join(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<MatchDetailView> {
    return this.matches.join(req.user.id, id);
  }

  /** UC-8 flow 8.1 (brief F-012): a non-host player leaves a match before startAt (BR-18). */
  @Post(':id/leave')
  @UseGuards(SessionGuard)
  @Roles('USER')
  @HttpCode(200)
  leave(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<MatchDetailView> {
    return this.matches.leave(req.user.id, id);
  }

  /** Brief F-028 (UC-15): the host approves a waiting request. */
  @Post(':id/requests/:userId/approve')
  @UseGuards(SessionGuard)
  @Roles('USER')
  @HttpCode(200)
  approveRequest(
    @Req() req: AuthedRequest,
    @Param('id', Id) id: string,
    @Param('userId', Id) userId: string,
  ): Promise<MatchDetailView> {
    return this.matches.approveRequest(req.user.id, id, userId);
  }

  /** Brief F-028 (UC-15): the host rejects a waiting request. */
  @Post(':id/requests/:userId/reject')
  @UseGuards(SessionGuard)
  @Roles('USER')
  @HttpCode(200)
  rejectRequest(
    @Req() req: AuthedRequest,
    @Param('id', Id) id: string,
    @Param('userId', Id) userId: string,
  ): Promise<MatchDetailView> {
    return this.matches.rejectRequest(req.user.id, id, userId);
  }

  /** UC-9 (brief F-011): the host cancels their match and its underlying booking (BR-17). */
  @Post(':id/cancel')
  @UseGuards(SessionGuard)
  @Roles('USER')
  @HttpCode(200)
  cancel(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<MatchView> {
    return this.matches.cancel(req.user.id, id);
  }
}
