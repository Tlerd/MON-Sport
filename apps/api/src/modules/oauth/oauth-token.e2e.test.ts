import 'reflect-metadata';
import { createHash, randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { MCP_READ_TOOLS, MCP_TOOL_NAMES } from '@monsport/shared';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { AccessTokensService } from '../access-tokens/access-tokens.service.js';
import { issueSession } from '../auth/session.js';
import { BookingsService } from '../bookings/bookings.service.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

// Brief F-038, step 3: `token`, refresh, and `POST /api/mcp` with an OAuth access token.
const ORIGIN = 'https://monsport.test';
const CLIENT = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
const CALLBACK = 'https://claude.ai/api/mcp/auth_callback';
const RESOURCE = `${ORIGIN}/api/mcp`;
const VERIFIER = 'v'.repeat(43);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
const START = new Date('2026-12-01T03:00:00Z');
const DAY = 86_400_000;
const clock = { at: START, now() { return this.at; } };
const CIMD = { client_id: CLIENT, client_name: 'Claude', redirect_uris: [CALLBACK], token_endpoint_auth_method: 'none' };
const WWW_AUTH = `Bearer resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/api/mcp", scope="read book"`;
const TOO_MANY = 'Quá nhiều lệnh. Thử lại sau';
const NOT_FOUND = 'Không tìm thấy kết nối';
const NO_MATCH = 'Không tìm thấy trận';
const MISSING = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

interface Tokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

let app: INestApplication;
let db: PrismaService;
let passwordHash: string;
let fetchSpy: ReturnType<typeof vi.spyOn>;
const ids: Record<string, string> = {};
const http = () => request(app.getHttpServer());
const as = (who: string | null) => (r: request.Test) => (who ? r.set('Cookie', `session=${issueSession(ids[who], clock.now())}`) : r);
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const later = (ms: number) => {
  clock.at = new Date(START.getTime() + ms);
};
const vn = (hhmm: string, day: string) => `${day}T${hhmm}:00+07:00`;

const query = (extra: Record<string, string | undefined> = {}): Record<string, string> => {
  const base: Record<string, string | undefined> = {
    response_type: 'code',
    client_id: CLIENT,
    redirect_uri: CALLBACK,
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    state: 'xyz',
    scope: 'read book offline_access',
    resource: RESOURCE,
    ...extra,
  };
  return Object.fromEntries(Object.entries(base).filter(([, v]) => v !== undefined)) as Record<string, string>;
};
const requestId = async (extra: Record<string, string | undefined> = {}): Promise<string> => {
  const res = await http().get('/api/oauth/authorize').query(query(extra));
  expect(res.status).toBe(302);
  return new URL(res.headers.location).searchParams.get('yeu-cau')!;
};
const approve = (who: string, id: string, scopes: string[]) =>
  as(who)(http().post(`/api/oauth/requests/${id}/approve`)).send({ scopes });

/** authorize, then approve. Gives the code. */
const flow = async (who = 'An', extra: Record<string, string | undefined> = {}, scopes: string[] = ['read', 'book']): Promise<string> => {
  const res = await approve(who, await requestId(extra), scopes);
  expect(res.status).toBe(200);
  return new URL(res.body.redirectTo).searchParams.get('code')!;
};
const token = (body: Record<string, string>) => http().post('/api/oauth/token').type('form').send(body);
const exchange = (code: string, extra: Record<string, string> = {}) =>
  token({ grant_type: 'authorization_code', code, redirect_uri: CALLBACK, client_id: CLIENT, code_verifier: VERIFIER, resource: RESOURCE, ...extra });
const refresh = (refreshToken: string, extra: Record<string, string> = {}) =>
  token({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: CLIENT, resource: RESOURCE, ...extra });
const connect = async (who = 'An', extra: Record<string, string | undefined> = {}, scopes: string[] = ['read', 'book']): Promise<Tokens> => {
  const res = await exchange(await flow(who, extra, scopes));
  expect(res.status).toBe(200);
  return res.body as Tokens;
};

const rpc = (secret: string | null, method: string, params: Record<string, unknown> = {}, id = 1) => {
  const r = http().post('/api/mcp').set('Accept', 'application/json, text/event-stream').set('Content-Type', 'application/json');
  if (secret) r.set('Authorization', `Bearer ${secret}`);
  return r.send({ jsonrpc: '2.0', id, method, params });
};
const callTool = (secret: string, name: string, args: Record<string, unknown> = {}) => rpc(secret, 'tools/call', { name, arguments: args });
const toolText = (res: request.Response): string => res.body?.result?.content?.[0]?.text ?? '';
const toolNames = (res: request.Response): string[] => res.body.result.tools.map((t: { name: string }) => t.name).sort();
const expectUnauthorized = (res: request.Response) => {
  expect(res.status).toBe(401);
  expect(res.headers['www-authenticate']).toBe(WWW_AUTH);
  expect(res.body).toEqual({ message: 'Mã truy cập không hợp lệ' });
};
const expectGrantError = (res: request.Response, error = 'invalid_grant') => {
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error });
};

const seed = (
  userId: string,
  extra: {
    createdAt?: Date;
    revokedAt?: Date | null;
    accessExpiresAt?: Date;
    refreshTokenHash?: string;
    refreshExpiresAt?: Date;
  } = {},
) =>
  db.oAuthConnection.create({
    data: {
      userId,
      clientId: CLIENT,
      clientName: 'Claude',
      scope: 'READ',
      accessTokenHash: sha(randomBytes(16).toString('hex')),
      accessExpiresAt: extra.accessExpiresAt ?? new Date(START.getTime() + 3_600_000),
      refreshTokenHash: extra.refreshTokenHash ?? null,
      refreshExpiresAt: extra.refreshExpiresAt ?? null,
      createdAt: extra.createdAt ?? START,
      revokedAt: extra.revokedAt ?? null,
    },
  });

beforeAll(async () => {
  process.env.PUBLIC_ORIGIN = ORIGIN;
  process.env.OAUTH_CIMD_HOSTS = 'claude.ai';
  passwordHash = await hash('test-password');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue(clock).compile();
  app = setupApp(moduleRef.createNestApplication());
  await app.init();
  db = app.get(PrismaService);
});

afterAll(async () => {
  await app?.close();
  delete process.env.PUBLIC_ORIGIN;
  delete process.env.OAUTH_CIMD_HOSTS;
});

beforeEach(async () => {
  clock.at = START;
  fetchSpy = vi.spyOn(globalThis, 'fetch');
  fetchSpy.mockImplementation(async () => new Response(JSON.stringify(CIMD)));
  await db.$executeRawUnsafe('TRUNCATE "OAuthConnection", "OAuthRequest", "AccessToken", "PushSubscription", "Notification", "MatchPlayer", "Match", "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
  const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER') =>
    db.user.create({ data: { name, phone, role, passwordHash } }).then((u) => (ids[name] = u.id));
  await Promise.all([user('An', '0901234567', 'USER'), user('Bảo', '0901234568', 'USER'), user('Bình', '0912345678', 'OWNER'), user('Quản trị', '0900000001', 'ADMIN')]);
  const venue = await db.venue.create({ data: { ownerId: ids['Bình'], name: 'Cầu lông A', address: '1 Lê Lợi', phone: '0281234567', opensAt: 360, closesAt: 1380 } });
  ids.F1 = (await db.court.create({ data: { venueId: venue.id, name: 'Sân 1', sport: 'FOOTBALL', priceNormal: 100_000, pricePeak: 150_000 } })).id;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OAuth token, refresh and /api/mcp (F-038 step 3)', () => {
  it('AC-3: POST /api/mcp without a token gives 401 with the resource_metadata challenge, and a bare Bearer without PUBLIC_ORIGIN', async () => {
    expectUnauthorized(await rpc(null, 'tools/list'));
    expectUnauthorized(await rpc('mst_sai', 'tools/list'));
    delete process.env.PUBLIC_ORIGIN;
    try {
      const res = await rpc(null, 'tools/list');
      expect(res.status).toBe(401);
      expect(res.headers['www-authenticate']).toBe('Bearer');
    } finally {
      process.env.PUBLIC_ORIGIN = ORIGIN;
    }
  });

  it('AC-8: a code gives the tokens, and the rows hold only hashes', async () => {
    const code = await flow();
    const res = await exchange(code);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers.pragma).toBe('no-cache');
    expect(res.body).toEqual({
      access_token: expect.stringMatching(/^mot_[A-Za-z0-9_-]{43}$/),
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: expect.stringMatching(/^mor_[A-Za-z0-9_-]{43}$/),
      scope: 'read book offline_access',
    });
    const connection = await db.oAuthConnection.findFirstOrThrow();
    expect(connection).toMatchObject({
      userId: ids.An,
      clientId: CLIENT,
      clientName: 'Claude',
      scope: 'BOOK',
      accessTokenHash: sha(res.body.access_token),
      refreshTokenHash: sha(res.body.refresh_token),
    });
    expect(connection.accessExpiresAt.toISOString()).toBe('2026-12-01T04:00:00.000Z');
    expect(connection.refreshExpiresAt!.toISOString()).toBe('2026-12-31T03:00:00.000Z');
    const serialized = JSON.stringify(connection);
    expect(serialized).not.toContain(res.body.access_token);
    expect(serialized).not.toContain(res.body.refresh_token);
    const row = await db.oAuthRequest.findUniqueOrThrow({ where: { codeHash: sha(code) } });
    expect(row.codeUsedAt).not.toBeNull();
    expect(row.connectionId).toBe(connection.id);
    expect(JSON.stringify(row)).not.toContain(code);
  });

  it('AC-8: a flow without offline_access gives no refresh_token', async () => {
    const res = await exchange(await flow('An', { scope: 'read book' }));
    expect(res.status).toBe(200);
    expect(res.body.refresh_token).toBeUndefined();
    expect(res.body.scope).toBe('read book');
    const connection = await db.oAuthConnection.findFirstOrThrow();
    expect(connection.refreshTokenHash).toBeNull();
    expect(connection.refreshExpiresAt).toBeNull();
  });

  it('AC-9: a wrong code_verifier gives invalid_grant', async () => {
    const code = await flow();
    expectGrantError(await exchange(code, { code_verifier: 'w'.repeat(43) }));
    expectGrantError(await exchange(code, { code_verifier: 'short' }));
    expect(await db.oAuthConnection.count()).toBe(0);
  });

  it('AC-9: a second use of a code gives invalid_grant, and the first connection still works', async () => {
    const code = await flow();
    const first = await exchange(code);
    expect(first.status).toBe(200);
    expectGrantError(await exchange(code));
    expect(await db.oAuthConnection.count({ where: { revokedAt: null } })).toBe(1);
    expect((await rpc(first.body.access_token, 'tools/list')).status).toBe(200);
  });

  it('AC-9: a code older than 60 seconds gives invalid_grant', async () => {
    const code = await flow();
    later(61_000);
    expectGrantError(await exchange(code));
    expect(await db.oAuthConnection.count()).toBe(0);
  });

  it('AC-9: a different redirect_uri, client_id, or resource gives invalid_grant', async () => {
    const code = await flow();
    expectGrantError(await exchange(code, { redirect_uri: 'https://claude.ai/other' }));
    expectGrantError(await exchange(code, { client_id: 'https://claude.ai/other' }));
    expectGrantError(await exchange(code, { resource: 'https://la.example/api/mcp' }));
    expect(await db.oAuthConnection.count()).toBe(0);
  });

  it('AC-9: a JSON body or a repeated code gives invalid_request, and another grant_type is refused', async () => {
    const code = await flow();
    const json = await http().post('/api/oauth/token').send({ grant_type: 'authorization_code', code, redirect_uri: CALLBACK, client_id: CLIENT, code_verifier: VERIFIER, resource: RESOURCE });
    expectGrantError(json, 'invalid_request');
    const params = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: CALLBACK, client_id: CLIENT, code_verifier: VERIFIER, resource: RESOURCE });
    params.append('code', code);
    expectGrantError(await http().post('/api/oauth/token').type('form').send(params.toString()), 'invalid_request');
    expectGrantError(await http().post('/api/oauth/token').type('form').send(`grant_type=authorization_code&code[]=${code}`), 'invalid_request');
    expectGrantError(await token({ grant_type: 'password', username: 'a', password: 'b' }), 'unsupported_grant_type');
    // No attempt above used the code.
    expect((await exchange(code)).status).toBe(200);
  });

  it('AC-9: two exchanges of one code at once give one 200 and one invalid_grant, and the winner works', async () => {
    const code = await flow();
    const results = await Promise.all([exchange(code), exchange(code)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    const winner = results.find((r) => r.status === 200)!;
    const loser = results.find((r) => r.status === 400)!;
    expect(loser.body).toEqual({ error: 'invalid_grant' });
    expect(await db.oAuthConnection.count()).toBe(1);
    expect((await rpc(winner.body.access_token, 'tools/list')).status).toBe(200);
  });

  it('AC-10: an OAuth token lists 9 tools and requests a booking as its user, and no log line has a token', async () => {
    const lines: string[] = [];
    const sink = (chunk: unknown) => (lines.push(String(chunk)), true);
    vi.spyOn(process.stdout, 'write').mockImplementation(sink as never);
    vi.spyOn(process.stderr, 'write').mockImplementation(sink as never);
    for (const level of ['log', 'error', 'warn', 'info', 'debug'] as const) vi.spyOn(console, level).mockImplementation((...a: unknown[]) => void lines.push(a.join(' ')));

    const tokens = await connect();
    const list = await rpc(tokens.access_token, 'tools/list', {}, 2);
    expect(list.status).toBe(200);
    expect(toolNames(list)).toEqual([...MCP_TOOL_NAMES].sort());
    expect(toolNames(list)).toHaveLength(9);
    const res = await callTool(tokens.access_token, 'request_booking', { courtId: ids.F1, startAt: vn('18:00', '2026-12-10'), endAt: vn('19:30', '2026-12-10') });
    expect(res.status).toBe(200);
    expect(res.body.result.isError).not.toBe(true);

    const bookings = await db.booking.findMany();
    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toMatchObject({ createdById: ids.An, status: 'PENDING', source: 'APP' });
    const connection = await db.oAuthConnection.findFirstOrThrow();
    expect(connection.lastUsedAt?.toISOString()).toBe(clock.now().toISOString());
    const output = lines.join('\n');
    expect(output).not.toContain('mot_');
    expect(output).not.toContain('mor_');
  });

  it('AC-10: BR-58 counts the PAT and the OAuth token of one user together', async () => {
    const pat = (await app.get(AccessTokensService).create(ids.An, { name: 'test', scope: 'BOOK', expiresInDays: 30 })).secret;
    const oauth = (await connect()).access_token;
    for (let i = 0; i < 5; i++) expect(toolText(await callTool(pat, 'join_match', { matchId: MISSING }))).toBe(NO_MATCH);
    for (let i = 0; i < 5; i++) expect(toolText(await callTool(oauth, 'join_match', { matchId: MISSING }))).toBe(NO_MATCH);
    expect(toolText(await callTool(oauth, 'join_match', { matchId: MISSING }))).toBe(TOO_MANY);
    expect(toolText(await callTool(pat, 'join_match', { matchId: MISSING }))).toBe(TOO_MANY);
  });

  it('AC-11: a connection with only "read" sees 4 tools, and request_booking does not run', async () => {
    const tokens = await connect('An', {}, ['read']);
    expect(tokens.scope).toBe('read offline_access');
    const request_ = vi.spyOn(app.get(BookingsService), 'request');
    const list = await rpc(tokens.access_token, 'tools/list');
    expect(toolNames(list)).toEqual([...MCP_READ_TOOLS].sort());
    expect(toolNames(list)).toHaveLength(4);
    const res = await callTool(tokens.access_token, 'request_booking', { courtId: ids.F1, startAt: vn('18:00', '2026-12-10'), endAt: vn('19:30', '2026-12-10') });
    expect(res.body.error !== undefined || res.body.result?.isError === true).toBe(true);
    expect(JSON.stringify(res.body)).toMatch(/not found|không tồn tại/i);
    expect(request_).not.toHaveBeenCalled();
  });

  it('AC-12: a refresh rotates both tokens, a retry within 60 seconds is refused, and a reuse after 60 seconds ends the connection', async () => {
    const first = await connect();
    later(59 * 60_000);
    const res = await refresh(first.refresh_token!);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({
      access_token: expect.stringMatching(/^mot_/),
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: expect.stringMatching(/^mor_/),
      scope: 'read book offline_access',
    });
    expect(res.body.access_token).not.toBe(first.access_token);
    expect(res.body.refresh_token).not.toBe(first.refresh_token);
    const rotated = await db.oAuthConnection.findFirstOrThrow();
    expect(rotated).toMatchObject({
      accessTokenHash: sha(res.body.access_token),
      refreshTokenHash: sha(res.body.refresh_token),
      previousRefreshTokenHash: sha(first.refresh_token!),
    });
    expect(rotated.refreshRotatedAt!.toISOString()).toBe(clock.now().toISOString());
    expectUnauthorized(await rpc(first.access_token, 'tools/list'));

    later(59 * 60_000 + 30_000);
    expectGrantError(await refresh(first.refresh_token!));
    expect((await db.oAuthConnection.findFirstOrThrow()).revokedAt).toBeNull();
    expect((await rpc(res.body.access_token, 'tools/list')).status).toBe(200);

    later(59 * 60_000 + 62_000);
    expectGrantError(await refresh(first.refresh_token!));
    expect((await db.oAuthConnection.findFirstOrThrow()).revokedAt).not.toBeNull();
    expectUnauthorized(await rpc(res.body.access_token, 'tools/list'));
    expectGrantError(await refresh(res.body.refresh_token));
  });

  it('AC-12: two refreshes of one token at once give one 200 and one invalid_grant', async () => {
    const first = await connect();
    const results = await Promise.all([refresh(first.refresh_token!), refresh(first.refresh_token!)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    const winner = results.find((r) => r.status === 200)!;
    expect(results.find((r) => r.status === 400)!.body).toEqual({ error: 'invalid_grant' });
    expect((await rpc(winner.body.access_token, 'tools/list')).status).toBe(200);
  });

  it('AC-12: a refresh token not used for 31 days gives invalid_grant', async () => {
    const first = await connect();
    later(31 * DAY);
    expectGrantError(await refresh(first.refresh_token!));
  });

  it('AC-12: a refresh after 90 days from the grant gives invalid_grant, even with a fresh token', async () => {
    let current = (await connect()).refresh_token!;
    for (const day of [25, 50, 75]) {
      later(day * DAY);
      const res = await refresh(current);
      expect(res.status).toBe(200);
      current = res.body.refresh_token;
    }
    later(91 * DAY);
    expectGrantError(await refresh(current));
  });

  it('AC-12: a refresh with another client_id or another resource gives invalid_grant', async () => {
    const first = await connect();
    expectGrantError(await refresh(first.refresh_token!, { client_id: 'https://claude.ai/other' }));
    expectGrantError(await refresh(first.refresh_token!, { resource: 'https://la.example/api/mcp' }));
    expect((await refresh(first.refresh_token!)).status).toBe(200);
  });

  it('AC-13: an access token after 3600 seconds gives 401 with the challenge', async () => {
    const tokens = await connect();
    expect((await rpc(tokens.access_token, 'tools/list')).status).toBe(200);
    later(3601 * 1000);
    expectUnauthorized(await rpc(tokens.access_token, 'tools/list'));
  });

  it('AC-13: after an admin locks and unlocks the user, the access gives 401 and the refresh gives invalid_grant', async () => {
    const tokens = await connect();
    const asAdmin = (path: string) => http().post(path).set('Cookie', `session=${issueSession(ids['Quản trị'], clock.now())}`);
    later(10 * 60_000);
    expect((await asAdmin(`/api/admin/users/${ids.An}/lock`)).status).toBeLessThan(300);
    later(20 * 60_000);
    expect((await asAdmin(`/api/admin/users/${ids.An}/unlock`)).status).toBe(200);
    later(30 * 60_000);
    expectUnauthorized(await rpc(tokens.access_token, 'tools/list'));
    expectGrantError(await refresh(tokens.refresh_token!));
  });

  it('AC-13: after the user revokes the connection, the access gives 401 and the refresh gives invalid_grant', async () => {
    const tokens = await connect();
    const connection = await db.oAuthConnection.findFirstOrThrow();
    const res = await as('An')(http().delete(`/api/me/oauth-connections/${connection.id}`));
    expect(res.status).toBe(204);
    expectUnauthorized(await rpc(tokens.access_token, 'tools/list'));
    expectGrantError(await refresh(tokens.refresh_token!));
  });

  it('AC-13: a well-formed mot_ string that is not in the table gives 401 with the challenge', async () => {
    expectUnauthorized(await rpc(`mot_${'x'.repeat(43)}`, 'tools/list'));
    expectUnauthorized(await rpc(`mot_${'x'.repeat(200)}`, 'tools/list'));
  });

  it('AC-14: an exchange with 10 valid connections gives invalid_grant, and the user keeps exactly 10', async () => {
    for (let i = 0; i < 10; i++) await seed(ids.An);
    // Built by hand: the approve route would refuse this request.
    const code = randomBytes(32).toString('base64url');
    await db.oAuthRequest.create({
      data: {
        clientId: CLIENT,
        clientName: 'Claude',
        redirectUri: CALLBACK,
        codeChallenge: CHALLENGE,
        scope: 'read book',
        resource: RESOURCE,
        expiresAt: new Date(START.getTime() + 600_000),
        userId: ids.An,
        grantedScope: 'read book',
        codeHash: sha(code),
        codeExpiresAt: new Date(START.getTime() + 60_000),
        createdAt: START,
      },
    });
    expectGrantError(await exchange(code));
    expect(await db.oAuthConnection.count({ where: { userId: ids.An } })).toBe(10);
  });

  it('AC-15: the 61st token request in a minute gives 429, and the throttle keys hide the IP', async () => {
    for (let i = 0; i < 60; i++) expect((await token({ grant_type: 'password' })).status).toBe(400);
    const res = await token({ grant_type: 'password' });
    expect(res.status).toBe(429);
    expect(res.body.message).toBe(TOO_MANY);
    const keys = (await db.authThrottle.findMany()).map((row) => row.key);
    expect(keys.some((key) => key.startsWith('oauth-token-ip:'))).toBe(true);
    for (const key of keys) expect(key).not.toMatch(/127\.0\.0\.1|::/);
  });

  it('AC-19: the list holds the valid connections of the caller only, with no hash, and a delete of another user gives 404', async () => {
    const valid = await seed(ids.An);
    await seed(ids.An, { revokedAt: START });
    await seed(ids.An, { createdAt: new Date(START.getTime() - 91 * DAY) });
    await seed(ids.An, { accessExpiresAt: new Date(START.getTime() - 1000) });
    await seed(ids.An, {
      createdAt: new Date(START.getTime() - 31 * DAY),
      accessExpiresAt: new Date(START.getTime() - 1000),
      refreshTokenHash: sha('idle'),
      refreshExpiresAt: new Date(START.getTime() - DAY),
    });
    const other = await seed(ids['Bảo']);

    const list = await as('An')(http().get('/api/me/oauth-connections'));
    expect(list.status).toBe(200);
    expect(list.body.connections).toHaveLength(1);
    expect(list.body.connections[0].id).toBe(valid.id);
    expect(Object.keys(list.body.connections[0]).sort()).toEqual(['clientName', 'createdAt', 'id', 'lastUsedAt', 'scope']);
    expect(JSON.stringify(list.body)).not.toMatch(/hash/i);

    const del = await as('An')(http().delete(`/api/me/oauth-connections/${other.id}`));
    expect(del.status).toBe(404);
    expect(del.body.message).toBe(NOT_FOUND);
    expect((await db.oAuthConnection.findUniqueOrThrow({ where: { id: other.id } })).revokedAt).toBeNull();
    expect((await as('An')(http().delete('/api/me/oauth-connections/not-a-uuid'))).status).toBe(404);

    expect((await as('Bình')(http().get('/api/me/oauth-connections'))).status).toBe(403);
    expect((await as(null)(http().get('/api/me/oauth-connections'))).status).toBe(401);
    expect((await as(null)(http().delete(`/api/me/oauth-connections/${valid.id}`))).status).toBe(401);
  });

  it('AC-19: the list gives the newest connection first', async () => {
    const older = await seed(ids.An, { createdAt: new Date(START.getTime() - 2 * DAY) });
    const newer = await seed(ids.An, { createdAt: new Date(START.getTime() - DAY) });
    const list = await as('An')(http().get('/api/me/oauth-connections'));
    expect(list.body.connections.map((c: { id: string }) => c.id)).toEqual([newer.id, older.id]);
  });
});
