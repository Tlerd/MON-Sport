import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthCandidate, SessionUser } from '@monsport/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AUTH_COOKIE_NAME, JwtAuthGuard, type JwtPayload } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  // Danh sach user de chon o trang dang nhap mock — day la du lieu goc cua app
  // (bang User), khong phai viec cua cong AuthProvider (Zalo that khong "liet ke").
  @Get('candidates')
  async candidates(): Promise<AuthCandidate[]> {
    return this.prisma.user.findMany({
      select: { id: true, zaloId: true, name: true, avatarUrl: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    const { token, user } = await this.authService.login(dto.zaloId);
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE_MS,
    });
    return user;
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): { success: true } {
    res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: JwtPayload): Promise<SessionUser> {
    return this.authService.getSessionUser(user.sub);
  }
}
