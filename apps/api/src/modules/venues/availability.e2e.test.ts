import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { Prisma } from '../../generated/prisma/client.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { AvailabilityController } from './availability.controller.js';

// Data of brief F-008: Bình runs "Cầu lông A" (06:00-23:00, "Sân 1" and "Sân 2"), Dũng runs "Cầu lông B"
// (08:00-24:00, "Sân 1"). Now is 20/11/2026 10:00 Asia/Ho_Chi_Minh unless a test moves the clock.
const at = (day: string, hhmm: string) => new Date(`2026-11-${day}T${hhmm}:00+07:00`);
const clock = { at: at('20', '10:00'), now() { return this.at; } };
const MISSING = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

let app: INestApplication;
let db: PrismaService;
const ids: Record<string, string> = {};
const get = (court: string, query = '') => request(app.getHttpServer()).get(`/api/courts/${ids[court] ?? court}/availability${query}`);
const day = (date: string) => `?date=2026-11-${date}`;
const range = (d: string, from: string, to: string) => ({ startAt: at(d, from).toISOString(), endAt: at(d, to).toISOString() });
const hold = (court: string, d: string, from: string, to: string, extra: Partial<Prisma.BookingUncheckedCreateInput> = {}) =>
  db.booking.create({
    data: {
      courtId: ids[court], startAt: at(d, from), endAt: at(d, to), status: 'CONFIRMED', source: 'APP', createdById: ids.An, priceTotal: 80_000, ...extra,
    },
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
  clock.at = at('20', '10:00');
  await db.$executeRawUnsafe('TRUNCATE "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
  const passwordHash = await hash('test-password');
  const user = (name: string, phone: string, role: 'OWNER' | 'USER') => db.user.create({ data: { name, phone, role, passwordHash } }).then((u) => (ids[name] = u.id));
  await Promise.all([user('Bình', '0912345678', 'OWNER'), user('Dũng', '0912345679', 'OWNER'), user('An', '0901234567', 'USER')]);
  const prices = { sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 } as const;
  const a = await db.venue.create({ data: { ownerId: ids['Bình'], name: 'Cầu lông A', address: 'A', phone: '0912345678', opensAt: 360, closesAt: 1380 } });
  const b = await db.venue.create({ data: { ownerId: ids['Dũng'], name: 'Cầu lông B', address: 'B', phone: '0912345679', opensAt: 480, closesAt: 1440 } });
  ids.A1 = (await db.court.create({ data: { venueId: a.id, name: 'Sân 1', ...prices } })).id;
  ids.A2 = (await db.court.create({ data: { venueId: a.id, name: 'Sân 2', ...prices } })).id;
  ids.B1 = (await db.court.create({ data: { venueId: b.id, name: 'Sân 1', ...prices } })).id;
});

describe('GET /api/courts/:id/availability', () => {
  it('AC-1: a court without bookings is free all day, and the body has exactly five keys, without a cookie', async () => {
    const res = await get('A1', day('21')).expect(200);
    expect(Object.keys(res.body).sort()).toEqual(['closesAt', 'courtId', 'date', 'free', 'opensAt']);
    expect(res.body).toEqual({
      courtId: ids.A1, date: '2026-11-21', opensAt: 360, closesAt: 1380,
      free: [{ startAt: '2026-11-20T23:00:00.000Z', endAt: '2026-11-21T16:00:00.000Z' }],
    });
  });

  it('AC-2: a confirmed booking 19:00-20:00 cuts today, which starts at 10:30', async () => {
    await hold('A1', '20', '19:00', '20:00');
    expect((await get('A1', day('20')).expect(200)).body.free).toEqual([range('20', '10:30', '19:00'), range('20', '20:00', '23:00')]);
  });

  it('AC-3: a pending request holds its time until its deadline, and the API writes nothing', async () => {
    const pending = await hold('A1', '20', '20:00', '21:00', { status: 'PENDING', confirmDeadline: at('20', '12:00') });
    const before = await db.booking.findMany();
    expect((await get('A1', day('20')).expect(200)).body.free).toEqual([range('20', '10:30', '20:00'), range('20', '21:00', '23:00')]);
    clock.at = at('20', '12:00');
    expect((await get('A1', day('20')).expect(200)).body.free).toEqual([range('20', '12:30', '20:00'), range('20', '21:00', '23:00')]);
    clock.at = new Date(at('20', '12:00').getTime() + 1000);
    expect((await get('A1', day('20')).expect(200)).body.free).toEqual([range('20', '12:30', '23:00')]);
    expect(await db.booking.findMany()).toEqual(before);
    expect((await db.booking.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe('PENDING');
  });

  it('AC-4: rejected, expired, and cancelled bookings do not hold time', async () => {
    for (const status of ['REJECTED', 'EXPIRED', 'CANCELLED'] as const) await hold('A1', '20', '20:00', '21:00', { status });
    expect((await get('A1', day('20')).expect(200)).body.free).toEqual([range('20', '10:30', '23:00')]);
  });

  it('AC-5: two adjacent bookings leave no gap', async () => {
    await hold('A1', '20', '19:00', '20:00');
    await hold('A1', '20', '20:00', '21:00');
    expect((await get('A1', day('20')).expect(200)).body.free).toEqual([range('20', '10:30', '19:00'), range('20', '21:00', '23:00')]);
  });

  it('AC-6: a gap shorter than 1 hour is not free', async () => {
    await hold('A1', '21', '06:00', '09:30');
    await hold('A1', '21', '10:00', '23:00');
    expect((await get('A1', day('21')).expect(200)).body.free).toEqual([]);
  });

  it('AC-7: a past day, and a day after closing, have no free time', async () => {
    expect((await get('A1', day('19')).expect(200)).body.free).toEqual([]);
    clock.at = at('20', '23:10');
    expect((await get('A1', day('20')).expect(200)).body.free).toEqual([]);
  });

  it('AC-7: a day in year 0000 or 0001 answers 200 with no free time, not 500', async () => {
    for (const date of ['0000-01-01', '0001-01-01', '1999-12-31']) {
      expect((await get('A1', `?date=${date}`).expect(200)).body).toMatchObject({ date, free: [] });
    }
  });

  it('AC-2: a booking that starts before opening and ends after it still cuts the start of the day', async () => {
    await hold('A1', '21', '07:00', '09:00');
    await db.venue.updateMany({ data: { opensAt: 480 } });
    expect((await get('A1', day('21')).expect(200)).body.free).toEqual([range('21', '09:00', '23:00')]);
  });

  it('AC-8: another court does not matter, and a venue closing at 24:00 ends at 00:00 of the next day', async () => {
    await hold('A2', '21', '19:00', '20:00');
    expect((await get('A1', day('21')).expect(200)).body.free).toEqual([range('21', '06:00', '23:00')]);
    const b = (await get('B1', day('21')).expect(200)).body;
    expect(b).toMatchObject({ opensAt: 480, closesAt: 1440, free: [{ startAt: '2026-11-21T01:00:00.000Z', endAt: '2026-11-21T17:00:00.000Z' }] });
  });

  it('AC-9: an unknown court answers 404, and a bad id or query answers 400', async () => {
    expect((await get(MISSING, day('21')).expect(404)).body.message).toBe('Không tìm thấy sân');
    for (const [court, query] of [
      ['abc', day('21')],
      ['A1', '?date=2026-13-45'],
      ['A1', '?date=21-11-2026'],
      ['A1', ''],
      ['A1', `${day('21')}&x=1`],
      ['A1', `${day('21')}&date=2026-11-22`],
    ] as const) {
      expect((await get(court, query).expect(400)).body.message, `${court}${query}`).toBe('Dữ liệu không hợp lệ');
    }
  });

  it('AC-10: the body has no data of the customer', async () => {
    await hold('A1', '21', '19:00', '20:00', { source: 'PHONE', customerName: 'Chú Tư', customerPhone: '0987654321', createdById: ids['Bình'] });
    const res = await get('A1', day('21')).expect(200);
    const text = JSON.stringify(res.body);
    for (const secret of ['Chú Tư', '0987654321', ids['Bình'], ids.An, 'customer', 'createdById', 'status', 'priceTotal']) expect(text).not.toContain(secret);
  });

  it('AC-10: the controller selects only startAt and endAt of a booking', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      court: { findUnique: vi.fn().mockResolvedValue({ id: ids.A1, venue: { opensAt: 360, closesAt: 1380 } }) },
      booking: { findMany },
    };
    await new AvailabilityController(prisma as unknown as PrismaService, clock as Clock).availability(ids.A1, { date: '2026-11-21' });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ select: { startAt: true, endAt: true } }));
  });
});
