import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  OAUTH_ACCESS_TOKEN_PREFIX,
  OAUTH_ACCESS_TTL_SECONDS,
  OAUTH_REFRESH_TOKEN_PREFIX,
  parseScope,
} from '@monsport/shared';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { OAuthGrantError } from './oauth-grant.error.js';
import {
  ACCESS_TTL_MS,
  CODE_TTL_MS,
  MAX_CONNECTIONS,
  MAX_TOKEN_LENGTH,
  publicOrigin,
  REFRESH_IDLE_MS,
  REUSE_GRACE_MS,
  sha256,
  validWhere,
  VERIFIER_FORMAT,
} from './oauth-helpers.js';

export interface OAuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

function mint(prefix: string): string {
  return prefix + randomBytes(32).toString('base64url');
}

function tokenResponse(accessToken: string, refreshToken: string | null, scope: string): OAuthTokenResponse {
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: OAUTH_ACCESS_TTL_SECONDS,
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
    scope,
  };
}

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

@Injectable()
export class OAuthTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async token(form: Record<string, string>): Promise<OAuthTokenResponse> {
    const origin = publicOrigin();
    if (form.grant_type === 'authorization_code') return this.exchangeCode(form, origin);
    if (form.grant_type === 'refresh_token') return this.refresh(form, origin);
    throw new OAuthGrantError(form.grant_type === undefined ? 'invalid_request' : 'unsupported_grant_type');
  }

  private async exchangeCode(form: Record<string, string>, origin: string): Promise<OAuthTokenResponse> {
    const { code, redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier, resource } = form;
    if (!code || !redirectUri || !clientId || !verifier || !resource) throw new OAuthGrantError('invalid_request');
    const invalid = new OAuthGrantError('invalid_grant');
    if (code.length > MAX_TOKEN_LENGTH || !VERIFIER_FORMAT.test(verifier)) throw invalid;

    const now = this.clock.now();
    const row = await this.prisma.oAuthRequest.findUnique({ where: { codeHash: sha256(code) } });
    if (!row || !row.userId || !row.grantedScope || !row.codeExpiresAt) throw invalid;
    if (row.codeUsedAt || row.codeExpiresAt.getTime() <= now.getTime()) throw invalid;
    if (row.redirectUri !== redirectUri || row.clientId !== clientId || row.resource !== resource) throw invalid;
    if (resource !== `${origin}/api/mcp`) throw invalid;
    if (!sameSecret(createHash('sha256').update(verifier).digest('base64url'), row.codeChallenge)) throw invalid;

    const userId = row.userId;
    const scope = parseScope(row.grantedScope);
    const accessToken = mint(OAUTH_ACCESS_TOKEN_PREFIX);
    const refreshToken = scope.offline ? mint(OAUTH_REFRESH_TOKEN_PREFIX) : null;
    await this.prisma.$transaction(async (tx) => {
      const used = await tx.$executeRaw`UPDATE "OAuthRequest" SET "codeUsedAt" = ${now} WHERE "id" = ${row.id}::uuid AND "codeUsedAt" IS NULL`;
      if (used === 0) throw invalid;
      const users = await tx.$queryRaw<{ sessionsValidFrom: Date | null; lockedAt: Date | null; deletedAt: Date | null }[]>`SELECT "sessionsValidFrom", "lockedAt", "deletedAt" FROM "User" WHERE "id" = ${userId}::uuid FOR NO KEY UPDATE`;
      const user = users[0];
      if (!user || user.lockedAt || user.deletedAt) throw invalid;
      const approvedAt = (row.codeExpiresAt?.getTime() ?? 0) - CODE_TTL_MS;
      if (user.sessionsValidFrom && approvedAt < user.sessionsValidFrom.getTime()) throw invalid;
      const active = await tx.oAuthConnection.count({ where: validWhere(userId, user.sessionsValidFrom, now) });
      if (active >= MAX_CONNECTIONS) throw invalid;
      const connection = await tx.oAuthConnection.create({
        data: {
          userId,
          clientId: row.clientId,
          clientName: row.clientName,
          scope: scope.access,
          accessTokenHash: sha256(accessToken),
          accessExpiresAt: new Date(now.getTime() + ACCESS_TTL_MS),
          refreshTokenHash: refreshToken ? sha256(refreshToken) : null,
          refreshExpiresAt: refreshToken ? new Date(now.getTime() + REFRESH_IDLE_MS) : null,
          createdAt: now,
        },
      });
      await tx.oAuthRequest.update({ where: { id: row.id }, data: { connectionId: connection.id } });
    });
    return tokenResponse(accessToken, refreshToken, row.grantedScope);
  }

  private async refresh(form: Record<string, string>, origin: string): Promise<OAuthTokenResponse> {
    const { refresh_token: presented, client_id: clientId, resource } = form;
    if (!presented || !clientId) throw new OAuthGrantError('invalid_request');
    const invalid = new OAuthGrantError('invalid_grant');
    if (presented.length > MAX_TOKEN_LENGTH) throw invalid;
    if (resource !== undefined && resource !== `${origin}/api/mcp`) throw new OAuthGrantError('invalid_target');

    const now = this.clock.now();
    const oldHash = sha256(presented);
    const row = await this.prisma.oAuthConnection.findUnique({ where: { refreshTokenHash: oldHash }, include: { user: true } });
    if (!row) {
      const old = await this.prisma.oAuthConnection.findUnique({ where: { previousRefreshTokenHash: oldHash } });
      if (old?.refreshRotatedAt && now.getTime() - old.refreshRotatedAt.getTime() >= REUSE_GRACE_MS) {
        await this.prisma.oAuthConnection.updateMany({ where: { id: old.id, revokedAt: null }, data: { revokedAt: now } });
      }
      throw invalid;
    }
    if (row.clientId !== clientId) throw invalid;
    const valid = await this.prisma.oAuthConnection.count({
      where: { AND: [{ id: row.id, refreshExpiresAt: { gt: now } }, validWhere(row.userId, row.user.sessionsValidFrom, now)] },
    });
    if (valid === 0) throw invalid;

    const accessToken = mint(OAUTH_ACCESS_TOKEN_PREFIX);
    const refreshToken = mint(OAUTH_REFRESH_TOKEN_PREFIX);
    const rotated = await this.prisma.oAuthConnection.updateMany({
      where: { refreshTokenHash: oldHash, revokedAt: null },
      data: {
        accessTokenHash: sha256(accessToken),
        accessExpiresAt: new Date(now.getTime() + ACCESS_TTL_MS),
        refreshTokenHash: sha256(refreshToken),
        previousRefreshTokenHash: oldHash,
        refreshRotatedAt: now,
        refreshExpiresAt: new Date(now.getTime() + REFRESH_IDLE_MS),
      },
    });
    if (rotated.count === 0) throw invalid;
    return tokenResponse(accessToken, refreshToken, `${row.scope === 'BOOK' ? 'read book' : 'read'} offline_access`);
  }
}
