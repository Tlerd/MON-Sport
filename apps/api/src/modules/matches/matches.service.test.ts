import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Clock } from '../database/clock.js';
import type { PrismaService } from '../database/prisma.service.js';
import { MatchesService } from './matches.service.js';
import { ALREADY_HAS_MATCH, BUSY } from './match-messages.js';

const USER = 'user-1';
const input = { bookingId: 'booking-1', capacity: 4, pricePerSlot: 0 } as unknown as Parameters<MatchesService['create']>[1];

async function run(transaction: ReturnType<typeof vi.fn>) {
  const prisma = {
    booking: { findUnique: vi.fn().mockResolvedValue({ courtId: 'court-1', createdById: USER, source: 'APP' }) },
    $transaction: transaction,
  } as unknown as PrismaService;
  const clock = { now: () => new Date('2030-01-01T00:00:00Z') } as unknown as Clock;
  return new MatchesService(prisma, clock).create(USER, input).catch((error: unknown) => error);
}

describe('MatchesService.create', () => {
  it('answers ALREADY_HAS_MATCH when the transaction hits a unique violation', async () => {
    const transaction = vi.fn().mockRejectedValue({ code: 'P2002' });
    const result = await run(transaction);
    expect(result).toBeInstanceOf(ConflictException);
    expect((result as ConflictException).message).toBe(ALREADY_HAS_MATCH);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('answers BUSY when the transaction hits a deadlock', async () => {
    const transaction = vi.fn().mockRejectedValue({ code: '40P01' });
    const result = await run(transaction);
    expect(result).toBeInstanceOf(ConflictException);
    expect((result as ConflictException).message).toBe(BUSY);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
