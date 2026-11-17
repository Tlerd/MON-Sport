import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AccessTokenScope,
  MAX_ACTIVE_OAUTH_CONNECTIONS,
  OAUTH_ACCESS_TOKEN_PREFIX,
  OAUTH_ACCESS_TTL_SECONDS,
  OAUTH_CONNECTION_MAX_DAYS,
  OAUTH_REFRESH_IDLE_DAYS,
  OAUTH_REFRESH_TOKEN_PREFIX,
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
import { OAuthGrantError } from './oauth-grant.error.js';

const NOT_FOUND = 'Không tìm thấy yêu cầu';
const EXPIRED = 'Yêu cầu đã hết hạn. Nối lại từ Claude';
const DONE = 'Yêu cầu đã được xử lý';
const FULL = 'Bạn đã có 10 kết nối AI. Thu hồi một kết nối trước';
const REQUEST_TTL_MS = 10 * 60_000;
const CODE_TTL_MS = 60_000;
const DAY_MS = 86_400_000;
const MAX_CONNECTIONS = MAX_ACTIVE_OAUTH_CONNECTIONS;
const CONNECTION_MAX_DAYS = OAUTH_CONNECTION_MAX_DAYS;
const SCOPES = ['read', 'book', 'offline_access'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const MAX_URL = 500;
const VERIFIER_FORMAT = /^[A-Za-z0-9._~-]{43,128}$/;
const MAX_TOKEN_LENGTH = 100;
const LAST_USED_STEP_MS = 60_000;
const REUSE_GRACE_MS = 60_000;
const ACCESS_TTL_MS = OAUTH_ACCESS_TTL_SECONDS * 1000;
const REFRESH_IDLE_MS = OAUTH_REFRESH_IDLE_DAYS * 86_400_000;
const CONNECTION_NOT_FOUND = 'Không tìm thấy kết nối';

/** What `authenticate` gives to the MCP route. The same shape as the context of a personal access token. */
export interface OAuthContext {
  userId: string;
  role: Role;
  scope: AccessTokenScope;
}

/** The body of a successful token response (RFC 6749, section 5.1). */
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

/** Compares two base64url strings of one length without a timing leak. */
function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** BR-29, brief F-038: the 4 lines of the consent screen. */
const DATA_READ = [
  'Tên của bạn',
  'Booking của bạn: sân, giờ, giá, trạng thái',
  'Trận bạn mở hoặc đã vào, và phòng chờ ghép trận',
  'AI không thấy số điện thoại, mật khẩu hay email của bạn',
];

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

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** The origin of this server for OAuth. Read at call time. An empty value turns every OAuth route off with a 404. */
export function publicOrigin(): string {
  const origin = (process.env.PUBLIC_ORIGIN ?? '').trim().replace(/\/+$/, '');
  if (!origin) throw new NotFoundException();
  return origin;
}

/** RFC 9207: every redirect to the client carries the issuer. */
function redirectUrl(base: string, params: Record<string, string | null | undefined>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) if (value !== null && value !== undefined) url.searchParams.set(key, value);
  return url.toString();
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

  /** Checks the client, the redirect URI, PKCE, and the resource. Non-redirect errors come first. */
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
    // MCP spec, "Communication Security": a redirect URI is https or a loopback address.
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
    // Postgres text refuses NUL, and no client needs a control character in state.
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
      // Lock order: OAuthRequest (FOR UPDATE), then User (FOR NO KEY UPDATE), then count and write.
      const row = await this.lockRequest(tx, id);
      this.assertOpen(row);
      const users = await tx.$queryRaw<{ sessionsValidFrom: Date | null }[]>`SELECT "sessionsValidFrom" FROM "User" WHERE "id" = ${userId}::uuid FOR NO KEY UPDATE`;
      const sessionsValidFrom = users[0]?.sessionsValidFrom ?? null;
      const connections = await tx.oAuthConnection.count({ where: this.validWhere(userId, sessionsValidFrom, now) });
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

  /** Brief F-038, step 3. Every failure is an `OAuthGrantError`. Nothing here logs a token, a code, or a verifier. */
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
    // A used code only gives invalid_grant. It revokes nothing (brief F-038, "Assumptions").
    if (row.codeUsedAt || row.codeExpiresAt.getTime() <= now.getTime()) throw invalid;
    if (row.redirectUri !== redirectUri || row.clientId !== clientId || row.resource !== resource) throw invalid;
    if (resource !== `${origin}/api/mcp`) throw invalid;
    if (!sameSecret(createHash('sha256').update(verifier).digest('base64url'), row.codeChallenge)) throw invalid;

    const userId = row.userId;
    const scope = parseScope(row.grantedScope);
    const accessToken = mint(OAUTH_ACCESS_TOKEN_PREFIX);
    const refreshToken = scope.offline ? mint(OAUTH_REFRESH_TOKEN_PREFIX) : null;
    await this.prisma.$transaction(async (tx) => {
      // Lock order (brief F-038): the conditional UPDATE on OAuthRequest, then User (FOR NO KEY UPDATE), then count and insert.
      const used = await tx.$executeRaw`UPDATE "OAuthRequest" SET "codeUsedAt" = ${now} WHERE "id" = ${row.id}::uuid AND "codeUsedAt" IS NULL`;
      if (used === 0) throw invalid;
      const users = await tx.$queryRaw<{ sessionsValidFrom: Date | null; lockedAt: Date | null; deletedAt: Date | null }[]>`SELECT "sessionsValidFrom", "lockedAt", "deletedAt" FROM "User" WHERE "id" = ${userId}::uuid FOR NO KEY UPDATE`;
      const user = users[0];
      if (!user || user.lockedAt || user.deletedAt) throw invalid;
      // BR-32: a code approved before the admin unlock (sessionsValidFrom) must not become a connection.
      const approvedAt = (row.codeExpiresAt?.getTime() ?? 0) - CODE_TTL_MS;
      if (user.sessionsValidFrom && approvedAt < user.sessionsValidFrom.getTime()) throw invalid;
      const active = await tx.oAuthConnection.count({ where: this.validWhere(userId, user.sessionsValidFrom, now) });
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
    // RFC 8707, section 2: a token for another resource is invalid_target.
    if (resource !== undefined && resource !== `${origin}/api/mcp`) throw new OAuthGrantError('invalid_target');

    const now = this.clock.now();
    const oldHash = sha256(presented);
    const row = await this.prisma.oAuthConnection.findUnique({ where: { refreshTokenHash: oldHash }, include: { user: true } });
    if (!row) {
      // A refresh token that was rotated out. Within 60 seconds it is a retry. After that it is a reuse, and the connection ends.
      const old = await this.prisma.oAuthConnection.findUnique({ where: { previousRefreshTokenHash: oldHash } });
      if (old?.refreshRotatedAt && now.getTime() - old.refreshRotatedAt.getTime() >= REUSE_GRACE_MS) {
        await this.prisma.oAuthConnection.updateMany({ where: { id: old.id, revokedAt: null }, data: { revokedAt: now } });
      }
      throw invalid;
    }
    if (row.clientId !== clientId) throw invalid;
    const valid = await this.prisma.oAuthConnection.count({
      where: { AND: [{ id: row.id, refreshExpiresAt: { gt: now } }, this.validWhere(row.userId, row.user.sessionsValidFrom, now)] },
    });
    if (valid === 0) throw invalid;

    const accessToken = mint(OAUTH_ACCESS_TOKEN_PREFIX);
    const refreshToken = mint(OAUTH_REFRESH_TOKEN_PREFIX);
    // One conditional UPDATE: of two parallel refreshes with one token, only one finds the old hash.
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

  /** Returns the context for a valid access token and null otherwise. It never logs the token and never puts it in an error. */
  async authenticate(accessToken: string): Promise<OAuthContext | null> {
    if (!accessToken.startsWith(OAUTH_ACCESS_TOKEN_PREFIX) || accessToken.length > MAX_TOKEN_LENGTH) return null;
    try {
      const row = await this.prisma.oAuthConnection.findUnique({ where: { accessTokenHash: sha256(accessToken) }, include: { user: true } });
      if (!row) return null;
      const now = this.clock.now();
      const valid = await this.prisma.oAuthConnection.count({
        where: { AND: [{ id: row.id, accessExpiresAt: { gt: now } }, this.validWhere(row.userId, row.user.sessionsValidFrom, now)] },
      });
      if (valid === 0) return null;
      if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_STEP_MS) {
        await this.prisma.oAuthConnection.updateMany({ where: { id: row.id }, data: { lastUsedAt: now } });
      }
      return { userId: row.userId, role: row.user.role, scope: row.scope };
    } catch {
      // The Prisma error could echo the query. Give a fixed message.
      throw new Error('OAuth authenticate failed');
    }
  }

  async listConnections(userId: string): Promise<OAuthConnectionView[]> {
    const now = this.clock.now();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { sessionsValidFrom: true } });
    const rows = await this.prisma.oAuthConnection.findMany({
      where: this.validWhere(userId, user?.sessionsValidFrom ?? null, now),
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
      where: { id, ...this.validWhere(userId, user?.sessionsValidFrom ?? null, now) },
      data: { revokedAt: now },
    });
    if (result.count === 0) throw new NotFoundException(CONNECTION_NOT_FOUND);
  }

  /** 404 for a missing row, 410 when expired, 409 when it already has a user, a code, or a denial. */
  private assertOpen(row: { expiresAt: Date; userId: string | null; codeHash: string | null; deniedAt: Date | null }): void {
    if (row.expiresAt.getTime() <= this.clock.now().getTime()) throw new GoneException(EXPIRED);
    if (row.userId || row.codeHash || row.deniedAt) throw new ConflictException(DONE);
  }

  private async lockRequest(tx: Prisma.TransactionClient, id: string): Promise<LockedRequest> {
    const rows = await tx.$queryRaw<LockedRequest[]>`SELECT "id", "clientName", "redirectUri", "scope", "state", "expiresAt", "userId", "codeHash", "deniedAt" FROM "OAuthRequest" WHERE "id" = ${id}::uuid FOR UPDATE`;
    if (!rows[0]) throw new NotFoundException(NOT_FOUND);
    return rows[0];
  }

  /** The one rule for a valid connection (BR-60, BR-32): five conditions. */
  private validWhere(userId: string, sessionsValidFrom: Date | null, now: Date): Prisma.OAuthConnectionWhereInput {
    const earliest = new Date(now.getTime() - CONNECTION_MAX_DAYS * DAY_MS);
    return {
      userId,
      revokedAt: null,
      createdAt: sessionsValidFrom ? { gt: earliest, gte: sessionsValidFrom } : { gt: earliest },
      user: { lockedAt: null, deletedAt: null },
      OR: [{ accessExpiresAt: { gt: now } }, { refreshTokenHash: { not: null }, refreshExpiresAt: { gt: now } }],
    };
  }
}
