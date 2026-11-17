import 'reflect-metadata';
import { createHash, randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

const ORIGIN = 'https://monsport.test';
const CLIENT = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
const CALLBACK = 'https://claude.ai/api/mcp/auth_callback';
const VERIFIER = 'v'.repeat(43);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
const START = new Date('2026-12-01T03:00:00Z');
const clock = { at: START, now() { return this.at; } };
const FULL = 'Bạn đã có 10 kết nối AI. Thu hồi một kết nối trước';
const DONE = 'Yêu cầu đã được xử lý';
const CIMD = { client_id: CLIENT, client_name: 'Claude', redirect_uris: [CALLBACK], token_endpoint_auth_method: 'none' };

let app: INestApplication;
let db: PrismaService;
let passwordHash: string;
let fetchSpy: ReturnType<typeof vi.spyOn>;
const ids: Record<string, string> = {};
const http = () => request(app.getHttpServer());
const as = (who: string | null) => (r: request.Test) => (who ? r.set('Cookie', `session=${issueSession(ids[who], clock.now())}`) : r);
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const at = (iso: string) => {
  clock.at = new Date(iso);
};

const query = (extra: Record<string, string | undefined> = {}): Record<string, string> => {
  const base: Record<string, string | undefined> = {
    response_type: 'code',
    client_id: CLIENT,
    redirect_uri: CALLBACK,
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    state: 'xyz',
    scope: 'read book offline_access',
    resource: `${ORIGIN}/api/mcp`,
    ...extra,
  };
  return Object.fromEntries(Object.entries(base).filter(([, v]) => v !== undefined)) as Record<string, string>;
};
const authorize = (extra: Record<string, string | undefined> = {}) => http().get('/api/oauth/authorize').query(query(extra));
const setCimd = (doc: object) => {
  fetchSpy.mockImplementation(async () => new Response(JSON.stringify(doc)));
};
const requestId = async (extra: Record<string, string | undefined> = {}): Promise<string> => {
  const res = await authorize(extra);
  expect(res.status).toBe(302);
  return new URL(res.headers.location).searchParams.get('yeu-cau')!;
};
const consent = (who: string | null, id: string) => as(who)(http().get(`/api/oauth/requests/${id}`));
const approve = (who: string | null, id: string, scopes: string[] = ['read', 'book']) =>
  as(who)(http().post(`/api/oauth/requests/${id}/approve`)).send({ scopes });
const deny = (who: string | null, id: string) => as(who)(http().post(`/api/oauth/requests/${id}/deny`)).send({});
const seedConnection = (
  userId: string,
  extra: { createdAt?: Date; revokedAt?: Date | null; accessExpiresAt?: Date; refreshTokenHash?: string; refreshExpiresAt?: Date } = {},
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
const clientErrorPage = (res: request.Response) => {
  expect(res.status).toBe(400);
  expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
  expect(res.text).toContain('Ứng dụng này không nối được với MONSPORT');
  expect(res.headers.location).toBeUndefined();
};

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

describe('OAuth authorize (F-038 step 2)', () => {
  beforeEach(async () => {
    clock.at = START;
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    setCimd(CIMD);
    await db.$executeRawUnsafe('TRUNCATE "OAuthConnection", "OAuthRequest", "AccessToken", "PushSubscription", "Notification", "MatchPlayer", "Match", "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
    const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER') =>
      db.user.create({ data: { name, phone, role, passwordHash } }).then((u) => (ids[name] = u.id));
    await Promise.all([user('An', '0901234567', 'USER'), user('Bảo', '0901234568', 'USER'), user('Bình', '0912345678', 'OWNER'), user('Quản trị', '0900000001', 'ADMIN')]);
    const venue = await db.venue.create({ data: { ownerId: ids['Bình'], name: 'Cầu lông A', address: '1 Lê Lợi', phone: '0281234567', opensAt: 360, closesAt: 1380 } });
    ids['Nhân viên'] = (await db.user.create({ data: { name: 'Nhân viên', phone: '0901234569', role: 'STAFF', passwordHash, staffVenueId: venue.id } })).id;
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('AC-2: the two metadata routes return the documents, and openid-configuration is 404', async () => {
    const resource = await http().get('/.well-known/oauth-protected-resource/api/mcp');
    expect(resource.status).toBe(200);
    expect(resource.headers['cache-control']).toBe('public, max-age=3600');
    expect(resource.body).toEqual({
      resource: `${ORIGIN}/api/mcp`,
      authorization_servers: [ORIGIN],
      scopes_supported: ['read', 'book', 'offline_access'],
      bearer_methods_supported: ['header'],
    });

    const server = await http().get('/.well-known/oauth-authorization-server');
    expect(server.status).toBe(200);
    expect(server.headers['cache-control']).toBe('public, max-age=3600');
    expect(server.body).toEqual({
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/api/oauth/authorize`,
      token_endpoint: `${ORIGIN}/api/oauth/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      client_id_metadata_document_supported: true,
      scopes_supported: ['read', 'book', 'offline_access'],
      authorization_response_iss_parameter_supported: true,
    });
    expect(server.body.registration_endpoint).toBeUndefined();

    expect((await http().get('/.well-known/openid-configuration')).status).toBe(404);
  });

  it('AC-4: authorize stores a request, redirects to the consent screen, and fetches the client once', async () => {
    const res = await authorize();
    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    expect(`${location.origin}${location.pathname}`).toBe(`${ORIGIN}/ket-noi-ai/cho-phep`);
    const row = await db.oAuthRequest.findUniqueOrThrow({ where: { id: location.searchParams.get('yeu-cau')! } });
    expect(row).toMatchObject({
      clientId: CLIENT,
      clientName: 'Claude',
      redirectUri: CALLBACK,
      codeChallenge: CHALLENGE,
      scope: 'read book offline_access',
      state: 'xyz',
      userId: null,
    });
    expect(row.expiresAt.toISOString()).toBe('2026-12-01T03:10:00.000Z');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(CLIENT);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ redirect: 'error' });
    // The 5-second limit of AC-5 (4) comes from this signal.
    expect(fetchSpy.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('AC-5: client errors give a 400 page, with no redirect and no row', async () => {
    clientErrorPage(await authorize({ client_id: 'https://la.example/x' }));
    clientErrorPage(await authorize({ client_id: 'http://claude.ai/x' }));
    expect(fetchSpy).not.toHaveBeenCalled();

    setCimd({ ...CIMD, client_id: 'https://claude.ai/other' });
    clientErrorPage(await authorize());

    fetchSpy.mockImplementation(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });
    clientErrorPage(await authorize());
    setCimd({ ...CIMD, padding: 'x'.repeat(11_000) });
    clientErrorPage(await authorize());

    setCimd(CIMD);
    clientErrorPage(await authorize({ redirect_uri: 'https://claude.ai/elsewhere' }));
    expect(await db.oAuthRequest.count()).toBe(0);
  });

  it('AC-5: a client_id that appears twice gives a 400 page and no fetch', async () => {
    const qs = new URLSearchParams(query());
    qs.append('client_id', CLIENT);
    clientErrorPage(await http().get(`/api/oauth/authorize?${qs.toString()}`));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await db.oAuthRequest.count()).toBe(0);
  });

  it('AC-5: redirect errors go to redirect_uri with state and iss, and no row', async () => {
    const cases: [Record<string, string>, string][] = [
      [{ code_challenge_method: 'plain' }, 'invalid_request'],
      [{ resource: 'https://la.example/api/mcp' }, 'invalid_target'],
      [{ response_type: 'token' }, 'unsupported_response_type'],
    ];
    for (const [extra, error] of cases) {
      const res = await authorize(extra);
      expect(res.status).toBe(302);
      const location = new URL(res.headers.location);
      expect(`${location.origin}${location.pathname}`).toBe(CALLBACK);
      expect(location.searchParams.get('error')).toBe(error);
      expect(location.searchParams.get('state')).toBe('xyz');
      expect(location.searchParams.get('iss')).toBe(ORIGIN);
    }
    expect(await db.oAuthRequest.count()).toBe(0);
  });

  it('AC-6: the consent view and the approve call give a code, and the row keeps only its hash', async () => {
    const id = await requestId();
    const view = await consent('An', id);
    expect(view.status).toBe(200);
    expect(view.body).toEqual({
      clientName: 'Claude',
      clientHost: 'claude.ai',
      scopes: ['read', 'book'],
      dataRead: [
        'Tên của bạn',
        'Booking của bạn: sân, giờ, giá, trạng thái',
        'Trận bạn mở hoặc đã vào, và phòng chờ ghép trận',
        'AI không thấy số điện thoại, mật khẩu hay email của bạn',
      ],
    });

    const res = await approve('An', id);
    expect(res.status).toBe(200);
    const location = new URL(res.body.redirectTo);
    expect(`${location.origin}${location.pathname}`).toBe(CALLBACK);
    const code = location.searchParams.get('code')!;
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(location.searchParams.get('state')).toBe('xyz');
    expect(location.searchParams.get('iss')).toBe(ORIGIN);

    const row = await db.oAuthRequest.findUniqueOrThrow({ where: { id } });
    expect(row.userId).toBe(ids.An);
    expect(row.grantedScope).toBe('read book offline_access');
    expect(row.codeHash).toBe(sha(code));
    expect(row.codeExpiresAt!.toISOString()).toBe('2026-12-01T03:01:00.000Z');
    expect(JSON.stringify(row)).not.toContain(code);
  });

  it('AC-7: deny gives access_denied and writes deniedAt', async () => {
    const id = await requestId();
    const res = await deny('An', id);
    expect(res.status).toBe(200);
    const location = new URL(res.body.redirectTo);
    expect(location.searchParams.get('error')).toBe('access_denied');
    expect(location.searchParams.get('state')).toBe('xyz');
    expect(location.searchParams.get('iss')).toBe(ORIGIN);
    const row = await db.oAuthRequest.findUniqueOrThrow({ where: { id } });
    expect(row.deniedAt).not.toBeNull();
    expect(row.codeHash).toBeNull();
  });

  it('AC-7: an approve after 10 minutes gives 410 and no code', async () => {
    const id = await requestId();
    at('2026-12-01T03:11:00Z');
    const res = await approve('An', id);
    expect(res.status).toBe(410);
    expect(res.body.message).toBe('Yêu cầu đã hết hạn. Nối lại từ Claude');
    expect((await db.oAuthRequest.findUniqueOrThrow({ where: { id } })).codeHash).toBeNull();
  });

  it('AC-7: no cookie gives 401, and an owner, staff, or admin gives 403, with no code', async () => {
    const id = await requestId();
    expect((await approve(null, id)).status).toBe(401);
    for (const who of ['Bình', 'Nhân viên', 'Quản trị']) {
      const res = await approve(who, id);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Bạn không có quyền làm việc này');
    }
    expect((await db.oAuthRequest.findUniqueOrThrow({ where: { id } })).codeHash).toBeNull();
  });

  it('AC-7: a second approve gives 409', async () => {
    const id = await requestId();
    expect((await approve('An', id)).status).toBe(200);
    const res = await approve('An', id);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe(DONE);
  });

  it('AC-7: a foreign Origin header gives 403 and no code', async () => {
    const id = await requestId();
    const res = await approve('An', id).set('Origin', 'https://la.example');
    expect(res.status).toBe(403);
    expect((await db.oAuthRequest.findUniqueOrThrow({ where: { id } })).codeHash).toBeNull();
    expect((await approve('An', id).set('Origin', ORIGIN)).status).toBe(200);
  });

  it('AC-7: a deny after an approve gives 409, and the code stays', async () => {
    const id = await requestId();
    expect((await approve('An', id)).status).toBe(200);
    const before = await db.oAuthRequest.findUniqueOrThrow({ where: { id } });
    const res = await deny('An', id);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe(DONE);
    const after = await db.oAuthRequest.findUniqueOrThrow({ where: { id } });
    expect(after.codeHash).toBe(before.codeHash);
    expect(after.deniedAt).toBeNull();
  });

  it('AC-14: with 10 valid connections an approve gives 409', async () => {
    for (let i = 0; i < 10; i++) await seedConnection(ids.An);
    const id = await requestId();
    const res = await approve('An', id);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe(FULL);
    expect((await db.oAuthRequest.findUniqueOrThrow({ where: { id } })).codeHash).toBeNull();
  });

  it('AC-14: a revoked, a 90-day-old, a pre-unlock and a dead connection do not count, so the approve gives 200', async () => {
    const day = 86_400_000;
    for (let i = 0; i < 9; i++) await seedConnection(ids.An);
    await db.user.update({ where: { id: ids.An }, data: { sessionsValidFrom: new Date(START.getTime() - day) } });
    await seedConnection(ids.An, { revokedAt: START });
    await seedConnection(ids.An, { createdAt: new Date(START.getTime() - 91 * day) });
    await seedConnection(ids.An, { createdAt: new Date(START.getTime() - 2 * day) });
    await seedConnection(ids.An, { accessExpiresAt: new Date(START.getTime() - 1000) });
    await seedConnection(ids.An, {
      accessExpiresAt: new Date(START.getTime() - 1000),
      refreshTokenHash: sha(randomBytes(16).toString('hex')),
      refreshExpiresAt: new Date(START.getTime() - 1000),
    });
    const res = await approve('An', await requestId());
    expect(res.status).toBe(200);
  });

  it('AC-14: an approved request that is not exchanged counts, so the next approve gives 409', async () => {
    for (let i = 0; i < 9; i++) await seedConnection(ids.An);
    const r1 = await requestId();
    const r2 = await requestId();
    expect((await approve('An', r1)).status).toBe(200);
    const res = await approve('An', r2);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe(FULL);
    expect(await db.oAuthConnection.count({ where: { userId: ids.An } })).toBe(9);
  });

  it('AC-14: two approves at once with 9 connections give exactly one 200', async () => {
    for (let i = 0; i < 9; i++) await seedConnection(ids.An);
    const r1 = await requestId();
    const r2 = await requestId();
    const results = await Promise.all([approve('An', r1), approve('An', r2)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await db.oAuthRequest.count({ where: { codeHash: { not: null } } })).toBe(1);
  });

  it('AC-14: a 91-day-old connection alone does not count, with no sessionsValidFrom', async () => {
    const day = 86_400_000;
    for (let i = 0; i < 9; i++) await seedConnection(ids.An);
    await seedConnection(ids.An, { createdAt: new Date(START.getTime() - 91 * day) });
    expect((await db.user.findUniqueOrThrow({ where: { id: ids.An } })).sessionsValidFrom).toBeNull();
    expect((await approve('An', await requestId())).status).toBe(200);
  });

  it('AC-5: a state with a NUL character gives a redirect with invalid_request and no row', async () => {
    const res = await authorize({ state: 'a\u0000b' });
    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    expect(`${location.origin}${location.pathname}`).toBe(CALLBACK);
    expect(location.searchParams.get('error')).toBe('invalid_request');
    expect(await db.oAuthRequest.count()).toBe(0);
  });

  it('AC-5: a CIMD client_name with a control character gives the 400 page and no row', async () => {
    setCimd({ ...CIMD, client_name: 'Cl\u0007aude' });
    clientErrorPage(await authorize());
    expect(await db.oAuthRequest.count()).toBe(0);
  });

  it('AC-15: the 61st authorize in a minute gives 429, with no fetch and no readable IP', async () => {
    for (let i = 0; i < 60; i++) expect((await authorize()).status).toBe(302);
    expect(fetchSpy).toHaveBeenCalledTimes(60);
    const res = await authorize();
    expect(res.status).toBe(429);
    expect(res.body.message).toBe('Quá nhiều lệnh. Thử lại sau');
    expect(fetchSpy).toHaveBeenCalledTimes(60);
    const keys = (await db.authThrottle.findMany()).map((row) => row.key);
    expect(keys.some((key) => key.startsWith('oauth-authorize-ip:'))).toBe(true);
    for (const key of keys) expect(key).not.toMatch(/127\.0\.0\.1|::/);
  });
});
