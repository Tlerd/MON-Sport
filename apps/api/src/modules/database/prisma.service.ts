import { ConflictException, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

const POOL_MAX = 6;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, options: '-c TimeZone=UTC', max: POOL_MAX }),
      transactionOptions: { maxWait: 10_000, timeout: 10_000 },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

export function isExclusionViolation(error: unknown): boolean {
  return hasSqlState(error, '23P01', /23P01|Booking_no_overlap/);
}

export function isDeadlock(error: unknown): boolean {
  return hasSqlState(error, '40P01', /40P01|deadlock detected/) || hasSqlState(error, 'P2034', /(?!)/);
}

export async function retryOnDeadlock<T>(work: () => Promise<T>, busyMessage?: string): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (!isDeadlock(error)) throw error;
  }
  try {
    return await work();
  } catch (again) {
    if (busyMessage !== undefined && isDeadlock(again)) throw new ConflictException(busyMessage);
    throw again;
  }
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
