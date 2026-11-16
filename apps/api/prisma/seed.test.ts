import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { TEST_DATABASE_URL } from '../test/database-url.js';
import { buildDemoData, seedDatabase } from './seed.ts';

// The seed runs against the test database, never the dev one. The booking tests also empty it.
async function query<T extends pg.QueryResultRow>(sql: string): Promise<T[]> {
  const db = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await db.connect();
  try {
    return (await db.query<T>(sql)).rows;
  } finally {
    await db.end();
  }
}

describe('demo seed', () => {
  it('AC-1: after the seed, at least 8 future OPEN matches exist for both sports', async () => {
    await seedDatabase(TEST_DATABASE_URL, 'test-password');
    const rows = await query<{ sport: string; n: string }>(
      `SELECT m.sport, count(*) AS n FROM "Match" m JOIN "Booking" b ON b.id = m."bookingId"
       WHERE m.status = 'OPEN' AND b.status = 'CONFIRMED' AND b."startAt" > now() GROUP BY m.sport`,
    );
    const by = Object.fromEntries(rows.map((r) => [r.sport, Number(r.n)]));
    expect(by.BADMINTON).toBeGreaterThanOrEqual(1);
    expect(by.FOOTBALL).toBeGreaterThanOrEqual(1);
    expect((by.BADMINTON ?? 0) + (by.FOOTBALL ?? 0)).toBeGreaterThanOrEqual(8);
  });

  it('AC-1: joinedCount equals the ACTIVE players, stays under capacity, and the host is ACTIVE', async () => {
    await seedDatabase(TEST_DATABASE_URL, 'test-password');
    const bad = await query(
      `SELECT m.id FROM "Match" m WHERE m."joinedCount" <> (SELECT count(*) FROM "MatchPlayer" p WHERE p."matchId" = m.id AND p.status = 'ACTIVE')
         OR m."joinedCount" >= m.capacity
         OR NOT EXISTS (SELECT 1 FROM "MatchPlayer" p WHERE p."matchId" = m.id AND p."userId" = m."hostId" AND p.status = 'ACTIVE')`,
    );
    expect(bad).toEqual([]);
  });

  it('AC-1: demo has 6+ extra players, PENDING bookings, 2+ APPROVAL matches, and a PENDING request', async () => {
    await seedDatabase(TEST_DATABASE_URL, 'test-password');
    const [counts] = await query<{ users: string; pending: string; approval: string; request: string; levels: string }>(
      `SELECT (SELECT count(*) FROM "User" WHERE role = 'USER') AS users,
              (SELECT count(*) FROM "Booking" WHERE status = 'PENDING') AS pending,
              (SELECT count(*) FROM "Match" WHERE "joinMode" = 'APPROVAL') AS approval,
              (SELECT count(*) FROM "MatchPlayer" WHERE status = 'PENDING') AS request,
              (SELECT count(DISTINCT "skillLevel") FROM "User" WHERE role = 'USER') AS levels`,
    );
    expect(Number(counts!.users)).toBeGreaterThanOrEqual(8);
    expect(Number(counts!.levels)).toBe(3);
    expect(Number(counts!.pending)).toBeGreaterThanOrEqual(3);
    expect(Number(counts!.approval)).toBeGreaterThanOrEqual(2);
    expect(Number(counts!.request)).toBeGreaterThanOrEqual(1);
  });

  it('AC-1: the builder keeps every booking within 7 Vietnam days after now, on the future side, with no overlap per court', () => {
    for (const hourNow of [0, 5, 12, 23]) {
      const now = new Date(Date.UTC(2026, 10, 16, hourNow - 7 + 24, 30)); // 16/11/2026 at hourNow:30 in Vietnam
      const data = buildDemoData(now);
      const sevenDays = now.getTime() + 8 * 24 * 3600_000;
      for (const b of data.bookings) {
        expect(b.startAt.getTime()).toBeGreaterThan(now.getTime());
        expect(b.startAt.getTime()).toBeLessThan(sevenDays);
        // Opening hours 06:00 to 23:00 in Vietnam.
        const startMin = Math.floor((b.startAt.getTime() + 7 * 3600_000) / 60_000) % 1440;
        const endMin = Math.floor((b.endAt.getTime() + 7 * 3600_000) / 60_000) % 1440;
        expect(startMin).toBeGreaterThanOrEqual(360);
        expect(endMin).toBeLessThanOrEqual(1380);
        if (b.confirmDeadline) expect(b.confirmDeadline.getTime()).toBeGreaterThan(now.getTime());
      }
      const sorted = [...data.bookings].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
      for (const [i, b] of sorted.entries())
        for (const c of sorted.slice(i + 1))
          if (c.courtId === b.courtId) expect(c.startAt.getTime()).toBeGreaterThanOrEqual(b.endAt.getTime());
    }
  });

  it('AC-2: the seed runs twice in a row without an error and gives the same counts', async () => {
    await seedDatabase(TEST_DATABASE_URL, 'test-password');
    const first = await query<{ n: string }>('SELECT count(*) AS n FROM "Match"');
    await expect(seedDatabase(TEST_DATABASE_URL, 'test-password')).resolves.toBeDefined();
    const second = await query<{ n: string }>('SELECT count(*) AS n FROM "Match"');
    expect(second).toEqual(first);
  });

  it('AC-2: the seed refuses a database that is not on localhost', async () => {
    await expect(seedDatabase('postgresql://u:p@db.example.com:5432/x', 'x')).rejects.toThrow('localhost');
  });
});
