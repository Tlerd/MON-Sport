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
// The API package does not depend on zod, so a regex stands in for `z.uuid()`. A bad id is a 404, never a database error.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Brief F-037: what `authenticate` gives to the MCP layer. Step 3 joins it with McpContext. */
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

/** SHA-256 of the whole token, lowercase hex. */
export function hashToken(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/** Never returns the hash. */
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

  /**
   * The one rule for "valid" (BR-59, BR-32): not revoked, not expired, and not created before the user's sessionsValidFrom.
   */
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
      // Lock order: the User row first (FOR NO KEY UPDATE), then the insert. Two parallel calls cannot make a sixth token.
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

  /** Returns the context for a valid token and null otherwise. It never logs the secret and never puts it in an error. */
  async authenticate(secret: string): Promise<AccessTokenContext | null> {
    if (!secret.startsWith(ACCESS_TOKEN_PREFIX) || secret.length > MAX_SECRET_LENGTH) return null;
    const row = await this.prisma.accessToken.findUnique({ where: { tokenHash: hashToken(secret) }, include: { user: true } });
    if (!row) return null;
    const now = this.clock.now();
    const { user } = row;
    if (row.revokedAt || row.expiresAt.getTime() <= now.getTime()) return null;
    if (user.lockedAt || user.deletedAt) return null;
    if (user.sessionsValidFrom && row.createdAt.getTime() < user.sessionsValidFrom.getTime()) return null;
    if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_STEP_MS) {
      await this.prisma.accessToken.updateMany({ where: { id: row.id }, data: { lastUsedAt: now } });
    }
    return { userId: user.id, role: user.role, scope: row.scope };
  }
}
