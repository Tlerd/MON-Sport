import { randomBytes } from 'node:crypto';
import { ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AccessTokenScope,
  OAUTH_ACCESS_TOKEN_PREFIX,
  type OAuthConnectionView,
  type OAuthConsentView,
  type OAuthDecisionRequest,
  type OAuthDecisionResponse,
  OAuthScope,
  parseScope,
  type Role,
} from '@monsport/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { ClientMetadataFetcher, isAllowedClientId } from './client-metadata.fetcher.js';
import {
  CHALLENGE,
  CODE_TTL_MS,
  CONNECTION_NOT_FOUND,
  DATA_READ,
  DAY_MS,
  DONE,
  EXPIRED,
  FULL,
  LAST_USED_STEP_MS,
  MAX_CONNECTIONS,
  MAX_TOKEN_LENGTH,
  MAX_URL,
  NOT_FOUND,
  publicOrigin,
  redirectUrl,
  REQUEST_TTL_MS,
  SCOPES,
  sha256,
  UUID,
  validWhere,
} from './oauth-helpers.js';

export interface OAuthContext {
  userId: string;
  role: Role;
  scope: AccessTokenScope;
}

export type AuthorizeResult = { redirect: string } | { page: 'client-error' };

interface LockedRequest {
  id: string;
  clientName: string;
  redirectUri: string;
  scope: string;
  state: string | null;
  expiresAt: Date;
  userId: string | null;
  codeHash: string | null;
  deniedAt: Date | null;
}

@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly fetcher: ClientMetadataFetcher,
  ) {}

  metadata(): { resource: object; server: object } {
    const origin = publicOrigin();
    return {
      resource: {
        resource: `${origin}/api/mcp`,
        authorization_servers: [origin],
        scopes_supported: SCOPES,
        bearer_methods_supported: ['header'],
      },
      server: {
        issuer: origin,
        authorization_endpoint: `${origin}/api/oauth/authorize`,
        token_endpoint: `${origin}/api/oauth/token`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
        client_id_metadata_document_supported: true,
        scopes_supported: SCOPES,
        authorization_response_iss_parameter_supported: true,
      },
    };
  }

  async startAuthorization(query: Record<string, unknown>): Promise<AuthorizeResult> {
    const origin = publicOrigin();
    const fail: AuthorizeResult = { page: 'client-error' };
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
      if (typeof value !== 'string') return fail;
      params[key] = value;
    }

    const clientId = params.client_id;
    const redirectUri = params.redirect_uri;
    if (!clientId || !redirectUri || clientId.length > MAX_URL || redirectUri.length > MAX_URL) return fail;
    if (!isAllowedClientId(clientId)) return fail;
    const client = await this.fetcher.fetch(clientId);
    if (!client || !client.redirectUris.includes(redirectUri)) return fail;
    let target: URL;
    try {
      target = new URL(redirectUri);
    } catch {
      return fail;
    }
    const loopback = target.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
    if (target.hash || !(target.protocol === 'https:' || loopback)) return fail;

    const state = params.state;
    const back = (error: string): AuthorizeResult => ({ redirect: redirectUrl(redirectUri, { error, state, iss: origin }) });
    const challenge = params.code_challenge ?? '';
    const scope = (params.scope ?? '').trim() || 'read';
    const parts = scope.split(/\s+/);
    if (params.response_type !== 'code') return back('unsupported_response_type');
    if (params.code_challenge_method !== 'S256') return back('invalid_request');
    if (!CHALLENGE.test(challenge)) return back('invalid_request');
    if (params.resource !== `${origin}/api/mcp`) return back('invalid_target');
    if (scope.length > 100 || !parts.every((part) => OAuthScope.safeParse(part).success)) return back('invalid_scope');
    if (state !== undefined && (state.length > 500 || /[\u0000-\u001f\u007f]/.test(state))) return back('invalid_request');

    const now = this.clock.now();
    await this.prisma.oAuthRequest.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - DAY_MS) } } });
    const row = await this.prisma.oAuthRequest.create({
      data: {
        clientId,
        clientName: client.clientName,
        redirectUri,
        codeChallenge: challenge,
        scope,
        state: state ?? null,
        resource: params.resource,
        expiresAt: new Date(now.getTime() + REQUEST_TTL_MS),
        createdAt: now,
      },
    });
    return { redirect: `${origin}/ket-noi-ai/cho-phep?yeu-cau=${row.id}` };
  }

  async consent(_userId: string, id: string): Promise<OAuthConsentView> {
    publicOrigin();
    const row = UUID.test(id) ? await this.prisma.oAuthRequest.findUnique({ where: { id } }) : null;
    if (!row) throw new NotFoundException(NOT_FOUND);
    this.assertOpen(row);
    const book = parseScope(row.scope).access === 'BOOK';
    return {
      clientName: row.clientName,
      clientHost: new URL(row.clientId).host,
      scopes: book ? ['read', 'book'] : ['read'],
      dataRead: DATA_READ,
    };
  }

  async approve(userId: string, id: string, input: OAuthDecisionRequest): Promise<OAuthDecisionResponse> {
    const origin = publicOrigin();
    if (!UUID.test(id)) throw new NotFoundException(NOT_FOUND);
    const now = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const row = await this.lockRequest(tx, id);
      this.assertOpen(row);
      const users = await tx.$queryRaw<{ sessionsValidFrom: Date | null }[]>`SELECT "sessionsValidFrom" FROM "User" WHERE "id" = ${userId}::uuid FOR NO KEY UPDATE`;
      const sessionsValidFrom = users[0]?.sessionsValidFrom ?? null;
      const connections = await tx.oAuthConnection.count({ where: validWhere(userId, sessionsValidFrom, now) });
      const pending = await tx.oAuthRequest.count({
        where: { userId, codeHash: { not: null }, codeUsedAt: null, codeExpiresAt: { gt: now } },
      });
      if (connections + pending >= MAX_CONNECTIONS) throw new ConflictException(FULL);

      const requested = row.scope.split(/\s+/);
      const granted = ['read'];
      if (input.scopes.includes('book') && requested.includes('book')) granted.push('book');
      if (requested.includes('offline_access')) granted.push('offline_access');
      const code = randomBytes(32).toString('base64url');
      await tx.oAuthRequest.update({
        where: { id },
        data: {
          userId,
          grantedScope: granted.join(' '),
          codeHash: sha256(code),
          codeExpiresAt: new Date(now.getTime() + CODE_TTL_MS),
        },
      });
      return { redirectTo: redirectUrl(row.redirectUri, { code, state: row.state, iss: origin }) };
    });
  }

  async deny(_userId: string, id: string): Promise<OAuthDecisionResponse> {
    const origin = publicOrigin();
    if (!UUID.test(id)) throw new NotFoundException(NOT_FOUND);
    const now = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const row = await this.lockRequest(tx, id);
      this.assertOpen(row);
      await tx.oAuthRequest.updateMany({ where: { id, codeHash: null }, data: { deniedAt: now } });
      return { redirectTo: redirectUrl(row.redirectUri, { error: 'access_denied', state: row.state, iss: origin }) };
    });
  }

  async authenticate(accessToken: string): Promise<OAuthContext | null> {
    if (!accessToken.startsWith(OAUTH_ACCESS_TOKEN_PREFIX) || accessToken.length > MAX_TOKEN_LENGTH) return null;
    try {
      const row = await this.prisma.oAuthConnection.findUnique({ where: { accessTokenHash: sha256(accessToken) }, include: { user: true } });
      if (!row) return null;
      const now = this.clock.now();
      const valid = await this.prisma.oAuthConnection.count({
        where: { AND: [{ id: row.id, accessExpiresAt: { gt: now } }, validWhere(row.userId, row.user.sessionsValidFrom, now)] },
      });
      if (valid === 0) return null;
      if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_STEP_MS) {
        await this.prisma.oAuthConnection.updateMany({ where: { id: row.id }, data: { lastUsedAt: now } });
      }
      return { userId: row.userId, role: row.user.role, scope: row.scope };
    } catch {
      throw new Error('OAuth authenticate failed');
    }
  }

  async listConnections(userId: string): Promise<OAuthConnectionView[]> {
    const now = this.clock.now();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { sessionsValidFrom: true } });
    const rows = await this.prisma.oAuthConnection.findMany({
      where: validWhere(userId, user?.sessionsValidFrom ?? null, now),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      clientName: row.clientName,
      scope: row.scope,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    }));
  }

  async revokeConnection(userId: string, id: string): Promise<void> {
    if (!UUID.test(id)) throw new NotFoundException(CONNECTION_NOT_FOUND);
    const now = this.clock.now();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { sessionsValidFrom: true } });
    const result = await this.prisma.oAuthConnection.updateMany({
      where: { id, ...validWhere(userId, user?.sessionsValidFrom ?? null, now) },
      data: { revokedAt: now },
    });
    if (result.count === 0) throw new NotFoundException(CONNECTION_NOT_FOUND);
  }

  private assertOpen(row: { expiresAt: Date; userId: string | null; codeHash: string | null; deniedAt: Date | null }): void {
    if (row.expiresAt.getTime() <= this.clock.now().getTime()) throw new GoneException(EXPIRED);
    if (row.userId || row.codeHash || row.deniedAt) throw new ConflictException(DONE);
  }

  private async lockRequest(tx: Prisma.TransactionClient, id: string): Promise<LockedRequest> {
    const rows = await tx.$queryRaw<LockedRequest[]>`SELECT "id", "clientName", "redirectUri", "scope", "state", "expiresAt", "userId", "codeHash", "deniedAt" FROM "OAuthRequest" WHERE "id" = ${id}::uuid FOR UPDATE`;
    if (!rows[0]) throw new NotFoundException(NOT_FOUND);
    return rows[0];
  }
}
