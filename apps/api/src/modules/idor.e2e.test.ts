import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { setupApp } from '../setup-app.js';
import { issueSession } from './auth/session.js';
import { Clock } from './database/clock.js';
import { PrismaService } from './database/prisma.service.js';

const vn = (hhmm: string) => `2026-11-20T${hhmm}:00+07:00`;
const clock = { at: new Date(vn('10:00')), now() { return this.at; } };
const DENIED = [403, 404];
const expectDenied = (res: request.Response) => {
  expect(DENIED).toContain(res.status);
  expect(String(res.body?.message ?? '')).not.toMatch(/^Cannot /);
};

let app: INestApplication;
let db: PrismaService;
const ids: Record<string, string> = {};
const http = () => request(app.getHttpServer());
const as = (who: string) => (r: request.Test) => r.set('Cookie', `session=${issueSession(ids[who], clock.now())}`);

async function booking(who: string, court: string, status: 'PENDING' | 'CONFIRMED', start = '20:00', end = '21:00') {
  const row = await db.booking.create({
    data: {
      courtId: ids[court],
      startAt: new Date(vn(start)),
      endAt: new Date(vn(end)),
      status,
      source: 'APP',
      createdById: ids[who],
      priceTotal: 80_000,
      confirmDeadline: status === 'PENDING' ? new Date(vn('18:00')) : null,
      confirmedAt: status === 'CONFIRMED' ? new Date(vn('08:00')) : null,
      createdAt: new Date(vn('08:00')),
    },
  });
  return row.id;
}

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
  await db.$executeRawUnsafe(
    'TRUNCATE "Notification", "MatchPlayer", "Match", "Booking", "Court", "Venue", "AccessToken", "OAuthConnection", "OAuthRequest", "User", "AuthThrottle" CASCADE',
  );
  const passwordHash = await hash('test-password');
  const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER') =>
    db.user.create({ data: { name, phone, role, passwordHash } }).then((u) => (ids[name] = u.id));
  await Promise.all([
    user('admin', '0900000000', 'ADMIN'),
    user('ownerA', '0912345678', 'OWNER'),
    user('ownerB', '0912345679', 'OWNER'),
    user('userA', '0901234567', 'USER'),
    user('userB', '0901234568', 'USER'),
  ]);
  const prices = { sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 } as const;
  const venue = (ownerId: string, name: string, phone: string) =>
    db.venue.create({ data: { ownerId, name, address: name, phone, opensAt: 360, closesAt: 1380 } });
  ids.venueA = (await venue(ids.ownerA, 'Venue A', '0911111111')).id;
  ids.venueB = (await venue(ids.ownerB, 'Venue B', '0922222222')).id;
  ids.courtA = (await db.court.create({ data: { venueId: ids.venueA, name: 'Sân 1', ...prices } })).id;
  ids.courtB = (await db.court.create({ data: { venueId: ids.venueB, name: 'Sân 1', ...prices } })).id;
});

describe('user resources', () => {
  it('IDOR-1: userB cannot cancel the booking of userA (POST /api/bookings/:id/cancel)', async () => {
    const id = await booking('userA', 'courtA', 'PENDING');
    const res = await as('userB')(http().post(`/api/bookings/${id}/cancel`));
    expectDenied(res);
    expect(await db.booking.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'PENDING', cancelledAt: null });
  });

  it('IDOR-2: userB cannot mark the notification of userA as read (POST /api/notifications/:id/read)', async () => {
    const bookingId = await booking('userA', 'courtA', 'PENDING');
    const note = await db.notification.create({ data: { userId: ids.userA, type: 'BOOKING_REQUESTED', bookingId } });
    const res = await as('userB')(http().post(`/api/notifications/${note.id}/read`));
    expectDenied(res);
    expect((await db.notification.findUniqueOrThrow({ where: { id: note.id } })).readAt).toBeNull();
  });

  it('IDOR-3: userB cannot revoke the access token of userA (DELETE /api/me/access-tokens/:id)', async () => {
    const token = await db.accessToken.create({
      data: { userId: ids.userA, name: 'bot', scope: 'READ', prefix: 'mst_abcdefgh', tokenHash: 'a'.repeat(64), expiresAt: new Date(vn('23:00')) },
    });
    const res = await as('userB')(http().delete(`/api/me/access-tokens/${token.id}`));
    expectDenied(res);
    expect((await db.accessToken.findUniqueOrThrow({ where: { id: token.id } })).revokedAt).toBeNull();
  });

  it('IDOR-4: userB cannot revoke the OAuth connection of userA (DELETE /api/me/oauth-connections/:id)', async () => {
    const conn = await db.oAuthConnection.create({
      data: {
        userId: ids.userA,
        clientId: 'https://client.example',
        clientName: 'Client',
        scope: 'READ',
        accessTokenHash: 'b'.repeat(64),
        accessExpiresAt: new Date(vn('23:00')),
      },
    });
    const res = await as('userB')(http().delete(`/api/me/oauth-connections/${conn.id}`));
    expectDenied(res);
    expect((await db.oAuthConnection.findUniqueOrThrow({ where: { id: conn.id } })).revokedAt).toBeNull();
  });
});

describe('match host', () => {
  const hosted = async () => {
    const bookingId = await booking('userA', 'courtA', 'CONFIRMED');
    const match = await db.match.create({
      data: { bookingId, hostId: ids.userA, sport: 'BADMINTON', capacity: 4, pricePerSlot: 50_000, joinedCount: 1, joinMode: 'APPROVAL' },
    });
    await db.matchPlayer.create({ data: { matchId: match.id, userId: ids.userA, status: 'ACTIVE', joinedAt: new Date(vn('09:00')) } });
    await db.matchPlayer.create({ data: { matchId: match.id, userId: ids.admin, status: 'PENDING', joinedAt: new Date(vn('09:30')) } });
    return match.id;
  };

  it('IDOR-5: userB cannot list the join requests of a match hosted by userA (GET /api/matches/:id/requests)', async () => {
    const id = await hosted();
    const res = await as('userB')(http().get(`/api/matches/${id}/requests`));
    expectDenied(res);
    expect(JSON.stringify(res.body)).not.toContain(ids.admin);
  });

  it('IDOR-6: userB cannot approve a join request of a match hosted by userA (POST /api/matches/:id/requests/:userId/approve)', async () => {
    const id = await hosted();
    const res = await as('userB')(http().post(`/api/matches/${id}/requests/${ids.admin}/approve`));
    expectDenied(res);
    expect((await db.matchPlayer.findUniqueOrThrow({ where: { matchId_userId: { matchId: id, userId: ids.admin } } })).status).toBe('PENDING');
    expect((await db.match.findUniqueOrThrow({ where: { id } })).joinedCount).toBe(1);
  });

  it('IDOR-7: userB cannot cancel a match hosted by userA (POST /api/matches/:id/cancel)', async () => {
    const id = await hosted();
    const res = await as('userB')(http().post(`/api/matches/${id}/cancel`));
    expectDenied(res);
    expect((await db.match.findUniqueOrThrow({ where: { id } })).status).not.toBe('CANCELLED');
  });
});

describe('owner resources', () => {
  it('IDOR-8: ownerB cannot update the venue of ownerA (PATCH /api/owner/venues/:id)', async () => {
    const before = await db.venue.findUniqueOrThrow({ where: { id: ids.venueA } });
    const res = await as('ownerB')(http().patch(`/api/owner/venues/${ids.venueA}`)).send({ opensAt: 420 });
    expectDenied(res);
    expect(await db.venue.findUniqueOrThrow({ where: { id: ids.venueA } })).toEqual(before);
  });

  it('IDOR-9: ownerB cannot confirm a booking at the venue of ownerA (POST /api/owner/bookings/:id/confirm)', async () => {
    const id = await booking('userA', 'courtA', 'PENDING');
    const res = await as('ownerB')(http().post(`/api/owner/bookings/${id}/confirm`));
    expectDenied(res);
    expect(await db.booking.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'PENDING', confirmedAt: null });
  });

  it('IDOR-10: ownerB cannot reject a booking at the venue of ownerA (POST /api/owner/bookings/:id/reject)', async () => {
    const id = await booking('userA', 'courtA', 'PENDING');
    const res = await as('ownerB')(http().post(`/api/owner/bookings/${id}/reject`)).send({});
    expectDenied(res);
    expect((await db.booking.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING');
  });

  it('IDOR-11: ownerB cannot mark a booking at the venue of ownerA as paid (PATCH /api/owner/bookings/:id/paid)', async () => {
    const id = await booking('userA', 'courtA', 'CONFIRMED');
    const res = await as('ownerB')(http().patch(`/api/owner/bookings/${id}/paid`)).send({ paidAtVenue: true });
    expectDenied(res);
    expect((await db.booking.findUniqueOrThrow({ where: { id } })).paidAtVenue).toBe(false);
  });

  it('IDOR-12: ownerB cannot read the financials of the venue of ownerA (GET /api/owner/venues/:id/financials)', async () => {
    await booking('userA', 'courtA', 'CONFIRMED');
    const res = await as('ownerB')(http().get(`/api/owner/venues/${ids.venueA}/financials`));
    expectDenied(res);
    expect(res.body).not.toHaveProperty('chartData');
    expect(res.body).not.toHaveProperty('revenue');
  });

  it('IDOR-13: ownerB cannot lock a staff member of ownerA (POST /api/owner/staff/:id/lock)', async () => {
    const staff = await db.user.create({ data: { name: 'staff', phone: '0933333333', role: 'STAFF', staffVenueId: ids.venueA } });
    const res = await as('ownerB')(http().post(`/api/owner/staff/${staff.id}/lock`));
    expectDenied(res);
    expect((await db.user.findUniqueOrThrow({ where: { id: staff.id } })).lockedAt).toBeNull();
  });
});

describe('role check', () => {
  it('IDOR-14: a USER cannot lock an account (POST /api/admin/users/:id/lock)', async () => {
    const res = await as('userB')(http().post(`/api/admin/users/${ids.userA}/lock`));
    expect(res.status).toBe(403);
    expect((await db.user.findUniqueOrThrow({ where: { id: ids.userA } })).lockedAt).toBeNull();
  });
});
