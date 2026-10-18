import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import {
  ALREADY_IN_MATCH_MESSAGE,
  HOST_CANNOT_LEAVE_MESSAGE,
  LEAVE_STARTED_MESSAGE,
  MATCH_FULL_MESSAGE,
  MatchDetailView,
  MatchView,
  NOT_IN_MATCH_MESSAGE,
  NOT_JOINABLE_MESSAGE,
  NOT_LEAVABLE_MESSAGE,
} from '@monsport/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { MatchesService } from './matches.service.js';

// Data of brief F-012: Bình runs "Cầu lông A" ("10 Nguyễn Huệ", phone 0911111111, 06:00-23:00, "Sân 1" BADMINTON).
// Users: An, Chi, Em, Giang, Hà. Now is 20/11/2026 10:00 Asia/Ho_Chi_Minh.
const vn = (hhmm: string, day = '2026-11-20') => `${day}T${hhmm.length === 5 ? `${hhmm}:00` : hhmm}+07:00`;
const clock = { at: new Date(vn('10:00')), now() { return this.at; } };
const MISSING = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const BUSY = 'Yêu cầu đang được xử lý, hãy thử lại';

let app: INestApplication;
let db: PrismaService;
let passwordHash: string;
const ids: Record<string, string> = {};
const http = () => request(app.getHttpServer());
const as = (who: string | null) => (r: request.Test) => (who ? r.set('Cookie', `session=${issueSession(ids[who], clock.now())}`) : r);
const openMatch = (who: string | null, body: Record<string, unknown>) => as(who)(http().post('/api/matches')).send(body);
const cancelMatch = (who: string | null, id: string) => as(who)(http().post(`/api/matches/${id}/cancel`));
const joinMatch = (who: string | null, id: string) => as(who)(http().post(`/api/matches/${id}/join`));
const leaveMatch = (who: string | null, id: string) => as(who)(http().post(`/api/matches/${id}/leave`));
const detailMatch = (who: string | null, id: string) => as(who)(http().get(`/api/matches/${id}`));
const joinedMatches = (who: string | null) => as(who)(http().get('/api/matches/joined'));
const lobby = (query = '') => http().get(`/api/matches${query}`);

async function book(
  who: string,
  start: string,
  end: string,
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED' = 'PENDING',
  extra: { confirmDeadline?: string; createdAt?: string; day?: string } = {},
): Promise<string> {
  const day = extra.day ?? '2026-11-20';
  const startAt = new Date(vn(start, day));
  const row = await db.booking.create({
    data: {
      courtId: ids.A1,
      startAt,
      endAt: new Date(vn(end, day)),
      status,
      source: 'APP',
      createdById: ids[who],
      priceTotal: 80_000,
      confirmDeadline: status === 'PENDING' ? new Date(extra.confirmDeadline ? vn(extra.confirmDeadline, day) : startAt.getTime() - 3_600_000) : null,
      confirmedAt: status === 'CONFIRMED' ? new Date(vn('08:00')) : null,
      cancelledAt: status === 'CANCELLED' ? new Date(vn('08:30')) : null,
      createdAt: extra.createdAt ? new Date(vn(extra.createdAt)) : new Date(vn('08:00')),
    },
  });
  return row.id;
}

async function openMatchT(): Promise<string> {
  const bookingId = await book('An', '20:00', '21:00', 'PENDING');
  const res = await openMatch('An', { bookingId, capacity: 4, pricePerSlot: 50_000 }).expect(201);
  return res.body.id as string;
}

beforeAll(async () => {
  passwordHash = await hash('test-password');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue(clock).compile();
  app = setupApp(moduleRef.createNestApplication());
  await app.init();
  db = app.get(PrismaService);
});

afterAll(async () => {
  await app?.close();
});

describe('matches join, leave, detail, and joined list (F-012)', () => {
  beforeEach(async () => {
    clock.at = new Date(vn('10:00'));
    await db.$executeRawUnsafe('TRUNCATE "MatchPlayer", "Match", "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
    const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER') =>
      db.user.create({ data: { name, phone, role, passwordHash } }).then((u) => (ids[name] = u.id));
    await Promise.all([
      user('admin', '0900000000', 'ADMIN'),
      user('Bình', '0912345678', 'OWNER'),
      user('An', '0901234567', 'USER'),
      user('Chi', '0901234568', 'USER'),
      user('Em', '0901234569', 'USER'),
      user('Giang', '0901234570', 'USER'),
      user('Hà', '0901234571', 'USER'),
    ]);
    const a = await db.venue.create({
      data: { ownerId: ids['Bình'], name: 'Cầu lông A', address: '10 Nguyễn Huệ', phone: '0911111111', opensAt: 360, closesAt: 1380 },
    });
    ids.A1 = (await db.court.create({ data: { venueId: a.id, name: 'Sân 1', sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 } })).id;
  });

  it('AC-1: Chi joins match T and receives MatchDetailView with joinedCount = 2, viewerRole = PLAYER, and an ACTIVE MatchPlayer row', async () => {
    const matchT = await openMatchT();
    clock.at = new Date(vn('10:00:30'));
    const res = await joinMatch('Chi', matchT).expect(200);
    const parsed = MatchDetailView.parse(res.body);
    expect(parsed).toMatchObject({
      id: matchT,
      joinedCount: 2,
      status: 'OPEN',
      viewerRole: 'PLAYER',
      players: [
        { userId: ids['An'], name: 'An', phone: null, joinedAt: new Date(vn('10:00')).toISOString() },
        { userId: ids['Chi'], name: 'Chi', phone: null, joinedAt: new Date(vn('10:00:30')).toISOString() },
      ],
    });
    const row = await db.matchPlayer.findUniqueOrThrow({ where: { matchId_userId: { matchId: matchT, userId: ids['Chi'] } } });
    expect(row).toMatchObject({
      matchId: matchT,
      userId: ids['Chi'],
      status: 'ACTIVE',
      joinedAt: new Date(vn('10:00:30')),
      leftAt: null,
    });
  });

  it('AC-2: the 4th player turns match T FULL (BR-15) and hides it from the lobby, and the 5th player receives 409 MATCH_FULL_MESSAGE', async () => {
    const matchT = await openMatchT();
    await joinMatch('Chi', matchT).expect(200);
    const emRes = await joinMatch('Em', matchT).expect(200);
    expect(emRes.body).toMatchObject({ joinedCount: 3, status: 'OPEN' });

    const giangRes = await joinMatch('Giang', matchT).expect(200);
    expect(MatchDetailView.parse(giangRes.body)).toMatchObject({
      id: matchT,
      joinedCount: 4,
      status: 'FULL',
      viewerRole: 'PLAYER',
    });
    expect((await lobby().expect(200)).body).toEqual([]);

    const haRes = await joinMatch('Hà', matchT).expect(409);
    expect(haRes.body.message).toBe(MATCH_FULL_MESSAGE);
    expect(await db.matchPlayer.count({ where: { matchId: matchT, status: 'ACTIVE' } })).toBe(4);
  });

  it('AC-3: leaving a FULL match reopens it (BR-15), marks LEFT with leftAt, and re-joining updates the existing MatchPlayer row', async () => {
    const matchT = await openMatchT();
    await joinMatch('Chi', matchT).expect(200);
    await joinMatch('Em', matchT).expect(200);
    await joinMatch('Giang', matchT).expect(200);

    clock.at = new Date(vn('10:00'));
    const leaveRes = await leaveMatch('Giang', matchT).expect(200);
    expect(MatchDetailView.parse(leaveRes.body)).toMatchObject({
      id: matchT,
      joinedCount: 3,
      status: 'OPEN',
      viewerRole: 'NONE',
    });
    const giangRow = await db.matchPlayer.findUniqueOrThrow({ where: { matchId_userId: { matchId: matchT, userId: ids['Giang'] } } });
    expect(giangRow).toMatchObject({ status: 'LEFT', leftAt: new Date(vn('10:00')) });

    const lobbyList = await lobby().expect(200);
    expect(lobbyList.body.map((m: { id: string }) => m.id)).toEqual([matchT]);

    await joinMatch('Hà', matchT).expect(200);
    expect((await db.match.findUniqueOrThrow({ where: { id: matchT } })).status).toBe('FULL');

    clock.at = new Date(vn('10:05'));
    await leaveMatch('Hà', matchT).expect(200);
    expect(await db.matchPlayer.findUniqueOrThrow({ where: { matchId_userId: { matchId: matchT, userId: ids['Hà'] } } })).toMatchObject({
      status: 'LEFT',
      leftAt: new Date(vn('10:05')),
    });

    clock.at = new Date(vn('10:10'));
    const rejoinRes = await joinMatch('Hà', matchT).expect(200);
    expect(rejoinRes.body).toMatchObject({ joinedCount: 4, status: 'FULL' });
    const haRows = await db.matchPlayer.findMany({ where: { matchId: matchT, userId: ids['Hà'] } });
    expect(haRows).toHaveLength(1);
    expect(haRows[0]).toMatchObject({
      status: 'ACTIVE',
      joinedAt: new Date(vn('10:10')),
      leftAt: null,
    });
  });

  it('AC-4: 10 concurrent join requests for the last slot on a capacity-2 match yield 1 x 200, 9 x 409 MATCH_FULL_MESSAGE, and 0 x 500', async () => {
    const bConfirmed = await book('An', '18:00', '19:00', 'CONFIRMED');
    const matchId = (await openMatch('An', { bookingId: bConfirmed, capacity: 2, pricePerSlot: 50_000 }).expect(201)).body.id as string;

    const testUsers = await Promise.all(
      Array.from({ length: 10 }, (_, i) => {
        const name = `test-khach-${i + 1}`;
        const phone = `09090000${String(i + 1).padStart(2, '0')}`;
        return db.user.create({ data: { name, phone, role: 'USER', passwordHash } }).then((u) => {
          ids[name] = u.id;
          return name;
        });
      }),
    );

    const responses = await Promise.all(testUsers.map((who) => joinMatch(who, matchId).then((r) => r)));
    expect(responses.filter((r) => r.status >= 500)).toEqual([]);
    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    const rejected = responses.filter((r) => r.status === 409);
    expect(rejected).toHaveLength(9);
    expect(rejected.every((r) => r.body.message === MATCH_FULL_MESSAGE)).toBe(true);

    const finalMatch = await db.match.findUniqueOrThrow({ where: { id: matchId } });
    expect(finalMatch).toMatchObject({ joinedCount: 2, status: 'FULL' });
    expect(await db.matchPlayer.count({ where: { matchId, status: 'ACTIVE' } })).toBe(2);
  });

  it('AC-5: refuses duplicate join, cancelled/started/overdue matches (persisting lazy EXPIRED/CANCELLED), missing UUID, bad UUID, and non-USER roles', async () => {
    const matchT = await openMatchT();
    await joinMatch('Chi', matchT).expect(200);

    const bCancelled = await book('An', '17:00', '18:00', 'CONFIRMED');
    const mCancelled = (await openMatch('An', { bookingId: bCancelled, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;
    await cancelMatch('An', mCancelled).expect(200);

    const bStarted = await book('An', '11:00', '12:00', 'CONFIRMED');
    const mStarted = (await openMatch('An', { bookingId: bStarted, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;
    await db.booking.update({ where: { id: bStarted }, data: { startAt: new Date(vn('09:00')), endAt: new Date(vn('10:30')) } });

    const bOverdue = await book('An', '13:00', '14:00', 'PENDING', { confirmDeadline: '11:00' });
    const mOverdue = (await openMatch('An', { bookingId: bOverdue, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;
    await db.booking.update({ where: { id: bOverdue }, data: { confirmDeadline: new Date(vn('09:30')) } });

    for (const who of ['An', 'Chi'] as const) {
      const res = await joinMatch(who, matchT).expect(409);
      expect(res.body.message).toBe(ALREADY_IN_MATCH_MESSAGE);
    }

    for (const mId of [mCancelled, mStarted, mOverdue]) {
      const res = await joinMatch('Em', mId).expect(409);
      expect(res.body.message).toBe(NOT_JOINABLE_MESSAGE);
    }
    expect((await db.booking.findUniqueOrThrow({ where: { id: bOverdue } })).status).toBe('EXPIRED');
    expect((await db.match.findUniqueOrThrow({ where: { id: mOverdue } })).status).toBe('CANCELLED');

    expect((await joinMatch('Em', MISSING).expect(404)).body.message).toBe('Không tìm thấy trận');
    expect((await joinMatch('Em', 'abc').expect(400)).body.message).toBe('Dữ liệu không hợp lệ');
    for (const [who, status] of [['Bình', 403], ['admin', 403], [null, 401]] as const) {
      await joinMatch(who, matchT).expect(status);
    }
    expect((await db.match.findUniqueOrThrow({ where: { id: matchT } })).joinedCount).toBe(2);
  });

  it('AC-6: refuses leave for host, non-member, started match at exact startAt boundary (BR-18), cancelled match, missing UUID, and non-USER roles', async () => {
    const matchT = await openMatchT();
    await joinMatch('Chi', matchT).expect(200);
    await joinMatch('Em', matchT).expect(200);

    const b1030 = await book('An', '10:30', '11:30', 'CONFIRMED');
    const m1030 = (await openMatch('An', { bookingId: b1030, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;
    await joinMatch('Giang', m1030).expect(200);

    const bCancelled = await book('An', '18:00', '19:00', 'CONFIRMED');
    const mCancelled = (await openMatch('An', { bookingId: bCancelled, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;
    await joinMatch('Hà', mCancelled).expect(200);
    await cancelMatch('An', mCancelled).expect(200);

    expect((await leaveMatch('An', matchT).expect(409)).body.message).toBe(HOST_CANNOT_LEAVE_MESSAGE);
    expect((await leaveMatch('Hà', matchT).expect(409)).body.message).toBe(NOT_IN_MATCH_MESSAGE);

    // 1 ms before 10:30:00.000: leave succeeds, then Giang rejoins.
    clock.at = new Date(new Date(vn('10:30')).getTime() - 1);
    await leaveMatch('Giang', m1030).expect(200);
    await joinMatch('Giang', m1030).expect(200);

    // Exactly at 10:30:00.000: leave is refused with LEAVE_STARTED_MESSAGE (BR-18, 8.1.E1).
    clock.at = new Date(vn('10:30'));
    expect((await leaveMatch('Giang', m1030).expect(409)).body.message).toBe(LEAVE_STARTED_MESSAGE);

    clock.at = new Date(vn('10:00'));
    expect((await leaveMatch('Hà', mCancelled).expect(409)).body.message).toBe(NOT_LEAVABLE_MESSAGE);
    expect((await leaveMatch('Chi', MISSING).expect(404)).body.message).toBe('Không tìm thấy trận');
    expect((await leaveMatch('Chi', 'abc').expect(400)).body.message).toBe('Dữ liệu không hợp lệ');
    for (const [who, status] of [['Bình', 403], ['admin', 403], [null, 401]] as const) {
      await leaveMatch(who, matchT).expect(status);
    }
  });

  it('AC-7: GET /api/matches/:id returns ACTIVE players in joinedAt order and reveals phone numbers only to the host (BR-20)', async () => {
    clock.at = new Date(vn('10:00'));
    const matchT = await openMatchT();
    clock.at = new Date(vn('10:00:30'));
    await joinMatch('Chi', matchT).expect(200);
    clock.at = new Date(vn('10:01'));
    await joinMatch('Em', matchT).expect(200);
    clock.at = new Date(vn('10:02'));
    await joinMatch('Giang', matchT).expect(200);
    clock.at = new Date(vn('10:03'));
    await leaveMatch('Giang', matchT).expect(200);

    const forChi = MatchDetailView.parse((await detailMatch('Chi', matchT).expect(200)).body);
    expect(forChi.viewerRole).toBe('PLAYER');
    expect(forChi.players.map((p) => [p.name, p.phone])).toEqual([
      ['An', null],
      ['Chi', null],
      ['Em', null],
    ]);

    const forAn = MatchDetailView.parse((await detailMatch('An', matchT).expect(200)).body);
    expect(forAn.viewerRole).toBe('HOST');
    expect(forAn.players.map((p) => [p.name, p.phone])).toEqual([
      ['An', '0901234567'],
      ['Chi', '0901234568'],
      ['Em', '0901234569'],
    ]);

    const forHa = MatchDetailView.parse((await detailMatch('Hà', matchT).expect(200)).body);
    expect(forHa.viewerRole).toBe('NONE');
    expect(forHa.players.map((p) => [p.name, p.phone])).toEqual([
      ['An', null],
      ['Chi', null],
      ['Em', null],
    ]);

    for (const [who, status] of [[null, 401], ['Bình', 403], ['admin', 403]] as const) {
      await detailMatch(who, matchT).expect(status);
    }
    expect((await detailMatch('Chi', MISSING).expect(404)).body.message).toBe('Không tìm thấy trận');
    expect((await detailMatch('Chi', 'abc').expect(400)).body.message).toBe('Dữ liệu không hợp lệ');
  });

  it('AC-8: GET /api/matches/joined lists matches where the caller is ACTIVE across all statuses (finishing past matches) with no phone numbers', async () => {
    const matchT = await openMatchT();
    await joinMatch('Chi', matchT).expect(200);

    const b1900 = await book('An', '19:00', '20:00', 'CONFIRMED');
    const m1900 = (await openMatch('An', { bookingId: b1900, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;
    await joinMatch('Chi', m1900).expect(200);
    await cancelMatch('An', m1900).expect(200);

    const b1030 = await book('An', '10:30', '11:30', 'CONFIRMED');
    const m1030 = (await openMatch('An', { bookingId: b1030, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;
    await joinMatch('Chi', m1030).expect(200);

    const b1800 = await book('An', '18:00', '19:00', 'CONFIRMED');
    const m1800 = (await openMatch('An', { bookingId: b1800, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;
    await joinMatch('Chi', m1800).expect(200);
    await leaveMatch('Chi', m1800).expect(200);

    clock.at = new Date(vn('11:31'));
    const res = await joinedMatches('Chi').expect(200);
    const list = (res.body as unknown[]).map((item) => MatchView.parse(item));
    expect(list.map((m) => [m.id, m.status])).toEqual([
      [matchT, 'OPEN'],
      [m1900, 'CANCELLED'],
      [m1030, 'FINISHED'],
    ]);
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('0901234567');
    expect(serialized).not.toContain('0901234568');

    for (const [who, status] of [['Bình', 403], ['admin', 403], [null, 401]] as const) {
      await joinedMatches(who).expect(status);
    }
  });

  it('AC-10: concurrent host cancel, player leave, and 3 player joins produce no 500 and keep joinedCount equal to ACTIVE rows', async () => {
    const matchT = await openMatchT();
    await joinMatch('Chi', matchT).expect(200);

    const [cancelRes, leaveRes, ...joinResponses] = await Promise.all([
      cancelMatch('An', matchT).then((r) => r),
      leaveMatch('Chi', matchT).then((r) => r),
      joinMatch('Em', matchT).then((r) => r),
      joinMatch('Giang', matchT).then((r) => r),
      joinMatch('Hà', matchT).then((r) => r),
    ]);

    const all = [cancelRes, leaveRes, ...joinResponses];
    expect(all.filter((r) => r.status >= 500)).toEqual([]);

    const finalMatch = await db.match.findUniqueOrThrow({ where: { id: matchT }, include: { booking: true } });
    const activeCount = await db.matchPlayer.count({ where: { matchId: matchT, status: 'ACTIVE' } });
    expect(finalMatch.joinedCount).toBe(activeCount);
    if (finalMatch.status === 'CANCELLED') {
      expect(finalMatch.booking.status).toBe('CANCELLED');
    }
    for (const jr of joinResponses.filter((r) => r.status !== 200)) {
      expect(jr.status).toBe(409);
      expect([NOT_JOINABLE_MESSAGE, MATCH_FULL_MESSAGE]).toContain(jr.body.message);
    }
  });
});

describe('a transaction that Postgres ends in MatchesService F-012 methods', () => {
  const ended = (code: string) => Object.assign(new Error('ended by Postgres'), { code });
  const USER = '0199a1b2-0000-7000-8000-000000000001';
  const MATCH = '0199a1b2-0000-7000-8000-000000000003';
  const fixed = { now: () => new Date(vn('10:00')) } as Clock;
  const service = (prisma: Record<string, unknown>) => new MatchesService(prisma as unknown as PrismaService, fixed);

  for (const code of ['40P01', 'P2034']) {
    it(`join and leave answer 409 after ${code}, and joined and detail retry once`, async () => {
      const prisma = {
        match: {
          findUnique: vi.fn().mockResolvedValue({ bookingId: 'b', booking: { courtId: 'c' } }),
          findMany: vi.fn(),
        },
        $transaction: vi.fn().mockRejectedValue(ended(code)),
        $executeRaw: vi.fn().mockRejectedValue(ended(code)),
      };
      await expect(service(prisma).join(USER, MATCH)).rejects.toThrow(BUSY);
      await expect(service(prisma).leave(USER, MATCH)).rejects.toThrow(BUSY);

      prisma.$executeRaw.mockClear();
      const joinedFailure = service(prisma).joined(USER);
      await expect(joinedFailure).rejects.toBeInstanceOf(ConflictException);
      await expect(joinedFailure).rejects.toThrow(BUSY);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

      prisma.$executeRaw.mockClear();
      const detailFailure = service(prisma).detail(USER, MATCH);
      await expect(detailFailure).rejects.toBeInstanceOf(ConflictException);
      await expect(detailFailure).rejects.toThrow(BUSY);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    });
  }
});
