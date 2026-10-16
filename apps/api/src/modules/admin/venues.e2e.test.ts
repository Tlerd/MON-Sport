import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import type { VenueView } from '@monsport/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { isHoursViolation } from './db-errors.js';

// Data of brief F-003: Bình runs "Cầu lông A" (06:00-23:00, "Sân 1" and "Sân 2" at 80.000đ and 120.000đ), Dũng runs "Cầu lông B".
const NOW = new Date('2026-10-17T10:00:00+07:00');
const clock = { now: () => NOW };

let app: INestApplication;
let db: PrismaService;
const ids: Record<string, string> = {};
const http = () => request(app.getHttpServer());
const as = (who: string | null) => {
  const auth = (r: request.Test) => (who ? r.set('Cookie', `session=${issueSession(ids[who], NOW)}`) : r);
  return {
    get: (path: string) => auth(http().get(path)),
    post: (path: string, body?: object) => auth(http().post(path)).send(body),
    patch: (path: string, body?: object) => auth(http().patch(path)).send(body),
  };
};
const venueOf = (body: VenueView[], name: string) => body.find((v) => v.name === name);
const cauLongC = () => ({ ownerId: ids.Giang, name: 'Cầu lông C', address: '12 Lê Lợi', phone: '0912345681', opensAt: 360, closesAt: 1380 });
const court = (name: string) => ({ name, sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 });

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
  await db.$executeRawUnsafe('TRUNCATE "Booking", "Court", "Venue", "User" CASCADE');
  const passwordHash = await hash('test-password');
  const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER') =>
    db.user.create({ data: { name, phone, role, passwordHash } }).then((u) => (ids[name] = u.id));
  await Promise.all([
    user('admin', '0900000000', 'ADMIN'),
    user('Bình', '0912345678', 'OWNER'),
    user('Dũng', '0912345679', 'OWNER'),
    user('Giang', '0912345681', 'OWNER'),
    user('An', '0901234567', 'USER'),
  ]);
  const a = await db.venue.create({ data: { ownerId: ids['Bình'], name: 'Cầu lông A', address: 'A', phone: '0912345678', opensAt: 360, closesAt: 1380 } });
  ids.venueA = a.id;
  await db.venue.create({ data: { ownerId: ids['Dũng'], name: 'Cầu lông B', address: 'B', phone: '0912345679', opensAt: 360, closesAt: 1380 } });
  for (const name of ['Sân 1', 'Sân 2'])
    ids[name] = (await db.court.create({ data: { venueId: a.id, ...court(name), sport: 'BADMINTON' } })).id;
});

describe('admin venues and courts', () => {
  it('AC-15: the admin creates a venue with 2 courts, and the public list shows it', async () => {
    const venue = await as('admin').post('/api/admin/venues', cauLongC()).expect(201);
    expect(venue.body).toMatchObject({ name: 'Cầu lông C', opensAt: 360, closesAt: 1380, courts: [], owner: { id: ids.Giang, name: 'Giang', phone: '0912345681' } });
    for (const name of ['Sân 1', 'Sân 2']) {
      const res = await as('admin').post(`/api/admin/venues/${venue.body.id}/courts`, court(name)).expect(201);
      expect(res.body).toEqual({ id: expect.any(String), ...court(name) });
    }
    const list = await http().get('/api/venues').expect(200);
    expect(venueOf(list.body, 'Cầu lông C')?.courts.map((c) => c.name)).toEqual(['Sân 1', 'Sân 2']);
  });

  it('AC-16: an owner sees only their own venues', async () => {
    const c = await db.venue.create({ data: cauLongC() });
    for (const name of ['Sân 1', 'Sân 2']) await db.court.create({ data: { venueId: c.id, ...court(name), sport: 'BADMINTON' } });
    const res = await as('Giang').get('/api/owner/venues').expect(200);
    expect(res.body.map((v: { name: string }) => v.name)).toEqual(['Cầu lông C']);
    expect(res.body[0].courts).toHaveLength(2);
    expect(res.body[0]).not.toHaveProperty('ownerId');
  });

  it('AC-17: a venue owner that is not an OWNER account gets 400', async () => {
    for (const ownerId of [ids.An, '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b']) {
      const res = await as('admin').post('/api/admin/venues', { ...cauLongC(), ownerId }).expect(400);
      expect(res.body.message).toBe('Chủ sân không hợp lệ');
    }
    expect(await db.venue.count()).toBe(2);
  });

  it('AC-18: a venue that closes before it opens gets 400', async () => {
    const res = await as('admin').post('/api/admin/venues', { ...cauLongC(), opensAt: 1380, closesAt: 360 }).expect(400);
    expect(res.body.message).toBe('Giờ đóng cửa phải sau giờ mở cửa');
  });

  it('AC-19: a partial update is checked against the stored venue', async () => {
    const hours = await as('admin').patch(`/api/admin/venues/${ids.venueA}`, { closesAt: 300 }).expect(400);
    expect(hours.body.message).toBe('Giờ đóng cửa phải sau giờ mở cửa');
    const owner = await as('admin').patch(`/api/admin/venues/${ids.venueA}`, { ownerId: ids.An }).expect(400);
    expect(owner.body.message).toBe('Chủ sân không hợp lệ');
    expect(await db.venue.findUniqueOrThrow({ where: { id: ids.venueA } })).toMatchObject({ ownerId: ids['Bình'], closesAt: 1380 });
  });

  it('AC-20: a court name that the venue has gets 409, on create and on rename', async () => {
    const created = await as('admin').post(`/api/admin/venues/${ids.venueA}/courts`, court('Sân 1')).expect(409);
    expect(created.body.message).toBe('Tên sân đã có trong đơn vị này');
    const renamed = await as('admin').patch(`/api/admin/courts/${ids['Sân 2']}`, { name: 'Sân 1' }).expect(409);
    expect(renamed.body.message).toBe('Tên sân đã có trong đơn vị này');
  });

  it('AC-21: the admin changes a court price and the closing time', async () => {
    const c = await as('admin').patch(`/api/admin/courts/${ids['Sân 1']}`, { pricePeak: 150_000 }).expect(200);
    expect(c.body).toMatchObject({ name: 'Sân 1', priceNormal: 80_000, pricePeak: 150_000 });
    const v = await as('admin').patch(`/api/admin/venues/${ids.venueA}`, { closesAt: 1320 }).expect(200);
    expect(v.body.closesAt).toBe(1320);
    const a = venueOf((await http().get('/api/venues').expect(200)).body, 'Cầu lông A');
    expect(a).toMatchObject({ closesAt: 1320 });
    expect(a?.courts.find((x) => x.name === 'Sân 1')?.pricePeak).toBe(150_000);
  });

  it('AC-22: only the admin reaches the venue routes, and only an owner reaches the owner venues', async () => {
    const routes: [('get' | 'post' | 'patch'), string, object?][] = [
      ['get', '/api/admin/venues'],
      ['post', '/api/admin/venues', cauLongC()],
      ['patch', `/api/admin/venues/${ids.venueA}`, { closesAt: 1320 }],
      ['post', `/api/admin/venues/${ids.venueA}/courts`, court('Sân 3')],
      ['patch', `/api/admin/courts/${ids['Sân 1']}`, { pricePeak: 150_000 }],
    ];
    for (const [method, path, body] of routes) {
      await as('Bình')[method](path, body).expect(403);
      await as('An')[method](path, body).expect(403);
      await as(null)[method](path, body).expect(401);
    }
    await as('An').get('/api/owner/venues').expect(403);
    await as('admin').get('/api/owner/venues').expect(403);
    await as(null).get('/api/owner/venues').expect(401);
    expect(await db.venue.count()).toBe(2);
    expect(await db.court.count()).toBe(2);
  });

  it('AC-30: opening hours off the 30-minute grid and a price of 0 get 400', async () => {
    const grid = await as('admin').post('/api/admin/venues', { ...cauLongC(), opensAt: 375 }).expect(400);
    expect(grid.body.message).toBe('Giờ phải theo bước 30 phút');
    const price = await as('admin').post(`/api/admin/venues/${ids.venueA}/courts`, { ...court('Sân 3'), priceNormal: 0 }).expect(400);
    expect(price.body.message).toBe('Giá phải lớn hơn 0');
  });

  it('keeps every one of parallel updates of different fields', async () => {
    await Promise.all([
      as('admin').patch(`/api/admin/venues/${ids.venueA}`, { opensAt: 420 }).expect(200),
      as('admin').patch(`/api/admin/venues/${ids.venueA}`, { address: '99 Trần Phú' }).expect(200),
      as('admin').patch(`/api/admin/venues/${ids.venueA}`, { closesAt: 1320 }).expect(200),
    ]);
    expect(await db.venue.findUniqueOrThrow({ where: { id: ids.venueA } })).toMatchObject({ opensAt: 420, address: '99 Trần Phú', closesAt: 1320 });
  });

  it('moves a venue to another owner at once, and refuses a locked owner', async () => {
    await as('admin').patch(`/api/admin/venues/${ids.venueA}`, { ownerId: ids.Giang }).expect(200);
    expect((await as('Giang').get('/api/owner/venues').expect(200)).body.map((v: VenueView) => v.name)).toEqual(['Cầu lông A']);
    expect((await as('Bình').get('/api/owner/venues').expect(200)).body).toEqual([]);
    await db.user.update({ where: { id: ids['Dũng'] }, data: { lockedAt: NOW } });
    const res = await as('admin').patch(`/api/admin/venues/${ids.venueA}`, { ownerId: ids['Dũng'] }).expect(400);
    expect(res.body.message).toBe('Chủ sân không hợp lệ');
  });

  it('recognises the hours CHECK error of the database, and only that one', async () => {
    const hours = await db.venue.update({ where: { id: ids.venueA }, data: { closesAt: 300 } }).catch((e: unknown) => e);
    expect(isHoursViolation(hours)).toBe(true);
    const price = await db.court.update({ where: { id: ids['Sân 1'] }, data: { priceNormal: 0 } }).catch((e: unknown) => e);
    expect(isHoursViolation(price)).toBe(false);
  });

  it('lists every venue with its owner for the admin', async () => {
    const res = await as('admin').get('/api/admin/venues').expect(200);
    expect(res.body.map((v: { name: string; owner: { name: string } }) => [v.name, v.owner.name])).toEqual([
      ['Cầu lông A', 'Bình'],
      ['Cầu lông B', 'Dũng'],
    ]);
  });

  it('answers 404 for an unknown venue or court', async () => {
    const unknown = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
    await as('admin').patch(`/api/admin/venues/${unknown}`, { closesAt: 1320 }).expect(404);
    await as('admin').post(`/api/admin/venues/${unknown}/courts`, court('Sân 1')).expect(404);
    await as('admin').patch(`/api/admin/courts/${unknown}`, { pricePeak: 1 }).expect(404);
  });

  it('keeps the sport of a court fixed', async () => {
    await as('admin').patch(`/api/admin/courts/${ids['Sân 1']}`, { sport: 'FOOTBALL' }).expect(400);
    expect((await db.court.findUniqueOrThrow({ where: { id: ids['Sân 1'] } })).sport).toBe('BADMINTON');
  });

  it('refuses a price above 10.000.000đ, and a malformed id, with Vietnamese texts', async () => {
    const res = await as('admin').patch(`/api/admin/courts/${ids['Sân 1']}`, { pricePeak: 10_000_001 }).expect(400);
    expect(res.body.message).toBe('Giá tối đa 10.000.000đ một giờ');
    expect((await as('admin').patch('/api/admin/venues/abc', { closesAt: 1320 }).expect(400)).body.message).toBe('Dữ liệu không hợp lệ');
  });
});
