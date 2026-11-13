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

const vn = (hhmm: string, day = '2026-11-20') => `${day}T${hhmm}:00+07:00`;
const clock = { at: new Date(vn('10:00')), now() { return this.at; } };
const PASSWORD = 'test-password-123';

let app: INestApplication;
let db: PrismaService;
const ids: Record<string, string> = {};
const http = () => request(app.getHttpServer());
const cookie = (who: string) => `session=${issueSession(ids[who], clock.now())}`;
const as = (who: string | null) => (r: request.Test) => (who ? r.set('Cookie', cookie(who)) : r);

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
  const passwordHash = await hash(PASSWORD);
  const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER' | 'STAFF', staffVenueId?: string) =>
    db.user.create({ data: { name, phone, role, passwordHash, staffVenueId } }).then((u) => (ids[name] = u.id));

  await Promise.all([
    user('admin', '0900000000', 'ADMIN'),
    user('Bình', '0912345678', 'OWNER'),
    user('Dũng', '0912345679', 'OWNER'),
    user('An', '0901234567', 'USER'),
  ]);

  const prices = { sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 } as const;
  const va = await db.venue.create({
    data: { ownerId: ids['Bình'], name: 'Cầu lông A', address: '123 Đường A', phone: '0912345678', opensAt: 360, closesAt: 1380 },
  });
  const vb = await db.venue.create({
    data: { ownerId: ids['Dũng'], name: 'Cầu lông B', address: '456 Đường B', phone: '0912345679', opensAt: 360, closesAt: 1380 },
  });
  ids.venueA = va.id;
  ids.venueB = vb.id;

  ids.courtA1 = (await db.court.create({ data: { venueId: va.id, name: 'Sân A1', ...prices } })).id;
  ids.courtA2 = (await db.court.create({ data: { venueId: va.id, name: 'Sân A2', ...prices } })).id;
  ids.courtB1 = (await db.court.create({ data: { venueId: vb.id, name: 'Sân B1', ...prices } })).id;

  await Promise.all([
    user('staffA', '0988888881', 'STAFF', ids.venueA),
    user('staffB', '0988888882', 'STAFF', ids.venueB),
  ]);
});

describe('Staff access control (F-031)', () => {
  it('AC-6: staff sees only their venue on GET /api/owner/venues and only their venue bookings on GET /api/owner/bookings', async () => {
    // GET /api/owner/venues
    const venuesRes = await as('staffA')(http().get('/api/owner/venues')).expect(200);
    expect(venuesRes.body).toHaveLength(1);
    expect(venuesRes.body[0].id).toBe(ids.venueA);
    expect(venuesRes.body[0].name).toBe('Cầu lông A');

    // Create a pending booking on venue A and venue B
    const bookingA = await db.booking.create({
      data: {
        courtId: ids.courtA1,
        startAt: new Date(vn('14:00')),
        endAt: new Date(vn('15:00')),
        status: 'PENDING',
        source: 'APP',
        createdById: ids.An,
        confirmDeadline: new Date(vn('13:00')),
        priceTotal: 80_000,
      },
    });
    const bookingB = await db.booking.create({
      data: {
        courtId: ids.courtB1,
        startAt: new Date(vn('14:00')),
        endAt: new Date(vn('15:00')),
        status: 'PENDING',
        source: 'APP',
        createdById: ids.An,
        confirmDeadline: new Date(vn('13:00')),
        priceTotal: 80_000,
      },
    });

    // staffA sees only bookingA
    const bookingsResA = await as('staffA')(http().get('/api/owner/bookings')).expect(200);
    expect(bookingsResA.body).toHaveLength(1);
    expect(bookingsResA.body[0].id).toBe(bookingA.id);

    // staffB sees only bookingB
    const bookingsResB = await as('staffB')(http().get('/api/owner/bookings')).expect(200);
    expect(bookingsResB.body).toHaveLength(1);
    expect(bookingsResB.body[0].id).toBe(bookingB.id);
  });

  it('AC-7: staff confirms and rejects booking of their venue, gets 403 for booking of another venue', async () => {
    const bookingA = await db.booking.create({
      data: {
        courtId: ids.courtA1,
        startAt: new Date(vn('14:00')),
        endAt: new Date(vn('15:00')),
        status: 'PENDING',
        source: 'APP',
        createdById: ids.An,
        confirmDeadline: new Date(vn('13:00')),
        priceTotal: 80_000,
      },
    });
    const bookingB = await db.booking.create({
      data: {
        courtId: ids.courtB1,
        startAt: new Date(vn('14:00')),
        endAt: new Date(vn('15:00')),
        status: 'PENDING',
        source: 'APP',
        createdById: ids.An,
        confirmDeadline: new Date(vn('13:00')),
        priceTotal: 80_000,
      },
    });

    // staffA cannot confirm bookingB -> 403
    await as('staffA')(http().post(`/api/owner/bookings/${bookingB.id}/confirm`)).expect(403);
    // staffA cannot reject bookingB -> 403
    await as('staffA')(http().post(`/api/owner/bookings/${bookingB.id}/reject`)).expect(403);

    // staffA confirms bookingA -> 200
    const confirmedRes = await as('staffA')(http().post(`/api/owner/bookings/${bookingA.id}/confirm`)).expect(200);
    expect(confirmedRes.body.status).toBe('CONFIRMED');

    // staffB rejects bookingB -> 200
    const rejectedRes = await as('staffB')(http().post(`/api/owner/bookings/${bookingB.id}/reject`)).expect(200);
    expect(rejectedRes.body.status).toBe('REJECTED');
  });

  it('AC-8: staff enters phone booking and recurring booking on own court, gets 404 for court of another venue', async () => {
    // Phone booking on own court succeeds
    const phoneRes = await as('staffA')(http().post('/api/owner/bookings'))
      .send({
        courtId: ids.courtA1,
        startAt: vn('14:00'),
        endAt: vn('15:00'),
        customerName: 'Khách gọi A',
        customerPhone: '0901234567',
      })
      .expect(201);
    expect(phoneRes.body.status).toBe('CONFIRMED');

    // Phone booking on court of another venue returns 404
    await as('staffA')(http().post('/api/owner/bookings'))
      .send({
        courtId: ids.courtB1,
        startAt: vn('16:00'),
        endAt: vn('17:00'),
        customerName: 'Khách gọi B',
        customerPhone: '0901234567',
      })
      .expect(404);

    // Recurring phone booking on own court succeeds
    const recurringRes = await as('staffA')(http().post('/api/owner/bookings/recurring'))
      .send({
        courtId: ids.courtA2,
        startAt: vn('18:00'),
        endAt: vn('19:00'),
        weeks: 3,
        customerName: 'Khách định kỳ',
        customerPhone: '0901234567',
      })
      .expect(201);
    expect(recurringRes.body.created).toHaveLength(3);

    // Recurring phone booking on court of another venue returns 404
    await as('staffA')(http().post('/api/owner/bookings/recurring'))
      .send({
        courtId: ids.courtB1,
        startAt: vn('18:00'),
        endAt: vn('19:00'),
        weeks: 3,
        customerName: 'Khách định kỳ',
        customerPhone: '0901234567',
      })
      .expect(404);
  });

  it('AC-9: staff gets 403 for cancel, mark paid, venue edit, court edit, financials, and staff management', async () => {
    const booking = await db.booking.create({
      data: {
        courtId: ids.courtA1,
        startAt: new Date(vn('14:00')),
        endAt: new Date(vn('15:00')),
        status: 'CONFIRMED',
        source: 'APP',
        createdById: ids.An,
        priceTotal: 80_000,
      },
    });

    // 1. Cancel booking -> 403
    await as('staffA')(http().post(`/api/owner/bookings/${booking.id}/cancel`)).expect(403);

    // 2. Mark paid -> 403
    await as('staffA')(http().patch(`/api/owner/bookings/${booking.id}/paid`).send({ paidAtVenue: true })).expect(403);

    // 3. Edit venue -> 403
    await as('staffA')(http().patch(`/api/owner/venues/${ids.venueA}`).send({ opensAt: 420 })).expect(403);

    // 4. Edit court -> 403
    await as('staffA')(http().patch(`/api/owner/courts/${ids.courtA1}`).send({ priceNormal: 90_000 })).expect(403);

    // 5. Financials -> 403
    await as('staffA')(http().get(`/api/owner/venues/${ids.venueA}/financials?period=day&date=2026-11-20`)).expect(403);

    // 6. Create staff -> 403
    await as('staffA')(http().post(`/api/owner/venues/${ids.venueA}/staff`).send({
      name: 'Nhân viên mới',
      phone: '0988888889',
      password: 'new-password-123',
      consent: true,
    })).expect(403);

    // 7. Lock staff -> 403
    await as('staffA')(http().post(`/api/owner/staff/${ids.staffA}/lock`)).expect(403);
  });
});
