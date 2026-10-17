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

// Data of brief F-007: Bình runs "Cầu lông A" (06:00-23:00, "Sân 1" and "Sân 2" at 80.000đ and 120.000đ),
// Dũng runs "Cầu lông B" with its own "Sân 1". Now is 20/11/2026 10:00, and every time below is on that day.
const vn = (hhmm: string) => `2026-11-20T${hhmm}:00+07:00`;
const clock = { at: new Date(vn('10:00')), now() { return this.at; } };
const TAKEN = 'Khung giờ này vừa có người đặt';
const MISSING = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

let app: INestApplication;
let db: PrismaService;
const ids: Record<string, string> = {};
const http = () => request(app.getHttpServer());
const cookie = (who: string) => `session=${issueSession(ids[who], clock.now())}`;
const as = (who: string | null) => (r: request.Test) => (who ? r.set('Cookie', cookie(who)) : r);
const enter = (who: string | null, start: string, end: string, extra: object = {}, court = 'A1') =>
  as(who)(http().post('/api/owner/bookings')).send({ courtId: ids[court] ?? court, startAt: vn(start), endAt: vn(end), ...extra });
const cancel = (who: string | null, id: string) => as(who)(http().post(`/api/owner/bookings/${id}/cancel`));
const ask = (start: string, end: string) => as('An')(http().post('/api/bookings')).send({ courtId: ids.A1, startAt: vn(start), endAt: vn(end) });
const count = () => db.booking.count();

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
  clock.at = new Date(vn('10:00'));
  await db.$executeRawUnsafe('TRUNCATE "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
  const passwordHash = await hash('test-password');
  const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER') =>
    db.user.create({ data: { name, phone, role, passwordHash } }).then((u) => (ids[name] = u.id));
  await Promise.all([
    user('admin', '0900000000', 'ADMIN'),
    user('Bình', '0912345678', 'OWNER'),
    user('Dũng', '0912345679', 'OWNER'),
    user('An', '0901234567', 'USER'),
  ]);
  const prices = { sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 } as const;
  const a = await db.venue.create({ data: { ownerId: ids['Bình'], name: 'Cầu lông A', address: 'A', phone: '0912345678', opensAt: 360, closesAt: 1380 } });
  const b = await db.venue.create({ data: { ownerId: ids['Dũng'], name: 'Cầu lông B', address: 'B', phone: '0912345679', opensAt: 360, closesAt: 1380 } });
  ids.A1 = (await db.court.create({ data: { venueId: a.id, name: 'Sân 1', ...prices } })).id;
  ids.A2 = (await db.court.create({ data: { venueId: a.id, name: 'Sân 2', ...prices } })).id;
  ids.B1 = (await db.court.create({ data: { venueId: b.id, name: 'Sân 1', ...prices } })).id;
});

describe('POST /api/owner/bookings', () => {
  it('AC-1: Bình enters 17:00-18:00 for "Chú Tư", and it is confirmed at once at the peak price', async () => {
    const res = await enter('Bình', '17:00', '18:00', { customerName: 'Chú Tư', customerPhone: '0987654321' }).expect(201);
    expect(res.body).toMatchObject({
      courtId: ids.A1,
      status: 'CONFIRMED',
      source: 'PHONE',
      priceTotal: 120_000,
      confirmedAt: new Date(vn('10:00')).toISOString(),
      confirmDeadline: null,
      cancelledAt: null,
      customer: { name: 'Chú Tư', phone: '0987654321' },
    });
    expect((await db.booking.findUniqueOrThrow({ where: { id: res.body.id } })).createdById).toBe(ids['Bình']);
  });

  it('AC-2: a booking without a name and a phone, or with spaces and an empty phone, stores null', async () => {
    const plain = await enter('Bình', '18:00', '19:00').expect(201);
    const blank = await enter('Bình', '19:00', '20:00', { customerName: '   ', customerPhone: '' }).expect(201);
    for (const res of [plain, blank]) {
      expect(res.body.customer).toEqual({ name: '', phone: null });
      const row = await db.booking.findUniqueOrThrow({ where: { id: res.body.id } });
      expect([row.customerName, row.customerPhone]).toEqual([null, null]);
    }
  });

  it('AC-3: a slot that overlaps a pending request is refused, and the next slot is free', async () => {
    await ask('20:00', '21:00').expect(201);
    expect((await enter('Bình', '20:30', '21:30').expect(409)).body.message).toBe(TAKEN);
    await enter('Bình', '21:00', '22:00').expect(201);
  });

  it('AC-4: 20 parallel entries of one slot give exactly one 201', async () => {
    const responses = await Promise.all(Array.from({ length: 20 }, () => enter('Bình', '17:00', '18:00').then((r) => r)));
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    const refused = responses.filter((r) => r.status === 409);
    expect(refused).toHaveLength(19);
    expect(refused.every((r) => r.body.message === TAKEN)).toBe(true);
    expect(await db.booking.count({ where: { startAt: new Date(vn('17:00')) } })).toBe(1);
  });

  it('AC-5: a request past its deadline expires, and the owner takes its slot', async () => {
    clock.at = new Date(vn('14:00'));
    const request = await ask('17:00', '18:00').expect(201);
    expect(request.body.confirmDeadline).toBe(new Date(vn('16:00')).toISOString());
    clock.at = new Date(vn('16:30'));
    const res = await enter('Bình', '17:00', '18:00').expect(201);
    expect(res.body.status).toBe('CONFIRMED');
    expect((await db.booking.findUniqueOrThrow({ where: { id: request.body.id } })).status).toBe('EXPIRED');
  });

  it('AC-6: wrong times, a past start, a wrong phone, a long name, and an unknown key are refused', async () => {
    const cases: [() => request.Test, string][] = [
      [() => enter('Bình', '17:15', '18:15'), 'Giờ phải theo bước 30 phút'],
      [() => enter('Bình', '17:00', '17:30'), 'Mỗi booking dài ít nhất 1 giờ'],
      [() => enter('Bình', '05:00', '06:00'), 'Ngoài giờ mở cửa'],
      [() => enter('Bình', '22:30', '23:30'), 'Ngoài giờ mở cửa'],
      [() => enter('Bình', '09:30', '10:30'), 'Giờ bắt đầu đã qua'],
      [() => enter('Bình', '10:00', '11:00'), 'Giờ bắt đầu đã qua'],
      [() => enter('Bình', '17:00', '18:00', { customerPhone: '12345' }), 'Số điện thoại có 10 chữ số và bắt đầu bằng 0'],
      [() => enter('Bình', '17:00', '18:00', { customerName: 'a'.repeat(101) }), 'Dữ liệu đặt sân không hợp lệ'],
      [() => enter('Bình', '17:00', '18:00', { status: 'PENDING' }), 'Dữ liệu đặt sân không hợp lệ'],
    ];
    for (const [req, message] of cases) expect((await req().expect(400)).body.message).toBe(message);
    expect(await count()).toBe(0);
  });

  it('AC-7: a court of another owner, or one that does not exist, answers 404', async () => {
    expect((await enter('Bình', '17:00', '18:00', {}, 'B1').expect(404)).body.message).toBe('Không tìm thấy sân');
    expect((await enter('Bình', '17:00', '18:00', {}, MISSING).expect(404)).body.message).toBe('Không tìm thấy sân');
    expect(await count()).toBe(0);
  });

  it('AC-8: a user, the admin, and a request without a cookie cannot use the owner routes', async () => {
    const booking = (await enter('Bình', '17:00', '18:00').expect(201)).body.id as string;
    for (const [who, status] of [['An', 403], ['admin', 403], [null, 401]] as const) {
      await enter(who, '19:00', '20:00').expect(status);
      await cancel(who, booking).expect(status);
    }
    expect(await count()).toBe(1);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking } })).status).toBe('CONFIRMED');
  });

  it('AC-13: 10 user requests and 10 owner entries of one slot at once give exactly one 201 and no 500', async () => {
    const all = [
      ...Array.from({ length: 10 }, () => ask('20:00', '21:00').then((r) => r)),
      ...Array.from({ length: 10 }, () => enter('Bình', '20:00', '21:00').then((r) => r)),
    ];
    const responses = await Promise.all(all);
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409 && r.body.message === TAKEN)).toHaveLength(19);
    expect(await db.booking.count({ where: { startAt: new Date(vn('20:00')) } })).toBe(1);
  });

  it('AC-14: Bình enters a booking that starts within 1 hour', async () => {
    await enter('Bình', '10:30', '11:30').expect(201);
  });
});

describe('POST /api/owner/bookings/:id/cancel', () => {
  it('AC-9: Bình cancels a phone booking, and the slot is free again', async () => {
    const id = (await enter('Bình', '17:00', '18:00', { customerName: 'Chú Tư' }).expect(201)).body.id as string;
    const res = await cancel('Bình', id).expect(200);
    expect(res.body).toMatchObject({ id, status: 'CANCELLED', cancelledAt: new Date(vn('10:00')).toISOString() });
    await enter('Bình', '17:00', '18:00').expect(201);
  });

  it('AC-10: an app booking, a booking of Dũng, a missing id, and a malformed id are refused', async () => {
    await enter('Bình', '17:00', '18:00').expect(201);
    const app = (await ask('20:00', '21:00').expect(201)).body.id as string;
    const dung = (await enter('Dũng', '17:00', '18:00', {}, 'B1').expect(201)).body.id as string;
    const before = await db.booking.findMany({ orderBy: { id: 'asc' } });

    expect((await cancel('Bình', app).expect(409)).body.message).toBe('Chỉ hủy được booking bạn nhập cho khách gọi điện');
    for (const id of [dung, MISSING]) expect((await cancel('Bình', id).expect(404)).body.message).toBe('Không tìm thấy booking');
    expect((await cancel('Bình', 'abc').expect(400)).body.message).toBe('Dữ liệu không hợp lệ');
    expect(await db.booking.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
  });

  it('AC-11: a booking that has started, and a booking cancelled before, cannot be cancelled', async () => {
    const started = (await enter('Bình', '11:00', '12:00').expect(201)).body.id as string;
    const cancelled = (await enter('Bình', '17:00', '18:00').expect(201)).body.id as string;
    await cancel('Bình', cancelled).expect(200);
    clock.at = new Date(vn('11:00'));
    for (const id of [started, cancelled]) expect((await cancel('Bình', id).expect(409)).body.message).toBe('Booking này không hủy được nữa');
    expect((await db.booking.findUniqueOrThrow({ where: { id: started } })).status).toBe('CONFIRMED');
  });
});

describe('GET /api/owner/bookings?status=CONFIRMED', () => {
  it('AC-12: the list holds the phone booking with its customer', async () => {
    const id = (await enter('Bình', '17:00', '18:00', { customerName: 'Chú Tư', customerPhone: '0987654321' }).expect(201)).body.id;
    const res = await as('Bình')(http().get('/api/owner/bookings?status=CONFIRMED')).expect(200);
    expect(res.body).toEqual([expect.objectContaining({ id, source: 'PHONE', customer: { name: 'Chú Tư', phone: '0987654321' } })]);
  });

  // Review of PR #40, finding 3: the list and an entry both expire the same rows. Without one lock order,
  // Postgres ends one of them with 40P01, and the owner gets a 500.
  it('expires the same rows from the list and from parallel entries without a deadlock', async () => {
    for (let round = 0; round < 3; round++) {
      await db.booking.deleteMany();
      const expired = Array.from({ length: 60 }, (_, i) => {
        const start = new Date(`2026-11-${21 + (i % 8)}T${String(6 + Math.floor(i / 8)).padStart(2, '0')}:00:00+07:00`);
        return {
          courtId: i % 2 ? ids.A1 : ids.A2,
          startAt: start,
          endAt: new Date(start.getTime() + 3_600_000),
          status: 'PENDING' as const,
          source: 'APP' as const,
          createdById: ids.An,
          priceTotal: 80_000,
          confirmDeadline: new Date(vn('09:00')),
        };
      });
      await db.booking.createMany({ data: expired });
      const list = () => as('Bình')(http().get('/api/owner/bookings?status=PENDING'));
      const hours = [11, 12, 13, 14, 15, 16, 17, 18];
      const responses = await Promise.all([
        ...Array.from({ length: 8 }, list),
        ...hours.flatMap((h) => ['A1', 'A2'].map((court) => enter('Bình', `${h}:00`, `${h + 1}:00`, {}, court))),
      ]);
      expect(responses.map((r) => r.status).filter((s) => s >= 500)).toEqual([]);
      expect(await db.booking.count({ where: { status: 'PENDING' } })).toBe(0);
    }
  });
});
