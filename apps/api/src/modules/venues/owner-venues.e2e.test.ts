import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import type { VenueView } from '@monsport/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

// Data of brief F-005: Bình runs "Cầu lông A" (06:00-23:00, "Sân 1" and "Sân 2" at 80.000đ and 120.000đ),
// Dũng runs "Cầu lông B" with its own "Sân 1". Bookings are on 20/11/2026.
const NOW = new Date('2026-10-17T10:00:00+07:00');
const clock = { now: () => NOW };
const vn = (hhmm: string) => `2026-11-20T${hhmm}:00+07:00`;

let app: INestApplication;
let db: PrismaService;
const ids: Record<string, string> = {};
const http = () => request(app.getHttpServer());
const as = (who: string | null) => {
  const auth = (r: request.Test) => (who ? r.set('Cookie', `session=${issueSession(ids[who], NOW)}`) : r);
  return {
    get: (path: string) => auth(http().get(path)),
    post: (path: string, body?: object) => auth(http().post(path)).send(body),
    patch: (path: string, body?: object) => auth(http().patch(path)).send(body),
  };
};
const editVenue = (who: string | null, venue: string, body: object) => as(who).patch(`/api/owner/venues/${ids[venue] ?? venue}`, body);
const editCourt = (who: string | null, court: string, body: object) => as(who).patch(`/api/owner/courts/${ids[court] ?? court}`, body);
const ask = (start: string, end: string, court = 'A1') => as('An').post('/api/bookings', { courtId: ids[court], startAt: vn(start), endAt: vn(end) });
const MISSING = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

/** The stored hours and prices, to show that a refused request changed nothing. */
const snapshot = async () => ({
  venues: await db.venue.findMany({ select: { id: true, ownerId: true, name: true, phone: true, opensAt: true, closesAt: true }, orderBy: { name: 'asc' } }),
  courts: await db.court.findMany({ select: { id: true, name: true, sport: true, priceNormal: true, pricePeak: true }, orderBy: { id: 'asc' } }),
});

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
  ids.A = a.id;
  ids.B = b.id;
  ids.A1 = (await db.court.create({ data: { venueId: a.id, name: 'Sân 1', ...prices } })).id;
  ids.A2 = (await db.court.create({ data: { venueId: a.id, name: 'Sân 2', ...prices } })).id;
  ids.B1 = (await db.court.create({ data: { venueId: b.id, name: 'Sân 1', ...prices } })).id;
});

describe('PATCH /api/owner/courts/:id', () => {
  it('AC-1: Bình changes the peak price of "Sân 1", and the public list shows it', async () => {
    const res = await editCourt('Bình', 'A1', { pricePeak: 150_000 }).expect(200);
    expect(res.body).toEqual({ id: ids.A1, name: 'Sân 1', sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 150_000 });
    const list = await http().get('/api/venues').expect(200);
    const courts = (list.body as VenueView[]).find((v) => v.name === 'Cầu lông A')!.courts;
    expect(courts.map((c) => [c.name, c.priceNormal, c.pricePeak])).toEqual([
      ['Sân 1', 80_000, 150_000],
      ['Sân 2', 80_000, 120_000],
    ]);
  });

  it('AC-2: an old booking keeps its price, and a new booking takes the new price', async () => {
    const old = await ask('20:00', '21:00').expect(201);
    expect(old.body.priceTotal).toBe(120_000);
    await editCourt('Bình', 'A1', { pricePeak: 150_000 }).expect(200);
    const fresh = await ask('21:00', '22:00').expect(201);
    expect(fresh.body.priceTotal).toBe(150_000);
    expect((await db.booking.findUniqueOrThrow({ where: { id: old.body.id } })).priceTotal).toBe(120_000);
  });

  it('AC-3: a booking across 17:00 takes half of each new price per 30 minutes', async () => {
    await editCourt('Bình', 'A1', { priceNormal: 90_000, pricePeak: 150_000 }).expect(200);
    const res = await ask('16:30', '17:30').expect(201);
    expect(res.body.priceTotal).toBe(45_000 + 75_000);
  });

  it('AC-4: a request that waits on the court lock takes the price that was written under the lock', async () => {
    let pending: Promise<request.Response> | undefined;
    let waited = false;
    await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT 1 FROM "Court" WHERE id = ${ids.A1}::uuid FOR UPDATE`;
        const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        pending = ask('20:00', '21:00').then((r) => r);
        // Wait, up to 2 seconds, until a session waits on a lock of this transaction: the booking request.
        for (let i = 0; i < 100 && !waited; i++) {
          const [{ waiting }] = await db.$queryRaw<{ waiting: bigint }[]>`
            SELECT count(*) AS waiting FROM pg_stat_activity WHERE ${pid}::int = ANY (pg_blocking_pids(pid))`;
          waited = waiting > 0n;
          if (!waited) await new Promise((resolve) => setTimeout(resolve, 20));
        }
        await tx.court.update({ where: { id: ids.A1 }, data: { pricePeak: 150_000 } });
      },
      { timeout: 10_000 },
    );
    const res = await pending!;
    expect(waited).toBe(true);
    expect(res.status).toBe(201);
    expect(res.body.priceTotal).toBe(150_000);
  });
});

describe('PATCH /api/owner/venues/:id', () => {
  it('AC-5: Bình changes the opening hours, and a request outside them is refused', async () => {
    const res = await editVenue('Bình', 'A', { opensAt: 420, closesAt: 1320 }).expect(200);
    expect(res.body).toMatchObject({ id: ids.A, name: 'Cầu lông A', opensAt: 420, closesAt: 1320 });
    expect((res.body as VenueView).courts.map((c) => c.name)).toEqual(['Sân 1', 'Sân 2']);
    expect(res.body).not.toHaveProperty('ownerId');
    const early = await ask('06:00', '07:00').expect(400);
    expect(early.body.message).toBe('Ngoài giờ mở cửa');
    await ask('21:00', '22:00').expect(201);
  });

  it('AC-6: a confirmed booking outside the new hours stays confirmed with its price', async () => {
    const booking = await db.booking.create({
      data: { courtId: ids.A1, startAt: new Date(vn('06:00')), endAt: new Date(vn('07:00')), status: 'CONFIRMED', source: 'APP', createdById: ids.An, priceTotal: 80_000 },
    });
    await editVenue('Bình', 'A', { opensAt: 420, closesAt: 1320 }).expect(200);
    const after = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect([after.status, after.priceTotal]).toEqual(['CONFIRMED', 80_000]);
  });

  it('AC-7: a closing time not after the opening time is refused, also against the stored opening time', async () => {
    const before = await snapshot();
    for (const body of [{ opensAt: 1320, closesAt: 1320 }, { closesAt: 300 }]) {
      const res = await editVenue('Bình', 'A', body).expect(400);
      expect(res.body.message, JSON.stringify(body)).toBe('Giờ đóng cửa phải sau giờ mở cửa');
    }
    expect(await snapshot()).toEqual(before);
  });
});

describe('owner edit rules', () => {
  it('AC-8: hours off the grid or out of range, and wrong prices, are refused with their texts', async () => {
    const before = await snapshot();
    // Each request starts only when its turn comes, as supertest binds one server per started request.
    const cases: [() => request.Test, string][] = [
      [() => editVenue('Bình', 'A', { opensAt: 375 }), 'Giờ phải theo bước 30 phút'],
      [() => editVenue('Bình', 'A', { closesAt: 1470 }), 'Giờ phải trong khoảng 00:00–24:00'],
      [() => editCourt('Bình', 'A1', { pricePeak: 0 }), 'Giá phải lớn hơn 0'],
      [() => editCourt('Bình', 'A1', { pricePeak: 10_000_001 }), 'Giá tối đa 10.000.000đ một giờ'],
      [() => editCourt('Bình', 'A1', { pricePeak: 150_000.5 }), 'Dữ liệu không hợp lệ'],
    ];
    for (const [req, message] of cases) {
      const res = await req().expect(400);
      expect(res.body.message).toBe(message);
    }
    expect(await snapshot()).toEqual(before);
  });

  it('AC-9: a field of the admin, or an empty body, is refused', async () => {
    const before = await snapshot();
    const venueBodies = [{ name: 'Cầu lông Z' }, { ownerId: ids['Dũng'] }, { opensAt: 420, phone: '0999999999' }, {}];
    for (const body of venueBodies) expect((await editVenue('Bình', 'A', body).expect(400)).body.message).toBe('Dữ liệu không hợp lệ');
    for (const body of [{ name: 'Sân 9' }, { sport: 'FOOTBALL' }, {}])
      expect((await editCourt('Bình', 'A1', body).expect(400)).body.message).toBe('Dữ liệu không hợp lệ');
    expect(await snapshot()).toEqual(before);
  });

  it('AC-10: Bình cannot edit the venue or court of Dũng, or one that does not exist', async () => {
    const before = await snapshot();
    for (const venue of ['B', MISSING]) expect((await editVenue('Bình', venue, { opensAt: 420 }).expect(404)).body.message).toBe('Không tìm thấy đơn vị');
    for (const court of ['B1', MISSING]) expect((await editCourt('Bình', court, { pricePeak: 150_000 }).expect(404)).body.message).toBe('Không tìm thấy sân');
    expect((await as('Bình').patch('/api/owner/venues/abc', { opensAt: 420 }).expect(400)).body.message).toBe('Dữ liệu không hợp lệ');
    expect((await as('Bình').patch('/api/owner/courts/abc', { pricePeak: 150_000 }).expect(400)).body.message).toBe('Dữ liệu không hợp lệ');
    expect(await snapshot()).toEqual(before);
  });

  it('AC-11: after the admin moves "Cầu lông A" to Dũng, only Dũng edits it', async () => {
    await as('admin').patch(`/api/admin/venues/${ids.A}`, { ownerId: ids['Dũng'] }).expect(200);
    await editVenue('Bình', 'A', { opensAt: 420 }).expect(404);
    await editCourt('Bình', 'A1', { pricePeak: 150_000 }).expect(404);
    const res = await editCourt('Dũng', 'A1', { pricePeak: 150_000 }).expect(200);
    expect(res.body.pricePeak).toBe(150_000);
  });

  it('AC-12: a user, the admin, and a request without a cookie cannot use the owner routes', async () => {
    const before = await snapshot();
    for (const [who, status] of [['An', 403], ['admin', 403], [null, 401]] as const) {
      await editVenue(who, 'A', { opensAt: 420 }).expect(status);
      await editCourt(who, 'A1', { pricePeak: 150_000 }).expect(status);
    }
    expect(await snapshot()).toEqual(before);
  });
});
