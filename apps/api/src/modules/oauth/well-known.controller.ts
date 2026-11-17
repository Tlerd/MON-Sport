import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { OAuthService } from './oauth.service.js';

// Brief F-038: the two discovery routes. `setupApp` keeps them out of the `api` prefix.
@Controller()
export class WellKnownController {
  constructor(private readonly service: OAuthService) {}

  @Get('.well-known/oauth-protected-resource/api/mcp')
  resource(@Res({ passthrough: true }) res: Response): object {
    const body = this.service.metadata().resource;
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return body;
  }

  @Get('.well-known/oauth-authorization-server')
  server(@Res({ passthrough: true }) res: Response): object {
    const body = this.service.metadata().server;
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return body;
  }
}
