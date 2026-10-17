import { afterAll, describe, expect, it } from 'vitest';
import { isDeadlock, PrismaService } from './prisma.service.js';

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

describe('isDeadlock', () => {
  it('finds SQLSTATE 40P01 on the error, in meta, and in a cause', () => {
    expect(isDeadlock({ code: '40P01' })).toBe(true);
    expect(isDeadlock({ meta: { code: '40P01' } })).toBe(true);
    expect(isDeadlock(new Error('wrapped', { cause: { originalCode: '40P01' } }))).toBe(true);
  });

  // The shape that a typed query gives for a victim (rule-review of PR #49), seen on the local Postgres.
  it('finds a typed query victim: P2034, with 40P01 in meta.driverAdapterError', () => {
    const victim = Object.assign(new Error('Transaction failed due to a write conflict or a deadlock. Please retry your transaction'), {
      code: 'P2034',
      meta: { modelName: 'Booking', driverAdapterError: { cause: { originalCode: '40P01' } } },
    });
    expect(isDeadlock(victim)).toBe(true);
    expect(isDeadlock({ meta: { driverAdapterError: { cause: { originalCode: '40P01' } } } })).toBe(true);
  });

  it('finds the message of a deadlock when the driver drops the code', () => {
    expect(isDeadlock(new Error('deadlock detected'))).toBe(true);
  });

  it('refuses other errors', () => {
    expect(isDeadlock({ code: '23P01' })).toBe(false);
    expect(isDeadlock(new Error('boom'))).toBe(false);
    expect(isDeadlock(undefined)).toBe(false);
  });
});
