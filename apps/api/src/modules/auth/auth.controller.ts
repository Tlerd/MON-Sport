import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, HttpException, HttpStatus, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { errorMessage, LoginRequest, Messages, RegisterRequest, type SessionUser } from '@monsport/shared';
import { hash } from '@node-rs/argon2';
import type { Request, Response } from 'express';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { AccountsService } from './accounts.service.js';
import { Passwords } from './passwords.js';
import { issueSession, SESSION_COOKIE, SESSION_MS } from './session.js';
import { type AuthedRequest, SessionGuard } from './session.guard.js';
import { ThrottleService } from './throttle.service.js';

// Verified when no user has the phone, so both wrong answers take the same time (UC-1, 1.1.E1).
const NO_USER_HASH = hash('no-user-has-this-phone');

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly accounts: AccountsService,
    private readonly throttle: ThrottleService,
    private readonly passwords: Passwords,
  ) {}

  /** UC-1, flow 1.0: a guest signs up as a USER and is signed in (brief F-003). */
  @Post('register')
  @HttpCode(201)
  async register(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SessionUser> {
    const input = RegisterRequest.safeParse(body);
    if (!input.success) throw new BadRequestException(errorMessage(input.error));
    refuseWhenThrottled(res, await this.throttle.register(req.ip)); // Before the argon2 hash (brief F-006).
    const now = this.clock.now();
    const { consent: _consent, ...account } = input.data;
    // The role is fixed here. A role field in the body is ignored, because Zod strips unknown keys.
    const user = await this.accounts.create({ ...account, role: 'USER', consentAt: now, createdAt: now });
    this.startSession(res, user.id);
    return { id: user.id, name: user.name, role: user.role };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SessionUser> {
    const input = LoginRequest.safeParse(body);
    if (!input.success) throw new BadRequestException('Số điện thoại hoặc mật khẩu không hợp lệ');
    refuseWhenThrottled(res, await this.throttle.login(input.data.phone, req.ip)); // Before the argon2 check (brief F-006).
    const user = await this.prisma.user.findUnique({ where: { phone: input.data.phone } });
    // One message for a wrong phone and a wrong password (UC-1, 1.1.E1).
    const passwordOk = await this.passwords.verify(user?.passwordHash ?? (await NO_USER_HASH), input.data.password);
    if (!user || user.deletedAt || !passwordOk)
      throw new UnauthorizedException('Sai số điện thoại hoặc mật khẩu');
    await this.throttle.loginSucceeded(input.data.phone);
    if (user.lockedAt) throw new ForbiddenException('Tài khoản đã bị khóa'); // BR-28
    this.startSession(res, user.id);
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
    return req.user;
  }

  private startSession(res: Response, userId: string): void {
    res.cookie(SESSION_COOKIE, issueSession(userId, this.clock.now()), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MS,
      path: '/',
    });
  }
}

/** Brief F-006, BR-30: 429 with the seconds to wait, when a counter passed its limit. */
function refuseWhenThrottled(res: Response, retryAfter: number | null): void {
  if (retryAfter === null) return;
  res.setHeader('Retry-After', String(retryAfter));
  throw new HttpException(Messages.tooManyAttempts, HttpStatus.TOO_MANY_REQUESTS);
}
