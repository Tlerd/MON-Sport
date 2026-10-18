import 'reflect-metadata';
import http from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { issueSession } from '../auth/session.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

// Brief F-012 (AC-9, UC-8): two separate API instances A and B running against the same database.
// An opens, Chi joins, and An cancels on instance A. A guest SSE client connected to instance B receives
// 3 match events with {"id":"<matchId>"} within 2 seconds of each response from A.
const vn = (hhmm: string) => `2026-11-20T${hhmm}:00+07:00`;
const clock = { at: new Date(vn('10:00')), now() { return this.at; } };

let appA: INestApplication;
let appB: INestApplication;
let db: PrismaService;
const ids: Record<string, string> = {};

beforeAll(async () => {
  const modA = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue(clock).compile();
  appA = setupApp(modA.createNestApplication());
  await appA.init();

  const modB = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue(clock).compile();
  appB = setupApp(modB.createNestApplication());
  await appB.listen(0);

  db = appA.get(PrismaService);
  await db.$executeRawUnsafe('TRUNCATE "MatchPlayer", "Match", "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
  const passwordHash = await hash('test-password');
  const user = (name: string, phone: string, role: 'ADMIN' | 'OWNER' | 'USER') =>
    db.user.create({ data: { name, phone, role, passwordHash } }).then((u) => (ids[name] = u.id));
  await Promise.all([
    user('Bình', '0912345678', 'OWNER'),
    user('An', '0901234567', 'USER'),
    user('Chi', '0901234568', 'USER'),
  ]);
  const a = await db.venue.create({
    data: { ownerId: ids['Bình'], name: 'Cầu lông A', address: '10 Nguyễn Huệ', phone: '0911111111', opensAt: 360, closesAt: 1380 },
  });
  ids.A1 = (await db.court.create({ data: { venueId: a.id, name: 'Sân 1', sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 } })).id;
});

afterAll(async () => {
  await appA?.close();
  await appB?.close();
});

describe('lobby SSE stream across instances (F-012, AC-9)', () => {
  it('AC-9: client connected to instance B receives match events within 2 seconds when instance A mutates a match', async () => {
    const address = appB.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    expect(port).toBeGreaterThan(0);

    const asA = (who: string) => (r: request.Test) => r.set('Cookie', `session=${issueSession(ids[who], clock.now())}`);

    // Create booking for An on instance A.
    const startAt = new Date(vn('20:00'));
    const booking = await db.booking.create({
      data: {
        courtId: ids.A1,
        startAt,
        endAt: new Date(vn('21:00')),
        status: 'PENDING',
        source: 'APP',
        createdById: ids['An'],
        priceTotal: 80_000,
        confirmDeadline: new Date(startAt.getTime() - 3_600_000),
      },
    });

    const receivedEvents: Array<{ event: string; data: string; receivedAt: number }> = [];
    let sseReq: http.ClientRequest | null = null;
    let sseRes: http.IncomingMessage | null = null;

    const streamConnected = new Promise<void>((resolve, reject) => {
      sseReq = http.get(`http://127.0.0.1:${port}/api/matches/stream`, (res) => {
        sseRes = res;
        expect(res.headers['content-type']).toMatch(/text\/event-stream/);
        let buffer = '';
        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() ?? '';
          for (const block of blocks) {
            const lines = block.split('\n');
            let event = 'message';
            let data = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) event = line.slice(7).trim();
              if (line.startsWith('data: ')) data = line.slice(6).trim();
            }
            if (event === 'match') {
              receivedEvents.push({ event, data, receivedAt: Date.now() });
            }
          }
        });
        resolve();
      });
      sseReq.on('error', reject);
    });

    await streamConnected;

    // Action 1: An opens match on instance A.
    const t0 = Date.now();
    const openRes = await asA('An')(request(appA.getHttpServer()).post('/api/matches'))
      .send({ bookingId: booking.id, capacity: 4, pricePerSlot: 50_000 })
      .expect(201);
    const matchId = openRes.body.id as string;

    // Action 2: Chi joins match on instance A.
    const t1 = Date.now();
    await asA('Chi')(request(appA.getHttpServer()).post(`/api/matches/${matchId}/join`)).expect(200);

    // Action 3: An cancels match on instance A.
    const t2 = Date.now();
    await asA('An')(request(appA.getHttpServer()).post(`/api/matches/${matchId}/cancel`)).expect(200);

    // Wait up to 2 seconds after t2 for all 3 events to arrive at instance B.
    const deadline = t2 + 2000;
    while (receivedEvents.length < 3 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 20));
    }

    (sseRes as http.IncomingMessage | null)?.destroy();
    (sseReq as http.ClientRequest | null)?.destroy();

    expect(receivedEvents).toHaveLength(3);
    expect(receivedEvents.map((e) => JSON.parse(e.data))).toEqual([
      { id: matchId },
      { id: matchId },
      { id: matchId },
    ]);
    expect(receivedEvents[0].receivedAt - t0).toBeLessThanOrEqual(2000);
    expect(receivedEvents[1].receivedAt - t1).toBeLessThanOrEqual(2000);
    expect(receivedEvents[2].receivedAt - t2).toBeLessThanOrEqual(2000);
  });
});
