import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { retryOnDeadlock } from './prisma.service.js';

const deadlock = () => ({ code: '40P01' });
const BUSY = 'Yêu cầu đang được xử lý, hãy thử lại';

describe('retryOnDeadlock', () => {
  it('returns the result of a first call that succeeds', async () => {
    const work = vi.fn().mockResolvedValue('ok');
    expect(await retryOnDeadlock(work, BUSY)).toBe('ok');
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('runs the work once more after a deadlock', async () => {
    const work = vi.fn().mockRejectedValueOnce(deadlock()).mockResolvedValue('ok');
    expect(await retryOnDeadlock(work, BUSY)).toBe('ok');
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('rethrows another error after one run', async () => {
    const boom = new Error('boom');
    const work = vi.fn().mockRejectedValue(boom);
    await expect(retryOnDeadlock(work, BUSY)).rejects.toBe(boom);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('answers a ConflictException with the busy message after two deadlocks', async () => {
    const work = vi.fn().mockRejectedValue(deadlock());
    const failure = retryOnDeadlock(work, BUSY);
    await expect(failure).rejects.toBeInstanceOf(ConflictException);
    await expect(failure).rejects.toThrow(BUSY);
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('rethrows the second error after two deadlocks without a busy message', async () => {
    const first = deadlock();
    const second = deadlock();
    const work = vi.fn().mockRejectedValueOnce(first).mockRejectedValueOnce(second);
    await expect(retryOnDeadlock(work)).rejects.toBe(second);
    expect(work).toHaveBeenCalledTimes(2);
  });
});
