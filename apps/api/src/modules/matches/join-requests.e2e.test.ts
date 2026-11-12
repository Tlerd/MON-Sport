import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { JOIN_REJECTED_MESSAGE, MatchDetailView, MatchRequestListView, MatchView } from '@monsport/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

// Brief F-028 step 2. Data as in join-leave.e2e.test.ts: Bình runs "Cầu lông A". Users: An (host), Chi, Em, Giang, Hà.
// Now is 20/11/2026 10:00 Asia/Ho_Chi_Minh.
const vn = (hhmm: string, day = '2026-11-20') => `${day}T${hhmm.length === 5 ? `${hhmm}:00` : hhmm}+07:00`;
const clock = { at: new Date(vn('10:00')), now() { return this.at; } };

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
const requestsOf = (who: string | null, id: string) => as(who)(http().get(`/api/matches/${id}/requests`));

async function book(who: string, start: string, end: string): Promise<string> {
  const startAt = new Date(vn(start));
  const row = await db.booking.create({
    data: {
      courtId: ids.A1,
      startAt,
      endAt: new Date(vn(end)),
      status: 'CONFIRMED',
      source: 'APP',
      createdById: ids[who],
      priceTotal: 80_000,
      confirmedAt: new Date(vn('08:00')),
      createdAt: new Date(vn('08:00')),
    },
  });
  return row.id;
}

async function openT(joinMode?: 'INSTANT' | 'APPROVAL', start = '20:00', end = '21:00'): Promise<string> {
  const bookingId = await book('An', start, end);
  const res = await openMatch('An', { bookingId, capacity: 4, pricePerSlot: 50_000, ...(joinMode ? { joinMode } : {}) }).expect(201);
  return res.body.id as string;
}

/** A FULL 4/4 APPROVAL match: the host plus Em, Giang, and Hà with ACTIVE rows. */
async function fillMatch(matchId: string): Promise<void> {
  for (const who of ['Em', 'Giang', 'Hà']) {
    await db.matchPlayer.create({ data: { matchId, userId: ids[who], status: 'ACTIVE', joinedAt: new Date(vn('09:00')) } });
  }
  await db.match.update({ where: { id: matchId }, data: { joinedCount: 4, status: 'FULL' } });
}

const row = (matchId: string, who: string) => db.matchPlayer.findUnique({ where: { matchId_userId: { matchId, userId: ids[who] } } });

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

describe('match join requests (F-028 step 2)', () => {
  beforeEach(async () => {
    clock.at = new Date(vn('10:00'));
    await db.$executeRawUnsafe('TRUNCATE "Notification", "MatchPlayer", "Match", "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
    const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER') =>
      db.user.create({ data: { name, phone, role, passwordHash } }).then((u) => (ids[name] = u.id));
    await Promise.all([
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

  it('AC-1: POST /api/matches with joinMode APPROVAL gives APPROVAL and joinedCount 1, and without joinMode gives INSTANT', async () => {
    const first = await openMatch('An', { bookingId: await book('An', '18:00', '19:00'), capacity: 4, pricePerSlot: 50_000, joinMode: 'APPROVAL' }).expect(201);
    expect(MatchView.parse(first.body)).toMatchObject({ joinMode: 'APPROVAL', joinedCount: 1 });
    const second = await openMatch('An', { bookingId: await book('An', '20:00', '21:00'), capacity: 4, pricePerSlot: 50_000 }).expect(201);
    expect(MatchView.parse(second.body)).toMatchObject({ joinMode: 'INSTANT', joinedCount: 1 });
  });

  it('AC-2: join on an INSTANT match still gives the player a slot', async () => {
    const matchId = await openT();
    const res = await joinMatch('Chi', matchId).expect(200);
    expect(MatchDetailView.parse(res.body)).toMatchObject({ joinMode: 'INSTANT', joinedCount: 2, viewerRole: 'PLAYER', myRequest: null });
    expect(await row(matchId, 'Chi')).toMatchObject({ status: 'ACTIVE' });
  });

  it('AC-3: join on an APPROVAL match, OPEN or FULL, gives myRequest PENDING and no slot, and a second join changes nothing', async () => {
    const open = await openT('APPROVAL', '18:00', '19:00');
    clock.at = new Date(vn('10:01'));
    const lan = await joinMatch('Chi', open).expect(200);
    expect(MatchDetailView.parse(lan.body)).toMatchObject({ myRequest: 'PENDING', joinedCount: 1, status: 'OPEN', viewerRole: 'NONE' });
    expect(await row(open, 'Chi')).toMatchObject({ status: 'PENDING', joinedAt: new Date(vn('10:01')) });
    expect((await db.match.findUniqueOrThrow({ where: { id: open } })).joinedCount).toBe(1);

    const full = await openT('APPROVAL', '20:00', '21:00');
    await fillMatch(full);
    const minh = await joinMatch('Chi', full).expect(200);
    expect(MatchDetailView.parse(minh.body)).toMatchObject({ myRequest: 'PENDING', joinedCount: 4, status: 'FULL' });
    expect(await db.matchPlayer.count({ where: { matchId: full, status: 'ACTIVE' } })).toBe(4);

    clock.at = new Date(vn('10:30'));
    const again = await joinMatch('Chi', open).expect(200);
    expect(again.body).toMatchObject({ myRequest: 'PENDING', joinedCount: 1 });
    expect((await row(open, 'Chi'))?.joinedAt).toEqual(new Date(vn('10:01')));
  });

  it('AC-3: a player who left an APPROVAL match can send a request again', async () => {
    const matchId = await openT('APPROVAL');
    await db.matchPlayer.create({ data: { matchId, userId: ids['Chi'], status: 'LEFT', joinedAt: new Date(vn('09:00')) } });
    clock.at = new Date(vn('10:01'));
    const res = await joinMatch('Chi', matchId).expect(200);
    expect(MatchDetailView.parse(res.body)).toMatchObject({ myRequest: 'PENDING', joinedCount: 1 });
    expect(await row(matchId, 'Chi')).toMatchObject({ status: 'PENDING' });
    expect((await db.match.findUniqueOrThrow({ where: { id: matchId } })).joinedCount).toBe(1);
  });

  it('AC-4: the host gets the requests oldest first with phone numbers, and a requester or a stranger gets 403', async () => {
    const matchId = await openT('APPROVAL');
    clock.at = new Date(vn('10:01'));
    await joinMatch('Chi', matchId).expect(200);
    clock.at = new Date(vn('10:02'));
    await joinMatch('Em', matchId).expect(200);

    const res = await requestsOf('An', matchId).expect(200);
    expect(MatchRequestListView.parse(res.body)).toEqual([
      { userId: ids['Chi'], name: 'Chi', phone: '0901234568', requestedAt: new Date(vn('10:01')).toISOString(), reputation: { ratingAvg: null, ratingCount: 0, noShowCount: 0 } },
      { userId: ids['Em'], name: 'Em', phone: '0901234569', requestedAt: new Date(vn('10:02')).toISOString(), reputation: { ratingAvg: null, ratingCount: 0, noShowCount: 0 } },
    ]);
    await requestsOf('Chi', matchId).expect(403);
    await requestsOf('Giang', matchId).expect(403);
    await requestsOf(null, matchId).expect(401);

    const detail = await detailMatch('An', matchId).expect(200);
    expect(detail.body).toMatchObject({ viewerRole: 'HOST', pendingCount: 2, myRequest: null });
    expect(detail.body.players).toHaveLength(1);
    const asChi = await detailMatch('Chi', matchId).expect(200);
    expect(asChi.body.pendingCount).toBeUndefined();
  });

  it('AC-9: leave by a PENDING player deletes the row, and a new join sets a new requestedAt', async () => {
    const matchId = await openT('APPROVAL');
    clock.at = new Date(vn('10:01'));
    await joinMatch('Chi', matchId).expect(200);
    clock.at = new Date(vn('10:05'));
    const left = await leaveMatch('Chi', matchId).expect(200);
    expect(MatchDetailView.parse(left.body)).toMatchObject({ myRequest: null, joinedCount: 1 });
    expect(await row(matchId, 'Chi')).toBeNull();

    clock.at = new Date(vn('10:10'));
    const again = await joinMatch('Chi', matchId).expect(200);
    expect(again.body.myRequest).toBe('PENDING');
    expect((await row(matchId, 'Chi'))?.joinedAt).toEqual(new Date(vn('10:10')));
    const list = await requestsOf('An', matchId).expect(200);
    expect(list.body[0].requestedAt).toBe(new Date(vn('10:10')).toISOString());
  });

  it('AC-10: a PENDING request on a cancelled match or on a started booking is expired', async () => {
    const cancelled = await openT('APPROVAL', '18:00', '19:00');
    await joinMatch('Chi', cancelled).expect(200);
    await cancelMatch('An', cancelled).expect(200);
    expect((await requestsOf('An', cancelled).expect(200)).body).toEqual([]);
    expect((await detailMatch('Chi', cancelled).expect(200)).body.myRequest).toBeNull();
    expect((await detailMatch('Chi', cancelled).expect(200)).body.viewerRole).toBe('NONE');
    expect(await row(cancelled, 'Chi')).toMatchObject({ status: 'PENDING' });

    const started = await openT('APPROVAL', '20:00', '21:00');
    await joinMatch('Em', started).expect(200);
    expect((await requestsOf('An', started).expect(200)).body).toHaveLength(1);
    clock.at = new Date(vn('20:30'));
    expect((await requestsOf('An', started).expect(200)).body).toEqual([]);
    const detail = await detailMatch('Em', started).expect(200);
    expect(detail.body.myRequest).toBeNull();
    expect(detail.body.viewerRole).toBe('NONE');
    expect(await row(started, 'Em')).toMatchObject({ status: 'PENDING' });
    const host = await detailMatch('An', started).expect(200);
    expect(host.body.pendingCount).toBe(0);
  });

  it('AC-10: the request list is empty after the confirm deadline of an unconfirmed booking passes', async () => {
    const bookingId = (
      await db.booking.create({
        data: {
          courtId: ids.A1,
          startAt: new Date(vn('20:00')),
          endAt: new Date(vn('21:00')),
          status: 'PENDING',
          source: 'APP',
          createdById: ids['An'],
          priceTotal: 80_000,
          confirmDeadline: new Date(vn('10:30')),
          createdAt: new Date(vn('08:00')),
        },
      })
    ).id;
    const matchId = (await openMatch('An', { bookingId, capacity: 4, pricePerSlot: 50_000, joinMode: 'APPROVAL' }).expect(201)).body.id as string;
    clock.at = new Date(vn('10:01'));
    const joined = await joinMatch('Chi', matchId).expect(200);
    expect(joined.body.myRequest).toBe('PENDING');
    clock.at = new Date(vn('10:31'));
    expect((await requestsOf('An', matchId).expect(200)).body).toEqual([]);
    const host = await detailMatch('An', matchId).expect(200);
    expect(host.body.pendingCount).toBe(0);
  });

  it('BR-51: a REJECTED player gets 409 JOIN_REJECTED_MESSAGE on join, and the detail shows myRequest REJECTED', async () => {
    const matchId = await openT('APPROVAL');
    await db.matchPlayer.create({ data: { matchId, userId: ids['Chi'], status: 'REJECTED', joinedAt: new Date(vn('09:30')) } });
    const res = await joinMatch('Chi', matchId).expect(409);
    expect(res.body.message).toBe(JOIN_REJECTED_MESSAGE);
    expect(await row(matchId, 'Chi')).toMatchObject({ status: 'REJECTED' });
    const detail = await detailMatch('Chi', matchId).expect(200);
    expect(MatchDetailView.parse(detail.body)).toMatchObject({ myRequest: 'REJECTED' });
  });
});
