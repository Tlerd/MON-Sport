import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Clock } from '../database/clock.js';
import type { PrismaService } from '../database/prisma.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import { BUSY } from './booking-sync.js';
import { OwnerBookingsService } from './owner-bookings.service.js';
import type { VenueScope } from './venue-scope.js';

const deadlock = () => Object.assign(new Error('deadlock detected'), { code: '40P01' });
const clock = { now: () => new Date('2026-11-20T03:00:00Z') } as Clock;
const notifications = { createNotification: vi.fn() } as unknown as NotificationsService;
const OWNER: VenueScope = { ownerId: '0199a1b2-0000-7000-8000-000000000001' };

function service(prisma: Record<string, unknown>) {
  return new OwnerBookingsService(prisma as unknown as PrismaService, clock, notifications);
}

describe('decide', () => {
  it('answers 409 when Postgres ends the transaction with 40P01', async () => {
    const prisma = {
      booking: { findUnique: vi.fn().mockResolvedValue({ courtId: 'c' }) },
      $transaction: vi.fn().mockRejectedValue(deadlock()),
    };
    await expect(service(prisma).decide(OWNER, 'b', 'CONFIRMED')).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not hide another error', async () => {
    const prisma = {
      booking: { findUnique: vi.fn().mockResolvedValue({ courtId: 'c' }) },
      $transaction: vi.fn().mockRejectedValue(new Error('boom')),
    };
    await expect(service(prisma).decide(OWNER, 'b', 'CONFIRMED')).rejects.toThrow('boom');
  });
});

describe('forOwner', () => {
  it('runs the expire once more after 40P01, and lists', async () => {
    const prisma = {
      $executeRaw: vi.fn().mockRejectedValueOnce(deadlock()).mockResolvedValue(0),
      booking: { findMany: vi.fn().mockResolvedValue([]) },
    };
    expect(await service(prisma).forOwner(OWNER, 'PENDING')).toEqual([]);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('answers 409 BUSY after a second 40P01, and does not list', async () => {
    const prisma = {
      $executeRaw: vi.fn().mockRejectedValue(deadlock()),
      booking: { findMany: vi.fn() },
    };
    const error = await service(prisma).forOwner(OWNER, 'PENDING').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toBe(BUSY);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('does not retry another error', async () => {
    const prisma = { $executeRaw: vi.fn().mockRejectedValue(new Error('boom')), booking: { findMany: vi.fn() } };
    await expect(service(prisma).forOwner(OWNER, 'PENDING')).rejects.toThrow('boom');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});

describe('insertUnderLock', () => {
  const insert = (prisma: Record<string, unknown>) =>
    (service(prisma) as unknown as { insertUnderLock: (...args: unknown[]) => Promise<unknown> })
      .insertUnderLock('c', new Date(), new Date(), new Date(), null, {});

  it('runs the insert once more after 40P01', async () => {
    const prisma = { $transaction: vi.fn().mockRejectedValueOnce(deadlock()).mockResolvedValue({ id: 'new' }) };
    expect(await insert(prisma)).toEqual({ id: 'new' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('answers "taken" when the retry meets the EXCLUDE constraint', async () => {
    const prisma = { $transaction: vi.fn().mockRejectedValueOnce(deadlock()).mockRejectedValue({ code: '23P01' }) };
    await expect(insert(prisma)).rejects.toThrow('Khung giờ này vừa có người đặt');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('does not retry another error', async () => {
    const prisma = { $transaction: vi.fn().mockRejectedValue(new Error('boom')) };
    await expect(insert(prisma)).rejects.toThrow('boom');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('answers 409 after a second 40P01', async () => {
    const prisma = { $transaction: vi.fn().mockRejectedValue(deadlock()) };
    await expect(insert(prisma)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
