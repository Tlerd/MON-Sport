import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Checks the hand-written constraints of the F-002 and F-003 migrations, and the F-006 columns, on the real Postgres database.
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const courtId = randomUUID();
const userId = randomUUID();
const venueId = randomUUID();

const insert = (start: string, end: string, status = 'PENDING') =>
  db.query(
    `INSERT INTO "Booking" (id, "courtId", "startAt", "endAt", status, source, "createdById", "priceTotal")
     VALUES ($1, $2, $3, $4, $5, 'APP', $6, 0)`,
    [randomUUID(), courtId, `2026-11-20T${start}:00+07:00`, `2026-11-20T${end}:00+07:00`, status, userId],
  );
const sqlState = (p: Promise<unknown>) => p.then(() => 'ok', (e: { code?: string }) => e.code);

beforeAll(async () => {
  await db.connect();
  await db.query(`INSERT INTO "User" (id, name, phone, "passwordHash") VALUES ($1, 'Test', $2, 'x')`, [userId, `09${Date.now() % 1e8}`.padEnd(10, '0')]);
  await db.query(`INSERT INTO "Venue" (id, "ownerId", name, address, phone, "opensAt", "closesAt") VALUES ($1, $2, 'T', 'T', '0900000000', 360, 1380)`, [venueId, userId]);
  await db.query(`INSERT INTO "Court" (id, "venueId", name, sport, "priceNormal", "pricePeak") VALUES ($1, $2, 'Sân 1', 'BADMINTON', 1, 1)`, [courtId, venueId]);
});

afterAll(async () => {
  await db.query('DELETE FROM "Notification" WHERE "userId" = $1', [userId]);
  await db.query('DELETE FROM "MatchPlayer" WHERE "userId" = $1', [userId]);
  await db.query('DELETE FROM "Match" WHERE "hostId" = $1', [userId]);
  await db.query('DELETE FROM "Booking" WHERE "courtId" = $1', [courtId]);
  // By venue and by owner, so a row that a missing CHECK let in does not hide the real failure.
  await db.query('DELETE FROM "Court" WHERE "venueId" = $1', [venueId]);
  await db.query('DELETE FROM "Venue" WHERE "ownerId" = $1', [userId]);
  await db.query('DELETE FROM "User" WHERE id = $1', [userId]);
  await db.end();
});

describe('migration f002_booking', () => {
  it('refuses an overlapping live booking with SQLSTATE 23P01', async () => {
    expect(await sqlState(insert('19:00', '20:00'))).toBe('ok');
    expect(await sqlState(insert('19:30', '20:30', 'CONFIRMED'))).toBe('23P01');
  });

  it('accepts an adjacent booking', async () => {
    expect(await sqlState(insert('20:00', '21:00'))).toBe('ok');
  });

  it('ignores rejected and expired bookings', async () => {
    expect(await sqlState(insert('08:00', '09:00', 'REJECTED'))).toBe('ok');
    expect(await sqlState(insert('08:00', '09:00', 'EXPIRED'))).toBe('ok');
    expect(await sqlState(insert('08:00', '09:00'))).toBe('ok');
  });

  it('refuses an end before the start with SQLSTATE 23514', async () => {
    expect(await sqlState(insert('22:00', '21:00'))).toBe('23514');
  });
});

describe('migration f003_consent', () => {
  it('AC-23: refuses a venue that closes when it opens, and a court price of 0, with SQLSTATE 23514', async () => {
    const venue = (opensAt: number, closesAt: number) =>
      db.query(`INSERT INTO "Venue" (id, "ownerId", name, address, phone, "opensAt", "closesAt") VALUES ($1, $2, 'T2', 'T', '0900000000', $3, $4)`, [
        randomUUID(), userId, opensAt, closesAt,
      ]);
    expect(await sqlState(venue(360, 360))).toBe('23514');
    expect(await sqlState(venue(375, 1380))).toBe('23514');
    expect(await sqlState(venue(0, 1470))).toBe('23514');
    expect(await sqlState(venue(-30, 1380))).toBe('23514');
    expect(await sqlState(venue(360, 1385))).toBe('23514');
    const court = (priceNormal: number, pricePeak: number) =>
      db.query(`INSERT INTO "Court" (id, "venueId", name, sport, "priceNormal", "pricePeak") VALUES ($1, $2, 'Sân 9', 'BADMINTON', $3, $4)`, [
        randomUUID(), venueId, priceNormal, pricePeak,
      ]);
    expect(await sqlState(court(0, 1))).toBe('23514');
    expect(await sqlState(court(1, 0))).toBe('23514');
    expect(await sqlState(court(1, 10_000_001))).toBe('23514');
    expect(await sqlState(court(10_000_001, 1))).toBe('23514');
  });

  it('adds User.consentAt as a nullable timestamptz(3), so existing accounts stay valid', async () => {
    const { rows } = await db.query(
      `SELECT data_type, datetime_precision, is_nullable FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'consentAt'`,
    );
    expect(rows).toEqual([{ data_type: 'timestamp with time zone', datetime_precision: 3, is_nullable: 'YES' }]);
  });
});

describe('migration f006_throttle_sessions', () => {
  it('AC-15: a new User row without sessionsValidFrom gets null, so existing sessions stay valid', async () => {
    const { rows } = await db.query('SELECT "sessionsValidFrom" FROM "User" WHERE id = $1', [userId]);
    expect(rows).toEqual([{ sessionsValidFrom: null }]);
  });

  it('keeps one counter row per key', async () => {
    const key = `test:${randomUUID()}`;
    const row = () => db.query(`INSERT INTO "AuthThrottle" (key, count, "windowStart") VALUES ($1, 1, now())`, [key]);
    expect(await sqlState(row())).toBe('ok');
    expect(await sqlState(row())).toBe('23505');
    await db.query('DELETE FROM "AuthThrottle" WHERE key = $1', [key]);
  });
});

describe('migration f011_matches', () => {
  it('AC-14: refuses invalid capacity, pricePerSlot, or joinedCount with 23514, and a second match on one booking with 23505', async () => {
    const bookingId = randomUUID();
    await db.query(
      `INSERT INTO "Booking" (id, "courtId", "startAt", "endAt", status, source, "createdById", "priceTotal")
       VALUES ($1, $2, '2026-11-20T14:00:00+07:00', '2026-11-20T15:00:00+07:00', 'PENDING', 'APP', $3, 80000)`,
      [bookingId, courtId, userId],
    );
    const match = (capacity: number, pricePerSlot: number, joinedCount: number) =>
      db.query(
        `INSERT INTO "Match" (id, "bookingId", "hostId", sport, capacity, "pricePerSlot", status, "joinedCount")
         VALUES ($1, $2, $3, 'BADMINTON', $4, $5, 'OPEN', $6)`,
        [randomUUID(), bookingId, userId, capacity, pricePerSlot, joinedCount],
      );
    expect(await sqlState(match(1, 50_000, 1))).toBe('23514');
    expect(await sqlState(match(31, 50_000, 1))).toBe('23514');
    expect(await sqlState(match(4, -1, 1))).toBe('23514');
    expect(await sqlState(match(4, 10_000_001, 1))).toBe('23514');
    expect(await sqlState(match(4, 50_000, 5))).toBe('23514');
    expect(await sqlState(match(4, 50_000, -1))).toBe('23514');
    expect(await sqlState(match(4, 0, 1))).toBe('ok');
    expect(await sqlState(match(4, 50_000, 1))).toBe('23505');
  });
});

describe('migration f012_lobby_notify', () => {
  it('AC-14: notifies the lobby channel with the match id when a Match row is inserted and when joinedCount changes', async () => {
    const listener = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await listener.connect();
    try {
      const payloads: string[] = [];
      const bookingId = randomUUID();
      const matchId = randomUUID();
      listener.on('notification', (msg) => {
        if (msg.channel === 'lobby' && msg.payload === matchId) {
          payloads.push(msg.payload);
        }
      });
      await listener.query('LISTEN lobby');

      await db.query(
        `INSERT INTO "Booking" (id, "courtId", "startAt", "endAt", status, source, "createdById", "priceTotal")
         VALUES ($1, $2, '2026-11-20T16:00:00+07:00', '2026-11-20T17:00:00+07:00', 'PENDING', 'APP', $3, 80000)`,
        [bookingId, courtId, userId],
      );
      await db.query(
        `INSERT INTO "Match" (id, "bookingId", "hostId", sport, capacity, "pricePerSlot", status, "joinedCount")
         VALUES ($1, $2, $3, 'BADMINTON', 4, 50000, 'OPEN', 1)`,
        [matchId, bookingId, userId],
      );
      await db.query(`UPDATE "Match" SET "joinedCount" = 2 WHERE id = $1`, [matchId]);

      const deadline = Date.now() + 2000;
      while (payloads.length < 2 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(payloads).toEqual([matchId, matchId]);
    } finally {
      await listener.end();
    }
  });
});

describe('migration f013_notifications', () => {
  it('enforces foreign keys on userId, bookingId, matchId and accepts valid rows', async () => {
    const bookingId = randomUUID();
    const matchId = randomUUID();
    await db.query(
      `INSERT INTO "Booking" (id, "courtId", "startAt", "endAt", status, source, "createdById", "priceTotal")
       VALUES ($1, $2, '2026-11-20T17:00:00+07:00', '2026-11-20T18:00:00+07:00', 'PENDING', 'APP', $3, 80000)`,
      [bookingId, courtId, userId],
    );
    await db.query(
      `INSERT INTO "Match" (id, "bookingId", "hostId", sport, capacity, "pricePerSlot", status, "joinedCount")
       VALUES ($1, $2, $3, 'BADMINTON', 4, 50000, 'OPEN', 1)`,
      [matchId, bookingId, userId],
    );

    const notif = (uId: string, bId: string, mId: string | null = null, type = 'BOOKING_REQUESTED') =>
      db.query(
        `INSERT INTO "Notification" (id, "userId", type, "bookingId", "matchId")
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), uId, type, bId, mId],
      );

    expect(await sqlState(notif(randomUUID(), bookingId))).toBe('23503');
    expect(await sqlState(notif(userId, randomUUID()))).toBe('23503');
    expect(await sqlState(notif(userId, bookingId, randomUUID()))).toBe('23503');

    expect(await sqlState(notif(userId, bookingId, null, 'BOOKING_REQUESTED'))).toBe('ok');
    expect(await sqlState(notif(userId, bookingId, matchId, 'MATCH_CANCELLED'))).toBe('ok');

    await db.query('DELETE FROM "Notification" WHERE "userId" = $1', [userId]);
  });
});

describe('migration f015_financial_index', () => {
  it('creates the composite index Booking_courtId_startAt_idx on Booking(courtId, startAt)', async () => {
    const res = await db.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'Booking' AND indexname = 'Booking_courtId_startAt_idx'`,
    );
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].indexname).toBe('Booking_courtId_startAt_idx');
  });
});
