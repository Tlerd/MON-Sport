import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { MCP_READ_TOOLS, MCP_TOOL_NAMES, type AccessTokenScope } from '@monsport/shared';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { AccessTokensService } from '../access-tokens/access-tokens.service.js';
import { issueSession } from '../auth/session.js';
import { BookingsService } from '../bookings/bookings.service.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { MatchPlayersService } from '../matches/match-players.service.js';
import { VenuesService } from '../venues/venues.service.js';

const at = (hhmm: string) => new Date(`2026-12-01T${hhmm}:00Z`);
const vn = (hhmm: string, day: string) => `${day}T${hhmm}:00+07:00`;
const clock = { at: at('03:00'), now() { return this.at; } };
const MISSING = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const TOO_MANY = 'Quá nhiều lệnh. Thử lại sau';
const INVALID = { message: 'Mã truy cập không hợp lệ' };

let app: INestApplication;
let app2: INestApplication;
let db: PrismaService;
let tokens: AccessTokensService;
const ids: Record<string, string> = {};

const withApp = async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue(clock).compile();
  const created = setupApp(moduleRef.createNestApplication());
  await created.init();
  return created;
};

const rpc = (target: INestApplication, secret: string | null, method: string, params: Record<string, unknown> = {}, id = 1) => {
  const r = request(target.getHttpServer())
    .post('/api/mcp')
    .set('Accept', 'application/json, text/event-stream')
    .set('Content-Type', 'application/json');
  if (secret) r.set('Authorization', `Bearer ${secret}`);
  return r.send({ jsonrpc: '2.0', id, method, params });
};
const callTool = (secret: string, name: string, args: Record<string, unknown> = {}, target = app) =>
  rpc(target, secret, 'tools/call', { name, arguments: args });
const toolText = (res: request.Response): string => res.body?.result?.content?.[0]?.text ?? '';

async function newToken(who: string, scope: AccessTokenScope = 'BOOK'): Promise<{ id: string; secret: string }> {
  const out = await tokens.create(ids[who], { name: 'test', scope, expiresInDays: 30 });
  return { id: out.token.id, secret: out.secret };
}

beforeAll(async () => {
  app = await withApp();
  app2 = await withApp();
  db = app.get(PrismaService);
  tokens = app.get(AccessTokensService);
});

afterAll(async () => {
  await app?.close();
  await app2?.close();
});

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(async () => {
  clock.at = at('03:00');
  await db.$executeRawUnsafe('TRUNCATE "AccessToken", "MatchPlayer", "Match", "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
  const passwordHash = await hash('test-password');
  const make = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER') =>
    db.user.create({ data: { name, phone, role, passwordHash } }).then((u) => (ids[name] = u.id));
  await Promise.all([make('Admin', '0900000000', 'ADMIN'), make('Owner', '0900000001', 'OWNER'), make('A', '0901234567', 'USER'), make('B', '0901234568', 'USER')]);
  const venue = await db.venue.create({
    data: { ownerId: ids.Owner, name: 'An Phu Sport', address: '1 Le Loi', phone: '0281234567', opensAt: 360, closesAt: 1380 },
  });
  ids.F1 = (await db.court.create({ data: { venueId: venue.id, name: 'Sân bóng 1', sport: 'FOOTBALL', priceNormal: 100_000, pricePeak: 150_000 } })).id;
});

describe('POST /api/mcp (F-037)', () => {
  it('AC-4: after the token is revoked, POST /api/mcp with it is 401', async () => {
    const { id, secret } = await newToken('A');
    await rpc(app, secret, 'tools/list').expect(200);
    await request(app.getHttpServer())
      .delete(`/api/me/access-tokens/${id}`)
      .set('Cookie', `session=${issueSession(ids.A, clock.now())}`)
      .expect(204);
    await rpc(app, secret, 'tools/list').expect(401);
  });

  it('AC-5: a BOOK token lists 9 tools and requests a booking as its owner, and no log line has the token', async () => {
    const { secret } = await newToken('A');
    const lines: string[] = [];
    const sink = (chunk: unknown) => (lines.push(String(chunk)), true);
    vi.spyOn(process.stdout, 'write').mockImplementation(sink as never);
    vi.spyOn(process.stderr, 'write').mockImplementation(sink as never);
    for (const level of ['log', 'error', 'warn', 'info', 'debug'] as const) vi.spyOn(console, level).mockImplementation((...a: unknown[]) => void lines.push(a.join(' ')));

    await rpc(app, secret, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } }).expect(200);
    const list = await rpc(app, secret, 'tools/list', {}, 2).expect(200);
    expect(list.body.result.tools.map((t: { name: string }) => t.name).sort()).toEqual([...MCP_TOOL_NAMES].sort());
    const res = await callTool(secret, 'request_booking', { courtId: ids.F1, startAt: vn('18:00', '2026-12-10'), endAt: vn('19:30', '2026-12-10') });
    expect(res.status).toBe(200);
    expect(res.body.result.isError).not.toBe(true);

    const bookings = await db.booking.findMany();
    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toMatchObject({ createdById: ids.A, status: 'PENDING', source: 'APP' });
    const row = await db.accessToken.findFirstOrThrow();
    expect(row.lastUsedAt?.toISOString()).toBe(clock.now().toISOString());
    expect(lines.join('\n')).not.toContain('mst_');
  });

  it('AC-6: no header, a wrong token, an expired token, a locked user, a deleted user, or a cookie only is 401 and calls no service', async () => {
    const request_ = vi.spyOn(app.get(BookingsService), 'request');
    const search = vi.spyOn(app.get(VenuesService), 'search');
    const body = { courtId: ids.F1, startAt: vn('18:00', '2026-12-10'), endAt: vn('19:30', '2026-12-10') };
    const expectInvalid = (res: request.Response) => {
      expect(res.status).toBe(401);
      expect(res.headers['www-authenticate']).toMatch(/^Bearer/);
      expect(res.body).toEqual(INVALID);
    };

    expectInvalid(await rpc(app, null, 'tools/call', { name: 'request_booking', arguments: body }));
    expectInvalid(await callTool('mst_sai', 'search_venues'));

    const { secret } = await newToken('A');
    clock.at = new Date(clock.at.getTime() + 31 * 86_400_000);
    expectInvalid(await callTool(secret, 'request_booking', body));
    clock.at = at('03:00');

    const locked = await newToken('B');
    await db.user.update({ where: { id: ids.B }, data: { lockedAt: clock.now() } });
    expectInvalid(await callTool(locked.secret, 'search_venues'));
    await db.user.update({ where: { id: ids.B }, data: { lockedAt: null, deletedAt: clock.now() } });
    expectInvalid(await callTool(locked.secret, 'search_venues'));

    const cookie = `session=${issueSession(ids.A, clock.now())}`;
    const viaCookie = await request(app.getHttpServer())
      .post('/api/mcp')
      .set('Cookie', cookie)
      .set('Accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    expectInvalid(viaCookie);

    expect(request_).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it('AC-7: a token made before an unlock stops working, and a token made after it works', async () => {
    const old = await newToken('A');
    await rpc(app, old.secret, 'tools/list').expect(200);
    const asAdmin = (path: string) =>
      request(app.getHttpServer()).post(path).set('Cookie', `session=${issueSession(ids.Admin, clock.now())}`);
    clock.at = at('03:30');
    expect((await asAdmin(`/api/admin/users/${ids.A}/lock`)).status).toBeLessThan(300);
    clock.at = at('04:00');
    expect((await asAdmin(`/api/admin/users/${ids.A}/unlock`)).status).toBe(200);
    clock.at = at('05:00');
    const fresh = await newToken('A');
    await rpc(app, old.secret, 'tools/list').expect(401);
    await rpc(app, fresh.secret, 'tools/list').expect(200);
  });

  it('AC-8: a READ token sees the 4 read tools only, and a write tool never runs', async () => {
    const { secret } = await newToken('A', 'READ');
    const request_ = vi.spyOn(app.get(BookingsService), 'request');
    const list = await rpc(app, secret, 'tools/list').expect(200);
    expect(list.body.result.tools.map((t: { name: string }) => t.name).sort()).toEqual([...MCP_READ_TOOLS].sort());
    expect(list.body.result.tools).toHaveLength(4);
    const res = await callTool(secret, 'request_booking', { courtId: ids.F1, startAt: vn('18:00', '2026-12-10'), endAt: vn('19:30', '2026-12-10') });
    const failed = res.body.error !== undefined || res.body.result?.isError === true;
    expect(failed).toBe(true);
    expect(JSON.stringify(res.body)).toMatch(/not found|không tồn tại/i);
    expect(request_).not.toHaveBeenCalled();
  });

  it('AC-9: two instances share the count: the 11th write is refused, the window ends after 61 seconds, and the keys hide the user id', async () => {
    const { secret } = await newToken('A');
    const join = vi.spyOn(app.get(MatchPlayersService), 'join');
    const join2 = vi.spyOn(app2.get(MatchPlayersService), 'join');
    for (let i = 0; i < 6; i++) expect(toolText(await callTool(secret, 'join_match', { matchId: MISSING }, app))).toBe('Không tìm thấy trận');
    for (let i = 0; i < 4; i++) expect(toolText(await callTool(secret, 'join_match', { matchId: MISSING }, app2))).toBe('Không tìm thấy trận');
    expect(toolText(await callTool(secret, 'join_match', { matchId: MISSING }, app2))).toBe(TOO_MANY);
    expect(join).toHaveBeenCalledTimes(6);
    expect(join2).toHaveBeenCalledTimes(4);

    const keys = await db.$queryRawUnsafe<{ key: string }[]>('SELECT key FROM "AuthThrottle"');
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.some((k) => k.key.includes(ids.A))).toBe(false);

    clock.at = new Date(clock.at.getTime() + 61_000);
    expect(toolText(await callTool(secret, 'join_match', { matchId: MISSING }))).toBe('Không tìm thấy trận');

    clock.at = new Date(clock.at.getTime() + 61_000);
    const other = await newToken('B');
    for (let i = 0; i < 60; i++) expect((await callTool(other.secret, 'list_my_bookings')).body.result.isError).not.toBe(true);
    expect(toolText(await callTool(other.secret, 'list_my_bookings'))).toBe(TOO_MANY);
  });

  it('AC-10: a request with an Origin header is 403 and calls no service', async () => {
    const { secret } = await newToken('A');
    const search = vi.spyOn(app.get(VenuesService), 'search');
    const res = await rpc(app, secret, 'tools/call', { name: 'search_venues', arguments: {} }).set('Origin', 'https://la.example');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'Bạn không có quyền làm việc này' });
    expect(search).not.toHaveBeenCalled();
  });

  it('AC-11: GET and DELETE on /api/mcp are 405 with Allow: POST', async () => {
    for (const method of ['get', 'delete'] as const) {
      const res = await request(app.getHttpServer())[method]('/api/mcp');
      expect(res.status).toBe(405);
      expect(res.headers.allow).toBe('POST');
    }
  });

  it('AC-12: lastUsedAt moves at most once in 60 seconds', async () => {
    const { secret } = await newToken('A');
    const last = async () => (await db.accessToken.findFirstOrThrow()).lastUsedAt?.toISOString();
    await rpc(app, secret, 'tools/list').expect(200);
    expect(await last()).toBe(at('03:00').toISOString());
    clock.at = new Date(at('03:00').getTime() + 30_000);
    await rpc(app, secret, 'tools/list').expect(200);
    expect(await last()).toBe(at('03:00').toISOString());
    clock.at = new Date(at('03:00').getTime() + 65_000);
    await rpc(app, secret, 'tools/list').expect(200);
    expect(await last()).toBe(clock.now().toISOString());
  });
});
