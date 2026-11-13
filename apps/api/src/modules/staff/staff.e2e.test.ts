import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { STAFF_PHONE_TAKEN, StaffView } from '@monsport/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

const NOW = new Date('2026-11-12T10:00:00+07:00');
const LATER = new Date('2026-11-12T11:00:00+07:00');
let currentTime = NOW;
const clock = {
  now: () => currentTime,
};
const PASSWORD = 'test-password-123';

let app: INestApplication;
let db: PrismaService;
const ids: Record<string, string> = {};
const cookie = (who: string, at = currentTime) => `session=${issueSession(ids[who], at)}`;
const http = () => request(app.getHttpServer());
const as = (who: string, at = currentTime) => ({
  get: (path: string) => http().get(path).set('Cookie', cookie(who, at)),
  post: (path: string, body?: object) => http().post(path).set('Cookie', cookie(who, at)).send(body),
  patch: (path: string, body?: object) => http().patch(path).set('Cookie', cookie(who, at)).send(body),
});

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
  currentTime = NOW;
  await db.$executeRawUnsafe('TRUNCATE "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
  const passwordHash = await hash(PASSWORD);
  const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER' | 'STAFF', staffVenueId?: string) =>
    db.user.create({ data: { name, phone, role, passwordHash, staffVenueId } }).then((u) => {
      ids[name] = u.id;
      return u;
    });

  await Promise.all([
    user('admin', '0900000000', 'ADMIN'),
    user('Bình', '0912345678', 'OWNER'),
    user('Dũng', '0912345679', 'OWNER'),
    user('An', '0901234567', 'USER'),
  ]);

  const venueBình = await db.venue.create({
    data: {
      ownerId: ids.Bình,
      name: 'Sân Bình Thạnh',
      address: '123 Nơ Trang Long',
      phone: '0912345678',
      opensAt: 360,
      closesAt: 1380,
    },
  });
  ids.venueBình = venueBình.id;

  const venueDũng = await db.venue.create({
    data: {
      ownerId: ids.Dũng,
      name: 'Sân Quận 7',
      address: '456 Nguyễn Thị Thập',
      phone: '0912345679',
      opensAt: 360,
      closesAt: 1380,
    },
  });
  ids.venueDũng = venueDũng.id;
});

describe('Staff module (F-031)', () => {
  it('AC-2: creates STAFF user with staffVenueId, consentAt, hashed password, returns 201 StaffView, and returns 409 when phone taken', async () => {
    const res = await as('Bình')
      .post(`/api/owner/venues/${ids.venueBình}/staff`, {
        name: 'Nhân viên A',
        phone: '0988888881',
        password: 'secure-password-1',
        consent: true,
      })
      .expect(201);

    expect(StaffView.parse(res.body)).toEqual(res.body);
    expect(res.body.name).toBe('Nhân viên A');
    expect(res.body.phone).toBe('0988888881');
    expect(res.body.venueId).toBe(ids.venueBình);
    expect(res.body.lockedAt).toBeNull();

    const dbUser = await db.user.findUniqueOrThrow({ where: { phone: '0988888881' } });
    expect(dbUser.role).toBe('STAFF');
    expect(dbUser.staffVenueId).toBe(ids.venueBình);
    expect(dbUser.consentAt).toEqual(NOW);
    expect(dbUser.passwordHash).not.toBe('secure-password-1');

    const conflict = await as('Bình')
      .post(`/api/owner/venues/${ids.venueBình}/staff`, {
        name: 'Nhân viên Trùng',
        phone: '0988888881',
        password: 'secure-password-2',
        consent: true,
      })
      .expect(409);

    expect(conflict.body.message).toBe(STAFF_PHONE_TAKEN);
  });

  it('AC-3: owner who does not own the venue gets 404; USER, ADMIN, and STAFF get 403', async () => {
    const createRes = await as('Bình')
      .post(`/api/owner/venues/${ids.venueBình}/staff`, {
        name: 'Nhân viên B',
        phone: '0988888882',
        password: 'secure-password-1',
        consent: true,
      })
      .expect(201);
    const staffId = createRes.body.id;
    ids.staffB = staffId;

    // Dũng does not own venueBình -> 404
    await as('Dũng')
      .post(`/api/owner/venues/${ids.venueBình}/staff`, {
        name: 'Nhân viên Hack',
        phone: '0988888883',
        password: 'secure-password-1',
        consent: true,
      })
      .expect(404);
    await as('Dũng').get(`/api/owner/venues/${ids.venueBình}/staff`).expect(404);
    await as('Dũng').post(`/api/owner/staff/${staffId}/lock`).expect(404);

    // USER An -> 403
    await as('An')
      .post(`/api/owner/venues/${ids.venueBình}/staff`, {
        name: 'Nhân viên Hack',
        phone: '0988888883',
        password: 'secure-password-1',
        consent: true,
      })
      .expect(403);
    await as('An').get(`/api/owner/venues/${ids.venueBình}/staff`).expect(403);
    await as('An').post(`/api/owner/staff/${staffId}/lock`).expect(403);

    // ADMIN -> 403
    await as('admin')
      .post(`/api/owner/venues/${ids.venueBình}/staff`, {
        name: 'Nhân viên Hack',
        phone: '0988888883',
        password: 'secure-password-1',
        consent: true,
      })
      .expect(403);
    await as('admin').get(`/api/owner/venues/${ids.venueBình}/staff`).expect(403);
    await as('admin').post(`/api/owner/staff/${staffId}/lock`).expect(403);

    // STAFF staffB -> 403
    await as('staffB')
      .post(`/api/owner/venues/${ids.venueBình}/staff`, {
        name: 'Nhân viên Hack',
        phone: '0988888883',
        password: 'secure-password-1',
        consent: true,
      })
      .expect(403);
    await as('staffB').get(`/api/owner/venues/${ids.venueBình}/staff`).expect(403);
    await as('staffB').post(`/api/owner/staff/${staffId}/lock`).expect(403);
  });

  it('AC-4: lists staff sorted by name; lock sets lockedAt and sessionsValidFrom, locked staff cannot log in', async () => {
    await as('Bình')
      .post(`/api/owner/venues/${ids.venueBình}/staff`, {
        name: 'Vũ',
        phone: '0988888884',
        password: 'secure-password-vu',
        consent: true,
      })
      .expect(201);

    const createAn = await as('Bình')
      .post(`/api/owner/venues/${ids.venueBình}/staff`, {
        name: 'An Staff',
        phone: '0988888885',
        password: 'secure-password-an',
        consent: true,
      })
      .expect(201);
    const anId = createAn.body.id;
    ids.anStaff = anId;

    const listRes = await as('Bình').get(`/api/owner/venues/${ids.venueBình}/staff`).expect(200);
    expect(listRes.body.length).toBe(2);
    expect(listRes.body[0].name).toBe('An Staff');
    expect(listRes.body[1].name).toBe('Vũ');

    // Active session before lock works
    const meBefore = await as('anStaff', NOW).get('/api/auth/me').expect(200);
    expect(meBefore.body.role).toBe('STAFF');

    // Advance clock, lock staff
    currentTime = LATER;
    const lockRes = await as('Bình').post(`/api/owner/staff/${anId}/lock`).expect(200);
    expect(lockRes.body.lockedAt).toBe(LATER.toISOString());

    // Old session revoked -> 401
    await as('anStaff', NOW).get('/api/auth/me').expect(401);

    // Login fails with locked message
    const loginRes = await http().post('/api/auth/login').send({ phone: '0988888885', password: 'secure-password-an' }).expect(403);
    expect(loginRes.body.message).toBe('Tài khoản đã bị khóa. Liên hệ admin của MONSPORT');
  });

  it('AC-5: staff logs in with POST /api/auth/login and session has role STAFF', async () => {
    await as('Bình')
      .post(`/api/owner/venues/${ids.venueBình}/staff`, {
        name: 'Hoàng',
        phone: '0988888886',
        password: 'secure-password-hoang',
        consent: true,
      })
      .expect(201);

    const loginRes = await http().post('/api/auth/login').send({ phone: '0988888886', password: 'secure-password-hoang' }).expect(200);
    expect(loginRes.body.role).toBe('STAFF');
    expect(loginRes.body.name).toBe('Hoàng');

    const cookieHeader = loginRes.headers['set-cookie'];
    expect(cookieHeader).toBeDefined();

    const meRes = await http().get('/api/auth/me').set('Cookie', cookieHeader).expect(200);
    expect(meRes.body.role).toBe('STAFF');
    expect(meRes.body.name).toBe('Hoàng');
    expect(meRes.body).not.toHaveProperty('staffVenueId'); // SessionUser contract unchanged
  });

  it('AC-13: changing venue owner locks all staff of that venue; locking owner locks all staff of owner venues', async () => {
    const staffBìnhRes = await as('Bình')
      .post(`/api/owner/venues/${ids.venueBình}/staff`, {
        name: 'Nhân viên Bình Thạnh',
        phone: '0988888887',
        password: 'secure-password-7',
        consent: true,
      })
      .expect(201);
    const staffBìnhId = staffBìnhRes.body.id;

    const staffDũngRes = await as('Dũng')
      .post(`/api/owner/venues/${ids.venueDũng}/staff`, {
        name: 'Nhân viên Quận 7',
        phone: '0988888888',
        password: 'secure-password-8',
        consent: true,
      })
      .expect(201);
    const staffDũngId = staffDũngRes.body.id;

    currentTime = LATER;

    // 1. Admin changes venueBình ownerId to Dũng
    await as('admin').patch(`/api/admin/venues/${ids.venueBình}`, { ownerId: ids.Dũng }).expect(200);

    const staffBìnhAfter = await db.user.findUniqueOrThrow({ where: { id: staffBìnhId } });
    expect(staffBìnhAfter.lockedAt).toEqual(LATER);
    expect(staffBìnhAfter.sessionsValidFrom).toEqual(LATER);

    // Staff of venueDũng still not locked
    const staffDũngBefore = await db.user.findUniqueOrThrow({ where: { id: staffDũngId } });
    expect(staffDũngBefore.lockedAt).toBeNull();

    // 2. Admin locks owner Dũng
    const EVEN_LATER = new Date('2026-11-12T12:00:00+07:00');
    currentTime = EVEN_LATER;
    await as('admin').post(`/api/admin/users/${ids.Dũng}/lock`).expect(200);

    const staffDũngAfter = await db.user.findUniqueOrThrow({ where: { id: staffDũngId } });
    expect(staffDũngAfter.lockedAt).toEqual(EVEN_LATER);
    expect(staffDũngAfter.sessionsValidFrom).toEqual(EVEN_LATER);
  });

  async function waitForLock(timeoutMs = 2000, intervalMs = 50): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const rows = await db.$queryRaw<{ count: number }[]>`
        SELECT count(*)::int AS count FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database() AND query ILIKE '%FOR SHARE%'
      `;
      if (Number(rows[0]?.count ?? 0) > 0) return;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error(`Timed out waiting for backend lock in pg_stat_activity after ${timeoutMs}ms`);
  }

  it('AC-13: create staff waits while admin holds venue row, moves owner, and commits; create answers 404 and no STAFF row exists', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const holding = new Promise<void>((resolve) => (locked = resolve));

    const adminTx = db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "Venue" WHERE "id" = ${ids.venueBình}::uuid FOR UPDATE`;
      locked();
      await gate;
      await tx.venue.update({
        where: { id: ids.venueBình },
        data: { ownerId: ids.Dũng },
      });
    });

    await holding;

    let createReq: Promise<any> | undefined;
    try {
      let createFinished = false;
      createReq = as('Bình')
        .post(`/api/owner/venues/${ids.venueBình}/staff`, {
          name: 'Nhân viên Chuyển Chủ',
          phone: '0988888899',
          password: 'secure-password-99',
          consent: true,
        })
        .then((res) => {
          createFinished = true;
          return res;
        });

      await waitForLock();
      expect(createFinished).toBe(false);

      release();
      await adminTx;

      const res = await createReq;
      expect(res.status).toBe(404);

      const staffCount = await db.user.count({ where: { phone: '0988888899' } });
      expect(staffCount).toBe(0);
    } finally {
      release();
      await adminTx.catch(() => {});
      await createReq?.catch(() => {});
    }
  });

  it('AC-13: create staff waits while admin holds owner row, locks owner, and commits; create answers 404 and no STAFF row exists', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const holding = new Promise<void>((resolve) => (locked = resolve));

    const lockTx = db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "User" WHERE "id" = ${ids.Bình}::uuid FOR UPDATE`;
      locked();
      await gate;
      await tx.user.update({
        where: { id: ids.Bình },
        data: { lockedAt: LATER },
      });
    });

    await holding;

    let createReq: Promise<any> | undefined;
    try {
      let createFinished = false;
      createReq = as('Bình')
        .post(`/api/owner/venues/${ids.venueBình}/staff`, {
          name: 'Nhân viên Khóa Chủ',
          phone: '0988888890',
          password: 'secure-password-90',
          consent: true,
        })
        .then((res) => {
          createFinished = true;
          return res;
        });

      await waitForLock();
      expect(createFinished).toBe(false);

      release();
      await lockTx;

      const res = await createReq;
      expect(res.status).toBe(404);

      const staffCount = await db.user.count({ where: { phone: '0988888890' } });
      expect(staffCount).toBe(0);
    } finally {
      release();
      await lockTx.catch(() => {});
      await createReq?.catch(() => {});
    }
  });
});
