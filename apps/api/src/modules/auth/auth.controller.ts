import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  errorMessage,
  LoginRequest,
  type ProvidersResponse,
  RegisterRequest,
  type SessionUser,
} from '@monsport/shared';
import type { Request, Response } from 'express';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { AccountsService } from './accounts.service.js';
import { NO_USER_HASH, refuseWhenThrottled, startSession } from './auth-helpers.js';
import { GOOGLE_CONFIG, type GoogleConfig } from './google.config.js';
import { Passwords } from './passwords.js';
import { SESSION_COOKIE } from './session.js';
import { type AuthedRequest, SessionGuard } from './session.guard.js';
import { ThrottleService } from './throttle.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly accounts: AccountsService,
    private readonly throttle: ThrottleService,
    private readonly passwords: Passwords,
    @Inject(GOOGLE_CONFIG) private readonly googleConfig: GoogleConfig,
  ) {}

  @Post('register')
  @HttpCode(201)
  async register(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SessionUser> {
    const input = RegisterRequest.safeParse(body);
    if (!input.success) throw new BadRequestException(errorMessage(input.error));
    refuseWhenThrottled(res, await this.throttle.consumeRegister(req.ip));
    const now = this.clock.now();
    const { consent: _consent, ...account } = input.data;
    const user = await this.accounts.create({ ...account, role: 'USER', consentAt: now, createdAt: now });
    startSession(res, user.id, this.clock.now());
    return { id: user.id, name: user.name, role: user.role };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SessionUser> {
    const input = LoginRequest.safeParse(body);
    if (!input.success) throw new BadRequestException('Số điện thoại hoặc mật khẩu không hợp lệ');
    refuseWhenThrottled(res, await this.throttle.consumeLogin(input.data.phone, req.ip));
    const user = await this.prisma.user.findUnique({ where: { phone: input.data.phone } });
    const passwordOk = await this.passwords.verify(user?.passwordHash ?? (await NO_USER_HASH), input.data.password);
    if (!user || user.deletedAt || !passwordOk)
      throw new UnauthorizedException('Sai số điện thoại hoặc mật khẩu');
    await this.throttle.loginSucceeded(input.data.phone);
    if (user.lockedAt) throw new ForbiddenException('Tài khoản đã bị khóa. Liên hệ admin của MONSPORT');
    startSession(res, user.id, this.clock.now());
    return { id: user.id, name: user.name, role: user.role };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() req: AuthedRequest): SessionUser {
    return { id: req.user.id, name: req.user.name, role: req.user.role };
  }

  @Get('providers')
  providers(): ProvidersResponse {
    return { google: this.googleConfig.enabled };
  }
}
