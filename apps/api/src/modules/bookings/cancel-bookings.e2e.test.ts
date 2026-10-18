import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { CALL_OWNER_MESSAGE, userCancelDecision } from '@monsport/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { BookingsService } from './bookings.service.js';

// Data of brief F-009: Bình runs "Cầu lông A" (phone 0911111111, 06:00-23:00, "Sân 1" and "Sân 2"), Dũng runs
// "Cầu lông B" with its own "Sân 1". An and Chi are users. Now is 20/11/2026 10:00, and every time below is on that day.
const vn = (hhmm: string) => `2026-11-20T${hhmm}:00+07:00`;
const clock = { at: new Date(vn('10:00')), now() { return this.at; } };
const TAKEN = 'Khung giờ này vừa có người đặt';
const GONE = 'Booking này không hủy được nữa';
const NOT_FOUND = 'Không tìm thấy booking';
const BUSY = 'Yêu cầu đang được xử lý, hãy thử lại';
const MISSING = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

let app: INestApplication;
let db: PrismaService;
const ids: Record<string, string> = {};
const http = () => request(app.getHttpServer());
const as = (who: string | null) => (r: request.Test) => (who ? r.set('Cookie', `session=${issueSession(ids[who], clock.now())}`) : r);
const userCancel = (who: string | null, id: string) => as(who)(http().post(`/api/bookings/${id}/cancel`));
const ownerCancel = (who: string | null, id: string) => as(who)(http().post(`/api/owner/bookings/${id}/cancel`));
const mine = (who: string | null) => as(who)(http().get('/api/bookings/mine'));
const ask = (who: string, start: string, end: string, court = 'A1') =>
  as(who)(http().post('/api/bookings')).send({ courtId: ids[court], startAt: vn(start), endAt: vn(end) });
const enter = (start: string, end: string, court = 'A1') =>
  as('Bình')(http().post('/api/owner/bookings')).send({ courtId: ids[court], startAt: vn(start), endAt: vn(end) });

/** Writes one booking row straight into the database, so a test can set any status and any time. */
async function book(
  who: string,
  court: string,
  start: string,
  end: string,
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED',
  extra: { source?: 'APP' | 'PHONE'; confirmDeadline?: string; createdAt?: string } = {},
): Promise<string> {
  const startAt = new Date(vn(start));
  const row = await db.booking.create({
    data: {
      courtId: ids[court],
      startAt,
      endAt: new Date(vn(end)),
      status,
      source: extra.source ?? 'APP',
      createdById: ids[who],
      priceTotal: 80_000,
      confirmDeadline: status === 'PENDING' ? new Date(extra.confirmDeadline ? vn(extra.confirmDeadline) : startAt.getTime() - 3_600_000) : null,
      confirmedAt: status === 'CONFIRMED' ? new Date(vn('08:00')) : null,
      cancelledAt: status === 'CANCELLED' ? new Date(vn('08:30')) : null,
      createdAt: extra.createdAt ? new Date(vn(extra.createdAt)) : new Date(vn('08:00')),
    },
  });
  return row.id;
}
const rows = () => db.booking.findMany({ orderBy: { id: 'asc' } });
const row = (id: string) => db.booking.findUniqueOrThrow({ where: { id } });

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue(clock).compile();
  app = setupApp(moduleRef.createNestApplication());
  await app.init();
  db = app.get(PrismaService);
});

afterAll(async () => {
  await app?.close();
});

describe('with the database', () => {
  beforeEach(async () => {
    clock.at = new Date(vn('10:00'));
    await db.$executeRawUnsafe('TRUNCATE "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
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
    const prices = { sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 } as const;
    const a = await db.venue.create({ data: { ownerId: ids['Bình'], name: 'Cầu lông A', address: 'A', phone: '0911111111', opensAt: 360, closesAt: 1380 } });
    const b = await db.venue.create({ data: { ownerId: ids['Dũng'], name: 'Cầu lông B', address: 'B', phone: '0912345679', opensAt: 360, closesAt: 1380 } });
    ids.A1 = (await db.court.create({ data: { venueId: a.id, name: 'Sân 1', ...prices } })).id;
    ids.A2 = (await db.court.create({ data: { venueId: a.id, name: 'Sân 2', ...prices } })).id;
    ids.B1 = (await db.court.create({ data: { venueId: b.id, name: 'Sân 1', ...prices } })).id;
  });

  describe('POST /api/bookings/:id/cancel', () => {
    it('AC-1: An cancels a pending request, and Chi takes the slot', async () => {
      const id = (await ask('An', '20:00', '21:00').expect(201)).body.id as string;
      const res = await userCancel('An', id).expect(200);
      expect(res.body).toMatchObject({
        id,
        status: 'CANCELLED',
        cancelledAt: new Date(vn('10:00')).toISOString(),
        courtName: 'Sân 1',
        venueName: 'Cầu lông A',
        venuePhone: '0911111111',
      });
      await ask('Chi', '20:00', '21:00').expect(201);
    });

    it('AC-2: a pending request 2 hours before the start is cancelled, with no 6-hour mark', async () => {
      const id = await book('An', 'A1', '12:00', '13:00', 'PENDING', { confirmDeadline: '11:00', createdAt: '09:30' });
      const res = await userCancel('An', id).expect(200);
      expect(res.body.status).toBe('CANCELLED');
      expect((await row(id)).status).toBe('CANCELLED');
    });

    it('AC-3: a confirmed booking with 7 hours left is cancelled', async () => {
      const id = await book('An', 'A1', '20:00', '21:00', 'CONFIRMED');
      clock.at = new Date(vn('13:00'));
      const res = await userCancel('An', id).expect(200);
      expect(res.body).toMatchObject({ status: 'CANCELLED', cancelledAt: new Date(vn('13:00')).toISOString() });
    });

    it('AC-4: a confirmed booking with 5 hours left answers 409 and stays confirmed', async () => {
      const id = await book('An', 'A1', '20:00', '21:00', 'CONFIRMED');
      clock.at = new Date(vn('15:00'));
      expect((await userCancel('An', id).expect(409)).body.message).toBe(CALL_OWNER_MESSAGE);
      expect(await row(id)).toMatchObject({ status: 'CONFIRMED', cancelledAt: null });
    });

    it('AC-5: exactly 6 hours left is cancelled, and 1 ms later is refused', async () => {
      const first = await book('An', 'A1', '20:00', '21:00', 'CONFIRMED');
      const second = await book('An', 'A2', '20:00', '21:00', 'CONFIRMED');
      const startAt = new Date(vn('20:00'));
      const exact = new Date(vn('14:00'));
      const late = new Date(exact.getTime() + 1);
      expect([userCancelDecision({ status: 'CONFIRMED', startAt }, exact), userCancelDecision({ status: 'CONFIRMED', startAt }, late)]).toEqual(['ALLOW', 'CALL_OWNER']);

      clock.at = exact;
      await userCancel('An', first).expect(200);
      clock.at = late;
      expect((await userCancel('An', second).expect(409)).body.message).toBe(CALL_OWNER_MESSAGE);
      expect((await row(second)).status).toBe('CONFIRMED');
    });

    it('AC-6: a finished status, a started booking, and an overdue request are refused, and only the overdue one changes', async () => {
      const ids6 = [
        await book('An', 'A1', '17:00', '18:00', 'REJECTED'),
        await book('An', 'A1', '18:00', '19:00', 'EXPIRED'),
        await book('An', 'A1', '19:00', '20:00', 'CANCELLED'),
        await book('An', 'A1', '09:00', '10:30', 'CONFIRMED'),
        await book('An', 'A1', '12:00', '13:00', 'PENDING', { confirmDeadline: '09:30' }),
      ];
      const before = await rows();
      for (const id of ids6) expect((await userCancel('An', id).expect(409)).body.message).toBe(GONE);
      // A cancelled booking answers the same on the second try.
      expect((await userCancel('An', ids6[2]).expect(409)).body.message).toBe(GONE);
      const overdue = ids6[4];
      expect((await row(overdue)).status).toBe('EXPIRED');
      expect(await rows()).toEqual(before.map((r) => (r.id === overdue ? { ...r, status: 'EXPIRED' } : r)));
    });

    it('AC-7: a stranger, a phone booking, a missing id, a malformed id, other roles, and no cookie are refused', async () => {
      const pending = await book('An', 'A1', '20:00', '21:00', 'PENDING');
      const phone = await book('Bình', 'A1', '17:00', '18:00', 'CONFIRMED', { source: 'PHONE' });
      const before = await rows();

      expect((await userCancel('Chi', pending).expect(404)).body.message).toBe(NOT_FOUND);
      expect((await userCancel('An', phone).expect(404)).body.message).toBe(NOT_FOUND);
      expect((await userCancel('An', MISSING).expect(404)).body.message).toBe(NOT_FOUND);
      expect((await userCancel('An', 'abc').expect(400)).body.message).toBe('Dữ liệu không hợp lệ');
      for (const [who, status] of [['Bình', 403], ['admin', 403], [null, 401]] as const) await userCancel(who, pending).expect(status);
      expect(await rows()).toEqual(before);
    });

    it('AC-7: a stranger does not expire the overdue request of another user', async () => {
      const overdue = await book('An', 'A1', '12:00', '13:00', 'PENDING', { confirmDeadline: '09:30' });
      await userCancel('Chi', overdue).expect(404);
      expect((await row(overdue)).status).toBe('PENDING');
    });
  });

  describe('POST /api/owner/bookings/:id/cancel', () => {
    it('AC-8: Bình cancels an app booking until it starts, with no 6-hour mark', async () => {
      const early = await book('An', 'A1', '15:00', '16:00', 'CONFIRMED');
      const late = await book('An', 'A1', '20:00', '21:00', 'CONFIRMED');
      for (const id of [early, late]) {
        const res = await ownerCancel('Bình', id).expect(200);
        expect(res.body).toMatchObject({ id, status: 'CANCELLED', cancelledAt: new Date(vn('10:00')).toISOString() });
      }
    });

    it('AC-9: a pending, an overdue, a rejected, and a started booking are refused, and a booking of Dũng answers 404', async () => {
      const pending = await book('An', 'A1', '20:00', '21:00', 'PENDING');
      const overdue = await book('An', 'A1', '12:00', '13:00', 'PENDING', { confirmDeadline: '09:30' });
      const rejected = await book('An', 'A1', '17:00', '18:00', 'REJECTED');
      const started = await book('An', 'A1', '09:00', '10:30', 'CONFIRMED');
      const dung = await book('An', 'B1', '20:00', '21:00', 'CONFIRMED');
      const before = await rows();

      expect((await ownerCancel('Bình', pending).expect(409)).body.message).toBe('Yêu cầu đang chờ xác nhận. Hãy từ chối yêu cầu này');
      for (const id of [overdue, rejected, started]) expect((await ownerCancel('Bình', id).expect(409)).body.message).toBe(GONE);
      expect((await row(overdue)).status).toBe('EXPIRED');
      expect((await ownerCancel('Bình', dung).expect(404)).body.message).toBe(NOT_FOUND);
      await ownerCancel('admin', pending).expect(403);
      expect(await rows()).toEqual(before.map((r) => (r.id === overdue ? { ...r, status: 'EXPIRED' } : r)));
    });

    it('AC-9: Bình cannot expire an overdue request of Dũng by trying to cancel it', async () => {
      const strangers = await book('An', 'B1', '12:00', '13:00', 'PENDING', { confirmDeadline: '09:30' });
      expect((await ownerCancel('Bình', strangers).expect(404)).body.message).toBe(NOT_FOUND);
      expect((await row(strangers)).status).toBe('PENDING');
    });

    it('AC-9: Bình cancels a phone booking of the same rule, and the slot is free again', async () => {
      const id = (await enter('17:00', '18:00').expect(201)).body.id as string;
      await ownerCancel('Bình', id).expect(200);
      await enter('17:00', '18:00').expect(201);
    });
  });

  describe('GET /api/bookings/mine', () => {
    it('AC-10: An sees only their bookings, newest first, with the overdue request expired', async () => {
      const cancelled = await book('An', 'A1', '17:00', '18:00', 'CANCELLED', { createdAt: '08:00' });
      const overdue = await book('An', 'A1', '12:00', '13:00', 'PENDING', { confirmDeadline: '09:30', createdAt: '08:10' });
      const confirmed = await book('An', 'A1', '20:00', '21:00', 'CONFIRMED', { createdAt: '08:20' });
      const rejected = await book('An', 'A2', '20:00', '21:00', 'REJECTED', { createdAt: '08:30' });
      await book('Chi', 'A2', '18:00', '19:00', 'CONFIRMED');
      await book('Bình', 'A2', '15:00', '16:00', 'CONFIRMED', { source: 'PHONE' });

      const res = await mine('An').expect(200);
      expect(res.body.map((b: { id: string }) => b.id)).toEqual([rejected, confirmed, overdue, cancelled]);
      expect(res.body.map((b: { status: string }) => b.status)).toEqual(['REJECTED', 'CONFIRMED', 'EXPIRED', 'CANCELLED']);
      for (const b of res.body) expect(b).toMatchObject({ venueName: 'Cầu lông A', venuePhone: '0911111111' });
      for (const b of res.body) expect(b).toHaveProperty('cancelledAt');
      expect(res.body.map((b: { courtName: string }) => b.courtName)).toEqual(['Sân 2', 'Sân 1', 'Sân 1', 'Sân 1']);
      expect(res.body[3]).toHaveProperty('cancelledAt', new Date(vn('08:30')).toISOString());
      expect((await row(overdue)).status).toBe('EXPIRED');

      for (const [who, status] of [['Bình', 403], ['admin', 403], [null, 401]] as const) await mine(who).expect(status);
    });

    it('AC-10: two bookings made at the same instant come in descending id order', async () => {
      const first = await book('An', 'A1', '17:00', '18:00', 'CANCELLED');
      const second = await book('An', 'A1', '18:00', '19:00', 'CANCELLED');
      const res = await mine('An').expect(200);
      expect(res.body.map((b: { id: string }) => b.id)).toEqual([second, first].sort().reverse());
    });
  });

  describe('concurrency', () => {
    it('AC-11: 20 parallel cancels of one booking give exactly one 200 and no 500', async () => {
      const id = await book('An', 'A1', '20:00', '21:00', 'CONFIRMED');
      const responses = await Promise.all(Array.from({ length: 20 }, () => userCancel('An', id).then((r) => r)));
      expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
      const refused = responses.filter((r) => r.status === 409);
      expect(refused).toHaveLength(19);
      expect(refused.every((r) => r.body.message === GONE)).toBe(true);
      const { cancelledAt } = await row(id);
      expect(cancelledAt).toEqual(new Date(vn('10:00')));
    });

    it('AC-12: 10 cancels and 10 confirms of one pending request give exactly one 200 and no 500', async () => {
      const id = await book('An', 'A1', '12:00', '13:00', 'PENDING', { confirmDeadline: '11:00', createdAt: '09:30' });
      const responses = await Promise.all([
        ...Array.from({ length: 10 }, () => userCancel('An', id).then((r) => ({ kind: 'cancel', res: r }))),
        ...Array.from({ length: 10 }, () => as('Bình')(http().post(`/api/owner/bookings/${id}/confirm`)).then((r) => ({ kind: 'confirm', res: r }))),
      ]);
      expect(responses.filter((r) => r.res.status === 200)).toHaveLength(1);
      expect(responses.filter((r) => r.res.status === 409)).toHaveLength(19);
      const { status } = await row(id);
      expect(['CONFIRMED', 'CANCELLED']).toContain(status);
      const winner = responses.find((r) => r.res.status === 200)!;
      expect(status).toBe(winner.kind === 'confirm' ? 'CONFIRMED' : 'CANCELLED');
      if (status === 'CONFIRMED') {
        const cancels = responses.filter((r) => r.kind === 'cancel');
        expect(cancels.every((r) => r.res.status === 409 && r.res.body.message === CALL_OWNER_MESSAGE)).toBe(true);
      }
    });

    it('AC-13: a cancel with 10 user requests and 10 owner entries of the same slot gives no 500 and no double booking', async () => {
      const id = await book('An', 'A1', '20:00', '21:00', 'CONFIRMED');
      const responses = await Promise.all([
        userCancel('An', id).then((r) => r),
        ...Array.from({ length: 10 }, () => ask('Chi', '20:00', '21:00').then((r) => r)),
        ...Array.from({ length: 10 }, () => enter('20:00', '21:00').then((r) => r)),
      ]);
      expect(responses.map((r) => r.status).filter((s) => s >= 500)).toEqual([]);
      expect((await row(id)).status).toBe('CANCELLED');
      expect(await db.booking.count({ where: { startAt: new Date(vn('20:00')), status: { in: ['PENDING', 'CONFIRMED'] } } })).toBeLessThanOrEqual(1);
      for (const r of responses.slice(1)) {
        expect(r.status === 201 || (r.status === 409 && r.body.message === TAKEN)).toBe(true);
      }
    });
  });
});

// Review of PR #49 (finding 2): the 40P01 paths need a deadlock on demand, which a real database does not give.
describe('a transaction that Postgres ends', () => {
  const ended = (code: string) => Object.assign(new Error('ended by Postgres'), { code });
  const USER = '0199a1b2-0000-7000-8000-000000000001';
  const fixed = { now: () => new Date(vn('10:00')) } as Clock;
  const service = (prisma: Record<string, unknown>) => new BookingsService(prisma as unknown as PrismaService, fixed);
  const transactionEnded = (code: string) => ({
    booking: { findUnique: vi.fn().mockResolvedValue({ courtId: 'c' }) },
    $transaction: vi.fn().mockRejectedValue(ended(code)),
  });

  for (const code of ['40P01', 'P2034']) {
    it(`AC-14: the user cancel answers 409 after ${code}`, async () => {
      const prisma = transactionEnded(code);
      const failure = service(prisma).cancelOwn(USER, 'b');
      await expect(failure).rejects.toBeInstanceOf(ConflictException);
      await expect(failure).rejects.toThrow(BUSY);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it(`AC-14: the owner cancel answers 409 after ${code}`, async () => {
      const failure = service(transactionEnded(code)).cancelAsOwner(USER, 'b');
      await expect(failure).rejects.toBeInstanceOf(ConflictException);
      await expect(failure).rejects.toThrow(BUSY);
    });

    it(`AC-14: mine runs the expire once more after ${code}, and answers 409 when the second run ends too`, async () => {
      const prisma = { $executeRaw: vi.fn().mockRejectedValue(ended(code)), booking: { findMany: vi.fn() } };
      const failure = service(prisma).mine(USER);
      await expect(failure).rejects.toBeInstanceOf(ConflictException);
      await expect(failure).rejects.toThrow(BUSY);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
    });
  }

  it('AC-14: mine lists when the second expire runs through', async () => {
    const prisma = {
      $executeRaw: vi.fn().mockRejectedValueOnce(ended('40P01')).mockResolvedValue(0),
      booking: { findMany: vi.fn().mockResolvedValue([]) },
    };
    expect(await service(prisma).mine(USER)).toEqual([]);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('AC-14: another error is not hidden', async () => {
    const prisma = { ...transactionEnded('XX000'), $executeRaw: vi.fn().mockRejectedValue(new Error('boom')) };
    await expect(service(prisma).cancelOwn(USER, 'b')).rejects.toThrow('ended by Postgres');
    await expect(service(prisma).mine(USER)).rejects.toThrow('boom');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
