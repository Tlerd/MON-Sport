import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { CALL_OWNER_MESSAGE, MatchView, Messages, MyBookingView } from '@monsport/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { MatchesService } from './matches.service.js';

// Data of brief F-011: Bình runs "Cầu lông A" (address "10 Nguyễn Huệ", phone 0911111111, 06:00-23:00, "Sân 1" BADMINTON
// and "Sân 2" FOOTBALL), Dũng runs "Cầu lông B" with "Sân 1" BADMINTON. An and Chi are users. Now is 20/11/2026 10:00.
const vn = (hhmm: string, day = '2026-11-20') => `${day}T${hhmm}:00+07:00`;
const clock = { at: new Date(vn('10:00')), now() { return this.at; } };
const MISSING = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const BUSY = 'Yêu cầu đang được xử lý, hãy thử lại';

let app: INestApplication;
let db: PrismaService;
const ids: Record<string, string> = {};
const http = () => request(app.getHttpServer());
const as = (who: string | null) => (r: request.Test) => (who ? r.set('Cookie', `session=${issueSession(ids[who], clock.now())}`) : r);
const openMatch = (who: string | null, body: Record<string, unknown>) => as(who)(http().post('/api/matches')).send(body);
const cancelMatch = (who: string | null, id: string) => as(who)(http().post(`/api/matches/${id}/cancel`));
const lobby = (query = '') => http().get(`/api/matches${query}`);
const mine = (who: string | null) => as(who)(http().get('/api/bookings/mine'));
const userCancelBooking = (who: string, id: string) => as(who)(http().post(`/api/bookings/${id}/cancel`));
const ownerCancelBooking = (who: string, id: string) => as(who)(http().post(`/api/owner/bookings/${id}/cancel`));
const ownerConfirmBooking = (who: string, id: string) => as(who)(http().post(`/api/owner/bookings/${id}/confirm`));
const ownerRejectBooking = (who: string, id: string) => as(who)(http().post(`/api/owner/bookings/${id}/reject`));
const askBooking = (who: string, start: string, end: string, court = 'A1', day = '2026-11-20') =>
  as(who)(http().post('/api/bookings')).send({ courtId: ids[court], startAt: vn(start, day), endAt: vn(end, day) });

async function book(
  who: string,
  court: string,
  start: string,
  end: string,
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED',
  extra: { source?: 'APP' | 'PHONE'; confirmDeadline?: string; createdAt?: string; day?: string } = {},
): Promise<string> {
  const day = extra.day ?? '2026-11-20';
  const startAt = new Date(vn(start, day));
  const row = await db.booking.create({
    data: {
      courtId: ids[court],
      startAt,
      endAt: new Date(vn(end, day)),
      status,
      source: extra.source ?? 'APP',
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

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue(clock).compile();
  app = setupApp(moduleRef.createNestApplication());
  await app.init();
  db = app.get(PrismaService);
});

afterAll(async () => {
  await app?.close();
});

describe('matches API (F-011)', () => {
  beforeEach(async () => {
    clock.at = new Date(vn('10:00'));
    await db.$executeRawUnsafe('TRUNCATE "MatchPlayer", "Match", "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
    const passwordHash = await hash('test-password');
    const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER') =>
      db.user.create({ data: { name, phone, role, passwordHash } }).then((u) => (ids[name] = u.id));
    await Promise.all([
      user('admin', '0900000000', 'ADMIN'),
      user('Bình', '0912345678', 'OWNER'),
      user('Dũng', '0912345679', 'OWNER'),
      user('An', '0901234567', 'USER'),
      user('Chi', '0901234568', 'USER'),
    ]);
    const a = await db.venue.create({
      data: { ownerId: ids['Bình'], name: 'Cầu lông A', address: '10 Nguyễn Huệ', phone: '0911111111', opensAt: 360, closesAt: 1380 },
    });
    const b = await db.venue.create({
      data: { ownerId: ids['Dũng'], name: 'Cầu lông B', address: '20 Lê Lợi', phone: '0912345679', opensAt: 360, closesAt: 1380 },
    });
    ids.A1 = (await db.court.create({ data: { venueId: a.id, name: 'Sân 1', sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 } })).id;
    ids.A2 = (await db.court.create({ data: { venueId: a.id, name: 'Sân 2', sport: 'FOOTBALL', priceNormal: 200_000, pricePeak: 300_000 } })).id;
    ids.B1 = (await db.court.create({ data: { venueId: b.id, name: 'Sân 1', sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 } })).id;
  });

  describe('POST /api/matches', () => {
    it('AC-1: An opens a match on a PENDING badminton booking, and is counted as the first ACTIVE player', async () => {
      const bookingId = (await askBooking('An', '20:00', '21:00', 'A1').expect(201)).body.id as string;
      const res = await openMatch('An', { bookingId, capacity: 4, pricePerSlot: 50_000 }).expect(201);
      expect(MatchView.parse(res.body)).toMatchObject({
        bookingId,
        hostId: ids['An'],
        hostName: 'An',
        sport: 'BADMINTON',
        capacity: 4,
        joinedCount: 1,
        pricePerSlot: 50_000,
        status: 'OPEN',
        bookingStatus: 'PENDING',
        courtName: 'Sân 1',
        venueName: 'Cầu lông A',
        venueAddress: '10 Nguyễn Huệ',
      });
      const players = await db.matchPlayer.findMany({ where: { matchId: res.body.id } });
      expect(players).toHaveLength(1);
      expect(players[0]).toMatchObject({ matchId: res.body.id, userId: ids['An'], status: 'ACTIVE', leftAt: null });
    });

    it('AC-2: An opens a free match (pricePerSlot = 0) on a CONFIRMED football booking', async () => {
      const bookingId = await book('An', 'A2', '18:00', '19:00', 'CONFIRMED');
      const res = await openMatch('An', { bookingId, capacity: 10, pricePerSlot: 0 }).expect(201);
      expect(MatchView.parse(res.body)).toMatchObject({
        bookingId,
        sport: 'FOOTBALL',
        bookingStatus: 'CONFIRMED',
        capacity: 10,
        joinedCount: 1,
        pricePerSlot: 0,
        status: 'OPEN',
      });
    });

    it('AC-3: 10 parallel requests on a booking that already has a match all answer 409 "Booking này đã có trận"', async () => {
      const bookingId = await book('An', 'A1', '20:00', '21:00', 'PENDING');
      await openMatch('An', { bookingId, capacity: 4, pricePerSlot: 50_000 }).expect(201);

      const responses = await Promise.all(
        Array.from({ length: 10 }, () => openMatch('An', { bookingId, capacity: 4, pricePerSlot: 50_000 }).then((r) => r)),
      );
      expect(responses.every((r) => r.status === 409 && r.body.message === 'Booking này đã có trận')).toBe(true);
      expect(await db.match.count({ where: { bookingId } })).toBe(1);
    });

    it('AC-4: REJECTED, EXPIRED, CANCELLED, started CONFIRMED, and overdue PENDING bookings answer 409, and the overdue one becomes EXPIRED', async () => {
      const rejected = await book('An', 'A1', '17:00', '18:00', 'REJECTED');
      const expired = await book('An', 'A1', '18:00', '19:00', 'EXPIRED');
      const cancelled = await book('An', 'A1', '19:00', '20:00', 'CANCELLED');
      const started = await book('An', 'A1', '09:00', '10:00', 'CONFIRMED');
      const overdue = await book('An', 'A1', '12:00', '13:00', 'PENDING', { confirmDeadline: '09:30' });

      for (const bookingId of [rejected, expired, cancelled, started, overdue]) {
        const res = await openMatch('An', { bookingId, capacity: 4, pricePerSlot: 50_000 }).expect(409);
        expect(res.body.message).toBe('Chỉ mở được trận trên booking đang chờ xác nhận hoặc đã xác nhận');
      }
      expect((await db.booking.findUniqueOrThrow({ where: { id: overdue } })).status).toBe('EXPIRED');
      expect(await db.match.count()).toBe(0);
    });

    it('AC-5: stranger, PHONE booking, missing UUID, invalid fields, and non-USER roles are refused', async () => {
      const anBooking = await book('An', 'A1', '20:00', '21:00', 'PENDING');
      const anOverdue = await book('An', 'A1', '12:00', '13:00', 'PENDING', { confirmDeadline: '09:30' });
      const phoneBooking = await book('Bình', 'A1', '19:00', '20:00', 'CONFIRMED', { source: 'PHONE' });

      for (const id of [anBooking, anOverdue, phoneBooking, MISSING]) {
        const who = id === anBooking || id === anOverdue ? 'Chi' : 'An';
        const res = await openMatch(who, { bookingId: id, capacity: 4, pricePerSlot: 50_000 }).expect(404);
        expect(res.body.message).toBe('Không tìm thấy booking');
      }
      // A stranger trying to open a match on An's overdue booking must not expire it.
      expect((await db.booking.findUniqueOrThrow({ where: { id: anOverdue } })).status).toBe('PENDING');

      for (const capacity of [1, 31]) {
        const res = await openMatch('An', { bookingId: anBooking, capacity, pricePerSlot: 50_000 }).expect(400);
        expect(res.body.message).toBe('Số suất từ 2 đến 30');
      }
      expect((await openMatch('An', { bookingId: anBooking, capacity: 4, pricePerSlot: -1 }).expect(400)).body.message).toBe(
        'Giá mỗi suất không hợp lệ',
      );
      expect((await openMatch('An', { bookingId: 'abc', capacity: 4, pricePerSlot: 50_000 }).expect(400)).body.message).toBe(
        'Dữ liệu không hợp lệ',
      );

      for (const [who, status] of [['Bình', 403], ['admin', 403], [null, 401]] as const) {
        await openMatch(who, { bookingId: anBooking, capacity: 4, pricePerSlot: 50_000 }).expect(status);
      }
    });
  });

  describe('GET /api/matches and booking cascades', () => {
    it('AC-6: guests list and filter matches by sport and Asia/Ho_Chi_Minh date, with no phone numbers exposed', async () => {
      const bAn = await book('An', 'A1', '20:00', '21:00', 'PENDING');
      const bChi1 = await book('Chi', 'A2', '18:00', '19:00', 'CONFIRMED');
      const bChi2 = await book('Chi', 'A1', '06:00', '07:00', 'CONFIRMED', { day: '2026-11-21' });

      const mAn = (await openMatch('An', { bookingId: bAn, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;
      const mChi1 = (await openMatch('Chi', { bookingId: bChi1, capacity: 10, pricePerSlot: 60_000 }).expect(201)).body.id as string;
      const mChi2 = (await openMatch('Chi', { bookingId: bChi2, capacity: 4, pricePerSlot: 40_000 }).expect(201)).body.id as string;

      // 06:00 on 21/11 in Asia/Ho_Chi_Minh is 23:00Z on 20/11 in UTC.
      expect(new Date(vn('06:00', '2026-11-21')).toISOString()).toBe('2026-11-20T23:00:00.000Z');

      const all = await lobby().expect(200);
      expect(all.body.map((m: { id: string }) => m.id)).toEqual([mChi1, mAn, mChi2]);
      const serialized = JSON.stringify(all.body);
      expect(serialized).not.toContain('0901234567');
      expect(serialized).not.toContain('0901234568');
      expect(serialized).not.toContain('0911111111');

      const nov20Badminton = await lobby('?sport=BADMINTON&date=2026-11-20').expect(200);
      expect(nov20Badminton.body).toHaveLength(1);
      expect(nov20Badminton.body[0]).toMatchObject({ id: mAn, bookingStatus: 'PENDING', sport: 'BADMINTON' });

      const nov21 = await lobby('?date=2026-11-21').expect(200);
      expect(nov21.body).toHaveLength(1);
      expect(nov21.body[0]).toMatchObject({ id: mChi2, sport: 'BADMINTON' });

      expect((await lobby('?date=2026-11-19').expect(200)).body).toEqual([]);
      expect((await lobby('?date=0000-01-01').expect(200)).body).toEqual([]);

      expect((await lobby('?date=2026-13-45').expect(400)).body.message).toBe('Dữ liệu không hợp lệ');
      expect((await lobby('?sport=TENNIS').expect(400)).body.message).toBe('Dữ liệu không hợp lệ');
    });

    it('AC-7: owner confirm updates bookingStatus in lobby, and owner reject cancels the match (BR-16)', async () => {
      const bAn = await book('An', 'A1', '20:00', '21:00', 'PENDING');
      const bChi = await book('Chi', 'A1', '19:00', '20:00', 'PENDING');
      const mAn = (await openMatch('An', { bookingId: bAn, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;
      const mChi = (await openMatch('Chi', { bookingId: bChi, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;

      await ownerConfirmBooking('Bình', bAn).expect(200);
      await ownerRejectBooking('Bình', bChi).expect(200);

      const list = await lobby().expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toMatchObject({ id: mAn, bookingStatus: 'CONFIRMED', status: 'OPEN' });
      expect((await db.match.findUniqueOrThrow({ where: { id: mChi } })).status).toBe('CANCELLED');
    });

    it('AC-8: overdue PENDING booking expires and cancels its match, while ended CONFIRMED booking finishes its match', async () => {
      const bAn = (await askBooking('An', '20:00', '21:00', 'A1').expect(201)).body.id as string;
      const bChi = await book('Chi', 'A1', '10:30', '11:30', 'CONFIRMED');
      const mAn = (await openMatch('An', { bookingId: bAn, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;
      const mChi = (await openMatch('Chi', { bookingId: bChi, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;

      clock.at = new Date(vn('12:01'));
      expect((await lobby().expect(200)).body).toEqual([]);
      expect((await db.booking.findUniqueOrThrow({ where: { id: bAn } })).status).toBe('EXPIRED');
      expect((await db.match.findUniqueOrThrow({ where: { id: mAn } })).status).toBe('CANCELLED');
      expect((await db.match.findUniqueOrThrow({ where: { id: mChi } })).status).toBe('FINISHED');

      const anMine = await mine('An').expect(200);
      expect(MyBookingView.parse(anMine.body[0])).toMatchObject({
        id: bAn,
        status: 'EXPIRED',
        sport: 'BADMINTON',
        match: { id: mAn, status: 'CANCELLED', capacity: 4, joinedCount: 1, pricePerSlot: 50_000 },
      });

      const chiMine = await mine('Chi').expect(200);
      expect(MyBookingView.parse(chiMine.body[0])).toMatchObject({
        id: bChi,
        status: 'CONFIRMED',
        sport: 'BADMINTON',
        match: { id: mChi, status: 'FINISHED', capacity: 4, joinedCount: 1, pricePerSlot: 50_000 },
      });
    });

    it('AC-9: user booking cancel and owner booking cancel both cascade to cancel the linked match', async () => {
      const bPending = await book('An', 'A1', '20:00', '21:00', 'PENDING');
      const bConfirmed = await book('An', 'A1', '18:00', '19:00', 'CONFIRMED', { createdAt: '08:10' });
      const mPending = (await openMatch('An', { bookingId: bPending, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;
      const mConfirmed = (await openMatch('An', { bookingId: bConfirmed, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;

      const cancelRes = await userCancelBooking('An', bPending).expect(200);
      expect(cancelRes.body).toMatchObject({ id: bPending, status: 'CANCELLED', match: { id: mPending, status: 'CANCELLED' } });
      await ownerCancelBooking('Bình', bConfirmed).expect(200);

      expect((await db.match.findUniqueOrThrow({ where: { id: mPending } })).status).toBe('CANCELLED');
      expect((await db.match.findUniqueOrThrow({ where: { id: mConfirmed } })).status).toBe('CANCELLED');

      const anMine = await mine('An').expect(200);
      expect(anMine.body.map((b: { id: string; status: string; match: { status: string } }) => [b.id, b.status, b.match.status])).toEqual([
        [bConfirmed, 'CANCELLED', 'CANCELLED'],
        [bPending, 'CANCELLED', 'CANCELLED'],
      ]);
    });
  });

  describe('POST /api/matches/:id/cancel', () => {
    it('AC-10: An cancels a match on a PENDING booking and on a CONFIRMED booking (>= 6h left), freeing the slots', async () => {
      const bPending = await book('An', 'A1', '12:00', '13:00', 'PENDING', { confirmDeadline: '11:00', createdAt: '09:30' });
      const bConfirmed = await book('An', 'A1', '20:00', '21:00', 'CONFIRMED');
      const mPending = (await openMatch('An', { bookingId: bPending, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;
      const mConfirmed = (await openMatch('An', { bookingId: bConfirmed, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;

      for (const [mId, bId] of [[mPending, bPending], [mConfirmed, bConfirmed]] as const) {
        const res = await cancelMatch('An', mId).expect(200);
        expect(MatchView.parse(res.body)).toMatchObject({ id: mId, status: 'CANCELLED', bookingStatus: 'CANCELLED' });
        const b = await db.booking.findUniqueOrThrow({ where: { id: bId } });
        expect(b).toMatchObject({ status: 'CANCELLED', cancelledAt: new Date(vn('10:00')) });
      }
      await askBooking('Chi', '12:00', '13:00', 'A1').expect(201);
      await askBooking('Chi', '20:00', '21:00', 'A1').expect(201);
    });

    it('AC-11: with under 6 hours left on a CONFIRMED booking, host cancel answers 409 CALL_OWNER_MESSAGE, and owner cancel closes both', async () => {
      const bConfirmed = await book('An', 'A1', '20:00', '21:00', 'CONFIRMED');
      const mId = (await openMatch('An', { bookingId: bConfirmed, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;

      clock.at = new Date(new Date(vn('14:00')).getTime() + 1);
      const res = await cancelMatch('An', mId).expect(409);
      expect(res.body.message).toBe(CALL_OWNER_MESSAGE);
      expect((await db.match.findUniqueOrThrow({ where: { id: mId } })).status).toBe('OPEN');
      expect((await db.booking.findUniqueOrThrow({ where: { id: bConfirmed } })).status).toBe('CONFIRMED');

      await ownerCancelBooking('Bình', bConfirmed).expect(200);
      expect((await db.match.findUniqueOrThrow({ where: { id: mId } })).status).toBe('CANCELLED');
      expect((await db.booking.findUniqueOrThrow({ where: { id: bConfirmed } })).status).toBe('CANCELLED');
    });

    it('AC-12: cancelled, overdue, and finished matches answer 409 with lazy updates committed; strangers and other roles are refused', async () => {
      const bCancelled = await book('An', 'A1', '20:00', '21:00', 'CONFIRMED');
      const mCancelled = (await openMatch('An', { bookingId: bCancelled, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;
      await cancelMatch('An', mCancelled).expect(200);

      const bOverdue = await book('An', 'A1', '12:00', '13:00', 'PENDING', { confirmDeadline: '11:00' });
      const mOverdue = (await openMatch('An', { bookingId: bOverdue, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;
      await db.booking.update({ where: { id: bOverdue }, data: { confirmDeadline: new Date(vn('09:30')) } });

      const bFinished = await book('An', 'A1', '11:00', '12:00', 'CONFIRMED');
      const mFinished = (await openMatch('An', { bookingId: bFinished, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;
      await db.booking.update({ where: { id: bFinished }, data: { startAt: new Date(vn('08:00')), endAt: new Date(vn('09:00')) } });

      const bChi = await book('Chi', 'A1', '18:00', '19:00', 'CONFIRMED');
      const mChi = (await openMatch('Chi', { bookingId: bChi, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;

      for (const mId of [mCancelled, mOverdue, mFinished]) {
        const res = await cancelMatch('An', mId).expect(409);
        expect(res.body.message).toBe('Trận này không hủy được nữa');
      }
      expect((await db.booking.findUniqueOrThrow({ where: { id: bOverdue } })).status).toBe('EXPIRED');
      expect((await db.match.findUniqueOrThrow({ where: { id: mOverdue } })).status).toBe('CANCELLED');
      expect((await db.match.findUniqueOrThrow({ where: { id: mFinished } })).status).toBe('FINISHED');

      for (const mId of [mChi, MISSING]) {
        expect((await cancelMatch('An', mId).expect(404)).body.message).toBe('Không tìm thấy trận');
      }
      expect((await cancelMatch('An', 'abc').expect(400)).body.message).toBe('Dữ liệu không hợp lệ');
      for (const [who, status] of [['Bình', 403], ['admin', 403], [null, 401]] as const) {
        await cancelMatch(who, mChi).expect(status);
      }
    });
  });

  describe('concurrency', () => {
    it('AC-13: concurrent open match vs owner reject, and 10 host match cancels vs 10 owner booking confirms give no 500 and consistent state', async () => {
      // Case 1: An opens a match on 20:00-21:00 while Bình rejects the booking.
      const bCase1 = await book('An', 'A1', '20:00', '21:00', 'PENDING');
      const [openRes, rejectRes] = await Promise.all([
        openMatch('An', { bookingId: bCase1, capacity: 4, pricePerSlot: 50_000 }).then((r) => r),
        ownerRejectBooking('Bình', bCase1).then((r) => r),
      ]);
      expect([openRes.status, rejectRes.status].filter((s) => s >= 500)).toEqual([]);
      expect(rejectRes.status).toBe(200);
      expect((await db.booking.findUniqueOrThrow({ where: { id: bCase1 } })).status).toBe('REJECTED');
      const matchCase1 = await db.match.findUnique({ where: { bookingId: bCase1 } });
      if (openRes.status === 201) {
        expect(matchCase1?.status).toBe('CANCELLED');
      } else {
        expect(openRes.status).toBe(409);
        expect(matchCase1).toBeNull();
      }

      // Case 2: At 13:00 (5 hours before 18:00), An has an OPEN match on a PENDING booking 18:00-19:00 (confirmDeadline 15:00).
      clock.at = new Date(vn('13:00'));
      const bCase2 = await book('An', 'A1', '18:00', '19:00', 'PENDING', { confirmDeadline: '15:00', createdAt: '13:00' });
      const mCase2 = (await openMatch('An', { bookingId: bCase2, capacity: 4, pricePerSlot: 50_000 }).expect(201)).body.id as string;

      const responses = await Promise.all([
        ...Array.from({ length: 10 }, () => cancelMatch('An', mCase2).then((r) => ({ kind: 'cancel' as const, res: r }))),
        ...Array.from({ length: 10 }, () => ownerConfirmBooking('Bình', bCase2).then((r) => ({ kind: 'confirm' as const, res: r }))),
      ]);
      expect(responses.filter((r) => r.res.status >= 500)).toEqual([]);
      expect(responses.filter((r) => r.res.status === 200)).toHaveLength(1);
      expect(responses.filter((r) => r.res.status === 409)).toHaveLength(19);

      const winner = responses.find((r) => r.res.status === 200)!;
      const finalBooking = await db.booking.findUniqueOrThrow({ where: { id: bCase2 } });
      const finalMatch = await db.match.findUniqueOrThrow({ where: { id: mCase2 } });
      if (winner.kind === 'cancel') {
        expect(finalBooking.status).toBe('CANCELLED');
        expect(finalMatch.status).toBe('CANCELLED');
      } else {
        expect(finalBooking.status).toBe('CONFIRMED');
        expect(finalMatch.status).toBe('OPEN');
      }
    });
  });

  describe('skill level in match lobby (F-029)', () => {
    let beginnerMatchId: string;
    let intermediateMatchId: string;
    let noLevelMatchId: string;

    beforeEach(async () => {
      const passwordHash = await hash('test-password');
      await db.user.update({ where: { id: ids['An'] }, data: { skillLevel: 'BEGINNER' } });
      await db.user.update({ where: { id: ids['Chi'] }, data: { skillLevel: 'INTERMEDIATE' } });
      const em = await db.user.create({ data: { name: 'Em', phone: '0901119999', role: 'USER', passwordHash } });
      ids['Em'] = em.id;

      const b1 = await book('An', 'A1', '14:00', '15:00', 'CONFIRMED');
      const res1 = await openMatch('An', { bookingId: b1, capacity: 4, pricePerSlot: 50_000 }).expect(201);
      beginnerMatchId = res1.body.id;

      const b2 = await book('Chi', 'A2', '16:00', '17:00', 'CONFIRMED');
      const res2 = await openMatch('Chi', { bookingId: b2, capacity: 4, pricePerSlot: 60_000 }).expect(201);
      intermediateMatchId = res2.body.id;

      const b3 = await book('Em', 'B1', '18:00', '19:00', 'CONFIRMED');
      const res3 = await openMatch('Em', { bookingId: b3, capacity: 4, pricePerSlot: 70_000 }).expect(201);
      noLevelMatchId = res3.body.id;
    });

    it('AC-3: GET /api/matches?level=<level> returns only matches whose host has that level; without level returns all', async () => {
      const beginnerRes = await lobby('?level=BEGINNER').expect(200);
      expect(beginnerRes.body).toHaveLength(1);
      expect(beginnerRes.body[0].id).toBe(beginnerMatchId);

      const intermediateRes = await lobby('?level=INTERMEDIATE').expect(200);
      expect(intermediateRes.body).toHaveLength(1);
      expect(intermediateRes.body[0].id).toBe(intermediateMatchId);

      const advancedRes = await lobby('?level=ADVANCED').expect(200);
      expect(advancedRes.body).toHaveLength(0);

      const allRes = await lobby().expect(200);
      expect(allRes.body).toHaveLength(3);
      const allIds = allRes.body.map((m: { id: string }) => m.id);
      expect(allIds).toContain(beginnerMatchId);
      expect(allIds).toContain(intermediateMatchId);
      expect(allIds).toContain(noLevelMatchId);
    });

    it('AC-4: MatchView in lobby and match detail includes hostSkillLevel; null when host has no level', async () => {
      const listRes = await lobby().expect(200);
      const mBeginner = listRes.body.find((m: { id: string }) => m.id === beginnerMatchId);
      expect(mBeginner.hostSkillLevel).toBe('BEGINNER');
      const mNoLevel = listRes.body.find((m: { id: string }) => m.id === noLevelMatchId);
      expect(mNoLevel.hostSkillLevel).toBeNull();

      const detailBeginner = await as('An')(http().get(`/api/matches/${beginnerMatchId}`)).expect(200);
      expect(detailBeginner.body.hostSkillLevel).toBe('BEGINNER');

      const detailNoLevel = await as('An')(http().get(`/api/matches/${noLevelMatchId}`)).expect(200);
      expect(detailNoLevel.body.hostSkillLevel).toBeNull();
    });

    it('AC-5: GET /api/matches?level=EXPERT returns 400 with Messages.invalid', async () => {
      const res = await lobby('?level=EXPERT').expect(400);
      expect(res.body.message).toBe(Messages.invalid);
    });
  });
});

describe('a transaction that Postgres ends in MatchesService', () => {
  const ended = (code: string) => Object.assign(new Error('ended by Postgres'), { code });
  const USER = '0199a1b2-0000-7000-8000-000000000001';
  const BOOKING = '0199a1b2-0000-7000-8000-000000000002';
  const MATCH = '0199a1b2-0000-7000-8000-000000000003';
  const fixed = { now: () => new Date(vn('10:00')) } as Clock;
  const service = (prisma: Record<string, unknown>) => new MatchesService(prisma as unknown as PrismaService, fixed);

  for (const code of ['40P01', 'P2034']) {
    it(`create and cancel answer 409 after ${code}, and list retries once`, async () => {
      const prisma = {
        booking: { findUnique: vi.fn().mockResolvedValue({ courtId: 'c', createdById: USER, source: 'APP' }) },
        match: { findUnique: vi.fn().mockResolvedValue({ hostId: USER, booking: { courtId: 'c' } }), findMany: vi.fn() },
        $transaction: vi.fn().mockRejectedValue(ended(code)),
        $executeRaw: vi.fn().mockRejectedValue(ended(code)),
      };
      await expect(service(prisma).create(USER, { bookingId: BOOKING, capacity: 4, pricePerSlot: 50_000 })).rejects.toThrow(BUSY);
      await expect(service(prisma).cancel(USER, MATCH)).rejects.toThrow(BUSY);
      const listFailure = service(prisma).list({});
      await expect(listFailure).rejects.toBeInstanceOf(ConflictException);
      await expect(listFailure).rejects.toThrow(BUSY);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    });
  }
});
