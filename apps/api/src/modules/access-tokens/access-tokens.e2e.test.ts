import 'reflect-metadata';
import { createHash, randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import type { CreateAccessTokenResponse } from '@monsport/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { AccessTokensService } from './access-tokens.service.js';

const START = new Date('2026-12-01T03:00:00Z');
const clock = { at: START, now() { return this.at; } };
const FULL = 'Bạn đã có 5 mã. Thu hồi một mã trước';

let app: INestApplication;
let db: PrismaService;
let passwordHash: string;
const ids: Record<string, string> = {};
const http = () => request(app.getHttpServer());
const as = (who: string | null) => (r: request.Test) => (who ? r.set('Cookie', `session=${issueSession(ids[who], clock.now())}`) : r);
const at = (iso: string) => {
  clock.at = new Date(iso);
};
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const body = { name: 'Claude Code', scope: 'BOOK', expiresInDays: 30 };

const create = (who: string | null, input: object = body) => as(who)(http().post('/api/me/access-tokens')).send(input);
const list = (who: string | null) => as(who)(http().get('/api/me/access-tokens'));
const revoke = (who: string | null, id: string) => as(who)(http().delete(`/api/me/access-tokens/${id}`));
const service = () => app.get(AccessTokensService);
const seed = (userId: string, extra: { createdAt?: Date; expiresAt?: Date; revokedAt?: Date | null } = {}) =>
  db.accessToken.create({
    data: {
      userId,
      name: 'seed',
      scope: 'READ',
      prefix: 'mst_seed0000',
      tokenHash: sha(randomBytes(16).toString('hex')),
      createdAt: extra.createdAt ?? START,
      expiresAt: extra.expiresAt ?? new Date(START.getTime() + 30 * 86_400_000),
      revokedAt: extra.revokedAt ?? null,
    },
  });

beforeAll(async () => {
  passwordHash = await hash('test-password');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue(clock).compile();
  app = setupApp(moduleRef.createNestApplication());
  await app.init();
  db = app.get(PrismaService);
});

afterAll(async () => {
  await app?.close();
});

describe('access tokens (F-037 step 2)', () => {
  beforeEach(async () => {
    clock.at = START;
    await db.$executeRawUnsafe('TRUNCATE "AccessToken", "PushSubscription", "Notification", "MatchPlayer", "Match", "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
    const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER') =>
      db.user.create({ data: { name, phone, role, passwordHash } }).then((u) => (ids[name] = u.id));
    await Promise.all([
      user('An', '0901234567', 'USER'),
      user('Bảo', '0901234568', 'USER'),
      user('Bình', '0912345678', 'OWNER'),
      user('Quản trị', '0900000001', 'ADMIN'),
    ]);
    // A STAFF account belongs to a venue of an owner (QA F-037, finding 6).
    const venue = await db.venue.create({ data: { ownerId: ids['Bình'], name: 'Cầu lông A', address: '1 Lê Lợi', phone: '0281234567', opensAt: 360, closesAt: 1380 } });
    ids['Nhân viên'] = (await db.user.create({ data: { name: 'Nhân viên', phone: '0901234569', role: 'STAFF', passwordHash, staffVenueId: venue.id } })).id;
  });

  it('AC-2: A creates a token with 201, the secret is shown once, and only the hash is stored', async () => {
    const res = await create('An');
    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    const { token, secret } = res.body as CreateAccessTokenResponse;
    expect(secret).toMatch(/^mst_[A-Za-z0-9_-]{43}$/);
    expect(token.createdAt).toBe('2026-12-01T03:00:00.000Z');
    expect(token.expiresAt).toBe('2026-12-31T03:00:00.000Z');
    expect(token.prefix).toBe(secret.slice(0, 12));

    const row = await db.accessToken.findUniqueOrThrow({ where: { id: token.id } });
    expect(row.tokenHash).toBe(sha(secret));
    expect(JSON.stringify(row)).not.toContain(secret);

    const got = await list('An');
    expect(got.status).toBe(200);
    expect(got.body.tokens).toEqual([token]);
    expect(got.text).not.toContain('secret');
    expect(got.text).not.toContain('tokenHash');
  });

  it('AC-3: the sixth valid token gets 409, and a revoked, expired, or pre-unlock token does not count', async () => {
    for (let i = 0; i < 5; i++) await seed(ids.An);
    await seed(ids.An, { revokedAt: START });
    await seed(ids.An, { expiresAt: new Date('2026-11-30T00:00:00Z'), createdAt: new Date('2026-11-01T00:00:00Z') });
    await seed(ids.An, { createdAt: new Date('2026-11-30T00:00:00Z') });
    await db.user.update({ where: { id: ids.An }, data: { sessionsValidFrom: new Date('2026-11-30T12:00:00Z') } });
    const before = await db.accessToken.count();

    const res = await create('An');
    expect(res.status).toBe(409);
    expect(res.body.message).toBe(FULL);
    expect(await db.accessToken.count()).toBe(before);

    const got = await list('An');
    expect(got.status).toBe(200);
    expect(got.body.tokens).toHaveLength(5);
  });

  it('AC-3: two parallel POSTs at 4 valid tokens give one 201 and one 409, and 5 valid rows', async () => {
    for (let i = 0; i < 4; i++) await seed(ids.An);
    const results = await Promise.all([create('An'), create('An')]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await list('An')).body.tokens).toHaveLength(5);
    expect(await db.accessToken.count({ where: { userId: ids.An } })).toBe(5);
  });

  it('AC-3: an owner, a staff member, and an admin get 403, and a guest gets 401', async () => {
    for (const who of ['Bình', 'Nhân viên', 'Quản trị']) {
      const res = await create(who);
      expect(res.status, who).toBe(403);
      expect(res.body.message, who).toBe('Bạn không có quyền làm việc này');
    }
    expect((await create(null)).status).toBe(401);
    expect(await db.accessToken.count()).toBe(0);
  });

  it('AC-4: A revokes M1 with 204, and cannot revoke M2 of B', async () => {
    const m1 = (await create('An')).body as CreateAccessTokenResponse;
    const m2 = (await create('Bảo')).body as CreateAccessTokenResponse;

    const del = await revoke('An', m1.token.id);
    expect(del.status).toBe(204);
    const row = await db.accessToken.findUniqueOrThrow({ where: { id: m1.token.id } });
    expect(row.revokedAt).toEqual(START);
    const got = await list('An');
    expect(got.body.tokens.map((t: { id: string }) => t.id)).not.toContain(m1.token.id);
    expect(await service().authenticate(m1.secret)).toBeNull();

    const other = await revoke('An', m2.token.id);
    expect(other.status).toBe(404);
    expect(other.body.message).toBe('Không tìm thấy mã');
    expect((await db.accessToken.findUniqueOrThrow({ where: { id: m2.token.id } })).revokedAt).toBeNull();
    expect(await service().authenticate(m2.secret)).not.toBeNull();

    expect((await revoke('An', 'abc')).status).toBe(404);
  });

  it('AC-7: a lock and an unlock cancel an old token, and a new token works', async () => {
    const old = (await create('An')).body as CreateAccessTokenResponse;
    at('2026-12-01T04:00:00Z');
    const lock = await as('Quản trị')(http().post(`/api/admin/users/${ids.An}/lock`));
    expect(lock.status).toBe(200);
    const unlock = await as('Quản trị')(http().post(`/api/admin/users/${ids.An}/unlock`));
    expect(unlock.status).toBe(200);

    at('2026-12-01T05:00:00Z');
    expect(await service().authenticate(old.secret)).toBeNull();
    const fresh = (await create('An')).body as CreateAccessTokenResponse;
    expect(await service().authenticate(fresh.secret)).toEqual({ userId: ids.An, role: 'USER', scope: 'BOOK' });
  });

  it('AC-7: a wrong secret, an expired token, and lastUsedAt', async () => {
    const made = (await create('An')).body as CreateAccessTokenResponse;
    expect(await service().authenticate('mst_wrong')).toBeNull();

    at('2026-12-01T03:10:00Z');
    expect(await service().authenticate(made.secret)).not.toBeNull();
    const row = await db.accessToken.findUniqueOrThrow({ where: { id: made.token.id } });
    expect(row.lastUsedAt).toEqual(clock.now());

    at('2026-12-31T03:00:00Z');
    expect(await service().authenticate(made.secret)).toBeNull();
  });
});
