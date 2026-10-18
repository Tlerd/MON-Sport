import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import type { FinancialDashboardView, PaidAtVenueResponse } from '@monsport/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

const vn = (hhmm: string, day = '2026-11-20') => `${day}T${hhmm.length === 5 ? `${hhmm}:00` : hhmm}+07:00`;
const clock = { at: new Date(vn('10:00')), now() { return this.at; } };
const MISSING = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

let app: INestApplication;
let db: PrismaService;
let passwordHash: string;
const ids: Record<string, string> = {};
const http = () => request(app.getHttpServer());
const as = (who: string | null) => (r: request.Test) => (who ? r.set('Cookie', `session=${issueSession(ids[who], clock.now())}`) : r);

const getFinancials = (who: string | null, venueId: string, query?: Record<string, string>) => {
  const r = as(who)(http().get(`/api/owner/venues/${venueId}/financials`));
  return query ? r.query(query) : r;
};

const markPaid = (who: string | null, bookingId: string, paidAtVenue: boolean) =>
  as(who)(http().patch(`/api/owner/bookings/${bookingId}/paid`)).send({ paidAtVenue });

async function createBooking(data: {
  courtId: string;
  who: string;
  start: string;
  end: string;
  day?: string;
  status?: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
  priceTotal?: number;
  paidAtVenue?: boolean;
  source?: 'APP' | 'PHONE';
  customerPhone?: string | null;
}): Promise<string> {
  const dayStr = data.day ?? '2026-11-20';
  const startAt = new Date(vn(data.start, dayStr));
  const endAt = new Date(vn(data.end, dayStr));
  const status = data.status ?? 'CONFIRMED';
  const row = await db.booking.create({
    data: {
      courtId: data.courtId,
      startAt,
      endAt,
      status,
      source: data.source ?? 'APP',
      createdById: ids[data.who],
      customerPhone: data.customerPhone !== undefined ? data.customerPhone : undefined,
      priceTotal: data.priceTotal ?? 120_000,
      paidAtVenue: data.paidAtVenue ?? false,
      confirmedAt: status === 'CONFIRMED' ? new Date(vn('08:00', dayStr)) : null,
      cancelledAt: status === 'CANCELLED' ? new Date(vn('09:00', dayStr)) : null,
      createdAt: new Date(vn('07:00', dayStr)),
    },
  });
  return row.id;
}

beforeAll(async () => {
  passwordHash = await hash('test-password');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Clock)
    .useValue(clock)
    .compile();
  app = setupApp(moduleRef.createNestApplication());
  await app.init();
  db = app.get(PrismaService);
});

afterAll(async () => {
  await app?.close();
});

beforeEach(async () => {
  clock.at = new Date(vn('10:00'));
  await db.$executeRawUnsafe('TRUNCATE "Notification", "MatchPlayer", "Match", "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');

  const user = (name: string, phone: string, role: 'OWNER' | 'USER') =>
    db.user.create({ data: { name, phone, role, passwordHash } }).then((u) => (ids[name] = u.id));

  await Promise.all([
    user('Bình', '0912345678', 'OWNER'),
    user('Dũng', '0912345679', 'OWNER'),
    user('An', '0901234567', 'USER'),
    user('Chi', '0901234568', 'USER'),
  ]);

  const venueA = await db.venue.create({
    data: {
      ownerId: ids['Bình'],
      name: 'Cầu lông A',
      address: '123 Đường A',
      phone: '0912345678',
      opensAt: 360,
      closesAt: 1380,
    },
  });
  ids.VA = venueA.id;

  const venueB = await db.venue.create({
    data: {
      ownerId: ids['Dũng'],
      name: 'Cầu lông B',
      address: '456 Đường B',
      phone: '0912345679',
      opensAt: 480,
      closesAt: 1320,
    },
  });
  ids.VB = venueB.id;

  const prices = { sport: 'BADMINTON' as const, priceNormal: 80_000, pricePeak: 120_000 };
  const court1 = await db.court.create({ data: { venueId: ids.VA, name: 'Sân 1', ...prices } });
  const court2 = await db.court.create({ data: { venueId: ids.VA, name: 'Sân 2', ...prices } });
  const courtB = await db.court.create({ data: { venueId: ids.VB, name: 'Sân 1', ...prices } });

  ids.A1 = court1.id;
  ids.A2 = court2.id;
  ids.B1 = courtB.id;
});

describe('Finance API (F-015 / UC-12)', () => {
  it('AC-1: in a week with 10 confirmed 1h bookings at 120.000đ and 8 marked paid, revenue is 960.000đ', async () => {
    // Week 16/11 to 22/11/2026. Create 10 bookings across the days.
    // 8 marked paid, 2 marked unpaid.
    for (let i = 0; i < 8; i++) {
      await createBooking({
        courtId: ids.A1,
        who: 'An',
        start: `${10 + i}:00`,
        end: `${11 + i}:00`,
        day: '2026-11-16',
        priceTotal: 120_000,
        paidAtVenue: true,
      });
    }
    for (let i = 0; i < 2; i++) {
      await createBooking({
        courtId: ids.A2,
        who: 'Chi',
        start: `${10 + i}:00`,
        end: `${11 + i}:00`,
        day: '2026-11-17',
        priceTotal: 120_000,
        paidAtVenue: false,
      });
    }

    const res = await getFinancials('Bình', ids.VA, { period: 'week', date: '2026-11-20' }).expect(200);
    const body: FinancialDashboardView = res.body;

    expect(body.revenue).toBe(960_000);
    expect(body.totalBookings).toBe(10);
    expect(body.paidBookings).toBe(8);
    expect(body.unpaidBookings).toBe(2);
    expect(body.bookedHours).toBe(10);
  });

  it('AC-2: calculates occupancyRate as confirmed booked hours divided by total court opening hours', async () => {
    // 2 courts, opensAt 360 (06:00), closesAt 1380 (23:00) -> 17h/day * 2 courts = 34 court hours/day.
    // 2 confirmed bookings of 1 hour on 2026-11-20 -> bookedHours = 2.
    // occupancyRate = 2 / 34 = 0.0588.
    await createBooking({ courtId: ids.A1, who: 'An', start: '10:00', end: '11:00', day: '2026-11-20' });
    await createBooking({ courtId: ids.A2, who: 'Chi', start: '14:00', end: '15:00', day: '2026-11-20' });

    const res = await getFinancials('Bình', ids.VA, { period: 'day', date: '2026-11-20' }).expect(200);
    const body: FinancialDashboardView = res.body;

    expect(body.bookedHours).toBe(2);
    expect(body.openingHours).toBe(34);
    expect(body.occupancyRate).toBe(0.0588);
  });

  it('AC-3: separates peak hours (17:00-22:00) and normal hours in 30-minute blocks', async () => {
    // 1 booking 15:00-16:00 (1h normal)
    // 1 booking 18:00-19:00 (1h peak)
    // 1 booking 16:30-17:30 (0.5h normal, 0.5h peak)
    await createBooking({ courtId: ids.A1, who: 'An', start: '15:00', end: '16:00', day: '2026-11-20' });
    await createBooking({ courtId: ids.A1, who: 'Chi', start: '18:00', end: '19:00', day: '2026-11-20' });
    await createBooking({ courtId: ids.A2, who: 'An', start: '16:30', end: '17:30', day: '2026-11-20' });

    const res = await getFinancials('Bình', ids.VA, { period: 'day', date: '2026-11-20' }).expect(200);
    const body: FinancialDashboardView = res.body;

    expect(body.normalHours).toBe(1.5);
    expect(body.peakHours).toBe(1.5);
  });

  it('AC-4: calculates cancellationRate and rejectionRate across all bookings', async () => {
    // 6 CONFIRMED, 2 CANCELLED, 2 REJECTED -> total 10 bookings.
    for (let i = 0; i < 6; i++) {
      await createBooking({ courtId: ids.A1, who: 'An', start: `${10 + i}:00`, end: `${11 + i}:00`, status: 'CONFIRMED' });
    }
    await createBooking({ courtId: ids.A1, who: 'Chi', start: '16:00', end: '17:00', status: 'CANCELLED' });
    await createBooking({ courtId: ids.A1, who: 'Chi', start: '17:00', end: '18:00', status: 'CANCELLED' });
    await createBooking({ courtId: ids.A2, who: 'An', start: '18:00', end: '19:00', status: 'REJECTED' });
    await createBooking({ courtId: ids.A2, who: 'An', start: '19:00', end: '20:00', status: 'REJECTED' });

    const res = await getFinancials('Bình', ids.VA, { period: 'week', date: '2026-11-20' }).expect(200);
    const body: FinancialDashboardView = res.body;

    expect(body.totalBookings).toBe(10);
    expect(body.cancelledBookings).toBe(2);
    expect(body.rejectedBookings).toBe(2);
    expect(body.cancellationRate).toBe(0.2);
    expect(body.rejectionRate).toBe(0.2);
  });

  it('AC-5: counts returning customers (>= 2 bookings by phone) and ignores null phone', async () => {
    // An (0901234567) has 3 bookings
    await createBooking({ courtId: ids.A1, who: 'An', start: '10:00', end: '11:00', day: '2026-11-05' });
    await createBooking({ courtId: ids.A1, who: 'An', start: '11:00', end: '12:00', day: '2026-11-10' });
    await createBooking({ courtId: ids.A1, who: 'An', start: '12:00', end: '13:00', day: '2026-11-15' });

    // Chi (0901234568) has 1 booking
    await createBooking({ courtId: ids.A2, who: 'Chi', start: '14:00', end: '15:00', day: '2026-11-20' });

    // Phone booking with no phone number
    await createBooking({
      courtId: ids.A2,
      who: 'Bình',
      start: '16:00',
      end: '17:00',
      day: '2026-11-25',
      source: 'PHONE',
      customerPhone: null,
    });

    const res = await getFinancials('Bình', ids.VA, { period: 'month', date: '2026-11-20' }).expect(200);
    const body: FinancialDashboardView = res.body;

    expect(body.totalCustomers).toBe(2);
    expect(body.returningCustomers).toBe(1);
  });

  it('AC-6: period with no bookings returns zeros and 0-filled chart points', async () => {
    const res = await getFinancials('Bình', ids.VA, { period: 'week', date: '2026-11-20' }).expect(200);
    const body: FinancialDashboardView = res.body;

    expect(body.revenue).toBe(0);
    expect(body.bookedHours).toBe(0);
    expect(body.occupancyRate).toBe(0);
    expect(body.totalBookings).toBe(0);
    expect(body.cancellationRate).toBe(0);
    expect(body.rejectionRate).toBe(0);
    expect(body.totalCustomers).toBe(0);
    expect(body.returningCustomers).toBe(0);
    expect(body.chartData.length).toBe(7);
    for (const point of body.chartData) {
      expect(point.revenue).toBe(0);
      expect(point.bookedHours).toBe(0);
      expect(point.bookingCount).toBe(0);
    }
  });

  it('AC-7: an owner cannot view financials of another owner venue (404), unauthenticated gets 401', async () => {
    // Dũng calls for Venue A (owned by Bình)
    await getFinancials('Dũng', ids.VA).expect(404);

    // Unauthenticated
    await getFinancials(null, ids.VA).expect(401);

    // User gets 403
    await getFinancials('An', ids.VA).expect(403);
  });

  it('AC-8: marking a confirmed booking as paid updates paidAtVenue and reflects in revenue', async () => {
    const bookingId = await createBooking({
      courtId: ids.A1,
      who: 'An',
      start: '10:00',
      end: '11:00',
      day: '2026-11-20',
      priceTotal: 120_000,
      paidAtVenue: false,
    });

    // Check initial revenue is 0
    const before = await getFinancials('Bình', ids.VA, { period: 'day', date: '2026-11-20' }).expect(200);
    expect(before.body.revenue).toBe(0);

    // Mark paid
    const markRes = await markPaid('Bình', bookingId, true).expect(200);
    const markBody: PaidAtVenueResponse = markRes.body;
    expect(markBody.id).toBe(bookingId);
    expect(markBody.paidAtVenue).toBe(true);

    // Revenue is now 120.000
    const after = await getFinancials('Bình', ids.VA, { period: 'day', date: '2026-11-20' }).expect(200);
    expect(after.body.revenue).toBe(120_000);
    expect(after.body.paidBookings).toBe(1);
    expect(after.body.unpaidBookings).toBe(0);
  });

  it('AC-9: refuses to mark paid for a booking that is not CONFIRMED with 400', async () => {
    const cancelledId = await createBooking({
      courtId: ids.A1,
      who: 'An',
      start: '10:00',
      end: '11:00',
      day: '2026-11-20',
      status: 'CANCELLED',
    });

    const res = await markPaid('Bình', cancelledId, true).expect(400);
    expect(res.body.message).toBe('Chỉ đánh dấu thu tiền cho booking đã xác nhận');
  });

  it('AC-10: an owner cannot mark paid for a booking at another owner venue (404), unauthenticated gets 401', async () => {
    const bookingId = await createBooking({
      courtId: ids.A1,
      who: 'An',
      start: '10:00',
      end: '11:00',
      day: '2026-11-20',
      status: 'CONFIRMED',
    });

    // Dũng attempts to mark Bình's booking
    await markPaid('Dũng', bookingId, true).expect(404);

    // Non-existent booking
    await markPaid('Bình', MISSING, true).expect(404);

    // Unauthenticated
    await markPaid(null, bookingId, true).expect(401);
  });
});
