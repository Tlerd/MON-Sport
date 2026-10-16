// Sample data for local development: `pnpm --filter @monsport/api db:seed`.
// It empties the tables first, so it runs only against a database on localhost.
// Every seed account gets SEED_PASSWORD. Its default is a local test value.

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { hash } from '@node-rs/argon2';
import pg from 'pg';

if (existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL ?? '';
if (!/@localhost[:/]/.test(url)) throw new Error('The seed runs only against a database on localhost.');

// A seed of a shared demo database takes its password from SEED_PASSWORD, so the default stays local.
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'monsport123';
const passwordHash = await hash(SEED_PASSWORD);

const users = [
  { name: 'Admin', phone: '0900000000', role: 'ADMIN' },
  { name: 'Bình', phone: '0912345678', role: 'OWNER' },
  { name: 'Dũng', phone: '0912345679', role: 'OWNER' },
  { name: 'Hà', phone: '0912345680', role: 'OWNER' },
  { name: 'An', phone: '0901234567', role: 'USER' },
  { name: 'Chi', phone: '0901234568', role: 'USER' },
].map((u) => ({ ...u, id: randomUUID() }));
const owner = (phone: string) => users.find((u) => u.phone === phone)!.id;

// The court count of each venue is still open (intake, open item 1). Each venue has 2 courts for now.
const venues = [
  { name: 'Cầu lông A', owner: '0912345678', sport: 'BADMINTON', normal: 80_000, peak: 120_000 },
  { name: 'Cầu lông B', owner: '0912345679', sport: 'BADMINTON', normal: 70_000, peak: 100_000 },
  { name: 'Bóng đá A', owner: '0912345680', sport: 'FOOTBALL', normal: 300_000, peak: 500_000 },
];

const db = new pg.Client({ connectionString: url });
await db.connect();
try {
  await db.query('BEGIN');
  await db.query('TRUNCATE "Booking", "Court", "Venue", "User" CASCADE');
  for (const u of users)
    await db.query('INSERT INTO "User" (id, name, phone, "passwordHash", role) VALUES ($1, $2, $3, $4, $5)', [u.id, u.name, u.phone, passwordHash, u.role]);
  for (const v of venues) {
    const venueId = randomUUID();
    await db.query(
      'INSERT INTO "Venue" (id, "ownerId", name, address, phone, "opensAt", "closesAt") VALUES ($1, $2, $3, $4, $5, 360, 1380)',
      [venueId, owner(v.owner), v.name, `Địa chỉ của ${v.name}`, v.owner],
    );
    for (const name of ['Sân 1', 'Sân 2'])
      await db.query('INSERT INTO "Court" (id, "venueId", name, sport, "priceNormal", "pricePeak") VALUES ($1, $2, $3, $4, $5, $6)', [
        randomUUID(), venueId, name, v.sport, v.normal, v.peak,
      ]);
  }
  await db.query('COMMIT');
  console.log(`Seeded ${users.length} accounts and ${venues.length} venues.`);
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  await db.end();
}
