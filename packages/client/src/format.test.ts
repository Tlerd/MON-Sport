import { expect, test } from 'vitest';
import { durationLabel, formatVnd } from '@monsport/client';

test('AC-1 formatVnd lives in @monsport/client', () => {
  expect(formatVnd(240000)).toBe('240.000đ');
});

test('durationLabel formats minutes into Vietnamese hours', () => {
  expect(durationLabel(60)).toBe('1 giờ');
  expect(durationLabel(90)).toBe('1,5 giờ');
  expect(durationLabel(120)).toBe('2 giờ');
  expect(durationLabel(150)).toBe('2,5 giờ');
  expect(durationLabel(180)).toBe('3 giờ');
});
