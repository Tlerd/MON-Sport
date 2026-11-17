import { Controller, Delete, Get, HttpCode, Param, Req, UseGuards } from '@nestjs/common';
import type { OAuthConnectionList } from '@monsport/shared';
import { type AuthedRequest, Roles, SessionGuard } from '../auth/session.guard.js';
import { OAuthService } from './oauth.service.js';

// Brief F-038: only a USER lists and revokes connections, with the session cookie. The views hold no hash.
@Controller('me/oauth-connections')
@UseGuards(SessionGuard)
@Roles('USER')
export class OAuthConnectionsController {
  constructor(private readonly service: OAuthService) {}

  @Get()
  async list(@Req() req: AuthedRequest): Promise<OAuthConnectionList> {
    return { connections: await this.service.listConnections(req.user.id) };
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(@Req() req: AuthedRequest, @Param('id') id: string): Promise<void> {
    await this.service.revokeConnection(req.user.id, id);
  }
}
