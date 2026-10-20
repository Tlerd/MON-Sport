import 'reflect-metadata';
import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { Messages, type PushPublicKeyResponse } from '@monsport/shared';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

const START = new Date('2026-11-20T03:00:00Z');
const clock = { at: START, now() { return this.at; } };
const SAMPLE = 'https://fcm.googleapis.com/fcm/send/abc123';
const KEYS = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };
const VAPID_VARS = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;
const PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

let app: INestApplication;
let db: PrismaService;
let passwordHash: string;
const ids: Record<string, string> = {};
const http = () => request(app.getHttpServer());
const as = (who: string | null) => (r: request.Test) => (who ? r.set('Cookie', `session=${issueSession(ids[who], clock.now())}`) : r);

const publicKey = (who: string | null) => as(who)(http().get('/api/push/public-key'));
const subscribe = (who: string | null, body: unknown) => as(who)(http().post('/api/push/subscriptions')).send(body as object);
const unsubscribe = (who: string | null, body: unknown) => as(who)(http().delete('/api/push/subscriptions')).send(body as object);
const sub = (endpoint: string) => ({ endpoint, keys: KEYS });
const endpointsOf = async (who: string) =>
  (await db.pushSubscription.findMany({ where: { userId: ids[who] }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })).map((row) => row.endpoint);
const countAll = () => db.pushSubscription.count();

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

describe('push subscriptions (F-014 step 1)', () => {
  const saved = Object.fromEntries(VAPID_VARS.map((name) => [name, process.env[name]]));
  const setVapid = () => {
    process.env.VAPID_PUBLIC_KEY = PUBLIC_KEY;
    process.env.VAPID_PRIVATE_KEY = 'test-private-key-not-real';
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';
  };

  beforeEach(async () => {
    clock.at = START;
    setVapid();
    await db.$executeRawUnsafe('TRUNCATE "PushSubscription", "Notification", "MatchPlayer", "Match", "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
    const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER') =>
      db.user.create({ data: { name, phone, role, passwordHash } }).then((u) => (ids[name] = u.id));
    await Promise.all([
      user('Bình', '0912345678', 'OWNER'),
      user('An', '0901234567', 'USER'),
      user('Quản trị', '0900000001', 'ADMIN'),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const name of VAPID_VARS) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  it('AC-1: An reads the public key, a guest gets 401, and a missing key gives 404', async () => {
    setVapid();
    const ok = await publicKey('An');
    expect(ok.status).toBe(200);
    expect(ok.body satisfies PushPublicKeyResponse).toEqual({ publicKey: PUBLIC_KEY });

    expect((await publicKey(null)).status).toBe(401);

    // The API reads the variable on each request, so a change takes effect without a restart.
    delete process.env.VAPID_PUBLIC_KEY;
    const off = await publicKey('An');
    expect(off.status).toBe(404);
    expect(off.body.message).toBe('Thông báo đẩy chưa bật');

    process.env.VAPID_PUBLIC_KEY = '';
    expect((await publicKey('An')).status).toBe(404);

    setVapid();
    expect((await publicKey('An')).status).toBe(200);
  });

  it('AC-1: the feature is off unless all three VAPID variables are set, for GET and for POST', async () => {
    for (const name of ['VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const) {
      for (const value of [undefined, '', '   ']) {
        setVapid();
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
        const label = `${name}=${JSON.stringify(value)}`;
        const get = await publicKey('An');
        expect(get.status, label).toBe(404);
        expect(get.body.message, label).toBe('Thông báo đẩy chưa bật');
        const post = await subscribe('An', sub(SAMPLE));
        expect(post.status, label).toBe(404);
        expect(post.body.message, label).toBe('Thông báo đẩy chưa bật');
      }
    }
    expect(await countAll()).toBe(0);
    setVapid();
    expect((await publicKey('An')).status).toBe(200);
    expect((await subscribe('An', sub(SAMPLE))).status).toBe(201);
  });

  it('AC-1: every signed-in role reads the key, and the other two routes answer 404 or 401 as the contract says', async () => {
    expect((await publicKey('Bình')).status).toBe(200);
    expect((await publicKey('Quản trị')).status).toBe(200);
    delete process.env.VAPID_PUBLIC_KEY;
    expect((await subscribe('An', sub(SAMPLE))).status).toBe(404);
    expect(await countAll()).toBe(0);
    // Unsubscribe still works when the feature is off, so a user can clean up.
    expect((await unsubscribe('An', { endpoint: SAMPLE })).status).toBe(204);
    expect((await subscribe(null, sub(SAMPLE))).status).toBe(401);
    expect((await unsubscribe(null, { endpoint: SAMPLE })).status).toBe(401);
  });

  it('AC-2: An subscribes once with 201, and the same endpoint again gives 200 and still one row', async () => {
    const first = await subscribe('An', sub(SAMPLE));
    expect(first.status).toBe(201);
    const rows = await db.pushSubscription.findMany({ where: { userId: ids.An } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ endpoint: SAMPLE, p256dh: KEYS.p256dh, auth: KEYS.auth, createdAt: START });

    clock.at = new Date(START.getTime() + 60_000);
    const again = await subscribe('An', { endpoint: SAMPLE, keys: { p256dh: 'newKey', auth: 'newAuth' } });
    expect(again.status).toBe(200);
    const after = await db.pushSubscription.findMany({ where: { userId: ids.An } });
    expect(after).toHaveLength(1);
    // The browser can change its keys. The row takes the new ones and keeps its first createdAt.
    expect(after[0]).toMatchObject({ id: rows[0].id, p256dh: 'newKey', auth: 'newAuth', createdAt: START });
    expect(await countAll()).toBe(1);
  });

  it('AC-2: the response does not echo the endpoint or the keys', async () => {
    const res = await subscribe('An', sub(SAMPLE));
    expect(JSON.stringify(res.body)).not.toContain('fcm.googleapis.com');
    expect(JSON.stringify(res.body)).not.toContain(KEYS.auth);
  });

  it('AC-2: unsubscribe deletes the row of the caller with 204, and a second call is 204 too', async () => {
    await subscribe('An', sub(SAMPLE));
    expect((await unsubscribe('An', { endpoint: SAMPLE })).status).toBe(204);
    expect(await countAll()).toBe(0);
    expect((await unsubscribe('An', { endpoint: SAMPLE })).status).toBe(204);
    expect((await unsubscribe('An', {})).status).toBe(400);
    expect((await unsubscribe('An', { endpoint: 1 })).status).toBe(400);
  });

  it('AC-2: unsubscribe never deletes the row of another user and answers the same 204', async () => {
    await subscribe('An', sub(SAMPLE));
    const res = await unsubscribe('Bình', { endpoint: SAMPLE });
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(await endpointsOf('An')).toEqual([SAMPLE]);
  });

  it('AC-3: Bình takes the endpoint of An on the same browser, and An keeps no subscription', async () => {
    expect((await subscribe('An', sub(SAMPLE))).status).toBe(201);
    clock.at = new Date(START.getTime() + 1000);
    const res = await subscribe('Bình', sub(SAMPLE));
    expect(res.status).toBe(200);
    expect(await endpointsOf('An')).toEqual([]);
    expect(await endpointsOf('Bình')).toEqual([SAMPLE]);
    expect(await countAll()).toBe(1);
  });

  it('AC-3: a taken-over row counts as the newest one of the new owner, so the limit of 5 does not delete it', async () => {
    await subscribe('An', sub(SAMPLE));
    for (let i = 1; i <= 5; i++) {
      clock.at = new Date(START.getTime() + i * 1000);
      await subscribe('Bình', sub(`https://fcm.googleapis.com/fcm/send/b${i}`));
    }
    clock.at = new Date(START.getTime() + 10_000);
    await subscribe('Bình', sub(SAMPLE));
    expect(await endpointsOf('Bình')).toEqual([2, 3, 4, 5].map((i) => `https://fcm.googleapis.com/fcm/send/b${i}`).concat(SAMPLE));
    expect(await endpointsOf('An')).toEqual([]);
  });

  it('AC-4: a body that is not valid gets 400 "Dữ liệu không hợp lệ" and creates no row', async () => {
    const bad = [
      'http://fcm.googleapis.com/x',
      'https://internal.example.com/x',
      'https://169.254.169.254/x',
      'https://fcm.googleapis.com:8443/x',
      'https://user:pw@fcm.googleapis.com/x',
      'https://fcm.googleapis.com.evil.com/x',
      'https://evilnotify.windows.com/x',
      'https://10.0.0.5%2E.push.apple.com/x',
      'https://10.0.0.5%2e.push.apple.com/x',
      'https://FCM.GoogleAPIs.com/x',
    ];
    for (const endpoint of bad) {
      const res = await subscribe('An', sub(endpoint));
      expect(res.status, endpoint).toBe(400);
      expect(res.body.message, endpoint).toBe(Messages.invalid);
    }
    const noAuth = await subscribe('An', { endpoint: SAMPLE, keys: { p256dh: KEYS.p256dh } });
    expect(noAuth.status).toBe(400);
    expect(noAuth.body.message).toBe(Messages.invalid);
    for (const body of [{}, { endpoint: SAMPLE }, { keys: KEYS }, { endpoint: 5, keys: KEYS }, { endpoint: SAMPLE, keys: { p256dh: '', auth: 'a' } }, { endpoint: SAMPLE, keys: { p256dh: 'p'.repeat(201), auth: 'a' } }, { endpoint: SAMPLE, keys: { p256dh: 'p', auth: 'a'.repeat(101) } }]) {
      const res = await subscribe('An', body);
      expect(res.status, JSON.stringify(body).slice(0, 60)).toBe(400);
      expect(res.body.message).toBe(Messages.invalid);
    }
    expect((await http().post('/api/push/subscriptions').set('Cookie', `session=${issueSession(ids.An, clock.now())}`)).status).toBe(400);
    expect(await countAll()).toBe(0);
  });

  it('AC-4: a refused endpoint logs its host only, never the endpoint or the keys', async () => {
    const lines: string[] = [];
    for (const method of ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const) {
      vi.spyOn(Logger.prototype, method).mockImplementation((...args: unknown[]) => void lines.push(args.map(String).join(' ')));
    }
    const secret = 'https://internal.example.com/secret/path?token=abc123';
    expect((await subscribe('An', sub(secret))).status).toBe(400);
    expect((await subscribe('An', sub('not a url with secret-text'))).status).toBe(400);
    expect((await subscribe('An', { endpoint: 42, keys: KEYS })).status).toBe(400);
    const text = lines.join(' | ');
    expect(text).toContain('internal.example.com');
    expect(text).toContain('unparseable');
    for (const leak of ['secret/path', 'token=abc123', 'https://internal', 'secret-text', KEYS.auth, KEYS.p256dh]) {
      expect(text, leak).not.toContain(leak);
    }
  });

  it('AC-4: the endpoints of Windows and Apple pass', async () => {
    expect((await subscribe('An', sub('https://wns2-par02p.notify.windows.com/x'))).status).toBe(201);
    expect((await subscribe('An', sub('https://web.push.apple.com/x'))).status).toBe(201);
    expect(await endpointsOf('An')).toEqual(['https://wns2-par02p.notify.windows.com/x', 'https://web.push.apple.com/x']);
  });

  it('AC-5: a sixth subscription deletes the oldest one, by createdAt and then id', async () => {
    for (let i = 1; i <= 5; i++) {
      expect((await subscribe('An', sub(`https://fcm.googleapis.com/fcm/send/e${i}`))).status).toBe(201);
      clock.at = new Date(clock.at.getTime() + 1000);
    }
    expect(await endpointsOf('An')).toHaveLength(5);
    const six = await subscribe('An', sub('https://fcm.googleapis.com/fcm/send/e6'));
    expect(six.status).toBe(201);
    expect(await endpointsOf('An')).toEqual([2, 3, 4, 5, 6].map((i) => `https://fcm.googleapis.com/fcm/send/e${i}`));
  });

  it('AC-5: the limit counts one user at a time, and a repeated endpoint does not push a row out', async () => {
    for (let i = 1; i <= 5; i++) {
      await subscribe('An', sub(`https://fcm.googleapis.com/fcm/send/e${i}`));
      clock.at = new Date(clock.at.getTime() + 1000);
    }
    await subscribe('Bình', sub('https://fcm.googleapis.com/fcm/send/b1'));
    expect(await endpointsOf('An')).toHaveLength(5);
    expect((await subscribe('An', sub('https://fcm.googleapis.com/fcm/send/e3'))).status).toBe(200);
    expect(await endpointsOf('An')).toHaveLength(5);
    expect(await endpointsOf('Bình')).toEqual(['https://fcm.googleapis.com/fcm/send/b1']);
  });

  it('AC-5: rows with the same createdAt go in the order of id', async () => {
    // The clock does not move, so all six rows share one createdAt. The id decides: it is time-ordered (uuid v7).
    for (let i = 1; i <= 6; i++) {
      expect((await subscribe('An', sub(`https://fcm.googleapis.com/fcm/send/t${i}`))).status).toBe(201);
    }
    const left = await db.pushSubscription.findMany({ where: { userId: ids.An }, orderBy: { id: 'asc' } });
    expect(left).toHaveLength(5);
    expect(left.map((row) => row.endpoint)).not.toContain('https://fcm.googleapis.com/fcm/send/t1');
  });

  it('AC-5: two users at 5 devices swap their oldest endpoints in parallel, with no 5xx and at most 5 rows each', async () => {
    for (let round = 0; round < 4; round++) {
      await db.pushSubscription.deleteMany();
      clock.at = new Date(START.getTime() + round * 100_000);
      for (let i = 1; i <= 5; i++) {
        await subscribe('An', sub(`https://fcm.googleapis.com/fcm/send/a${i}`));
        await subscribe('Bình', sub(`https://fcm.googleapis.com/fcm/send/b${i}`));
        clock.at = new Date(clock.at.getTime() + 1000);
      }
      const results = await Promise.all([
        subscribe('An', sub('https://fcm.googleapis.com/fcm/send/b1')),
        subscribe('Bình', sub('https://fcm.googleapis.com/fcm/send/a1')),
        subscribe('An', sub('https://fcm.googleapis.com/fcm/send/b2')),
        subscribe('Bình', sub('https://fcm.googleapis.com/fcm/send/a2')),
      ]);
      for (const res of results) expect(res.status, `round ${round}`).toBeLessThan(500);
      expect(await db.pushSubscription.count({ where: { userId: ids.An } })).toBeLessThanOrEqual(5);
      expect(await db.pushSubscription.count({ where: { userId: ids['Bình'] } })).toBeLessThanOrEqual(5);
      // An endpoint belongs to one user at most.
      expect(await db.pushSubscription.count()).toBeLessThanOrEqual(10);
    }
  });

  it('AC-5: parallel subscriptions of one user never leave more than 5 rows', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => subscribe('An', sub(`https://fcm.googleapis.com/fcm/send/p${i}`))),
    );
    // The service locks the user row, so the writes of one user run one after another.
    for (const res of results) expect(res.status).toBe(201);
    expect(await db.pushSubscription.count({ where: { userId: ids.An } })).toBe(5);
  });
});
