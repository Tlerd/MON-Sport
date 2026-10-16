import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Checks the hand-written constraints of the F-002 and F-003 migrations on the real Postgres database.
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
