import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role, SessionUser } from '@monsport/shared';
import type { Request } from 'express';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { cookieValue, readSession, SESSION_COOKIE } from './session.js';

export type AuthedRequest = Request & { user: SessionUser };

const ROLES = 'roles';
/** Limits a route to these roles. Without it, any signed-in user passes. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const session = readSession(cookieValue(req.headers.cookie, SESSION_COOKIE), this.clock.now());
    const user = session ? await this.prisma.user.findUnique({ where: { id: session.userId } }) : null;
    // A cookie issued before sessionsValidFrom was revoked, for example by an unlock (brief F-006, BR-32).
    const revoked = !!user?.sessionsValidFrom && session!.issuedAt < user.sessionsValidFrom;
    if (!user || user.lockedAt || user.deletedAt || revoked) throw new UnauthorizedException('Bạn cần đăng nhập');
    req.user = { id: user.id, name: user.name, role: user.role };
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [context.getHandler(), context.getClass()]);
    if (roles && !roles.includes(user.role)) throw new ForbiddenException('Bạn không có quyền làm việc này');
    return true;
  }
}
