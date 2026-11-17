import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { type AccessTokenList, CreateAccessTokenRequest, type CreateAccessTokenResponse, errorMessage } from '@monsport/shared';
import type { Response } from 'express';
import { type AuthedRequest, Roles, SessionGuard } from '../auth/session.guard.js';
import { AccessTokensService } from './access-tokens.service.js';

// Brief F-037, BR-59: only a USER manages tokens, with the session cookie. The secret appears in the 201 response only.
@Controller('me/access-tokens')
@UseGuards(SessionGuard)
@Roles('USER')
export class AccessTokensController {
  constructor(private readonly service: AccessTokensService) {}

  @Get()
  async list(@Req() req: AuthedRequest): Promise<AccessTokenList> {
    return { tokens: await this.service.list(req.user.id) };
  }

  @Post()
  async create(@Req() req: AuthedRequest, @Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<CreateAccessTokenResponse> {
    const input = CreateAccessTokenRequest.safeParse(body);
    if (!input.success) throw new BadRequestException(errorMessage(input.error));
    res.setHeader('Cache-Control', 'no-store');
    return this.service.create(req.user.id, input.data);
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(@Req() req: AuthedRequest, @Param('id') id: string): Promise<void> {
    await this.service.revoke(req.user.id, id);
  }
}
