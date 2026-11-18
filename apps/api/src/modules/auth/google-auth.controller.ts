import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import type {
  GoogleLinkStartResponse,
  GooglePendingView,
  OtpResponse,
  SessionUser,
} from '@monsport/shared';
import type { Request, Response } from 'express';
import { Clock } from '../database/clock.js';
import { OtpThrottleException } from '../otp/otp.service.js';
import { errorRedirect, startSession, throwThrottled } from './auth-helpers.js';
import { GoogleAuthService } from './google-auth.service.js';
import { GoogleEnabledGuard } from './google.config.js';
import {
  GOOGLE_COOKIE_PATH,
  GOOGLE_FLOW_COOKIE,
  GOOGLE_FLOW_MS,
  GOOGLE_PENDING_COOKIE,
  GOOGLE_VERIFY_COOKIE,
  googleCookieOptions,
} from './session.js';
import { type AuthedRequest, SessionGuard } from './session.guard.js';

@Controller('auth')
export class GoogleAuthController {
  constructor(
    private readonly service: GoogleAuthService,
    private readonly clock: Clock,
  ) {}

  @Get('google/start')
  async googleStart(@Res() res: Response): Promise<void> {
    this.service.assertEnabled();
    const oidcConfig = await this.service.getOidcConfig();
    if (!oidcConfig) {
      res.redirect(302, '/?google_error=config');
      return;
    }
    const flow = await this.service.buildFlow(oidcConfig, 'login');
    res.cookie(GOOGLE_FLOW_COOKIE, flow.cookie, googleCookieOptions(GOOGLE_FLOW_MS));
    res.redirect(302, flow.url);
  }

  @Post('google/link-start')
  @HttpCode(200)
  @UseGuards(GoogleEnabledGuard, SessionGuard)
  async googleLinkStart(
    @Body() body: unknown,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<GoogleLinkStartResponse> {
    this.service.assertEnabled();
    const oidcConfig = await this.service.getOidcConfig();
    if (!oidcConfig) throw new ServiceUnavailableException();
    const result = await this.service.linkStart(oidcConfig, req.user.id, req.ip, body);
    if (result.retryAfter !== null) throwThrottled(res, result.retryAfter);
    res.cookie(GOOGLE_FLOW_COOKIE, result.cookie, googleCookieOptions(GOOGLE_FLOW_MS));
    return { url: result.url };
  }

  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    this.service.assertEnabled();
    res.clearCookie(GOOGLE_FLOW_COOKIE, { path: GOOGLE_COOKIE_PATH });
    if (req.query.error) {
      res.redirect(302, errorRedirect(String(req.query.error)));
      return;
    }
    const result = await this.service.callback(
      req.headers.cookie,
      req.query.state,
      req.query.code,
      req.originalUrl || req.url,
    );
    if (result.cookie) {
      res.cookie(result.cookie.name, result.cookie.value, googleCookieOptions(result.cookie.maxAge));
    }
    if (result.sessionUserId) {
      startSession(res, result.sessionUserId, this.clock.now());
    }
    res.redirect(302, result.redirect);
  }

  @Get('google/pending')
  googlePending(@Req() req: Request): GooglePendingView {
    this.service.assertEnabled();
    return this.service.pending(req.headers.cookie);
  }

  @Post('google/otp')
  @HttpCode(200)
  async googleOtp(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OtpResponse> {
    this.service.assertEnabled();
    try {
      return await this.service.otp(body, req.headers.cookie, req.ip);
    } catch (err) {
      if (err instanceof OtpThrottleException) {
        res.setHeader('Retry-After', String(err.retryAfter));
      }
      throw err;
    }
  }

  @Post('google/complete')
  @HttpCode(201)
  async googleComplete(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    this.service.assertEnabled();
    try {
      const { user } = await this.service.complete(body, req.headers.cookie, req.ip);
      res.clearCookie(GOOGLE_PENDING_COOKIE, { path: GOOGLE_COOKIE_PATH });
      startSession(res, user.id, this.clock.now());
      return user;
    } catch (err) {
      if (err instanceof OtpThrottleException) {
        res.setHeader('Retry-After', String(err.retryAfter));
      }
      throw err;
    }
  }

  @Post('google/verify')
  @HttpCode(200)
  async googleVerify(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    this.service.assertEnabled();
    const { user } = await this.service.verify(body, req.headers.cookie);
    res.clearCookie(GOOGLE_VERIFY_COOKIE, { path: GOOGLE_COOKIE_PATH });
    startSession(res, user.id, this.clock.now());
    return user;
  }

  @Post('google/unlink')
  @HttpCode(200)
  @UseGuards(GoogleEnabledGuard, SessionGuard)
  async googleUnlink(@Req() req: AuthedRequest): Promise<{ ok: true }> {
    this.service.assertEnabled();
    await this.service.unlink(req.user.id);
    return { ok: true };
  }
}
