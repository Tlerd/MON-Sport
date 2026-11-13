import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import {
  formatNotificationContent,
  JOIN_REJECTED_MESSAGE,
  MATCH_FULL_MESSAGE,
  MatchDetailView,
  REQUEST_EXPIRED_MESSAGE,
  REQUEST_NOT_PENDING_MESSAGE,
} from '@monsport/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

// Brief F-028 step 3. Data as in join-requests.e2e.test.ts: Bình runs "Cầu lông A". Users: An (host), Chi, Em, Giang, Hà.
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
const approve = (who: string | null, id: string, target: string) => as(who)(http().post(`/api/matches/${id}/requests/${ids[target]}/approve`));
const reject = (who: string | null, id: string, target: string) => as(who)(http().post(`/api/matches/${id}/requests/${ids[target]}/reject`));

async function book(who: string, start: string, end: string): Promise<string> {
  const row = await db.booking.create({
    data: {
      courtId: ids.A1,
      startAt: new Date(vn(start)),
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

async function openApproval(start = '20:00', end = '21:00'): Promise<{ matchId: string; bookingId: string }> {
  const bookingId = await book('An', start, end);
  const res = await openMatch('An', { bookingId, capacity: 4, pricePerSlot: 50_000, joinMode: 'APPROVAL' }).expect(201);
  return { matchId: res.body.id as string, bookingId };
}

/** Adds ACTIVE rows for the given players and sets joinedCount to match. */
async function addActive(matchId: string, who: string[]): Promise<void> {
  for (const name of who) {
    await db.matchPlayer.create({ data: { matchId, userId: ids[name], status: 'ACTIVE', joinedAt: new Date(vn('09:00')) } });
  }
  const joinedCount = 1 + who.length;
  await db.match.update({ where: { id: matchId }, data: { joinedCount, status: joinedCount >= 4 ? 'FULL' : 'OPEN' } });
}

const row = (matchId: string, who: string) => db.matchPlayer.findUnique({ where: { matchId_userId: { matchId, userId: ids[who] } } });
const matchOf = (matchId: string) => db.match.findUniqueOrThrow({ where: { id: matchId } });

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

describe('host approves and rejects join requests (F-028 step 3)', () => {
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

  it('AC-5: approve on 1/4 gives the requester a slot and keeps the match OPEN, and approve on 3/4 makes it FULL', async () => {
    const one = (await openApproval('18:00', '19:00')).matchId;
    await joinMatch('Chi', one).expect(200);
    const res = await approve('An', one, 'Chi').expect(200);
    expect(MatchDetailView.parse(res.body)).toMatchObject({ viewerRole: 'HOST', joinedCount: 2, status: 'OPEN', pendingCount: 0 });
    expect(await row(one, 'Chi')).toMatchObject({ status: 'ACTIVE', leftAt: null });
    expect(res.body.players.map((p: { userId: string }) => p.userId)).toContain(ids['Chi']);

    const three = (await openApproval('20:00', '21:00')).matchId;
    await addActive(three, ['Em', 'Giang']);
    await joinMatch('Hà', three).expect(200);
    const full = await approve('An', three, 'Hà').expect(200);
    expect(full.body).toMatchObject({ joinedCount: 4, status: 'FULL', pendingCount: 0 });
    expect(await row(three, 'Hà')).toMatchObject({ status: 'ACTIVE' });
    expect(await matchOf(three)).toMatchObject({ joinedCount: 4, status: 'FULL' });
  });

  it('AC-6: approve on a FULL match gives 409 and the request stays PENDING, then 200 after a player leaves', async () => {
    const { matchId } = await openApproval();
    await addActive(matchId, ['Em', 'Giang', 'Hà']);
    await joinMatch('Chi', matchId).expect(200);
    const res = await approve('An', matchId, 'Chi').expect(409);
    expect(res.body.message).toBe(MATCH_FULL_MESSAGE);
    expect(await row(matchId, 'Chi')).toMatchObject({ status: 'PENDING' });
    expect(await matchOf(matchId)).toMatchObject({ joinedCount: 4, status: 'FULL' });

    await leaveMatch('Em', matchId).expect(200);
    const ok = await approve('An', matchId, 'Chi').expect(200);
    expect(ok.body).toMatchObject({ joinedCount: 4, status: 'FULL' });
    expect(await row(matchId, 'Chi')).toMatchObject({ status: 'ACTIVE' });
  });

  it('AC-7: two approvals at the same time on a 3/4 match give one 200 and one 409, and joinedCount is 4', async () => {
    const { matchId } = await openApproval();
    await addActive(matchId, ['Em', 'Giang']);
    await joinMatch('Chi', matchId).expect(200);
    await joinMatch('Hà', matchId).expect(200);
    const results = await Promise.all([approve('An', matchId, 'Chi'), approve('An', matchId, 'Hà')]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);
    const failed = results.find((r) => r.status === 409)!;
    expect(failed.body.message).toBe(MATCH_FULL_MESSAGE);
    expect(await matchOf(matchId)).toMatchObject({ joinedCount: 4, status: 'FULL' });
    expect(await db.matchPlayer.count({ where: { matchId, status: 'ACTIVE' } })).toBe(4);
    expect(await db.matchPlayer.count({ where: { matchId, userId: { in: [ids['Chi'], ids['Hà']] }, status: 'ACTIVE' } })).toBe(1);
    expect(await db.matchPlayer.count({ where: { matchId, status: 'PENDING' } })).toBe(1);
  });

  it('AC-8: reject sets REJECTED and the next join gives 409 JOIN_REJECTED_MESSAGE', async () => {
    const { matchId } = await openApproval();
    await joinMatch('Chi', matchId).expect(200);
    const res = await reject('An', matchId, 'Chi').expect(200);
    expect(MatchDetailView.parse(res.body)).toMatchObject({ viewerRole: 'HOST', joinedCount: 1, pendingCount: 0 });
    expect(await row(matchId, 'Chi')).toMatchObject({ status: 'REJECTED' });
    const again = await joinMatch('Chi', matchId).expect(409);
    expect(again.body.message).toBe(JOIN_REJECTED_MESSAGE);
  });

  it('AC-8: approve or reject of a request that is not PENDING gives 409 REQUEST_NOT_PENDING_MESSAGE, and a missing request gives 404', async () => {
    const { matchId } = await openApproval();
    await joinMatch('Chi', matchId).expect(200);
    await joinMatch('Em', matchId).expect(200);
    await approve('An', matchId, 'Chi').expect(200);
    await reject('An', matchId, 'Em').expect(200);
    for (const who of ['Chi', 'Em']) {
      expect((await approve('An', matchId, who).expect(409)).body.message).toBe(REQUEST_NOT_PENDING_MESSAGE);
      expect((await reject('An', matchId, who).expect(409)).body.message).toBe(REQUEST_NOT_PENDING_MESSAGE);
    }
    await approve('An', matchId, 'Giang').expect(404);
    await reject('An', matchId, 'Giang').expect(404);
    expect(await matchOf(matchId)).toMatchObject({ joinedCount: 2 });
  });

  it('AC-10: approve and reject on a cancelled match or a started booking give 409 REQUEST_EXPIRED_MESSAGE and no slot', async () => {
    const cancelled = (await openApproval('18:00', '19:00')).matchId;
    await joinMatch('Chi', cancelled).expect(200);
    await cancelMatch('An', cancelled).expect(200);
    expect((await approve('An', cancelled, 'Chi').expect(409)).body.message).toBe(REQUEST_EXPIRED_MESSAGE);
    expect((await reject('An', cancelled, 'Chi').expect(409)).body.message).toBe(REQUEST_EXPIRED_MESSAGE);
    expect(await row(cancelled, 'Chi')).toMatchObject({ status: 'PENDING' });

    const started = (await openApproval('20:00', '21:00')).matchId;
    await joinMatch('Em', started).expect(200);
    clock.at = new Date(vn('20:30'));
    expect((await approve('An', started, 'Em').expect(409)).body.message).toBe(REQUEST_EXPIRED_MESSAGE);
    expect((await reject('An', started, 'Em').expect(409)).body.message).toBe(REQUEST_EXPIRED_MESSAGE);
    expect(await row(started, 'Em')).toMatchObject({ status: 'PENDING' });
    expect((await matchOf(started)).joinedCount).toBe(1);
  });

  it('AC-11: join, approve and reject create notifications for the right users, and the list shows the text', async () => {
    const first = await openApproval('18:00', '19:00');
    await joinMatch('Chi', first.matchId).expect(200);
    await joinMatch('Chi', first.matchId).expect(200);
    const requested = await db.notification.findMany({ where: { type: 'MATCH_JOIN_REQUESTED' } });
    expect(requested).toHaveLength(1);
    expect(requested[0]).toMatchObject({ userId: ids['An'], bookingId: first.bookingId, matchId: first.matchId });

    await approve('An', first.matchId, 'Chi').expect(200);
    const approved = await db.notification.findMany({ where: { type: 'MATCH_JOIN_APPROVED' } });
    expect(approved).toHaveLength(1);
    expect(approved[0]).toMatchObject({ userId: ids['Chi'], bookingId: first.bookingId, matchId: first.matchId });

    const second = await openApproval('20:00', '21:00');
    await joinMatch('Chi', second.matchId).expect(200);
    await reject('An', second.matchId, 'Chi').expect(200);
    const rejected = await db.notification.findMany({ where: { type: 'MATCH_JOIN_REJECTED' } });
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ userId: ids['Chi'], bookingId: second.bookingId, matchId: second.matchId });
    expect(await db.notification.count({ where: { type: 'MATCH_JOIN_REQUESTED' } })).toBe(2);

    const booking = await db.booking.findUniqueOrThrow({ where: { id: first.bookingId } });
    const expected = formatNotificationContent({
      type: 'MATCH_JOIN_APPROVED',
      venueName: 'Cầu lông A',
      courtName: 'Sân 1',
      startAt: booking.startAt,
      endAt: booking.endAt,
    });
    const list = await as('Chi')(http().get('/api/notifications')).expect(200);
    const item = list.body.items.find((i: { type: string }) => i.type === 'MATCH_JOIN_APPROVED');
    expect(item).toMatchObject({ title: expected.title, message: expected.message, matchId: first.matchId });
    expect(list.body.items.map((i: { type: string }) => i.type).sort()).toEqual(['MATCH_JOIN_APPROVED', 'MATCH_JOIN_REJECTED']);
    const hostList = await as('An')(http().get('/api/notifications')).expect(200);
    expect(hostList.body.items.filter((i: { type: string }) => i.type === 'MATCH_JOIN_REQUESTED')).toHaveLength(2);
  });

  it('AC-15: approve and cancel at the same time give no 5xx and no BUSY, and the match ends CANCELLED', async () => {
    const { matchId } = await openApproval();
    await joinMatch('Chi', matchId).expect(200);
    const [approved, cancelled] = await Promise.all([approve('An', matchId, 'Chi'), cancelMatch('An', matchId)]);
    expect([200, 409]).toContain(approved.status);
    if (approved.status === 409) {
      expect(approved.body.message).toBe(REQUEST_EXPIRED_MESSAGE);
      expect(await row(matchId, 'Chi')).toMatchObject({ status: 'PENDING' });
    } else {
      // The approve won the race: Chi holds a slot, and the cancel told Chi.
      expect(await row(matchId, 'Chi')).toMatchObject({ status: 'ACTIVE' });
      expect(await db.notification.count({ where: { type: 'MATCH_CANCELLED', userId: ids['Chi'], matchId } })).toBe(1);
    }
    expect(cancelled.status).toBe(200);
    expect((await matchOf(matchId)).status).toBe('CANCELLED');
  });

  it('AC-8: a player and a stranger get 403 on approve and reject', async () => {
    const { matchId } = await openApproval();
    await joinMatch('Chi', matchId).expect(200);
    await addActive(matchId, ['Em']);
    for (const who of ['Em', 'Giang']) {
      await approve(who, matchId, 'Chi').expect(403);
      await reject(who, matchId, 'Chi').expect(403);
    }
    await approve(null, matchId, 'Chi').expect(401);
    expect(await row(matchId, 'Chi')).toMatchObject({ status: 'PENDING' });
  });
});
