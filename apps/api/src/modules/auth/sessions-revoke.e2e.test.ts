import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { Messages } from '@monsport/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { issueSession } from './session.js';

// Data of brief F-006: the admin, the owner Bình with an old common password, and the user An. Now is 17/10/2026 10:00.
const at = (time: string) => new Date(`2026-10-17T${time}:00+07:00`);
let now = at('10:00');
const clock = { now: () => now };
const PASSWORD = 'test-password';

let app: INestApplication;
let db: PrismaService;
const ids: Record<string, string> = {};
const http = () => request(app.getHttpServer());
const admin = () => `session=${issueSession(ids.admin, now)}`;
const me = (cookie: string) => http().get('/api/auth/me').set('Cookie', cookie);
const unlock = (id: string) => http().post(`/api/admin/users/${id}/unlock`).set('Cookie', admin());

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
  now = at('10:00');
  await db.$executeRawUnsafe('TRUNCATE "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
  const user = async (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER', password = PASSWORD) =>
    (ids[name] = (await db.user.create({ data: { name, phone, role, passwordHash: await hash(password) } })).id);
  await Promise.all([
    user('admin', '0900000000', 'ADMIN'),
    user('Bình', '0912345678', 'OWNER', 'matkhau123'),
    user('An', '0901234567', 'USER'),
  ]);
});

describe('new passwords (BR-31)', () => {
  it('AC-11: the admin cannot create an owner with a common password', async () => {
    const owner = (password: string) => http().post('/api/admin/owners').set('Cookie', admin()).send({ name: 'Giang', phone: '0912345681', password });
    expect((await owner('matkhau123').expect(400)).body.message).toBe(Messages.weakPassword);
    await owner('san-cau-long-2026').expect(201);
  });

  it('AC-12: an account with an old common password still signs in', async () => {
    await http().post('/api/auth/login').send({ phone: '0912345678', password: 'matkhau123' }).expect(200);
  });

  it('refuses a sign-up with a common password, and creates no account', async () => {
    const res = await http().post('/api/auth/register').send({ name: 'Lan', phone: '0901112233', password: 'matkhau123', consent: true }).expect(400);
    expect(res.body.message).toBe(Messages.weakPassword);
    expect(await db.user.count({ where: { phone: '0901112233' } })).toBe(0);
  });
});

describe('session revoke on unlock (BR-32)', () => {
  it('AC-13: an unlock revokes the sessions issued before it, and a new login works', async () => {
    const old = `session=${issueSession(ids.An, at('09:00'))}`;
    await http().post(`/api/admin/users/${ids.An}/lock`).set('Cookie', admin()).expect(200);
    now = at('10:05');
    await unlock(ids.An).expect(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: ids.An } })).sessionsValidFrom).toEqual(at('10:05'));
    now = at('10:06');
    await me(old).expect(401);
    const fresh = (await http().post('/api/auth/login').send({ phone: '0901234567', password: PASSWORD }).expect(200)).headers['set-cookie']![0].split(';')[0];
    await me(fresh).expect(200);
  });

  it('AC-14: an unlock of an account that is not locked changes nothing, and the old session still works', async () => {
    const old = `session=${issueSession(ids.An, at('09:00'))}`;
    now = at('10:05');
    await unlock(ids.An).expect(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: ids.An } })).sessionsValidFrom).toBeNull();
    await me(old).expect(200);
  });

  it('accepts a session issued in the same millisecond as the unlock', async () => {
    await db.user.update({ where: { id: ids.An }, data: { sessionsValidFrom: at('10:00') } });
    await me(`session=${issueSession(ids.An, at('10:00'))}`).expect(200);
    await me(`session=${issueSession(ids.An, new Date(at('10:00').getTime() - 1))}`).expect(401);
  });
});
