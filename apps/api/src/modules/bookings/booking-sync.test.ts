import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service.js';
import { BUSY, type InsertBookingFields, insertUnderLock, TAKEN } from './booking-sync.js';

function run(transaction: ReturnType<typeof vi.fn>) {
  const prisma = { $transaction: transaction } as unknown as PrismaService;
  return insertUnderLock(prisma, undefined, 'c', new Date(), new Date(), new Date(), null, {} as InsertBookingFields);
}

describe('insertUnderLock', () => {
  it('answers TAKEN when the retry after 40P01 meets the EXCLUDE constraint', async () => {
    const transaction = vi.fn().mockRejectedValueOnce({ code: '40P01' }).mockRejectedValueOnce({ code: '23P01' });
    const result = await run(transaction).catch((error: unknown) => error);
    expect(result).toBeInstanceOf(ConflictException);
    expect((result as ConflictException).message).toBe(TAKEN);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('answers TAKEN without a retry on 23P01', async () => {
    const transaction = vi.fn().mockRejectedValue({ code: '23P01' });
    const result = await run(transaction).catch((error: unknown) => error);
    expect(result).toBeInstanceOf(ConflictException);
    expect((result as ConflictException).message).toBe(TAKEN);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('answers BUSY after two 40P01', async () => {
    const transaction = vi.fn().mockRejectedValue({ code: '40P01' });
    const result = await run(transaction).catch((error: unknown) => error);
    expect(result).toBeInstanceOf(ConflictException);
    expect((result as ConflictException).message).toBe(BUSY);
    expect(transaction).toHaveBeenCalledTimes(2);
  });
});
