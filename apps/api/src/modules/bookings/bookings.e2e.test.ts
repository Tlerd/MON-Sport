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

// Data of brief F-002: "Cầu lông A" opens 06:00-23:00, "Sân 1" costs 80.000đ and 120.000đ per hour.
const vn = (hhmm: string) => `2026-11-20T${hhmm}:00+07:00`;
const clock = { at: new Date(vn('10:00')), now() { return this.at; } };
const PASSWORD = 'test-password';

let app: INestApplication;
let db: PrismaService;
const ids: Record<string, string> = {};
const cookie = (who: string) => `session=${issueSession(ids[who], clock.now())}`;
const http = () => request(app.getHttpServer());
const ask = (who: string, start: string, end: string, court = 'san1') =>
  http().post('/api/bookings').set('Cookie', cookie(who)).send({ courtId: ids[court], startAt: vn(start), endAt: vn(end) });
const decide = (who: string, bookingId: string, action: 'confirm' | 'reject') =>
  http().post(`/api/owner/bookings/${bookingId}/${action}`).set('Cookie', cookie(who));

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
  await db.$executeRawUnsafe('TRUNCATE "Booking", "Court", "Venue", "User" CASCADE');
  const passwordHash = await hash(PASSWORD);
  const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER') =>
    db.user.create({ data: { name, phone, role, passwordHash } }).then((u) => (ids[name] = u.id));
  await Promise.all([
    user('admin', '0900000000', 'ADMIN'),
    user('binh', '0912345678', 'OWNER'),
    user('dung', '0912345679', 'OWNER'),
    user('an', '0901234567', 'USER'),
    user('chi', '0901234568', 'USER'),
  ]);
  const venue = await db.venue.create({
    data: { ownerId: ids.binh, name: 'Cầu lông A', address: 'A', phone: '0912345678', opensAt: 360, closesAt: 1380 },
  });
  await db.venue.create({ data: { ownerId: ids.dung, name: 'Cầu lông B', address: 'B', phone: '0912345679', opensAt: 360, closesAt: 1380 } });
  for (const [key, name] of [['san1', 'Sân 1'], ['san2', 'Sân 2']]) {
    const court = await db.court.create({ data: { venueId: venue.id, name, sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 } });
    ids[key] = court.id;
  }
});

describe('POST /api/bookings', () => {
  it('AC-1: 50 parallel requests for the same slot give exactly one 201', async () => {
    const passwordHash = await hash(PASSWORD);
    const players = await Promise.all(
      Array.from({ length: 50 }, (_, i) => db.user.create({ data: { name: `P${i}`, phone: `07${String(i).padStart(8, '0')}`, passwordHash } })),
    );
    const responses = await Promise.all(
      players.map((p) =>
        http().post('/api/bookings').set('Cookie', `session=${issueSession(p.id, clock.now())}`).send({ courtId: ids.san1, startAt: vn('20:00'), endAt: vn('21:00') }),
      ),
    );
    const codes = responses.map((r) => r.status);
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(49);
    expect(responses.find((r) => r.status === 409)!.body.message).toBe('Khung giờ này vừa có người đặt');
    // 50 transactions queue for the pool, and a deadlocked one retries, so this test needs more than 5 s on a busy machine.
  }, 30_000);

  it('AC-2: a slot next to a pending booking is accepted', async () => {
    await ask('chi', '19:00', '20:00').expect(201);
    await ask('an', '20:00', '21:00').expect(201);
  });

  it('AC-3: a slot of a rejected booking can be asked again', async () => {
    const first = await ask('chi', '19:00', '20:00').expect(201);
    await decide('binh', first.body.id, 'reject').expect(200);
    await ask('an', '19:00', '20:00').expect(201);
  });

  it('AC-6: a start off the 30-minute grid is refused', async () => {
    const res = await ask('an', '19:15', '20:15').expect(400);
    expect(res.body.message).toBe('Giờ phải theo bước 30 phút');
  });

  it('AC-7: a booking shorter than 1 hour is refused', async () => {
    const res = await ask('an', '19:00', '19:30').expect(400);
    expect(res.body.message).toBe('Mỗi booking dài ít nhất 1 giờ');
  });

  it('AC-10: a request after its deadline is refused', async () => {
    clock.at = new Date(vn('19:10'));
    const res = await ask('an', '20:00', '21:00').expect(400);
    expect(res.body.message).toBe('Đã quá hạn đặt trong app. Hãy gọi chủ sân');
  });

  it('AC-10: a request whose deadline equals its send time is accepted', async () => {
    clock.at = new Date(vn('19:00'));
    await ask('an', '20:00', '21:00').expect(201);
  });

  it('AC-11: a request outside the opening hours is refused', async () => {
    const res = await ask('an', '05:00', '06:00').expect(400);
    expect(res.body.message).toBe('Ngoài giờ mở cửa');
  });

  it('AC-14: an expired request frees its slot for the next user', async () => {
    const first = await ask('an', '20:00', '21:00').expect(201);
    clock.at = new Date(vn('12:01'));
    await ask('chi', '20:00', '21:00').expect(201);
    expect((await db.booking.findUniqueOrThrow({ where: { id: first.body.id } })).status).toBe('EXPIRED');
  });
});

describe('owner decisions', () => {
  it('AC-12: the owner confirms a pending request', async () => {
    const booking = await ask('an', '20:00', '21:00').expect(201);
    clock.at = new Date(vn('11:00'));
    const res = await decide('binh', booking.body.id, 'confirm').expect(200);
    expect(res.body).toMatchObject({ status: 'CONFIRMED', confirmedAt: new Date(vn('11:00')).toISOString() });
  });

  it('AC-13: the owner rejects a pending request', async () => {
    const booking = await ask('an', '20:00', '21:00').expect(201);
    const res = await decide('binh', booking.body.id, 'reject').expect(200);
    expect(res.body.status).toBe('REJECTED');
  });

  it('AC-15: a confirm after the deadline gives 409', async () => {
    const booking = await ask('an', '20:00', '21:00').expect(201);
    clock.at = new Date(vn('12:01'));
    const res = await decide('binh', booking.body.id, 'confirm').expect(409);
    expect(res.body.message).toBe('Yêu cầu đã hết hạn');
  });

  it('AC-16: the owner of another venue gets 403', async () => {
    const booking = await ask('an', '20:00', '21:00').expect(201);
    await decide('dung', booking.body.id, 'confirm').expect(403);
  });

  it('AC-17: an admin gets 403', async () => {
    const booking = await ask('an', '20:00', '21:00').expect(201);
    await decide('admin', booking.body.id, 'confirm').expect(403);
  });

  it('AC-18: the owner list shows the name and phone of the user', async () => {
    await ask('an', '20:00', '21:00').expect(201);
    const res = await http().get('/api/owner/bookings').set('Cookie', cookie('binh')).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].customer).toEqual({ name: 'an', phone: '0901234567' });
  });
});

describe('POST /api/auth/login', () => {
  it('AC-19: a wrong password gives 401', async () => {
    const res = await http().post('/api/auth/login').send({ phone: '0901234567', password: 'wrong' }).expect(401);
    expect(res.body.message).toBe('Sai số điện thoại hoặc mật khẩu');
  });

  it('signs in with the right password and sets an httpOnly cookie', async () => {
    const res = await http().post('/api/auth/login').send({ phone: '0901234567', password: PASSWORD }).expect(200);
    expect(res.body).toMatchObject({ name: 'an', role: 'USER' });
    expect(String(res.headers['set-cookie'])).toMatch(/session=.*HttpOnly/);
  });
});
