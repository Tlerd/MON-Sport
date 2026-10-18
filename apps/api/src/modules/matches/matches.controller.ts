import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CreateMatchRequest, matchErrorMessage, MatchLobbyQuery, type MatchView, Messages } from '@monsport/shared';
import { type AuthedRequest, Roles, SessionGuard } from '../auth/session.guard.js';
import { MatchesService } from './matches.service.js';

const Id = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException(Messages.invalid) });

@Controller('matches')
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  /** UC-8 steps 1-2 (brief F-011): public lobby list of OPEN matches. */
  @Get()
  list(@Query() query: unknown): Promise<MatchView[]> {
    const parsed = MatchLobbyQuery.safeParse(query);
    if (!parsed.success) throw new BadRequestException(Messages.invalid);
    return this.matches.list(parsed.data);
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

  /** UC-9 (brief F-011): the host cancels their match and its underlying booking (BR-17). */
  @Post(':id/cancel')
  @UseGuards(SessionGuard)
  @Roles('USER')
  @HttpCode(200)
  cancel(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<MatchView> {
    return this.matches.cancel(req.user.id, id);
  }
}
