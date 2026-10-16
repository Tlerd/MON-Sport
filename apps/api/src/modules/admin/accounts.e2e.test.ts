import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

// Data of brief F-003: the admin, owners Bình and Dũng, and the user An.
const NOW = new Date('2026-10-17T10:00:00+07:00');
const clock = { now: () => NOW };
const PASSWORD = 'test-password';

let app: INestApplication;
let db: PrismaService;
const ids: Record<string, string> = {};
const cookie = (who: string) => `session=${issueSession(ids[who], NOW)}`;
const http = () => request(app.getHttpServer());
const as = (who: string) => ({
  get: (path: string) => http().get(path).set('Cookie', cookie(who)),
  post: (path: string, body?: object) => http().post(path).set('Cookie', cookie(who)).send(body),
});
const login = (phone: string, password = PASSWORD) => http().post('/api/auth/login').send({ phone, password });

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue(clock).compile();
  app = setupApp(moduleRef.createNestApplication());
  await app.init();
  db = app.get(PrismaService);
});

afterAll(async () => {
  await app?.close();
});

beforeEach(async () => {
  await db.$executeRawUnsafe('TRUNCATE "Booking", "Court", "Venue", "User" CASCADE');
  const passwordHash = await hash(PASSWORD);
  const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER') =>
    db.user.create({ data: { name, phone, role, passwordHash } }).then((u) => (ids[name] = u.id));
  await Promise.all([
    user('admin', '0900000000', 'ADMIN'),
    user('Bình', '0912345678', 'OWNER'),
    user('Dũng', '0912345679', 'OWNER'),
    user('An', '0901234567', 'USER'),
  ]);
});

describe('admin accounts', () => {
  it('creates an OWNER whatever role the body names', async () => {
    await as('admin').post('/api/admin/owners', { name: 'Giang', phone: '0912345681', password: 'matkhau123', role: 'ADMIN' }).expect(201);
    expect((await db.user.findUniqueOrThrow({ where: { phone: '0912345681' } })).role).toBe('OWNER');
  });

  it('answers the Vietnamese generic text for a malformed id', async () => {
    expect((await as('admin').post('/api/admin/users/abc/lock').expect(400)).body.message).toBe('Dữ liệu không hợp lệ');
  });

  it('AC-7: the admin creates an owner who can sign in', async () => {
    const res = await as('admin').post('/api/admin/owners', { name: 'Giang', phone: '0912345681', password: 'matkhau123' }).expect(201);
    expect(res.body).toEqual({ id: expect.any(String), name: 'Giang', phone: '0912345681', role: 'OWNER', lockedAt: null, createdAt: NOW.toISOString() });
    expect((await login('0912345681', 'matkhau123').expect(200)).body.role).toBe('OWNER');
  });

  it('AC-8: an owner with a phone number that has an account gets 409', async () => {
    const res = await as('admin').post('/api/admin/owners', { name: 'Giang', phone: '0901234567', password: 'matkhau123' }).expect(409);
    expect(res.body.message).toBe('Số điện thoại này đã có tài khoản');
  });

  it('AC-9: a locked account cannot sign in', async () => {
    const res = await as('admin').post(`/api/admin/users/${ids.An}/lock`).expect(200);
    expect(res.body.lockedAt).toBe(NOW.toISOString());
    expect((await login('0901234567').expect(403)).body.message).toBe('Tài khoản đã bị khóa');
  });

  it('AC-10: the old session of a locked account gets 401', async () => {
    const session = (await login('0901234567').expect(200)).headers['set-cookie']![0].split(';')[0];
    await http().get('/api/auth/me').set('Cookie', session).expect(200);
    await as('admin').post(`/api/admin/users/${ids.An}/lock`).expect(200);
    await http().get('/api/auth/me').set('Cookie', session).expect(401);
  });

  it('AC-11: an unlocked account signs in again', async () => {
    await db.user.update({ where: { id: ids.An }, data: { lockedAt: new Date('2026-10-16T10:00:00+07:00') } });
    const res = await as('admin').post(`/api/admin/users/${ids.An}/unlock`).expect(200);
    expect(res.body.lockedAt).toBeNull();
    await login('0901234567').expect(200);
  });

  it('AC-12: the admin cannot lock an admin account', async () => {
    const res = await as('admin').post(`/api/admin/users/${ids.admin}/lock`).expect(400);
    expect(res.body.message).toBe('Không khóa được tài khoản admin');
    await as('admin').get('/api/auth/me').expect(200);
  });

  it('AC-13: an owner and a user get 403, and a request without a cookie gets 401, on every account route', async () => {
    const routes: [string, string, object?][] = [
      ['post', '/api/admin/owners', { name: 'Giang', phone: '0912345681', password: 'matkhau123' }],
      ['get', '/api/admin/owners'],
      ['post', '/api/admin/users/search', { phone: '0901234567' }],
      ['post', `/api/admin/users/${ids.An}/lock`],
      ['post', `/api/admin/users/${ids.An}/unlock`],
    ];
    for (const [method, path, body] of routes) {
      for (const who of ['Bình', 'An']) {
        const req = method === 'get' ? as(who).get(path) : as(who).post(path, body);
        await req.expect(403);
      }
      await (method === 'get' ? http().get(path) : http().post(path).send(body)).expect(401);
    }
    expect(await db.user.count({ where: { lockedAt: { not: null } } })).toBe(0);
    expect(await db.user.count({ where: { phone: '0912345681' } })).toBe(0);
  });

  it('AC-14: the admin lists owners and finds a user by one phone number, without password hashes', async () => {
    const owners = await as('admin').get('/api/admin/owners').expect(200);
    expect(owners.body.map((o: { name: string }) => o.name)).toEqual(['Bình', 'Dũng']);
    const found = await as('admin').post('/api/admin/users/search', { phone: '0901234567' }).expect(200);
    expect(found.body).toEqual([expect.objectContaining({ id: ids.An, name: 'An', role: 'USER' })]);
    expect((await as('admin').post('/api/admin/users/search', { phone: '0909999999' }).expect(200)).body).toEqual([]);
    const bad = await as('admin').post('/api/admin/users/search', { phone: '09' }).expect(400);
    expect(bad.body.message).toBe('Số điện thoại có 10 chữ số và bắt đầu bằng 0');
    for (const body of [owners.text, found.text]) expect(body).not.toContain('passwordHash');
  });

  it('AC-29: locking a locked account keeps the first lock time, and an unknown account gets 404', async () => {
    const first = new Date('2026-10-16T10:00:00+07:00');
    await db.user.update({ where: { id: ids.An }, data: { lockedAt: first } });
    const res = await as('admin').post(`/api/admin/users/${ids.An}/lock`).expect(200);
    expect(res.body.lockedAt).toBe(first.toISOString());
    await as('admin').post('/api/admin/users/0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/lock').expect(404);
    await as('admin').post('/api/admin/users/0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/unlock').expect(404);
  });
});
