import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export const AUTH_COOKIE_NAME = 'monsport_token';

export interface JwtPayload {
  sub: string;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- augmentation chuan cua Express, khong phai namespace tu viet.
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Doc cookie httpOnly, xac thuc JWT, gan request.user cho controller/decorator dung.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Bạn cần đăng nhập để tiếp tục.');
    }

    try {
      request.user = await this.jwtService.verifyAsync<JwtPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    }
  }
}

function extractToken(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[AUTH_COOKIE_NAME];
}
