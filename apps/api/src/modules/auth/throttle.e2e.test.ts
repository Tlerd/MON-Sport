import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { Messages } from '@monsport/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { Passwords } from './passwords.js';
import { keyedDigest } from './session.js';

// Data of brief F-006: An has 0901234567 and the password test-password. Now is 17/10/2026 10:00 in Asia/Ho_Chi_Minh.
const at = (time: string) => new Date(`2026-10-17T${time}:00+07:00`);
let now = at('10:00');
const clock = { now: () => now };
const AN = '0901234567';
const PASSWORD = 'test-password';
const WRONG = 'sai-mat-khau';

let app: INestApplication;
let db: PrismaService;
let passwords: Passwords;
const http = () => request(app.getHttpServer());
const login = (ip: string, phone = AN, password = PASSWORD) =>
  http().post('/api/auth/login').set('X-Forwarded-For', ip).send({ phone, password });
const register = (ip: string, phone: string) =>
  http().post('/api/auth/register').set('X-Forwarded-For', ip).send({ name: 'test-Lan', phone, password: 'san-cau-long-2026', consent: true });
const statuses = async (requests: Promise<{ status: number }>[]) => (await Promise.all(requests)).map((r) => r.status);
/** Sends one request at a time, so the counts follow the order. */
const inTurn = async (count: number, send: (i: number) => Promise<{ status: number }>) => {
  const result: number[] = [];
  for (let i = 0; i < count; i++) result.push((await send(i)).status);
  return result;
};
const times = (n: number, status: number) => Array<number>(n).fill(status);
const phoneOf = (i: number, base: number) => `0${base + i}`;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue(clock).compile();
  app = setupApp(moduleRef.createNestApplication());
  await app.init();
  db = app.get(PrismaService);
  passwords = app.get(Passwords);
});

afterAll(async () => {
  await app?.close();
});

beforeEach(async () => {
  now = at('10:00');
  vi.restoreAllMocks();
  await db.$executeRawUnsafe('TRUNCATE "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
  await db.user.create({ data: { name: 'An', phone: AN, passwordHash: await hash(PASSWORD) } });
});

describe('login limits (BR-30)', () => {
  it('AC-1: the 11th login on one phone gets 429 without an argon2 check, whatever the IP', async () => {
    const verify = vi.spyOn(passwords, 'verify');
    expect(await inTurn(10, (i) => login(`203.0.113.${i + 1}`, AN, WRONG))).toEqual(times(10, 401));
    const res = await login('203.0.113.11');
    expect(res.status).toBe(429);
    expect(res.body.message).toBe(Messages.tooManyAttempts);
    expect(res.headers['retry-after']).toBe('900');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(verify).toHaveBeenCalledTimes(10);
  });

  it('AC-2: the phone signs in again when the 15-minute window ends', async () => {
    await inTurn(11, (i) => login(`203.0.113.${i + 1}`, AN, WRONG));
    now = at('10:15');
    const res = await login('203.0.113.12').expect(200);
    expect(res.headers['set-cookie']?.[0]).toMatch(/^session=/);
  });

  it('AC-3: a correct password clears the phone counter', async () => {
    expect(await inTurn(9, (i) => login(`203.0.113.${i + 1}`, AN, WRONG))).toEqual(times(9, 401));
    await login('203.0.113.10').expect(200);
    expect(await inTurn(10, (i) => login(`198.51.100.${i + 1}`, AN, WRONG))).toEqual(times(10, 401));
  });

  it('AC-4: the 31st login from one IP gets 429, and another IP still signs in', async () => {
    expect(await inTurn(30, (i) => login('203.0.113.7', phoneOf(i, 911000000), WRONG))).toEqual(times(30, 401));
    await login('203.0.113.7').expect(429);
    await login('203.0.113.8').expect(200);
  });

  it('AC-5: of 20 parallel wrong logins on one phone, exactly 10 get 401 and 10 get 429', async () => {
    const result = await statuses(Array.from({ length: 20 }, (_, i) => login(`203.0.113.${i + 1}`, AN, WRONG)));
    expect(result.filter((s) => s === 401)).toHaveLength(10);
    expect(result.filter((s) => s === 429)).toHaveLength(10);
  });

  it('AC-7: a forged X-Forwarded-For entry does not change the counted IP', async () => {
    await inTurn(30, (i) => login('203.0.113.7', phoneOf(i, 911000000), WRONG));
    await login('198.51.100.1, 203.0.113.7').expect(429);
  });

  it('AC-8: IPv6 addresses in one /64 share a counter', async () => {
    await inTurn(30, (i) => login('2001:db8:1:2::a', phoneOf(i, 911000000), WRONG));
    await login('2001:db8:1:2::b').expect(429);
    await login('2001:db8:1:3::a').expect(200);
  });

  it('AC-9: the counter table holds no readable phone number or IP', async () => {
    await inTurn(11, (i) => login(`203.0.113.${i + 1}`, AN, WRONG));
    const rows = JSON.stringify(await db.authThrottle.findMany());
    expect(rows).toContain(keyedDigest(AN));
    expect(rows).not.toContain(AN);
    expect(rows).not.toContain('203.0.113.1');
  });

  it('AC-17: a login from a blocked IP does not count on the phone', async () => {
    await inTurn(30, (i) => login('203.0.113.7', phoneOf(i, 911000000), WRONG));
    await login('203.0.113.7', AN, WRONG).expect(429);
    expect(await db.authThrottle.count({ where: { key: `login-phone:${keyedDigest(AN)}` } })).toBe(0);
  });
});

describe('sign-up limits (BR-30)', () => {
  it('AC-6: the 21st sign-up from one IP in an hour gets 429 without an argon2 hash', async () => {
    const hashes = vi.spyOn(passwords, 'hash');
    expect(await inTurn(20, (i) => register('203.0.113.9', phoneOf(i, 902000000)))).toEqual(times(20, 201));
    const res = await register('203.0.113.9', '0902000020');
    expect(res.status).toBe(429);
    expect(res.body.message).toBe(Messages.tooManyAttempts);
    expect(res.headers['retry-after']).toBe('3600');
    expect(await db.user.count({ where: { phone: '0902000020' } })).toBe(0);
    expect(hashes).toHaveBeenCalledTimes(20);
    await register('203.0.113.10', '0902000020').expect(201);
  });
});

describe('counter rows', () => {
  it('drops rows older than one day when a counter opens a window', async () => {
    await login('203.0.113.1', AN, WRONG);
    now = new Date(at('10:00').getTime() + 25 * 60 * 60_000);
    await login('203.0.113.2', AN, WRONG);
    const rows = await db.authThrottle.findMany();
    expect(rows.every((r) => r.windowStart.getTime() === now.getTime())).toBe(true);
  });
});
