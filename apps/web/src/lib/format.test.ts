import { describe, expect, it } from 'vitest';
import { formatVnd } from './format.ts';

describe('formatVnd', () => {
  it('BR-25: writes whole VND with dots between thousands', () => {
    expect(formatVnd(1_500_000)).toBe('1.500.000đ');
  });
});
