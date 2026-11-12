import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import {
  MatchRequestListView,
  PlayerRatingView,
  RATE_CANCELLED,
  RATE_NOT_PLAYER,
  RATE_TOO_EARLY,
  RATE_TOO_LATE,
} from '@monsport/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

// Brief F-032: player ratings and reputation.
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
const joinMatch = (who: string | null, id: string) => as(who)(http().post(`/api/matches/${id}/join`));
const cancelMatch = (who: string | null, id: string) => as(who)(http().post(`/api/matches/${id}/cancel`));
const ratePlayer = (who: string | null, matchId: string, target: string, body: unknown) =>
  as(who)(http().put(`/api/matches/${matchId}/ratings/${ids[target] ?? target}`)).send(body as object);
const getRatings = (who: string | null, matchId: string) =>
  as(who)(http().get(`/api/matches/${matchId}/ratings`));
const requestsOf = (who: string | null, matchId: string) =>
  as(who)(http().get(`/api/matches/${matchId}/requests`));

async function book(who: string, start: string, end: string, status: 'CONFIRMED' | 'PENDING' = 'CONFIRMED', confirmDeadline?: Date): Promise<string> {
  const row = await db.booking.create({
    data: {
      courtId: ids.A1,
      startAt: new Date(vn(start)),
      endAt: new Date(vn(end)),
      status,
      source: 'APP',
      createdById: ids[who],
      priceTotal: 80_000,
      confirmedAt: status === 'CONFIRMED' ? new Date(vn('08:00')) : null,
      confirmDeadline: confirmDeadline ?? null,
      createdAt: new Date(vn('08:00')),
    },
  });
  return row.id;
}

let slotCounter = 0;
async function openMatchWithPlayers(host = 'An', start = '08:00', end = '09:00', players: string[] = ['Chi', 'Em']): Promise<string> {
  slotCounter++;
  const day = `2026-11-${String(21 + (slotCounter % 7)).padStart(2, '0')}`;
  const tempStart = `${day}T10:00:00+07:00`;
  const tempEnd = `${day}T11:00:00+07:00`;
  const bookingRow = await db.booking.create({
    data: {
      courtId: ids.A1,
      startAt: new Date(tempStart),
      endAt: new Date(tempEnd),
      status: 'CONFIRMED',
      source: 'APP',
      createdById: ids[host],
      priceTotal: 80_000,
      confirmedAt: new Date(vn('08:00')),
      createdAt: new Date(vn('08:00')),
    },
  });
  const res = await openMatch(host, { bookingId: bookingRow.id, capacity: 4, pricePerSlot: 50_000 }).expect(201);
  await db.booking.update({ where: { id: bookingRow.id }, data: { startAt: new Date(vn(start)), endAt: new Date(vn(end)) } });
  const matchId = res.body.id as string;
  for (const p of players) {
    await db.matchPlayer.create({
      data: { matchId, userId: ids[p], status: 'ACTIVE', joinedAt: new Date(vn('08:30')) },
    });
  }
  const joinedCount = 1 + players.length;
  await db.match.update({ where: { id: matchId }, data: { joinedCount, status: joinedCount >= 4 ? 'FULL' : 'OPEN' } });
  return matchId;
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

describe('player ratings and reputation (F-032)', () => {
  beforeEach(async () => {
    clock.at = new Date(vn('10:00'));
    await db.$executeRawUnsafe('TRUNCATE "PlayerRating", "Notification", "MatchPlayer", "Match", "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
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

  it('AC-2: PUT /api/matches/:id/ratings/:userId saves a rating and re-rating updates it with 200 PlayerRatingView', async () => {
    const matchId = await openMatchWithPlayers('An', '08:00', '09:00', ['Chi', 'Em']);

    // Host An rates Chi 5 stars
    const res1 = await ratePlayer('An', matchId, 'Chi', { stars: 5, noShow: false }).expect(200);
    expect(PlayerRatingView.parse(res1.body)).toEqual({
      userId: ids['Chi'],
      name: 'Chi',
      stars: 5,
      noShow: false,
    });

    // Re-rating Chi with noShow updates the rating
    const res2 = await ratePlayer('An', matchId, 'Chi', { stars: null, noShow: true }).expect(200);
    expect(PlayerRatingView.parse(res2.body)).toEqual({
      userId: ids['Chi'],
      name: 'Chi',
      stars: null,
      noShow: true,
    });

    // Verify at most one rating row in database for (matchId, Chi)
    const rows = await db.playerRating.findMany({ where: { matchId, playerId: ids['Chi'] } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ raterId: ids['An'], playerId: ids['Chi'], stars: null, noShow: true });
  });

  it('AC-3: refuses rating before startAt, after 7 days, cancelled match, unconfirmed booking, non-player, host, non-host caller, or invalid body', async () => {
    // 1. Refuses before startAt: 400 RATE_TOO_EARLY
    const futureMatch = await openMatchWithPlayers('An', '13:00', '14:00', ['Chi']);
    const tooEarly = await ratePlayer('An', futureMatch, 'Chi', { stars: 5, noShow: false }).expect(400);
    expect(tooEarly.body.message).toBe(RATE_TOO_EARLY);

    // 2. Refuses after startAt + 7 days: 400 RATE_TOO_LATE
    const pastMatch = await openMatchWithPlayers('An', '06:00', '07:00', ['Chi']);
    clock.at = new Date(vn('06:00', '2026-11-28')); // 8 days later
    const tooLate = await ratePlayer('An', pastMatch, 'Chi', { stars: 5, noShow: false }).expect(400);
    expect(tooLate.body.message).toBe(RATE_TOO_LATE);
    clock.at = new Date(vn('10:00')); // restore clock

    // 3. Refuses when match is CANCELLED: 400 RATE_CANCELLED
    const cancelledMatch = await openMatchWithPlayers('An', '07:00', '08:00', ['Chi']);
    await db.match.update({ where: { id: cancelledMatch }, data: { status: 'CANCELLED' } });
    const cancelledRes = await ratePlayer('An', cancelledMatch, 'Chi', { stars: 5, noShow: false }).expect(400);
    expect(cancelledRes.body.message).toBe(RATE_CANCELLED);

    // 4. Refuses when booking is not CONFIRMED: 400 RATE_CANCELLED
    const unconfirmedBooking = await db.booking.create({
      data: {
        courtId: ids.A1,
        startAt: new Date('2026-11-28T10:00:00+07:00'),
        endAt: new Date('2026-11-28T11:00:00+07:00'),
        status: 'PENDING',
        source: 'APP',
        createdById: ids['An'],
        priceTotal: 80_000,
        createdAt: new Date(vn('08:00')),
      },
    });
    const unconfirmedMatchRes = await openMatch('An', { bookingId: unconfirmedBooking.id, capacity: 4, pricePerSlot: 50_000 }).expect(201);
    await db.booking.update({ where: { id: unconfirmedBooking.id }, data: { startAt: new Date(vn('08:00')), endAt: new Date(vn('08:30')) } });
    const unconfirmedMatch = unconfirmedMatchRes.body.id as string;
    await db.matchPlayer.create({ data: { matchId: unconfirmedMatch, userId: ids['Chi'], status: 'ACTIVE', joinedAt: new Date(vn('08:15')) } });
    const unconfirmedRes = await ratePlayer('An', unconfirmedMatch, 'Chi', { stars: 5, noShow: false }).expect(400);
    expect(unconfirmedRes.body.message).toBe(RATE_CANCELLED);

    // 5. Booking past confirm deadline gives RATE_CANCELLED (sync expires booking)
    const expiredBooking = await db.booking.create({
      data: {
        courtId: ids.A1,
        startAt: new Date('2026-11-29T10:00:00+07:00'),
        endAt: new Date('2026-11-29T11:00:00+07:00'),
        status: 'PENDING',
        source: 'APP',
        createdById: ids['An'],
        priceTotal: 80_000,
        createdAt: new Date(vn('08:00')),
      },
    });
    const deadlineMatchRes = await openMatch('An', { bookingId: expiredBooking.id, capacity: 4, pricePerSlot: 50_000 }).expect(201);
    await db.booking.update({
      where: { id: expiredBooking.id },
      data: {
        startAt: new Date(vn('08:30')),
        endAt: new Date(vn('09:00')),
        confirmDeadline: new Date(vn('09:00')),
      },
    });
    const deadlineMatch = deadlineMatchRes.body.id as string;
    await db.matchPlayer.create({ data: { matchId: deadlineMatch, userId: ids['Chi'], status: 'ACTIVE', joinedAt: new Date(vn('08:45')) } });
    const deadlineRes = await ratePlayer('An', deadlineMatch, 'Chi', { stars: 5, noShow: false }).expect(400);
    expect(deadlineRes.body.message).toBe(RATE_CANCELLED);

    // 6. Refuses target not an ACTIVE player: 400 RATE_NOT_PLAYER
    const normalMatch = await openMatchWithPlayers('An', '09:00', '09:30', ['Chi']);
    // Target Hà never joined
    const notPlayer = await ratePlayer('An', normalMatch, 'Hà', { stars: 5, noShow: false }).expect(400);
    expect(notPlayer.body.message).toBe(RATE_NOT_PLAYER);
    // Target Giang has LEFT status
    await db.matchPlayer.create({ data: { matchId: normalMatch, userId: ids['Giang'], status: 'LEFT', joinedAt: new Date(vn('08:10')), leftAt: new Date(vn('08:20')) } });
    const leftPlayer = await ratePlayer('An', normalMatch, 'Giang', { stars: 5, noShow: false }).expect(400);
    expect(leftPlayer.body.message).toBe(RATE_NOT_PLAYER);

    // 7. Refuses target being the host: 400 RATE_NOT_PLAYER
    const hostTarget = await ratePlayer('An', normalMatch, 'An', { stars: 5, noShow: false }).expect(400);
    expect(hostTarget.body.message).toBe(RATE_NOT_PLAYER);

    // 8. Refuses non-host caller: 403
    await ratePlayer('Chi', normalMatch, 'Chi', { stars: 5, noShow: false }).expect(403);
    await ratePlayer('Giang', normalMatch, 'Chi', { stars: 5, noShow: false }).expect(403);
    await ratePlayer(null, normalMatch, 'Chi', { stars: 5, noShow: false }).expect(401);

    // 9. Refuses invalid request body: 400
    await ratePlayer('An', normalMatch, 'Chi', { stars: 0, noShow: false }).expect(400);
    await ratePlayer('An', normalMatch, 'Chi', { stars: 6, noShow: false }).expect(400);
    await ratePlayer('An', normalMatch, 'Chi', { stars: 3, noShow: true }).expect(400);
    await ratePlayer('An', normalMatch, 'Chi', { stars: null, noShow: false }).expect(400);
  });

  it('AC-4: GET /api/matches/:id/ratings returns active members except host with current ratings, 403 for non-host', async () => {
    const matchId = await openMatchWithPlayers('An', '08:00', '09:00', ['Chi', 'Em']);

    // Before any ratings: both Chi and Em have null stars and null noShow
    const initial = await getRatings('An', matchId).expect(200);
    expect(initial.body).toEqual([
      { userId: ids['Chi'], name: 'Chi', stars: null, noShow: null },
      { userId: ids['Em'], name: 'Em', stars: null, noShow: null },
    ]);

    // Host rates Chi 4 stars
    await ratePlayer('An', matchId, 'Chi', { stars: 4, noShow: false }).expect(200);

    // Host gets ratings again: Chi has stars 4, Em still null
    const afterRate = await getRatings('An', matchId).expect(200);
    expect(afterRate.body).toEqual([
      { userId: ids['Chi'], name: 'Chi', stars: 4, noShow: false },
      { userId: ids['Em'], name: 'Em', stars: null, noShow: null },
    ]);

    // Non-host caller receives 403
    await getRatings('Chi', matchId).expect(403);
    await getRatings('Giang', matchId).expect(403);
    await getRatings(null, matchId).expect(401);
  });

  it('AC-5: GET /api/matches/:id/requests includes reputation with ratingAvg, ratingCount, noShowCount for each requester', async () => {
    // Chi has past ratings across other matches: 5 stars, 4 stars, 1 noShow
    const past1 = await openMatchWithPlayers('Hà', '06:00', '07:00', ['Chi']);
    await db.playerRating.create({ data: { matchId: past1, raterId: ids['Hà'], playerId: ids['Chi'], stars: 5, noShow: false } });

    const past2 = await openMatchWithPlayers('Hà', '07:00', '08:00', ['Chi']);
    await db.playerRating.create({ data: { matchId: past2, raterId: ids['Hà'], playerId: ids['Chi'], stars: 4, noShow: false } });

    const past3 = await openMatchWithPlayers('Hà', '08:00', '09:00', ['Chi']);
    await db.playerRating.create({ data: { matchId: past3, raterId: ids['Hà'], playerId: ids['Chi'], stars: null, noShow: true } });

    // Em has only a noShow rating (stars: null, noShow: true)
    const past4 = await openMatchWithPlayers('Hà', '09:00', '10:00', ['Em']);
    await db.playerRating.create({ data: { matchId: past4, raterId: ids['Hà'], playerId: ids['Em'], stars: null, noShow: true } });

    // Giang has no ratings at all

    // An opens an APPROVAL match starting in the future
    const bookingId = await book('An', '18:00', '19:00');
    const openRes = await openMatch('An', { bookingId, capacity: 4, pricePerSlot: 50_000, joinMode: 'APPROVAL' }).expect(201);
    const matchId = openRes.body.id as string;

    // Chi, Em, and Giang request to join
    clock.at = new Date(vn('10:01'));
    await joinMatch('Chi', matchId).expect(200);
    clock.at = new Date(vn('10:02'));
    await joinMatch('Em', matchId).expect(200);
    clock.at = new Date(vn('10:03'));
    await joinMatch('Giang', matchId).expect(200);

    // Host reads requests list
    const res = await requestsOf('An', matchId).expect(200);
    const parsed = MatchRequestListView.parse(res.body);

    expect(parsed).toEqual([
      {
        userId: ids['Chi'],
        name: 'Chi',
        phone: '0901234568',
        requestedAt: new Date(vn('10:01')).toISOString(),
        reputation: {
          ratingAvg: 4.5,
          ratingCount: 2,
          noShowCount: 1,
        },
      },
      {
        userId: ids['Em'],
        name: 'Em',
        phone: '0901234569',
        requestedAt: new Date(vn('10:02')).toISOString(),
        reputation: {
          ratingAvg: null,
          ratingCount: 0,
          noShowCount: 1,
        },
      },
      {
        userId: ids['Giang'],
        name: 'Giang',
        phone: '0901234570',
        requestedAt: new Date(vn('10:03')).toISOString(),
        reputation: {
          ratingAvg: null,
          ratingCount: 0,
          noShowCount: 0,
        },
      },
    ]);
  });

  it('AC-6: PlayerRating model persists records without mutating existing match or player structure', async () => {
    const matchId = await openMatchWithPlayers('An', '08:00', '09:00', ['Chi']);
    await ratePlayer('An', matchId, 'Chi', { stars: 5, noShow: false }).expect(200);

    const match = await db.match.findUniqueOrThrow({
      where: { id: matchId },
      include: { players: true, ratings: true },
    });

    expect(match.ratings).toHaveLength(1);
    expect(match.ratings[0]).toMatchObject({
      matchId,
      raterId: ids['An'],
      playerId: ids['Chi'],
      stars: 5,
      noShow: false,
    });
    expect(match.players).toHaveLength(2); // host + Chi
  });
});
