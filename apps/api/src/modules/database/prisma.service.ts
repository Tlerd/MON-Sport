import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      // The adapter sends a Date as UTC clock time without an offset, and Postgres reads that in the session time zone.
      // UTC on each connection keeps every write of a Date (ORM and raw SQL) right on a server with another zone, such as the local cluster.
      // An `options` in DATABASE_URL replaces this one, so repeat `-c TimeZone=UTC` there.
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, options: '-c TimeZone=UTC' }),
      // Under a burst (AC-1: 50 requests on one slot) a transaction can wait more than the 2 s default for a connection.
      transactionOptions: { maxWait: 10_000, timeout: 10_000 },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

// Postgres SQLSTATE 23P01: the EXCLUDE constraint refused an overlapping booking (BR-1).
// The driver adapter can wrap the database error, so the code is searched on the error and its causes.
export function isExclusionViolation(error: unknown): boolean {
  return hasSqlState(error, '23P01', /23P01|Booking_no_overlap/);
}

// Postgres SQLSTATE 40P01: Postgres ended this transaction to break a lock cycle. The work can run again.
// A typed Prisma query (create, updateMany) that is the victim arrives as P2034 "write conflict or a deadlock", and the
// SQLSTATE sits in meta.driverAdapterError.cause. P2034 also covers a serialization failure, which is safe to retry too
// (rule-review of PR #49, AG-LOCKS).
export function isDeadlock(error: unknown): boolean {
  return hasSqlState(error, '40P01', /40P01|deadlock detected/) || hasSqlState(error, 'P2034', /(?!)/);
}

function hasSqlState(error: unknown, state: string, message: RegExp): boolean {
  for (let e: unknown = error, depth = 0; e && typeof e === 'object' && depth < 5; depth++) {
    const o = e as {
      code?: unknown;
      originalCode?: unknown;
      meta?: { code?: unknown; driverAdapterError?: { cause?: { originalCode?: unknown } } };
      cause?: unknown;
    };
    if ([o.code, o.originalCode, o.meta?.code, o.meta?.driverAdapterError?.cause?.originalCode].includes(state)) return true;
    e = o.cause;
  }
  return message.test(String((error as Error)?.message ?? ''));
}

