import 'reflect-metadata';
import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import type { NotificationsListResponse, PushPayload } from '@monsport/shared';
import request from 'supertest';
import webpush from 'web-push';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { type PushOptions, PushSender, PushSendError, type PushTarget, type PushVapid, WebPushSender } from './push-sender.js';
import { PushService } from './push.service.js';

const vn = (hhmm: string, day = '2026-11-20') => `${day}T${hhmm.length === 5 ? `${hhmm}:00` : hhmm}+07:00`;
const clock = { at: new Date(vn('10:00')), now() { return this.at; } };
const KEYS = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };
const EP = (name: string) => `https://fcm.googleapis.com/fcm/send/${name}`;
// A real pair: PushService checks the three values with web-push at start up. The pair is made for this run and is no secret.
const PAIR = webpush.generateVAPIDKeys();
const VAPID = { VAPID_PUBLIC_KEY: PAIR.publicKey, VAPID_PRIVATE_KEY: PAIR.privateKey, VAPID_SUBJECT: 'mailto:test@example.com' };

type Call = { sub: PushTarget; payload: PushPayload; vapid: PushVapid; options: PushOptions };

/** Records each call. `answer` decides the result: a status code, or a promise that never settles. */
class FakeSender extends PushSender {
  calls: Call[] = [];
  answer: (call: Call) => Promise<{ statusCode: number }> = async () => ({ statusCode: 201 });
  reset(): void {
    this.calls = [];
    this.answer = async () => ({ statusCode: 201 });
  }
  send(sub: PushTarget, payload: PushPayload, vapid: PushVapid, options: PushOptions): Promise<{ statusCode: number }> {
    const call = { sub, payload, vapid, options };
    this.calls.push(call);
    return this.answer(call);
  }
  to(endpoint: string): Call[] {
    return this.calls.filter((call) => call.sub.endpoint === endpoint);
  }
}

const fake = new FakeSender();
const never = () => new Promise<{ statusCode: number }>(() => undefined);

/** Sets environment variables and returns the function that restores them. */
function setEnv(values: Record<string, string | undefined>): () => void {
  const saved = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  return () => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}

async function boot(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Clock)
    .useValue(clock)
    .overrideProvider(PushSender)
    .useValue(fake)
    .compile();
  const created = setupApp(moduleRef.createNestApplication());
  await created.init();
  return created;
}

/** Polls a condition. Delivery runs after the response, so the tests wait for the effect and never for a fixed time. */
async function waitFor(condition: () => boolean | Promise<boolean>, label: string, limitMs = 5_000): Promise<void> {
  const end = Date.now() + limitMs;
  while (!(await condition())) {
    if (Date.now() > end) throw new Error(`Timed out after ${limitMs} ms: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

let app: INestApplication;
let db: PrismaService;
let passwordHash: string;
const ids: Record<string, string> = {};
const http = () => request(app.getHttpServer());
const as = (who: string | null) => (r: request.Test) => (who ? r.set('Cookie', `session=${issueSession(ids[who], clock.now())}`) : r);
const requestBooking = (who: string, body: Record<string, unknown>) => as(who)(http().post('/api/bookings')).send(body);
const confirmBooking = (who: string, id: string) => as(who)(http().post(`/api/owner/bookings/${id}/confirm`));
const rejectBooking = (who: string, id: string) => as(who)(http().post(`/api/owner/bookings/${id}/reject`));
const openMatch = (who: string, body: Record<string, unknown>) => as(who)(http().post('/api/matches')).send(body);
const joinMatch = (who: string, id: string) => as(who)(http().post(`/api/matches/${id}/join`));
const cancelMatch = (who: string, id: string) => as(who)(http().post(`/api/matches/${id}/cancel`));
const listNotifications = async (who: string) => (await as(who)(http().get('/api/notifications')).expect(200)).body as NotificationsListResponse;

async function book(who: string, start: string, end: string): Promise<string> {
  const startAt = new Date(vn(start));
  const row = await db.booking.create({
    data: {
      courtId: ids.A1,
      startAt,
      endAt: new Date(vn(end)),
      status: 'PENDING',
      source: 'APP',
      createdById: ids[who],
      priceTotal: 80_000,
      confirmDeadline: new Date(startAt.getTime() - 3_600_000),
      createdAt: new Date(vn('08:00')),
    },
  });
  return row.id;
}

const subscribeDevice = (who: string, endpoint: string) =>
  db.pushSubscription.create({ data: { userId: ids[who], endpoint, p256dh: KEYS.p256dh, auth: KEYS.auth, createdAt: clock.now() } });
const insertNotification = (who: string, bookingId: string, type: 'BOOKING_REQUESTED' | 'BOOKING_CONFIRMED' | 'BOOKING_REJECTED' | 'MATCH_CANCELLED' = 'BOOKING_CONFIRMED') =>
  db.notification.create({ data: { userId: ids[who], type, bookingId, createdAt: clock.now() } });

/** Waits until every Notification row has been claimed (n rows), then until each running delivery has ended. */
async function settle(rows: number, ...apps: INestApplication[]): Promise<void> {
  await waitFor(async () => (await db.notification.count()) === rows && (await db.notification.count({ where: { pushedAt: null } })) === 0, `${rows} notifications claimed`);
  await Promise.all((apps.length > 0 ? apps : [app]).map((each) => each.get(PushService).idle()));
}

const sessions = async (): Promise<number> =>
  (await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = 'monsport-push' AND datname = current_database()`)[0].n;

async function seed(): Promise<void> {
  clock.at = new Date(vn('10:00'));
  fake.reset();
  await db.$executeRawUnsafe('TRUNCATE "PushSubscription", "Notification", "MatchPlayer", "Match", "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
  const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER', extra: { lockedAt?: Date; deletedAt?: Date } = {}) =>
    db.user.create({ data: { name, phone, role, passwordHash, ...extra } }).then((u) => (ids[name] = u.id));
  await Promise.all([
    user('Bình', '0912345678', 'OWNER'),
    user('An', '0901234567', 'USER'),
    user('Chi', '0901234568', 'USER'),
    user('Lan', '0901234569', 'USER'),
    user('Mai', '0901234570', 'USER', { lockedAt: new Date(vn('09:00')) }),
    user('Dũng', '0901234571', 'USER', { deletedAt: new Date(vn('09:00')) }),
  ]);
  const venue = await db.venue.create({
    data: { ownerId: ids['Bình'], name: 'Cầu lông A', address: '10 Nguyễn Huệ', phone: '0911111111', opensAt: 360, closesAt: 1380 },
  });
  ids.A1 = (await db.court.create({ data: { venueId: venue.id, name: 'Sân 1', sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 } })).id;
}

describe('push sender (F-014 step 2)', () => {
  let restoreEnv: () => void;

  beforeAll(async () => {
    passwordHash = await hash('test-password');
    restoreEnv = setEnv({ ...VAPID, PUSH_TIMEOUT_MS: '200' });
    app = await boot();
    db = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
    restoreEnv?.();
  });

  beforeEach(seed);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Captures every Nest log line. A line must not hold an endpoint, a key, or a payload. */
  const captureLogs = (): string[] => {
    const lines: string[] = [];
    for (const method of ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const) {
      vi.spyOn(Logger.prototype, method).mockImplementation((...args: unknown[]) => void lines.push(args.map(String).join(' ')));
    }
    return lines;
  };

  it('AC-6: a booking request sends one push to the owner, with the text of the notification in the app and no phone number', async () => {
    await subscribeDevice('An', EP('e-an'));
    await subscribeDevice('Bình', EP('e-binh'));
    await requestBooking('An', { courtId: ids.A1, startAt: vn('20:00'), endAt: vn('21:00') }).expect(201);

    await waitFor(() => fake.calls.length > 0, 'push to the owner');
    await settle(1);
    expect(fake.calls).toHaveLength(1);
    const [call] = fake.calls;
    expect(call.sub).toEqual({ endpoint: EP('e-binh'), p256dh: KEYS.p256dh, auth: KEYS.auth });
    expect(call.options).toEqual({ ttl: 3600, urgency: 'high', timeoutMs: 200 });
    expect(call.vapid).toEqual({ publicKey: VAPID.VAPID_PUBLIC_KEY, privateKey: VAPID.VAPID_PRIVATE_KEY, subject: VAPID.VAPID_SUBJECT });

    const [item] = (await listNotifications('Bình')).items;
    expect(item.type).toBe('BOOKING_REQUESTED');
    expect(call.payload).toEqual({ title: item.title, body: item.message, notificationId: item.id });
    expect(call.payload.title).toBe('Yêu cầu đặt sân mới');
    expect(call.payload.body).toBe('Có yêu cầu đặt sân tại Cầu lông A - Sân 1 khung 20:00 - 21:00 ngày 20/11/2026.');
    const json = JSON.stringify(call.payload);
    expect(Object.keys(call.payload).sort()).toEqual(['body', 'notificationId', 'title']);
    expect(json).not.toMatch(/\d{9,}/);
    for (const phone of ['0901234567', '0912345678', '0911111111']) expect(json).not.toContain(phone);
    expect(await db.notification.count({ where: { pushedAt: null } })).toBe(0);
  });

  it('AC-7: confirm, reject, and match cancel each send one push to the people who get the notification', async () => {
    await subscribeDevice('An', EP('e-an'));
    await subscribeDevice('Lan', EP('e-lan'));

    const confirmed = await book('An', '14:00', '15:00');
    await confirmBooking('Bình', confirmed).expect(200);
    await waitFor(() => fake.calls.length > 0, 'push for the confirmation');
    await settle(1);
    expect(fake.calls.map((c) => [c.sub.endpoint, c.payload.title])).toEqual([[EP('e-an'), 'Yêu cầu đặt sân đã được xác nhận']]);

    fake.calls = [];
    const rejected = await book('An', '16:00', '17:00');
    await rejectBooking('Bình', rejected).expect(200);
    await waitFor(() => fake.calls.length > 0, 'push for the refusal');
    await settle(2);
    expect(fake.calls.map((c) => [c.sub.endpoint, c.payload.title])).toEqual([[EP('e-an'), 'Yêu cầu đặt sân bị từ chối']]);

    fake.calls = [];
    const hosted = await book('Lan', '20:00', '21:00');
    const match = await openMatch('Lan', { bookingId: hosted, capacity: 4, pricePerSlot: 50_000 }).expect(201);
    await joinMatch('An', match.body.id as string).expect(200);
    await cancelMatch('Lan', match.body.id as string).expect(200);
    await waitFor(() => fake.calls.length >= 2, 'push to both players');
    await settle(4);
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls.map((c) => c.sub.endpoint).sort()).toEqual([EP('e-an'), EP('e-lan')]);
    for (const who of ['An', 'Lan']) {
      const inApp = (await listNotifications(who)).items.find((item) => item.type === 'MATCH_CANCELLED')!;
      const pushed = fake.to(EP(who === 'An' ? 'e-an' : 'e-lan'))[0];
      expect(pushed.payload).toEqual({ title: 'Trận đấu đã bị hủy', body: inApp.message, notificationId: inApp.id });
    }
  });

  it('AC-8: two instances on one database send one push for one notification', async () => {
    const other = await boot();
    try {
      expect(await sessions()).toBeGreaterThanOrEqual(2);
      await subscribeDevice('An', EP('e-an'));
      const bookingId = await book('Chi', '18:00', '19:00');
      await insertNotification('An', bookingId);
      await waitFor(() => fake.calls.length > 0, 'one push');
      await settle(1, app, other);
      expect(fake.calls).toHaveLength(1);
      expect((await db.notification.findFirstOrThrow()).pushedAt).not.toBeNull();

      // Several rows: each one goes out once in all, so no row is sent by both instances.
      for (let i = 0; i < 4; i++) await insertNotification('An', bookingId);
      await waitFor(() => fake.calls.length >= 5, 'five pushes');
      await settle(5, app, other);
      expect(fake.calls).toHaveLength(5);
      expect(new Set(fake.calls.map((c) => c.payload.notificationId)).size).toBe(5);
    } finally {
      await other.close();
    }
  });

  it('AC-8: a payload that is not a uuid is ignored, and the row is not claimed twice', async () => {
    await subscribeDevice('An', EP('e-an'));
    const bookingId = await book('Chi', '18:00', '19:00');
    await db.$executeRaw`SELECT pg_notify('push', 'not-a-uuid')`;
    await db.$executeRaw`SELECT pg_notify('push', '')`;
    const row = await insertNotification('An', bookingId);
    await waitFor(() => fake.calls.length > 0, 'push for the real row');
    await settle(1);
    // A second event for a claimed row finds no row to claim.
    await db.$executeRaw`SELECT pg_notify('push', ${row.id})`;
    await app.get(PushService).idle();
    await app.get(PushService).handle(row.id);
    expect(fake.calls).toHaveLength(1);
  });

  for (const status of [410, 404]) {
    it(`AC-9: the push service answers ${status}, the device row is deleted, and the request still succeeds`, async () => {
      await subscribeDevice('An', EP('e-an'));
      await subscribeDevice('An', EP('e-an-2'));
      fake.answer = async (call) => ({ statusCode: call.sub.endpoint === EP('e-an') ? status : 201 });
      const bookingId = await book('An', '20:00', '21:00');
      await confirmBooking('Bình', bookingId).expect(200);
      await waitFor(() => fake.calls.length >= 2, 'both devices called');
      await waitFor(async () => (await db.pushSubscription.count({ where: { endpoint: EP('e-an') } })) === 0, 'the gone device deleted');
      await settle(1);
      expect((await db.pushSubscription.findMany({ select: { endpoint: true } })).map((row) => row.endpoint)).toEqual([EP('e-an-2')]);
      expect((await listNotifications('An')).items).toHaveLength(1);
    });
  }

  it('AC-9: a row whose endpoint is no longer allowed is deleted and never sent', async () => {
    await db.pushSubscription.create({ data: { userId: ids.An, endpoint: 'https://internal.example.com/x', ...KEYS, createdAt: clock.now() } });
    await db.pushSubscription.create({ data: { userId: ids.An, endpoint: 'https://fcm.googleapis.com:8443/x', ...KEYS, createdAt: clock.now() } });
    await db.pushSubscription.create({ data: { userId: ids.An, endpoint: 'http://169.254.169.254/latest', ...KEYS, createdAt: clock.now() } });
    await subscribeDevice('An', EP('e-an'));
    const lines = captureLogs();
    const bookingId = await book('An', '20:00', '21:00');
    await confirmBooking('Bình', bookingId).expect(200);
    await waitFor(() => fake.calls.length > 0, 'push to the allowed device');
    await waitFor(async () => (await db.pushSubscription.count()) === 1, 'refused rows deleted');
    await settle(1);
    expect(fake.calls.map((c) => c.sub.endpoint)).toEqual([EP('e-an')]);
    expect((await db.pushSubscription.findMany()).map((row) => row.endpoint)).toEqual([EP('e-an')]);
    const text = lines.join(' | ');
    for (const leak of ['internal.example.com', '169.254.169.254', '8443']) expect(text, leak).not.toContain(leak);
  });

  it('AC-10: the push service answers 500, the device stays, and the notification and the request are fine', async () => {
    await subscribeDevice('An', EP('e-an'));
    fake.answer = async () => ({ statusCode: 500 });
    const lines = captureLogs();
    const bookingId = await book('An', '20:00', '21:00');
    await confirmBooking('Bình', bookingId).expect(200);
    await waitFor(() => fake.calls.length > 0, 'push attempt');
    await settle(1);
    expect(await db.pushSubscription.count({ where: { endpoint: EP('e-an') } })).toBe(1);
    expect((await listNotifications('An')).items).toHaveLength(1);
    const text = lines.join(' | ');
    expect(text).toContain('500');
    for (const leak of ['fcm.googleapis.com', 'e-an', KEYS.auth, KEYS.p256dh, 'notificationId']) expect(text, leak).not.toContain(leak);
  });

  it('AC-10: the push service does not answer within PUSH_TIMEOUT_MS, and the device and the request are fine', async () => {
    await subscribeDevice('An', EP('e-an'));
    fake.answer = never;
    const lines = captureLogs();
    const bookingId = await book('An', '20:00', '21:00');
    const started = Date.now();
    await confirmBooking('Bình', bookingId).expect(200);
    expect(Date.now() - started).toBeLessThan(5_000);
    await waitFor(() => fake.calls.length > 0, 'push attempt');
    await settle(1);
    expect(await db.pushSubscription.count({ where: { endpoint: EP('e-an') } })).toBe(1);
    expect((await listNotifications('An')).items).toHaveLength(1);
    expect(lines.join(' | ')).toContain('timeout');
    expect(lines.join(' | ')).not.toContain('fcm.googleapis.com');
  });

  it('AC-10: a sender that throws leaves the device in place and the log without the endpoint', async () => {
    await subscribeDevice('An', EP('e-an'));
    fake.answer = async () => {
      throw new Error('connect ECONNREFUSED https://fcm.googleapis.com/fcm/send/e-an');
    };
    const lines = captureLogs();
    const bookingId = await book('An', '20:00', '21:00');
    await confirmBooking('Bình', bookingId).expect(200);
    await waitFor(() => fake.calls.length > 0, 'push attempt');
    await settle(1);
    expect(await db.pushSubscription.count()).toBe(1);
    expect(lines.join(' | ')).not.toContain('fcm.googleapis.com');
  });

  it('AC-11: no device, a locked user, and a deleted user get no push and no error, and the user with a device gets one', async () => {
    await subscribeDevice('Mai', EP('e-mai'));
    await subscribeDevice('Dũng', EP('e-dung'));
    await subscribeDevice('An', EP('e-an'));
    const lines = captureLogs();
    const bookingId = await book('An', '20:00', '21:00');
    for (const who of ['Chi', 'Mai', 'Dũng', 'An']) await insertNotification(who, bookingId);
    await waitFor(() => fake.calls.length > 0, 'push to An');
    await settle(4);
    expect(fake.calls.map((c) => c.sub.endpoint)).toEqual([EP('e-an')]);
    expect(lines.filter((line) => /error|failed/i.test(line))).toEqual([]);
  });

  it('AC-12 (sender): an endpoint that is not allowed is never called, and a status or a timeout comes back without the endpoint', async () => {
    const sender = new WebPushSender();
    const spy = vi.spyOn(webpush, 'sendNotification');
    const payload = { title: 't', body: 'b', notificationId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b' };
    const vapid = { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:test@example.com' };
    const options = { ttl: 3600, urgency: 'high' as const, timeoutMs: 123 };
    await expect(sender.send({ endpoint: 'https://internal.example.com/x', ...KEYS }, payload, vapid, options)).resolves.toEqual({ statusCode: 400 });
    await expect(sender.send({ endpoint: 'https://fcm.googleapis.com:8443/x', ...KEYS }, payload, vapid, options)).resolves.toEqual({ statusCode: 400 });
    expect(spy).not.toHaveBeenCalled();

    const target = { endpoint: EP('e-an'), ...KEYS };
    spy.mockResolvedValueOnce({ statusCode: 201, body: '', headers: {} });
    await expect(sender.send(target, payload, vapid, options)).resolves.toEqual({ statusCode: 201 });
    expect(spy).toHaveBeenCalledWith({ endpoint: EP('e-an'), keys: KEYS }, JSON.stringify(payload), {
      vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
      TTL: 3600,
      urgency: 'high',
      timeout: 123,
    });

    spy.mockRejectedValueOnce(new webpush.WebPushError('Received unexpected response code', 410, {}, 'gone', EP('e-an')));
    await expect(sender.send(target, payload, vapid, options)).resolves.toEqual({ statusCode: 410 });

    spy.mockRejectedValueOnce(new Error('Socket timeout'));
    const timeout = await sender.send(target, payload, vapid, options).catch((e: unknown) => e);
    expect(timeout).toBeInstanceOf(PushSendError);
    expect((timeout as PushSendError).kind).toBe('timeout');

    spy.mockRejectedValueOnce(Object.assign(new Error(`connect ECONNREFUSED ${EP('e-an')}`), { code: 'ECONNREFUSED' }));
    const network = (await sender.send(target, payload, vapid, options).catch((e: unknown) => e)) as PushSendError;
    expect(network.kind).toBe('network');
    expect(network.message).not.toContain('fcm.googleapis.com');

    // An error with no code and no status comes from web-push before the request: a bad key.
    spy.mockRejectedValueOnce(new Error('Vapid private key should be 32 bytes long when decoded.'));
    const invalid = (await sender.send(target, payload, vapid, options).catch((e: unknown) => e)) as PushSendError;
    expect(invalid).toBeInstanceOf(PushSendError);
    expect(invalid.kind).toBe('invalid');

    // A device key of the right length that is not on the curve fails inside the crypto library with an ERR_CRYPTO_ code.
    spy.mockRejectedValueOnce(Object.assign(new Error('Failed to translate Buffer to a EC_POINT'), { code: 'ERR_CRYPTO_ECDH_INVALID_PUBLIC_KEY' }));
    const badPoint = (await sender.send(target, payload, vapid, options).catch((e: unknown) => e)) as PushSendError;
    expect(badPoint.kind).toBe('invalid');
  });

  it('AC-10 (sender): a bad VAPID key or a bad key of the device fails before the request as kind invalid', async () => {
    const sender = new WebPushSender();
    const payload = { title: 't', body: 'b', notificationId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b' };
    const options = { ttl: 3600, urgency: 'high' as const, timeoutMs: 123 };
    const good = { publicKey: PAIR.publicKey, privateKey: PAIR.privateKey, subject: 'mailto:test@example.com' };
    const badVapid = await sender.send({ endpoint: EP('e-an'), ...KEYS }, payload, { ...good, privateKey: 'not-a-key' }, options).catch((e: unknown) => e);
    expect((badVapid as PushSendError).kind).toBe('invalid');
    const badDevice = await sender.send({ endpoint: EP('e-an'), p256dh: 'AAAA', auth: KEYS.auth }, payload, good, options).catch((e: unknown) => e);
    expect((badDevice as PushSendError).kind).toBe('invalid');
  });

  it('AC-10: an invalid key error keeps the device row and logs invalid key data', async () => {
    await subscribeDevice('An', EP('e-an'));
    fake.answer = async () => {
      throw new PushSendError('invalid');
    };
    const lines = captureLogs();
    const bookingId = await book('An', '20:00', '21:00');
    await confirmBooking('Bình', bookingId).expect(200);
    await waitFor(() => fake.calls.length > 0, 'push attempt');
    await settle(1);
    expect(await db.pushSubscription.count()).toBe(1);
    expect(lines.join(' | ')).toContain('Push send failed (invalid key data)');
  });
});

describe('push sender without VAPID keys (F-014 step 2)', () => {
  let restoreEnv: () => void;

  beforeAll(async () => {
    passwordHash = await hash('test-password');
    restoreEnv = setEnv({ VAPID_PUBLIC_KEY: undefined, VAPID_PRIVATE_KEY: undefined, VAPID_SUBJECT: undefined });
    // The apps of the tests before this block are closed. Wait until Postgres has dropped their sessions too.
    const probe = await boot();
    await waitFor(async () => (await probe.get(PrismaService).$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = 'monsport-push' AND datname = current_database()`)[0].n === 0, 'earlier LISTEN sessions closed');
    await probe.close();
    app = await boot();
    db = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
    restoreEnv?.();
  });

  beforeEach(seed);

  it('AC-12: the API starts without the keys, opens no push session, takes a booking request, and sends nothing', async () => {
    expect(await sessions()).toBe(0);
    await subscribeDevice('Bình', EP('e-binh'));
    await requestBooking('An', { courtId: ids.A1, startAt: vn('20:00'), endAt: vn('21:00') }).expect(201);
    // No instance listens, so no one claims the row. Handling a row by hand shows that the service sends nothing either way.
    expect(await db.notification.count()).toBe(1);
    const row = await db.notification.findFirstOrThrow();
    expect(row.pushedAt).toBeNull();
    await app.get(PushService).idle();
    expect(fake.calls).toEqual([]);
    expect(await sessions()).toBe(0);
    expect(await db.pushSubscription.count()).toBe(1);
  });
});

describe('push sender with invalid VAPID keys (F-014 step 2)', () => {
  let restoreEnv: () => void;

  beforeAll(async () => {
    passwordHash = await hash('test-password');
    // Set, non-empty, and not a key: the start up check of web-push refuses all three shapes below.
    restoreEnv = setEnv({ VAPID_PUBLIC_KEY: 'not-a-public-key', VAPID_PRIVATE_KEY: 'not-a-private-key', VAPID_SUBJECT: 'mailto:test@example.com' });
    const probe = await boot();
    await waitFor(async () => (await probe.get(PrismaService).$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = 'monsport-push' AND datname = current_database()`)[0].n === 0, 'earlier LISTEN sessions closed');
    await probe.close();
    app = await boot();
    db = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
    restoreEnv?.();
  });

  beforeEach(seed);

  it('AC-12: invalid VAPID keys at start up keep Web Push off, with no push session, and a booking request still succeeds', async () => {
    expect(await sessions()).toBe(0);
    await subscribeDevice('Bình', EP('e-binh'));
    await requestBooking('An', { courtId: ids.A1, startAt: vn('20:00'), endAt: vn('21:00') }).expect(201);
    await app.get(PushService).idle();
    expect((await db.notification.findFirstOrThrow()).pushedAt).toBeNull();
    expect(fake.calls).toEqual([]);
    expect(await sessions()).toBe(0);
    expect(await db.pushSubscription.count()).toBe(1);
  });
});
