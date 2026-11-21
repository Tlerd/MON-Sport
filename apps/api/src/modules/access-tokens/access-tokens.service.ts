import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ACCESS_TOKEN_PREFIX,
  type AccessTokenScope,
  type AccessTokenView,
  type CreateAccessTokenRequest,
  type CreateAccessTokenResponse,
  MAX_ACTIVE_ACCESS_TOKENS,
  type Role,
} from '@monsport/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

const NOT_FOUND = 'Không tìm thấy mã';
const FULL = 'Bạn đã có 5 mã. Thu hồi một mã trước';
const MAX_SECRET_LENGTH = 100;
const LAST_USED_STEP_MS = 60_000;
const DAY_MS = 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AccessTokenContext {
  userId: string;
  role: Role;
  scope: AccessTokenScope;
}

interface TokenRow {
  id: string;
  name: string;
  scope: AccessTokenScope;
  prefix: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
}

export function hashToken(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function toView(row: TokenRow): AccessTokenView {
  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
    prefix: row.prefix,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  };
}

@Injectable()
export class AccessTokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  private validWhere(userId: string, sessionsValidFrom: Date | null, now: Date): Prisma.AccessTokenWhereInput {
    return {
      userId,
      revokedAt: null,
      expiresAt: { gt: now },
      ...(sessionsValidFrom ? { createdAt: { gte: sessionsValidFrom } } : {}),
    };
  }

  async list(userId: string): Promise<AccessTokenView[]> {
    const now = this.clock.now();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { sessionsValidFrom: true } });
    const rows = await this.prisma.accessToken.findMany({
      where: this.validWhere(userId, user?.sessionsValidFrom ?? null, now),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toView);
  }

  async create(userId: string, input: CreateAccessTokenRequest): Promise<CreateAccessTokenResponse> {
    const now = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<{ sessionsValidFrom: Date | null }[]>`SELECT "sessionsValidFrom" FROM "User" WHERE "id" = ${userId}::uuid FOR NO KEY UPDATE`;
      const sessionsValidFrom = users[0]?.sessionsValidFrom ?? null;
      const active = await tx.accessToken.count({ where: this.validWhere(userId, sessionsValidFrom, now) });
      if (active >= MAX_ACTIVE_ACCESS_TOKENS) throw new ConflictException(FULL);

      const secret = ACCESS_TOKEN_PREFIX + randomBytes(32).toString('base64url');
      const row = await tx.accessToken.create({
        data: {
          userId,
          name: input.name,
          scope: input.scope,
          prefix: secret.slice(0, 12),
          tokenHash: hashToken(secret),
          createdAt: now,
          expiresAt: new Date(now.getTime() + input.expiresInDays * DAY_MS),
        },
      });
      return { token: toView(row), secret };
    });
  }

  async revoke(userId: string, id: string): Promise<void> {
    if (!UUID.test(id)) throw new NotFoundException(NOT_FOUND);
    const result = await this.prisma.accessToken.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: this.clock.now() },
    });
    if (result.count === 0) throw new NotFoundException(NOT_FOUND);
  }

  async authenticate(secret: string): Promise<AccessTokenContext | null> {
    if (!secret.startsWith(ACCESS_TOKEN_PREFIX) || secret.length > MAX_SECRET_LENGTH) return null;
    const row = await this.prisma.accessToken.findUnique({
      where: { tokenHash: hashToken(secret) },
      select: {
        id: true,
        userId: true,
        scope: true,
        lastUsedAt: true,
        user: { select: { id: true, role: true, lockedAt: true, deletedAt: true, sessionsValidFrom: true } },
      },
    });
    if (!row) return null;
    const now = this.clock.now();
    const { user } = row;
    if (user.role !== 'USER' || user.lockedAt || user.deletedAt) return null;
    const valid = await this.prisma.accessToken.count({
      where: { id: row.id, ...this.validWhere(row.userId, user.sessionsValidFrom, now) },
    });
    if (valid === 0) return null;
    if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_STEP_MS) {
      await this.prisma.accessToken.updateMany({ where: { id: row.id }, data: { lastUsedAt: now } });
    }
    return { userId: user.id, role: user.role, scope: row.scope };
  }
}
