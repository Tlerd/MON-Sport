import { afterAll, describe, expect, it } from 'vitest';
import { PrismaService } from './prisma.service.js';

// CI runs Postgres in UTC, so the tests ask for another zone through PGOPTIONS. `pg` reads it only when the config sets no options.
// Without the UTC option of PrismaService, these tests then fail on every server.
const pgOptions = process.env.PGOPTIONS;
process.env.PGOPTIONS = '-c TimeZone=Asia/Bangkok';
const prisma = new PrismaService();

afterAll(async () => {
  await prisma.$disconnect();
  if (pgOptions === undefined) delete process.env.PGOPTIONS;
  else process.env.PGOPTIONS = pgOptions;
});

describe('PrismaService connections', () => {
  it('use the session time zone UTC', async () => {
    expect(await prisma.$queryRaw`SHOW timezone`).toEqual([{ TimeZone: 'UTC' }]);
  });

  // The adapter also drops the offset when it reads, so a round trip through Prisma hides the error. Postgres computes the epoch here.
  it('store the instant of a Date that raw SQL sends', async () => {
    const at = new Date('2026-10-17T03:04:05.678Z');
    const [row] = await prisma.$queryRaw<{ ms: number }[]>`SELECT (extract(epoch FROM ${at}::timestamptz) * 1000)::float8 AS ms`;
    expect(row.ms).toBe(at.getTime());
  });
});
