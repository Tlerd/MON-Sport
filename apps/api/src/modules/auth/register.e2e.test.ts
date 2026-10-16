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

// Data of brief F-003: An has 0901234567. Now is 17/10/2026 10:00 in Asia/Ho_Chi_Minh.
const NOW = new Date('2026-10-17T10:00:00+07:00');
const clock = { now: () => NOW };
const lan = { name: 'Lan', phone: '0901112233', password: 'matkhau123', consent: true };
const TAKEN = 'Số điện thoại này đã có tài khoản';

let app: INestApplication;
let db: PrismaService;
const http = () => request(app.getHttpServer());
const register = (body: object) => http().post('/api/auth/register').send(body);

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
  await db.user.create({ data: { name: 'An', phone: '0901234567', passwordHash: await hash('test-password') } });
});

describe('POST /api/auth/register', () => {
  it('AC-1: a new phone number gets a USER account, a session, and the consent time', async () => {
    const res = await register(lan).expect(201);
    expect(res.body).toEqual({ id: expect.any(String), name: 'Lan', role: 'USER' });
    expect(res.headers['set-cookie']?.[0]).toMatch(/^session=.+HttpOnly/);
    const me = await http().get('/api/auth/me').set('Cookie', res.headers['set-cookie']![0].split(';')[0]).expect(200);
    expect(me.body.name).toBe('Lan');
    const stored = await db.user.findUniqueOrThrow({ where: { phone: lan.phone } });
    expect(stored.consentAt).toEqual(NOW);
    expect(stored.passwordHash).not.toContain(lan.password);
  });

  it('AC-2: the new account signs in with the same phone and password', async () => {
    await register(lan).expect(201);
    const res = await http().post('/api/auth/login').send({ phone: lan.phone, password: lan.password }).expect(200);
    expect(res.body.role).toBe('USER');
  });

  it('AC-3: a phone number that has an account gets 409', async () => {
    const res = await register({ ...lan, phone: '0901234567' }).expect(409);
    expect(res.body.message).toBe(TAKEN);
  });

  it('AC-4: 10 parallel sign-ups with one phone number give exactly one 201', async () => {
    const responses = await Promise.all(Array.from({ length: 10 }, () => register(lan)));
    const codes = responses.map((r) => r.status);
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(9);
    expect(responses.find((r) => r.status === 409)!.body.message).toBe(TAKEN);
  });

  it('AC-5: a sign-up without consent gets 400 and makes no account', async () => {
    const { consent: _consent, ...withoutConsent } = lan;
    for (const body of [{ ...lan, consent: false }, withoutConsent]) {
      const res = await register(body).expect(400);
      expect(res.body.message).toBe(Messages.consent);
    }
    expect(await db.user.count({ where: { phone: lan.phone } })).toBe(0);
  });

  it('AC-6: a password of 7 characters gets 400', async () => {
    const res = await register({ ...lan, password: '1234567' }).expect(400);
    expect(res.body.message).toBe('Mật khẩu có ít nhất 8 ký tự');
  });

  it('ignores a role field, so nobody signs up as an admin', async () => {
    const res = await register({ ...lan, role: 'ADMIN' }).expect(201);
    expect(res.body.role).toBe('USER');
  });
});
