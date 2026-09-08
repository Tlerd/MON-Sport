import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthProvider, SessionUser } from '@monsport/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AUTH_PROVIDER } from './auth.constants';

export interface LoginResult {
  token: string;
  user: SessionUser;
}

// Khong re nhanh if(mock) o day — chi phu thuoc interface AuthProvider, Nest DI
// (xem auth.module.ts) bind thang toi MockZaloProvider.
@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_PROVIDER) private readonly authProvider: AuthProvider,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(zaloId: string): Promise<LoginResult> {
    const identity = await this.authProvider.resolveIdentity({ externalId: zaloId });
    // Provider tra ve "danh tinh ben ngoai" (identity); anh xa sang tai khoan noi bo
    // la viec cua AuthService — tach biet co y, khong phai truy 2 lan thua.
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { zaloId: identity.externalId },
    });

    const token = await this.jwtService.signAsync({ sub: user.id, role: user.role });
    return { token, user: { id: user.id, name: user.name, role: user.role } };
  }

  async getSessionUser(userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { id: user.id, name: user.name, role: user.role };
  }
}
