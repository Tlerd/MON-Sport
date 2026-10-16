import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
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
  for (let e: unknown = error, depth = 0; e && typeof e === 'object' && depth < 5; depth++) {
    const o = e as { code?: unknown; originalCode?: unknown; meta?: { code?: unknown }; cause?: unknown };
    if ([o.code, o.originalCode, o.meta?.code].includes('23P01')) return true;
    e = o.cause;
  }
  return /23P01|Booking_no_overlap/.test(String((error as Error)?.message ?? ''));
}

