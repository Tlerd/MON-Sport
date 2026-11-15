// Sample data for local development: `pnpm --filter @monsport/api db:seed`.
// It empties the tables first, so it runs only against a database on localhost.
// Every seed account gets SEED_PASSWORD. Its default is a local test value.
// Brief F-034: it also adds demo players, bookings in the next 7 days, and matches, all computed from "now".

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { hash } from '@node-rs/argon2';
import pg from 'pg';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const VN_OFFSET = 7 * HOUR; // Asia/Ho_Chi_Minh has no daylight saving time (BR-27).

type SeedUser = { id: string; name: string; phone: string; role: string; skillLevel: string | null };
type SeedCourt = { id: string; name: string; priceNormal: number; pricePeak: number };
type SeedVenue = { id: string; name: string; ownerPhone: string; sport: string; courts: SeedCourt[] };
type SeedBooking = {
  id: string;
  courtId: string;
  startAt: Date;
  endAt: Date;
  status: 'PENDING' | 'CONFIRMED';
  createdById: string;
  priceTotal: number;
  createdAt: Date;
  confirmDeadline: Date | null;
  confirmedAt: Date | null;
};
type SeedMatch = {
  id: string;
  bookingId: string;
  hostId: string;
  sport: string;
  capacity: number;
  pricePerSlot: number;
  status: 'OPEN';
  joinedCount: number;
  joinMode: 'INSTANT' | 'APPROVAL';
  createdAt: Date;
};
type SeedMatchPlayer = { matchId: string; userId: string; status: 'ACTIVE' | 'PENDING'; joinedAt: Date };
export type DemoData = {
  users: SeedUser[];
  venues: SeedVenue[];
  bookings: SeedBooking[];
  matches: SeedMatch[];
  matchPlayers: SeedMatchPlayer[];
};

// The first 6 accounts, the 3 venues, and their courts are the base data. Do not change them.
const BASE_USERS = [
  { name: 'Admin', phone: '0900000000', role: 'ADMIN', skillLevel: null },
  { name: 'Bình', phone: '0912345678', role: 'OWNER', skillLevel: null },
  { name: 'Dũng', phone: '0912345679', role: 'OWNER', skillLevel: null },
  { name: 'Hà', phone: '0912345680', role: 'OWNER', skillLevel: null },
  { name: 'An', phone: '0901234567', role: 'USER', skillLevel: 'INTERMEDIATE' },
  { name: 'Chi', phone: '0901234568', role: 'USER', skillLevel: 'BEGINNER' },
];
// Demo players of brief F-034, with mixed skill levels.
const DEMO_USERS = [
  { name: 'Minh Quân', phone: '0901234569', role: 'USER', skillLevel: 'ADVANCED' },
  { name: 'Lan Anh', phone: '0901234570', role: 'USER', skillLevel: 'INTERMEDIATE' },
  { name: 'Tuấn Kiệt', phone: '0901234571', role: 'USER', skillLevel: 'BEGINNER' },
  { name: 'Thu Hương', phone: '0901234572', role: 'USER', skillLevel: 'INTERMEDIATE' },
  { name: 'Đăng Khoa', phone: '0901234573', role: 'USER', skillLevel: 'ADVANCED' },
  { name: 'Ngọc Mai', phone: '0901234574', role: 'USER', skillLevel: 'BEGINNER' },
  { name: 'Hoàng Phúc', phone: '0901234575', role: 'USER', skillLevel: 'INTERMEDIATE' },
  { name: 'Bảo Trân', phone: '0901234576', role: 'USER', skillLevel: 'ADVANCED' },
];

// The court count of each venue is still open (intake, open item 1). Each venue has 2 courts for now.
const BASE_VENUES = [
  { name: 'Cầu lông A', owner: '0912345678', sport: 'BADMINTON', normal: 80_000, peak: 120_000 },
  { name: 'Cầu lông B', owner: '0912345679', sport: 'BADMINTON', normal: 70_000, peak: 100_000 },
  { name: 'Bóng đá A', owner: '0912345680', sport: 'FOOTBALL', normal: 300_000, peak: 500_000 },
];

/** Midnight of the Asia/Ho_Chi_Minh day of an instant, as a UTC instant. */
function vnMidnight(at: Date): number {
  return Math.floor((at.getTime() + VN_OFFSET) / DAY) * DAY - VN_OFFSET;
}

/** BR-4, BR-5: the sum of 30-minute slots at half the hourly price of their band. Whole VND. */
function price(startAt: Date, endAt: Date, normal: number, peak: number): number {
  let sum = 0;
  for (let t = startAt.getTime(); t < endAt.getTime(); t += 30 * MINUTE) {
    const minute = Math.floor((t + VN_OFFSET) / MINUTE) % (24 * 60);
    sum += minute >= 17 * 60 && minute < 22 * 60 ? peak : normal;
  }
  return Math.round(sum / 2);
}

// Courts by index: 0-1 Cầu lông A, 2-3 Cầu lông B, 4-5 Bóng đá A. `day` counts Vietnam days after today (1 to 7).
// Each court has its own day and hour, so no two bookings of one court overlap. Hours stay inside 06:00 to 23:00.
type MatchSpec = { court: number; day: number; hour: number; hours: number; host: string; others: string[]; pending?: string[]; capacity: number; mode: 'INSTANT' | 'APPROVAL' };
const MATCHES: MatchSpec[] = [
  { court: 0, day: 1, hour: 18, hours: 2, host: 'Minh Quân', others: ['Lan Anh'], capacity: 4, mode: 'INSTANT' },
  { court: 1, day: 1, hour: 19, hours: 1, host: 'An', others: ['Chi', 'Tuấn Kiệt'], pending: ['Thu Hương'], capacity: 6, mode: 'APPROVAL' },
  { court: 2, day: 2, hour: 8, hours: 2, host: 'Lan Anh', others: ['Đăng Khoa', 'Ngọc Mai'], capacity: 6, mode: 'INSTANT' },
  { court: 3, day: 2, hour: 20, hours: 1, host: 'Thu Hương', others: [], capacity: 4, mode: 'INSTANT' },
  { court: 4, day: 1, hour: 19, hours: 2, host: 'Tuấn Kiệt', others: ['An', 'Chi', 'Hoàng Phúc', 'Bảo Trân', 'Ngọc Mai'], capacity: 10, mode: 'INSTANT' },
  { court: 5, day: 2, hour: 18, hours: 2, host: 'Đăng Khoa', others: ['An', 'Minh Quân', 'Ngọc Mai'], pending: ['Chi'], capacity: 10, mode: 'APPROVAL' },
  { court: 4, day: 3, hour: 17, hours: 2, host: 'Minh Quân', others: ['An', 'Lan Anh', 'Tuấn Kiệt', 'Thu Hương', 'Đăng Khoa', 'Hoàng Phúc'], capacity: 14, mode: 'INSTANT' },
  { court: 0, day: 3, hour: 7, hours: 1, host: 'Ngọc Mai', others: ['Hoàng Phúc'], capacity: 4, mode: 'INSTANT' },
  { court: 2, day: 4, hour: 19, hours: 2, host: 'Hoàng Phúc', others: ['Chi', 'Lan Anh'], capacity: 4, mode: 'INSTANT' },
  { court: 5, day: 4, hour: 20, hours: 2, host: 'An', others: ['Đăng Khoa'], capacity: 12, mode: 'INSTANT' },
  { court: 1, day: 5, hour: 9, hours: 1, host: 'Chi', others: [], capacity: 4, mode: 'INSTANT' },
  { court: 4, day: 6, hour: 18, hours: 2, host: 'Lan Anh', others: ['Tuấn Kiệt', 'Ngọc Mai'], capacity: 10, mode: 'INSTANT' },
];

// Bookings without a match: [court, day, hour, hours, customer, status]. The PENDING ones fill the owner queue.
const PLAIN_BOOKINGS: [number, number, number, number, string, 'PENDING' | 'CONFIRMED'][] = [
  [0, 2, 17, 1, 'Chi', 'PENDING'],
  [0, 4, 19, 2, 'Bảo Trân', 'PENDING'],
  [1, 3, 18, 1, 'Minh Quân', 'PENDING'],
  [2, 3, 10, 1, 'An', 'PENDING'],
  [3, 5, 19, 1, 'Đăng Khoa', 'PENDING'],
  [4, 5, 19, 2, 'Lan Anh', 'PENDING'],
  [5, 6, 20, 1, 'Hoàng Phúc', 'PENDING'],
  [0, 5, 18, 2, 'An', 'CONFIRMED'],
  [3, 6, 8, 1, 'Thu Hương', 'CONFIRMED'],
  [5, 7, 17, 2, 'Minh Quân', 'CONFIRMED'],
];

/** Pure builder of all rows. `now` is the clock, so the data is never in the past. */
export function buildDemoData(now: Date): DemoData {
  const users: SeedUser[] = [...BASE_USERS, ...DEMO_USERS].map((u) => ({ ...u, id: randomUUID() }));
  const byName = (name: string) => users.find((u) => u.name === name)!;
  const venues: SeedVenue[] = BASE_VENUES.map((v) => ({
    id: randomUUID(),
    name: v.name,
    ownerPhone: v.owner,
    sport: v.sport,
    courts: ['Sân 1', 'Sân 2'].map((name) => ({ id: randomUUID(), name, priceNormal: v.normal, pricePeak: v.peak })),
  }));
  const courts = venues.flatMap((v) => v.courts.map((c) => ({ ...c, sport: v.sport })));
  const today = vnMidnight(now);
  const requestedAt = new Date(now.getTime() - 5 * MINUTE);

  const makeBooking = (courtIndex: number, day: number, hour: number, hours: number, userId: string, status: 'PENDING' | 'CONFIRMED'): SeedBooking => {
    const court = courts[courtIndex]!;
    const startAt = new Date(today + day * DAY + hour * HOUR);
    const endAt = new Date(startAt.getTime() + hours * HOUR);
    return {
      id: randomUUID(),
      courtId: court.id,
      startAt,
      endAt,
      status,
      createdById: userId,
      priceTotal: price(startAt, endAt, court.priceNormal, court.pricePeak),
      createdAt: requestedAt,
      // BR-7: the earlier of request time + 2 hours and start time - 1 hour.
      confirmDeadline: status === 'PENDING' ? new Date(Math.min(requestedAt.getTime() + 2 * HOUR, startAt.getTime() - HOUR)) : null,
      confirmedAt: status === 'CONFIRMED' ? requestedAt : null,
    };
  };

  const bookings: SeedBooking[] = [];
  const matches: SeedMatch[] = [];
  const matchPlayers: SeedMatchPlayer[] = [];
  for (const spec of MATCHES) {
    const host = byName(spec.host);
    const booking = makeBooking(spec.court, spec.day, spec.hour, spec.hours, host.id, 'CONFIRMED');
    bookings.push(booking);
    const matchId = randomUUID();
    const active = [host.name, ...spec.others];
    matches.push({
      id: matchId,
      bookingId: booking.id,
      hostId: host.id,
      sport: courts[spec.court]!.sport,
      capacity: spec.capacity,
      // The cost of the booking shared by every seat, rounded up to 1,000 VND.
      pricePerSlot: Math.ceil(booking.priceTotal / spec.capacity / 1000) * 1000,
      status: 'OPEN',
      joinedCount: active.length,
      joinMode: spec.mode,
      createdAt: requestedAt,
    });
    active.forEach((name, i) => {
      matchPlayers.push({ matchId, userId: byName(name).id, status: 'ACTIVE', joinedAt: new Date(requestedAt.getTime() + i * MINUTE) });
    });
    for (const name of spec.pending ?? [])
      matchPlayers.push({ matchId, userId: byName(name).id, status: 'PENDING', joinedAt: now });
  }
  for (const [court, day, hour, hours, name, status] of PLAIN_BOOKINGS)
    bookings.push(makeBooking(court, day, hour, hours, byName(name).id, status));

  return { users, venues, bookings, matches, matchPlayers };
}

/** Empties the tables of the database at `url` and fills them. Refuses a URL that is not on localhost. */
export async function seedDatabase(url: string, password: string, now: Date = new Date()): Promise<{ accounts: number; venues: number; matches: number }> {
  if (!/@localhost[:/]/.test(url)) throw new Error('The seed runs only against a database on localhost.');
  const passwordHash = await hash(password);
  const data = buildDemoData(now);
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    await db.query('BEGIN');
    await db.query('TRUNCATE "MatchPlayer", "Match", "Booking", "Court", "Venue", "User" CASCADE');
    for (const u of data.users)
      await db.query('INSERT INTO "User" (id, name, phone, "passwordHash", role, "skillLevel") VALUES ($1, $2, $3, $4, $5, $6)', [u.id, u.name, u.phone, passwordHash, u.role, u.skillLevel]);
    for (const v of data.venues) {
      await db.query(
        'INSERT INTO "Venue" (id, "ownerId", name, address, phone, "opensAt", "closesAt") VALUES ($1, $2, $3, $4, $5, 360, 1380)',
        [v.id, data.users.find((u) => u.phone === v.ownerPhone)!.id, v.name, `Địa chỉ của ${v.name}`, v.ownerPhone],
      );
      for (const c of v.courts)
        await db.query('INSERT INTO "Court" (id, "venueId", name, sport, "priceNormal", "pricePeak") VALUES ($1, $2, $3, $4, $5, $6)', [
          c.id, v.id, c.name, v.sport, c.priceNormal, c.pricePeak,
        ]);
    }
    for (const b of data.bookings)
      await db.query(
        `INSERT INTO "Booking" (id, "courtId", "startAt", "endAt", status, source, "createdById", "priceTotal", "confirmDeadline", "confirmedAt", "createdAt")
         VALUES ($1, $2, $3, $4, $5, 'APP', $6, $7, $8, $9, $10)`,
        [b.id, b.courtId, b.startAt, b.endAt, b.status, b.createdById, b.priceTotal, b.confirmDeadline, b.confirmedAt, b.createdAt],
      );
    for (const m of data.matches)
      await db.query(
        `INSERT INTO "Match" (id, "bookingId", "hostId", sport, capacity, "pricePerSlot", status, "joinedCount", "joinMode", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [m.id, m.bookingId, m.hostId, m.sport, m.capacity, m.pricePerSlot, m.status, m.joinedCount, m.joinMode, m.createdAt],
      );
    for (const p of data.matchPlayers)
      await db.query('INSERT INTO "MatchPlayer" ("matchId", "userId", status, "joinedAt") VALUES ($1, $2, $3, $4)', [p.matchId, p.userId, p.status, p.joinedAt]);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
  return { accounts: data.users.length, venues: data.venues.length, matches: data.matches.length };
}

// Run only when node starts this file, not when a test imports it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (existsSync('.env')) process.loadEnvFile('.env');
  // A seed of a shared demo database takes its password from SEED_PASSWORD, so the default stays local.
  const done = await seedDatabase(process.env.DATABASE_URL ?? '', process.env.SEED_PASSWORD ?? 'monsport123');
  console.log(`Seeded ${done.accounts} accounts, ${done.venues} venues, and ${done.matches} open matches.`);
}
