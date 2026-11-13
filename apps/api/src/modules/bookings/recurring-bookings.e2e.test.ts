import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ALL_WEEKS_TAKEN, PHONE_MESSAGE, addDaysYmd, vnDateString } from '@monsport/shared';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

const vnDate = (daysFromBase: number, hhmm: string) => {
  const base = vnDateString(new Date('2026-11-20T00:00:00+07:00'));
  const ymd = addDaysYmd(base, daysFromBase);
  return `${ymd}T${hhmm}:00+07:00`;
};

const clock = { at: new Date(vnDate(0, '10:00')), now() { return this.at; } };

let app: INestApplication;
let db: PrismaService;
const ids: Record<string, string> = {};
const http = () => request(app.getHttpServer());
const cookie = (who: string) => `session=${issueSession(ids[who], clock.now())}`;
const as = (who: string | null) => (r: request.Test) => (who ? r.set('Cookie', cookie(who)) : r);

const enter = (who: string | null, start: string, end: string, extra: object = {}, court = 'A1') =>
  as(who)(http().post('/api/owner/bookings')).send({ courtId: ids[court] ?? court, startAt: vnDate(0, start), endAt: vnDate(0, end), ...extra });

const enterRecurring = (who: string | null, start: string, end: string, weeks = 4, extra: object = {}, court = 'A1') =>
  as(who)(http().post('/api/owner/bookings/recurring')).send({ courtId: ids[court] ?? court, startAt: vnDate(0, start), endAt: vnDate(0, end), weeks, ...extra });

const ask = (start: string, end: string) =>
  as('An')(http().post('/api/bookings')).send({ courtId: ids.A1, startAt: vnDate(0, start), endAt: vnDate(0, end) });

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
  clock.at = new Date(vnDate(0, '10:00'));
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

describe('POST /api/owner/bookings/recurring', () => {
  it('AC-2: weeks=4 on empty court creates 4 CONFIRMED bookings 7 days apart, same seriesId, correct priceTotal, skipped empty', async () => {
    const res = await enterRecurring('Bình', '17:00', '18:00', 4, { customerName: 'Chú Tư', customerPhone: '0987654321' }).expect(201);
    expect(res.body.seriesId).toBeDefined();
    expect(typeof res.body.seriesId).toBe('string');
    expect(res.body.skipped).toEqual([]);
    expect(res.body.created).toHaveLength(4);

    const seriesId = res.body.seriesId;
    for (let k = 0; k < 4; k++) {
      const item = res.body.created[k];
      expect(item).toMatchObject({
        courtId: ids.A1,
        seriesId,
        status: 'CONFIRMED',
        source: 'PHONE',
        priceTotal: 120_000,
        startAt: new Date(vnDate(k * 7, '17:00')).toISOString(),
        endAt: new Date(vnDate(k * 7, '18:00')).toISOString(),
        customer: { name: 'Chú Tư', phone: '0987654321' },
      });
      const dbRow = await db.booking.findUniqueOrThrow({ where: { id: item.id } });
      expect(dbRow.seriesId).toBe(seriesId);
      expect(dbRow.createdById).toBe(ids['Bình']);
    }
  });

  it('AC-3: week 2 conflicts with existing CONFIRMED booking -> 3 created, 1 skipped with week 2 times, existing unchanged', async () => {
    const existingStart = new Date(vnDate(7, '17:00'));
    const existingEnd = new Date(vnDate(7, '18:00'));
    const existing = await db.booking.create({
      data: {
        courtId: ids.A1,
        startAt: existingStart,
        endAt: existingEnd,
        status: 'CONFIRMED',
        source: 'PHONE',
        createdById: ids['Bình'],
        customerName: 'Khách Cũ',
        customerPhone: '0911223344',
        priceTotal: 120_000,
      },
    });

    const res = await enterRecurring('Bình', '17:00', '18:00', 4, { customerName: 'Chú Tư' }).expect(201);
    expect(res.body.created).toHaveLength(3);
    expect(res.body.skipped).toHaveLength(1);
    expect(new Date(res.body.skipped[0].startAt).toISOString()).toBe(existingStart.toISOString());
    expect(new Date(res.body.skipped[0].endAt).toISOString()).toBe(existingEnd.toISOString());

    const createdStarts = res.body.created.map((b: { startAt: string }) => new Date(b.startAt).toISOString());
    expect(createdStarts).toContain(new Date(vnDate(0, '17:00')).toISOString());
    expect(createdStarts).toContain(new Date(vnDate(14, '17:00')).toISOString());
    expect(createdStarts).toContain(new Date(vnDate(21, '17:00')).toISOString());
    expect(createdStarts).not.toContain(existingStart.toISOString());

    const after = await db.booking.findUniqueOrThrow({ where: { id: existing.id } });
    expect(after.status).toBe('CONFIRMED');
    expect(after.seriesId).toBeNull();
    expect(after.customerName).toBe('Khách Cũ');
  });

  it('AC-4: all weeks conflict -> 409 "Mọi buổi đều đã có người đặt", no bookings created', async () => {
    for (let k = 0; k < 2; k++) {
      await db.booking.create({
        data: {
          courtId: ids.A1,
          startAt: new Date(vnDate(k * 7, '17:00')),
          endAt: new Date(vnDate(k * 7, '18:00')),
          status: 'CONFIRMED',
          source: 'PHONE',
          createdById: ids['Bình'],
          priceTotal: 120_000,
        },
      });
    }
    const countBefore = await count();
    const res = await enterRecurring('Bình', '17:00', '18:00', 2).expect(409);
    expect(res.body.message).toBe(ALL_WEEKS_TAKEN);
    expect(await count()).toBe(countBefore);
  });

  it('AC-5: expired PENDING does not block -> becomes EXPIRED, booking created', async () => {
    clock.at = new Date(vnDate(0, '14:00'));
    const requested = await ask('17:00', '18:00').expect(201);
    expect(requested.body.confirmDeadline).toBe(new Date(vnDate(0, '16:00')).toISOString());

    clock.at = new Date(vnDate(0, '16:30'));
    const res = await enterRecurring('Bình', '17:00', '18:00', 2).expect(201);
    expect(res.body.created).toHaveLength(2);
    expect(res.body.skipped).toHaveLength(0);

    const pendingRow = await db.booking.findUniqueOrThrow({ where: { id: requested.body.id } });
    expect(pendingRow.status).toBe('EXPIRED');
  });

  it('AC-6: concurrent requests (Promise.all) -> exactly one succeeds with 201, other gets 409', async () => {
    const responses = await Promise.all([
      enterRecurring('Bình', '17:00', '18:00', 4),
      enterRecurring('Bình', '17:00', '18:00', 4),
    ]);
    const successes = responses.filter((r) => r.status === 201);
    const conflicts = responses.filter((r) => r.status === 409);
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].body.message).toBe(ALL_WEEKS_TAKEN);
    expect(await db.booking.count({ where: { courtId: ids.A1, status: 'CONFIRMED' } })).toBe(4);
  });

  it("AC-7: returns 404 for another owner's court and 400 for a past start or a time outside opening hours", async () => {
    expect((await enterRecurring('Bình', '17:00', '18:00', 4, {}, 'B1').expect(404)).body.message).toBe('Không tìm thấy sân');
    expect((await enterRecurring('Bình', '09:00', '10:00', 4).expect(400)).body.message).toBe('Giờ bắt đầu đã qua');
    expect((await enterRecurring('Bình', '05:00', '06:00', 4).expect(400)).body.message).toBe('Ngoài giờ mở cửa');
    expect((await enterRecurring('Bình', '17:15', '18:15', 4).expect(400)).body.message).toBe('Giờ phải theo bước 30 phút');
    expect((await enterRecurring('Bình', '17:00', '17:30', 4).expect(400)).body.message).toBe('Mỗi booking dài ít nhất 1 giờ');
    expect((await enterRecurring('Bình', '17:00', '18:00', 1).expect(400)).body.message).toBe('Dữ liệu đặt sân không hợp lệ');
    expect((await enterRecurring('Bình', '17:00', '18:00', 13).expect(400)).body.message).toBe('Dữ liệu đặt sân không hợp lệ');
    expect((await enterRecurring('Bình', '17:00', '18:00', 4, { customerPhone: '123' }).expect(400)).body.message).toBe(PHONE_MESSAGE);
  });

  it('AC-8: migration / existing booking has seriesId null, seriesId present in OwnerBookingView', async () => {
    const single = await enter('Bình', '11:00', '12:00').expect(201);
    expect(single.body.seriesId).toBeNull();
    const singleRow = await db.booking.findUniqueOrThrow({ where: { id: single.body.id } });
    expect(singleRow.seriesId).toBeNull();

    const recurring = await enterRecurring('Bình', '17:00', '18:00', 2).expect(201);
    expect(recurring.body.created[0].seriesId).toBe(recurring.body.seriesId);

    const list = await as('Bình')(http().get('/api/owner/bookings?status=CONFIRMED')).expect(200);
    const listedSingle = list.body.find((b: { id: string }) => b.id === single.body.id);
    expect(listedSingle.seriesId).toBeNull();
    const listedRecurring = list.body.find((b: { id: string }) => b.id === recurring.body.created[0].id);
    expect(listedRecurring.seriesId).toBe(recurring.body.seriesId);
  });
});
