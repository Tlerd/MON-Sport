import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { LoginRequest, type SessionUser } from '@monsport/shared';
import { hash, verify } from '@node-rs/argon2';
import type { Response } from 'express';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { issueSession, SESSION_COOKIE, SESSION_MS } from './session.js';
import { type AuthedRequest, SessionGuard } from './session.guard.js';

// Verified when no user has the phone, so both wrong answers take the same time (UC-1, 1.1.E1).
const NO_USER_HASH = hash('no-user-has-this-phone');

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<SessionUser> {
    const input = LoginRequest.safeParse(body);
    if (!input.success) throw new BadRequestException('Số điện thoại hoặc mật khẩu không hợp lệ');
    const user = await this.prisma.user.findUnique({ where: { phone: input.data.phone } });
    // One message for a wrong phone and a wrong password (UC-1, 1.1.E1).
    const passwordOk = await verify(user?.passwordHash ?? (await NO_USER_HASH), input.data.password);
    if (!user || user.deletedAt || !passwordOk)
      throw new UnauthorizedException('Sai số điện thoại hoặc mật khẩu');
    if (user.lockedAt) throw new ForbiddenException('Tài khoản đã bị khóa'); // BR-28
    res.cookie(SESSION_COOKIE, issueSession(user.id, this.clock.now()), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MS,
      path: '/',
    });
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
}
