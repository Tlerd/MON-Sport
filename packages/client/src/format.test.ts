import { expect, test } from 'vitest';
import { formatVnd } from '@monsport/client';

test('AC-1 formatVnd lives in @monsport/client', () => {
  expect(formatVnd(240000)).toBe('240.000đ');
});
