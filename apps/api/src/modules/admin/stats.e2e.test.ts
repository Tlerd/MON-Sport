import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { AdminStatsView } from '@monsport/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

// Test week: Monday 2026-11-16 to Sunday 2026-11-22, Asia/Ho_Chi_Minh. Default clock: 20/11 at 12:00 in Vietnam.
const vn = (day: string, hhmm = '10:00') => new Date(`${day}T${hhmm}:00+07:00`);
const DEFAULT_NOW = new Date('2026-11-20T05:00:00Z');
const clock = { at: DEFAULT_NOW, now() { return this.at; } };
const OUTSIDE = vn('2026-11-01'); // A createdAt that falls outside the test week.

let app: INestApplication;
let db: PrismaService;
let passwordHash: string;
let seq = 0;
const ids: Record<string, string> = {};
const http = () => request(app.getHttpServer());
const as = (who: string | null) => (r: request.Test) => (who ? r.set('Cookie', `session=${issueSession(ids[who], clock.now())}`) : r);
const getStats = (who: string | null, date?: string) => as(who)(http().get('/api/admin/stats')).query(date === undefined ? {} : { date });

type Status = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

// Each booking gets its own slot in December by default, so no two live bookings of one court overlap.
async function booking(data: {
  court?: string;
  who?: string;
  status?: Status;
  source?: 'APP' | 'PHONE';
  createdAt?: Date;
  startAt?: Date;
  confirmedAt?: Date | null;
  confirmDeadline?: Date | null;
}): Promise<string> {
  const startAt = data.startAt ?? new Date(Date.UTC(2026, 11, 10) + seq++ * 2 * 3_600_000);
  const row = await db.booking.create({
    data: {
      courtId: ids[data.court ?? 'A1'],
      startAt,
      endAt: new Date(startAt.getTime() + 3_600_000),
      status: data.status ?? 'CONFIRMED',
      source: data.source ?? 'APP',
      createdById: ids[data.who ?? 'An'],
      customerPhone: data.source === 'PHONE' ? '0987654321' : undefined,
      priceTotal: 120_000,
      confirmDeadline: data.confirmDeadline ?? null,
      confirmedAt: data.confirmedAt === undefined ? null : data.confirmedAt,
      createdAt: data.createdAt ?? OUTSIDE,
    },
  });
  return row.id;
}

async function match(data: { bookingId: string; host: string; status?: 'OPEN' | 'CANCELLED'; createdAt?: Date }): Promise<string> {
  const row = await db.match.create({
    data: {
      bookingId: data.bookingId,
      hostId: ids[data.host],
      sport: 'BADMINTON',
      capacity: 4,
      pricePerSlot: 30_000,
      status: data.status ?? 'OPEN',
      joinedCount: 1,
      createdAt: data.createdAt ?? OUTSIDE,
    },
  });
  return row.id;
}

const makeUsers = (count: number, role: 'OWNER' | 'USER', extra: { createdAt?: Date; lockedAt?: Date; deletedAt?: Date } = {}, tag = 'x') =>
  db.user.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      name: `${tag}-${role}-${i}`,
      phone: `${role === 'OWNER' ? '08' : '07'}${String(seq++ + 1_000_000).padStart(8, '0')}`,
      role,
      passwordHash,
      createdAt: OUTSIDE,
      ...extra,
    })),
  });

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
  clock.at = DEFAULT_NOW;
  seq = 0;
  await db.$executeRawUnsafe('TRUNCATE "Notification", "MatchPlayer", "Match", "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');

  const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER') =>
    db.user.create({ data: { name, phone, role, passwordHash, createdAt: OUTSIDE } }).then((u) => (ids[name] = u.id));

  await Promise.all([
    user('Quản trị', '0900000001', 'ADMIN'),
    user('Bình', '0912345678', 'OWNER'),
    user('Dũng', '0912345679', 'OWNER'),
    user('An', '0901234567', 'USER'),
    user('Chi', '0901234568', 'USER'),
    user('Lan', '0901234569', 'USER'),
    user('Mai', '0901234570', 'USER'),
  ]);

  const venue = (ownerId: string, name: string, phone: string) =>
    db.venue.create({ data: { ownerId, name, address: '1 Đường Test', phone, opensAt: 360, closesAt: 1380 } });
  ids.VA = (await venue(ids['Bình'], 'Cầu lông A', '0912345678')).id;
  ids.VB = (await venue(ids['Dũng'], 'Cầu lông B', '0912345679')).id;

  const prices = { sport: 'BADMINTON' as const, priceNormal: 80_000, pricePeak: 120_000 };
  ids.A1 = (await db.court.create({ data: { venueId: ids.VA, name: 'Sân 1', ...prices } })).id;
  ids.A2 = (await db.court.create({ data: { venueId: ids.VA, name: 'Sân 2', ...prices } })).id;
  ids.B1 = (await db.court.create({ data: { venueId: ids.VB, name: 'Sân 1', ...prices } })).id;
});

describe('Admin stats API (F-016 / UC-13)', () => {
  it('AC-1: counts accounts by role, keeps locked users, skips deleted users', async () => {
    // Seed has 1 admin, 2 owners, 4 users. Add 1 owner and 36 users: 3 owners and 40 users in all.
    await makeUsers(1, 'OWNER');
    await makeUsers(35, 'USER');
    await makeUsers(1, 'USER', { lockedAt: vn('2026-11-10') }, 'locked');
    await makeUsers(1, 'USER', { deletedAt: vn('2026-11-10') }, 'deleted');
    await makeUsers(1, 'OWNER', { deletedAt: vn('2026-11-10') }, 'deleted');

    const res = await getStats('Quản trị', '2026-11-20').expect(200);
    expect(AdminStatsView.parse(res.body)).toEqual(res.body);
    expect(res.body.accounts).toEqual({ ADMIN: 1, OWNER: 3, USER: 40 });
  });

  it('AC-2: counts new users of the week only, by Vietnam time, USER role only', async () => {
    const at = async (date: Date, role: 'OWNER' | 'USER', n = 1) => void (await makeUsers(n, role, { createdAt: date }));
    await at(new Date('2026-11-15T17:30:00Z'), 'USER'); // 00:30 on 16/11 in Vietnam: in the week.
    await at(vn('2026-11-17'), 'USER');
    await at(vn('2026-11-19'), 'USER');
    await at(vn('2026-11-21'), 'USER');
    await at(new Date('2026-11-22T16:59:59.999Z'), 'USER'); // 23:59:59.999 on 22/11: in the week.
    await at(vn('2026-11-15'), 'USER'); // 15/11: out.
    await at(new Date('2026-11-22T17:00:00Z'), 'USER'); // 00:00 on 23/11: out.
    await at(vn('2026-11-18'), 'OWNER');

    const res = await getStats('Quản trị', '2026-11-20').expect(200);
    expect(res.body.newUsers).toBe(5);
  });

  it('AC-3: counts an active user once, from bookings, joins and hosted matches in the week', async () => {
    // An creates an APP booking on 17/11 and joins a match on 20/11.
    await booking({ who: 'An', source: 'APP', createdAt: vn('2026-11-17') });
    // Matches sit on bookings that the owner made by phone. Those PHONE bookings are created in the week, and Dũng (an owner) hosts a match in the week: neither counts.
    const hosted = await match({
      bookingId: await booking({ who: 'Bình', source: 'PHONE', createdAt: vn('2026-11-18') }),
      host: 'Lan',
      createdAt: vn('2026-11-19'),
    });
    const other = await match({
      bookingId: await booking({ who: 'Bình', source: 'PHONE', createdAt: vn('2026-11-18') }),
      host: 'Dũng',
      createdAt: vn('2026-11-19'),
    });
    await db.matchPlayer.create({ data: { matchId: other, userId: ids['Chi'], status: 'ACTIVE', joinedAt: vn('2026-11-18') } });
    await db.matchPlayer.create({ data: { matchId: hosted, userId: ids['An'], status: 'ACTIVE', joinedAt: vn('2026-11-20') } });
    // Mai is active only on 25/11. Her match falls in no week day.
    const late = await match({ bookingId: await booking({ who: 'Bình', source: 'PHONE' }), host: 'Mai', createdAt: vn('2026-11-25') });
    await db.matchPlayer.create({ data: { matchId: late, userId: ids['Mai'], status: 'ACTIVE', joinedAt: vn('2026-11-25') } });

    const res = await getStats('Quản trị', '2026-11-20').expect(200);
    expect(res.body.activeUsers).toBe(3);
  });

  it('AC-16: PENDING and REJECTED rows and a cancelled request do not make an active user, ACTIVE and LEFT rows do', async () => {
    // Dũng is an owner, so hosting does not count. His match and bookings are outside the week.
    const m = await match({ bookingId: await booking({ who: 'Bình', source: 'PHONE' }), host: 'Dũng' });
    const row = (who: string, status: 'PENDING' | 'REJECTED' | 'ACTIVE' | 'LEFT') =>
      db.matchPlayer.create({ data: { matchId: m, userId: ids[who], status, joinedAt: vn('2026-11-18') } });
    await row('An', 'PENDING');
    await row('Chi', 'REJECTED');
    // Lan sent a request and cancelled it: no row exists.
    let res = await getStats('Quản trị', '2026-11-20').expect(200);
    expect(res.body.activeUsers).toBe(0);

    await row('Mai', 'ACTIVE');
    await row('Lan', 'LEFT');
    res = await getStats('Quản trị', '2026-11-20').expect(200);
    expect(res.body.activeUsers).toBe(2);
  });

  it('AC-4: counts confirmed bookings and live matches of each venue, sorted by name, overdue pending excluded', async () => {
    const day = '2026-11-17';
    const confirmed: string[] = [];
    for (const hh of ['08:00', '10:00']) confirmed.push(await booking({ court: 'A1', status: 'CONFIRMED', startAt: vn(day, hh) }));
    for (const hh of ['08:00', '10:00']) confirmed.push(await booking({ court: 'A2', status: 'CONFIRMED', startAt: vn(day, hh) }));
    const cancelled = await booking({ court: 'A1', status: 'CANCELLED', startAt: vn(day, '14:00') });
    await booking({ court: 'A1', status: 'CONFIRMED', startAt: vn('2026-11-25', '08:00') });
    const overdue = await booking({
      court: 'A2',
      status: 'PENDING',
      startAt: vn('2026-11-18', '15:00'),
      confirmDeadline: vn('2026-11-17', '12:00'),
    });

    await match({ bookingId: confirmed[0], host: 'An', status: 'OPEN' });
    await match({ bookingId: cancelled, host: 'Chi', status: 'CANCELLED' });
    await match({ bookingId: overdue, host: 'Lan', status: 'OPEN' });

    const res = await getStats('Quản trị', '2026-11-20').expect(200);
    expect(res.body.venues).toEqual([
      { venueId: ids.VA, venueName: 'Cầu lông A', bookingCount: 4, matchCount: 1 },
      { venueId: ids.VB, venueName: 'Cầu lông B', bookingCount: 0, matchCount: 0 },
    ]);
  });

  it('AC-5: averages confirm minutes of APP bookings only', async () => {
    const created = vn('2026-11-17', '09:00');
    for (const minutes of [10, 20, 45]) {
      await booking({ source: 'APP', status: 'CONFIRMED', createdAt: created, confirmedAt: new Date(created.getTime() + minutes * 60_000) });
    }
    await booking({ who: 'Bình', source: 'PHONE', status: 'CONFIRMED', createdAt: created, confirmedAt: new Date(created.getTime() + 600 * 60_000) });

    const res = await getStats('Quản trị', '2026-11-20').expect(200);
    expect(res.body.avgConfirmMinutes).toBe(25);
  });

  it('AC-6: expiry rate counts EXPIRED and overdue PENDING, leaves out live PENDING and CANCELLED', async () => {
    const createdAt = vn('2026-11-17', '09:00');
    for (let i = 0; i < 6; i++) await booking({ status: 'CONFIRMED', createdAt, confirmedAt: createdAt });
    for (let i = 0; i < 2; i++) await booking({ status: 'REJECTED', createdAt });
    await booking({ status: 'EXPIRED', createdAt });
    await booking({ status: 'PENDING', createdAt, confirmDeadline: vn('2026-11-17', '12:00') }); // Overdue, still PENDING in the data.
    for (let i = 0; i < 3; i++) await booking({ status: 'PENDING', createdAt, confirmDeadline: vn('2026-11-21', '12:00') });
    for (let i = 0; i < 4; i++) await booking({ status: 'CANCELLED', createdAt });

    const res = await getStats('Quản trị', '2026-11-20').expect(200);
    expect(res.body.expiryRate).toBe(0.2);
  });

  it('AC-7: a week with no bookings gives null average, zero rate and zero counts', async () => {
    const res = await getStats('Quản trị', '2026-11-20').expect(200);
    expect(res.body.avgConfirmMinutes).toBeNull();
    expect(res.body.expiryRate).toBe(0);
    expect(res.body.venues).toHaveLength(2);
    for (const v of res.body.venues) {
      expect(v.bookingCount).toBe(0);
      expect(v.matchCount).toBe(0);
    }
  });

  it('AC-8: USER and OWNER get 403, a guest gets 401', async () => {
    await getStats('An', '2026-11-20').expect(403);
    await getStats('Bình', '2026-11-20').expect(403);
    await getStats(null, '2026-11-20').expect(401);
  });

  it('AC-9: a bad date gets 400 with the Vietnamese message', async () => {
    for (const date of ['2026-13-45', 'abc', '2026-02-30']) {
      const res = await getStats('Quản trị', date).expect(400);
      expect(res.body.message).toBe('Tham số truy vấn không hợp lệ');
    }
  });

  it('AC-10: opening the dashboard writes nothing, and an overdue pending booking stays PENDING', async () => {
    const createdAt = vn('2026-11-17', '09:00');
    const overdue = await booking({
      who: 'An',
      status: 'PENDING',
      createdAt,
      startAt: vn('2026-11-21', '10:00'),
      confirmDeadline: vn('2026-11-18', '09:00'),
    });
    const open = await match({ bookingId: overdue, host: 'An', status: 'OPEN', createdAt });
    await db.matchPlayer.create({ data: { matchId: open, userId: ids['Chi'], status: 'ACTIVE', joinedAt: createdAt } });
    const confirmed = await booking({ who: 'Lan', status: 'CONFIRMED', createdAt, confirmedAt: createdAt });
    const kept = await match({ bookingId: confirmed, host: 'Lan', status: 'OPEN', createdAt });

    const snapshot = async () => ({
      users: await db.user.findMany({ orderBy: { id: 'asc' } }),
      bookings: await db.booking.findMany({ orderBy: { id: 'asc' } }),
      matches: await db.match.findMany({ orderBy: { id: 'asc' } }),
      players: await db.matchPlayer.findMany({ orderBy: [{ matchId: 'asc' }, { userId: 'asc' }] }),
    });
    const before = await snapshot();
    await getStats('Quản trị').expect(200);
    const after = await snapshot();

    expect(after).toEqual(before);
    expect(after.bookings.find((b) => b.id === overdue)?.status).toBe('PENDING');
    expect(after.matches.find((m) => m.id === open)?.status).toBe('OPEN');
    expect(after.matches.find((m) => m.id === kept)?.status).toBe('OPEN');
  });

  it('AC-11: a Sunday 23:30 booking counts in the week and a Monday 00:00 booking does not', async () => {
    await booking({ court: 'A1', status: 'CONFIRMED', startAt: new Date('2026-11-22T23:30:00+07:00') });
    await booking({ court: 'A2', status: 'CONFIRMED', startAt: new Date('2026-11-23T00:00:00+07:00') });

    const res = await getStats('Quản trị', '2026-11-20').expect(200);
    const venueA = res.body.venues.find((v: { venueId: string }) => v.venueId === ids.VA);
    expect(venueA.bookingCount).toBe(1);
  });

  it('AC-12: with no date, the default is today in Vietnam, not in UTC', async () => {
    clock.at = new Date('2026-11-22T17:30:00Z'); // 00:30 Monday 23/11 in Vietnam.
    const res = await getStats('Quản trị').expect(200);
    expect(res.body.date).toBe('2026-11-23');
    expect(res.body.weekStart).toBe('2026-11-23');
    expect(res.body.weekEnd).toBe('2026-11-29');
  });
});
