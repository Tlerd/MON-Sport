import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { errorMessage, OAuthDecisionRequest, type OAuthConsentView, type OAuthDecisionResponse } from '@monsport/shared';
import type { Request, Response } from 'express';
import { type AuthedRequest, Roles, SessionGuard } from '../auth/session.guard.js';
import { ThrottleService } from '../auth/throttle.service.js';
import { OAuthGrantError } from './oauth-grant.error.js';
import { OAuthService, publicOrigin } from './oauth.service.js';

const ERROR_PAGE = `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MONSPORT</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem">
<h1>Ứng dụng này không nối được với MONSPORT</h1>
<p>Quay lại ứng dụng và thử nối lại. Nếu lỗi vẫn còn, hãy báo cho người đã đưa bạn đường dẫn này.</p>
</body>
</html>`;

/** A request with a foreign Origin header is refused. A request without the header passes, as the other cookie routes do. */
function assertOrigin(req: Request): void {
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== publicOrigin()) throw new ForbiddenException('Bạn không có quyền làm việc này');
}

/**
 * The token route takes a form body only. Each parameter must be one string:
 * a repeated name or `a[]=1` gives an array or an object, so the whole request is refused.
 */
function readForm(req: Request): Record<string, string> | null {
  if (!req.is('application/x-www-form-urlencoded')) return null;
  const body: unknown = req.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const form: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== 'string') return null;
    form[key] = value;
  }
  return form;
}

// Brief F-038: the authorization server of the MCP connector. No route logs a code, a state, or a query.
@Controller('oauth')
export class OAuthController {
  constructor(
    private readonly service: OAuthService,
    private readonly throttle: ThrottleService,
  ) {}

  @Get('authorize')
  async authorize(@Req() req: Request, @Query() query: Record<string, unknown>, @Res() res: Response): Promise<void> {
    publicOrigin();
    if (!(await this.throttle.consumeOAuth('oauth-authorize-ip', req.ip))) {
      res.status(429).json({ message: 'Quá nhiều lệnh. Thử lại sau' });
      return;
    }
    const result = await this.service.startAuthorization(query);
    if ('redirect' in result) {
      res.redirect(302, result.redirect);
      return;
    }
    res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(ERROR_PAGE);
  }

  @Post('token')
  @HttpCode(200)
  async token(@Req() req: Request, @Res() res: Response): Promise<void> {
    publicOrigin();
    // Count first, before any read of the body or the tables.
    if (!(await this.throttle.consumeOAuth('oauth-token-ip', req.ip))) {
      res.status(429).json({ message: 'Quá nhiều lệnh. Thử lại sau' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    const form = readForm(req);
    if (!form) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    try {
      res.status(200).json(await this.service.token(form));
    } catch (error) {
      if (error instanceof OAuthGrantError) {
        res.status(400).json({ error: error.error });
        return;
      }
      throw error;
    }
  }

  @Get('requests/:id')
  @UseGuards(SessionGuard)
  @Roles('USER')
  consent(@Req() req: AuthedRequest, @Param('id') id: string): Promise<OAuthConsentView> {
    return this.service.consent(req.user.id, id);
  }

  @Post('requests/:id/approve')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  @Roles('USER')
  approve(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown): Promise<OAuthDecisionResponse> {
    assertOrigin(req);
    const input = OAuthDecisionRequest.safeParse(body);
    if (!input.success) throw new BadRequestException(errorMessage(input.error));
    return this.service.approve(req.user.id, id, input.data);
  }

  @Post('requests/:id/deny')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  @Roles('USER')
  deny(@Req() req: AuthedRequest, @Param('id') id: string): Promise<OAuthDecisionResponse> {
    assertOrigin(req);
    return this.service.deny(req.user.id, id);
  }
}
