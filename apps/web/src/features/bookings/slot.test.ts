import { describe, expect, it } from 'vitest';
import { slotAt } from './slot.ts';

describe('slotAt', () => {
  it('builds the instant of a minute of the day in Asia/Ho_Chi_Minh', () => {
    expect(slotAt('2026-11-20', 17 * 60 + 30)).toBe('2026-11-20T17:30:00+07:00');
  });

  it('turns 24:00 into 00:00 of the next day, so a venue that closes at 24:00 takes its last hour', () => {
    expect(slotAt('2026-11-20', 1440)).toBe('2026-11-21T00:00:00+07:00');
    expect(slotAt('2026-12-31', 1440)).toBe('2027-01-01T00:00:00+07:00');
  });
});
