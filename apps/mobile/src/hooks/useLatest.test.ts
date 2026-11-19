import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useLatest } from './useLatest.ts';

describe('useLatest', () => {
  afterEach(() => {
    cleanup();
  });

  it('holds the first value, updates on rerender, and keeps the same ref object', () => {
    const { result, rerender } = renderHook(({ value }) => useLatest(value), {
      initialProps: { value: 'first' },
    });
    const initialRef = result.current;
    expect(initialRef.current).toBe('first');

    rerender({ value: 'second' });
    expect(result.current).toBe(initialRef);
    expect(result.current.current).toBe('second');
  });
});
