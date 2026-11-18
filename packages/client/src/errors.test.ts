import { expect, test } from 'vitest';
import { ApiError } from './api.ts';
import { errorMessage } from './errors.ts';

test('errorMessage returns the message of an ApiError', () => {
  expect(errorMessage(new ApiError(409, 'Slot taken'), 'Fallback')).toBe('Slot taken');
});

test('errorMessage returns the fallback for any other error', () => {
  expect(errorMessage(new Error('boom'), 'Fallback')).toBe('Fallback');
  expect(errorMessage('text', 'Fallback')).toBe('Fallback');
  expect(errorMessage(undefined, 'Fallback')).toBe('Fallback');
});
