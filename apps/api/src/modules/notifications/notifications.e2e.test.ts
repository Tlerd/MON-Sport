import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import type {
  NotificationItemView,
  NotificationReadAllResponse,
  NotificationReadResponse,
  NotificationsListResponse,
} from '@monsport/shared';
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

const requestBooking = (who: string | null, body: Record<string, unknown>) => as(who)(http().post('/api/bookings')).send(body);
const confirmBooking = (who: string | null, id: string) => as(who)(http().post(`/api/owner/bookings/${id}/confirm`));
const rejectBooking = (who: string | null, id: string) => as(who)(http().post(`/api/owner/bookings/${id}/reject`));
const cancelBooking = (who: string | null, id: string) => as(who)(http().post(`/api/bookings/${id}/cancel`));
const openMatch = (who: string | null, body: Record<string, unknown>) => as(who)(http().post('/api/matches')).send(body);
const joinMatch = (who: string | null, id: string) => as(who)(http().post(`/api/matches/${id}/join`));
const leaveMatch = (who: string | null, id: string) => as(who)(http().post(`/api/matches/${id}/leave`));
const cancelMatch = (who: string | null, id: string) => as(who)(http().post(`/api/matches/${id}/cancel`));
const listNotifications = (who: string | null) => as(who)(http().get('/api/notifications'));
const readNotification = (who: string | null, id: string) => as(who)(http().post(`/api/notifications/${id}/read`));
const readAllNotifications = (who: string | null) => as(who)(http().post('/api/notifications/read-all'));

async function book(
  who: string,
  start: string,
  end: string,
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED' = 'PENDING',
): Promise<string> {
  const startAt = new Date(vn(start));
  const row = await db.booking.create({
    data: {
      courtId: ids.A1,
      startAt,
      endAt: new Date(vn(end)),
      status,
      source: 'APP',
      createdById: ids[who],
      priceTotal: 80_000,
      confirmDeadline: status === 'PENDING' ? new Date(startAt.getTime() - 3_600_000) : null,
      confirmedAt: status === 'CONFIRMED' ? new Date(vn('08:00')) : null,
      createdAt: new Date(vn('08:00')),
    },
  });
  return row.id;
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

describe('notifications in app (F-013)', () => {
  beforeEach(async () => {
    clock.at = new Date(vn('10:00'));
    await db.$executeRawUnsafe('TRUNCATE "Notification", "MatchPlayer", "Match", "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
    const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER') =>
      db.user.create({ data: { name, phone, role, passwordHash } }).then((u) => (ids[name] = u.id));
    await Promise.all([
      user('admin', '0900000000', 'ADMIN'),
      user('Bình', '0912345678', 'OWNER'),
      user('An', '0901234567', 'USER'),
      user('Chi', '0901234568', 'USER'),
      user('Em', '0901234569', 'USER'),
      user('Hà', '0901234570', 'USER'),
    ]);
    const a = await db.venue.create({
      data: { ownerId: ids['Bình'], name: 'Cầu lông A', address: '10 Nguyễn Huệ', phone: '0911111111', opensAt: 360, closesAt: 1380 },
    });
    ids.A1 = (await db.court.create({ data: { venueId: a.id, name: 'Sân 1', sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 } })).id;
  });

  it('AC-1: creating a booking request emits BOOKING_REQUESTED notification to venue owner', async () => {
    const res = await requestBooking('An', {
      courtId: ids.A1,
      startAt: vn('20:00'),
      endAt: vn('21:00'),
    }).expect(201);

    const rows = await db.notification.findMany({ where: { userId: ids['Bình'] } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: ids['Bình'],
      type: 'BOOKING_REQUESTED',
      bookingId: res.body.id,
      matchId: null,
      readAt: null,
    });
  });

  it('AC-2: confirming a booking emits BOOKING_CONFIRMED notification to booking creator', async () => {
    const bookingId = await book('An', '20:00', '21:00', 'PENDING');
    await confirmBooking('Bình', bookingId).expect(200);

    const rows = await db.notification.findMany({ where: { userId: ids['An'] } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: ids['An'],
      type: 'BOOKING_CONFIRMED',
      bookingId,
      matchId: null,
      readAt: null,
    });
  });

  it('AC-3: rejecting a booking emits BOOKING_REJECTED notification to booking creator', async () => {
    const bookingId = await book('An', '20:00', '21:00', 'PENDING');
    await rejectBooking('Bình', bookingId).expect(200);

    const rows = await db.notification.findMany({ where: { userId: ids['An'] } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: ids['An'],
      type: 'BOOKING_REJECTED',
      bookingId,
      matchId: null,
      readAt: null,
    });
  });

  it('AC-4: host cancelling a match emits MATCH_CANCELLED notification to all active players', async () => {
    const bookingId = await book('An', '20:00', '21:00', 'PENDING');
    const matchRes = await openMatch('An', { bookingId, capacity: 4, pricePerSlot: 50_000 }).expect(201);
    const matchId = matchRes.body.id as string;

    await joinMatch('Chi', matchId).expect(200);
    await joinMatch('Em', matchId).expect(200);

    // Cancel match
    await cancelMatch('An', matchId).expect(200);

    const rows = await db.notification.findMany({
      where: { matchId, type: 'MATCH_CANCELLED' },
      orderBy: { userId: 'asc' },
    });
    expect(rows).toHaveLength(3);

    const userIds = rows.map((r) => r.userId).sort();
    const expectedUserIds = [ids['An'], ids['Chi'], ids['Em']].sort();
    expect(userIds).toEqual(expectedUserIds);
  });

  it('AC-5: owner rejecting booking with a match emits BOOKING_REJECTED to creator and MATCH_CANCELLED to players', async () => {
    const bookingId = await book('An', '20:00', '21:00', 'PENDING');
    const matchRes = await openMatch('An', { bookingId, capacity: 4, pricePerSlot: 50_000 }).expect(201);
    const matchId = matchRes.body.id as string;

    await joinMatch('Chi', matchId).expect(200);

    // Reject booking
    await rejectBooking('Bình', bookingId).expect(200);

    const anNotifs = await db.notification.findMany({ where: { userId: ids['An'] } });
    expect(anNotifs).toHaveLength(2);
    expect(anNotifs.map((n) => n.type).sort()).toEqual(['BOOKING_REJECTED', 'MATCH_CANCELLED']);

    const chiNotifs = await db.notification.findMany({ where: { userId: ids['Chi'] } });
    expect(chiNotifs).toHaveLength(1);
    expect(chiNotifs[0].type).toBe('MATCH_CANCELLED');
    expect(chiNotifs[0].matchId).toBe(matchId);
  });

  it('AC-6: player cancelling booking with a match notifies active players and skips LEFT players', async () => {
    const bookingId = await book('An', '20:00', '21:00', 'PENDING');
    const matchRes = await openMatch('An', { bookingId, capacity: 4, pricePerSlot: 50_000 }).expect(201);
    const matchId = matchRes.body.id as string;

    await joinMatch('Chi', matchId).expect(200);
    await joinMatch('Hà', matchId).expect(200);
    await leaveMatch('Hà', matchId).expect(200);

    // Cancel booking
    await cancelBooking('An', bookingId).expect(200);

    const rows = await db.notification.findMany({ where: { matchId, type: 'MATCH_CANCELLED' } });
    expect(rows).toHaveLength(2);
    const notifiedUsers = rows.map((r) => r.userId).sort();
    expect(notifiedUsers).toEqual([ids['An'], ids['Chi']].sort());

    const haNotifs = await db.notification.findMany({ where: { userId: ids['Hà'] } });
    expect(haNotifs).toHaveLength(0);
  });

  it('AC-7: lists notifications formatted in Asia/Ho_Chi_Minh with unread count and filters by user', async () => {
    const bookingId = await book('An', '20:00', '21:00', 'PENDING');
    const pastBookingId = await book('An', '18:00', '19:00', 'CONFIRMED');

    // Create 2 notifications for Bình (1 unread at 10:00, 1 read at 09:00)
    await db.notification.create({
      data: {
        userId: ids['Bình'],
        type: 'BOOKING_REQUESTED',
        bookingId,
        readAt: null,
        createdAt: new Date(vn('10:00')),
      },
    });
    await db.notification.create({
      data: {
        userId: ids['Bình'],
        type: 'BOOKING_REQUESTED',
        bookingId: pastBookingId,
        readAt: new Date(vn('09:00')),
        createdAt: new Date(vn('08:30')),
      },
    });

    // Create 1 unread notification for An
    await db.notification.create({
      data: {
        userId: ids['An'],
        type: 'BOOKING_CONFIRMED',
        bookingId,
        readAt: null,
        createdAt: new Date(vn('09:30')),
      },
    });

    // Bình lists notifications
    const binhRes = await listNotifications('Bình').expect(200);
    const binhData = binhRes.body as NotificationsListResponse;
    expect(binhData.unreadCount).toBe(1);
    expect(binhData.items).toHaveLength(2);
    expect(binhData.items[0]).toMatchObject({
      title: 'Yêu cầu đặt sân mới',
      message: 'Có yêu cầu đặt sân tại Cầu lông A - Sân 1 khung 20:00 - 21:00 ngày 20/11/2026.',
      venueName: 'Cầu lông A',
      courtName: 'Sân 1',
      readAt: null,
    });
    expect(binhData.items[1].readAt).not.toBeNull();

    // An lists notifications
    const anRes = await listNotifications('An').expect(200);
    const anData = anRes.body as NotificationsListResponse;
    expect(anData.unreadCount).toBe(1);
    expect(anData.items).toHaveLength(1);
    expect(anData.items[0].title).toBe('Yêu cầu đặt sân đã được xác nhận');

    // Guest gets 401
    await listNotifications(null).expect(401);
  });

  it('AC-8: marking a notification as read is idempotent and enforces ownership', async () => {
    const bookingId = await book('An', '20:00', '21:00', 'PENDING');
    const notifAn = await db.notification.create({
      data: {
        userId: ids['An'],
        type: 'BOOKING_CONFIRMED',
        bookingId,
        readAt: null,
        createdAt: new Date(vn('09:30')),
      },
    });
    const notifBinh = await db.notification.create({
      data: {
        userId: ids['Bình'],
        type: 'BOOKING_REQUESTED',
        bookingId,
        readAt: null,
        createdAt: new Date(vn('09:30')),
      },
    });

    // An marks own notification as read
    const readRes1 = await readNotification('An', notifAn.id).expect(200);
    const readData1 = readRes1.body as NotificationReadResponse;
    expect(readData1.id).toBe(notifAn.id);
    expect(readData1.readAt).toBeTruthy();

    // Idempotent: reading again keeps readAt
    const readRes2 = await readNotification('An', notifAn.id).expect(200);
    const readData2 = readRes2.body as NotificationReadResponse;
    expect(readData2.readAt).toBe(readData1.readAt);

    // An tries to read Bình's notification -> 404
    await readNotification('An', notifBinh.id).expect(404);

    // Non-existent UUID -> 404
    await readNotification('An', MISSING).expect(404);

    // Invalid UUID -> 400
    await readNotification('An', 'not-a-uuid').expect(400);

    // Guest -> 401
    await readNotification(null, notifAn.id).expect(401);
  });

  it('AC-9: mark-all-as-read marks all unread notifications of user', async () => {
    const bookingId = await book('An', '20:00', '21:00', 'PENDING');
    for (let i = 0; i < 3; i++) {
      await db.notification.create({
        data: {
          userId: ids['Bình'],
          type: 'BOOKING_REQUESTED',
          bookingId,
          readAt: null,
          createdAt: new Date(vn('09:30')),
        },
      });
    }

    const res = await readAllNotifications('Bình').expect(200);
    const data = res.body as NotificationReadAllResponse;
    expect(data.count).toBe(3);

    const listRes = await listNotifications('Bình').expect(200);
    expect((listRes.body as NotificationsListResponse).unreadCount).toBe(0);
  });
});
