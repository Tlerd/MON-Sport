import { act, renderHook } from '@testing-library/react';
import { ApiError } from '@monsport/client';
import { describe, expect, it } from 'vitest';
import { useAction } from './useAction';

describe('useAction', () => {
  it('returns the result and clears busy on success', async () => {
    const { result } = renderHook(() => useAction());
    let value: number | undefined;
    await act(async () => {
      value = await result.current.run(async () => 7, 'Fallback');
    });
    expect(value).toBe(7);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets busy while the work runs', async () => {
    const { result } = renderHook(() => useAction());
    let release: () => void = () => {};
    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.run(() => new Promise<void>((r) => (release = r)), 'Fallback');
    });
    expect(result.current.busy).toBe(true);
    await act(async () => {
      release();
      await pending;
    });
    expect(result.current.busy).toBe(false);
  });

  it('sets the ApiError message and returns undefined on failure', async () => {
    const { result } = renderHook(() => useAction());
    let value: unknown = 'unset';
    await act(async () => {
      value = await result.current.run(async () => {
        throw new ApiError(409, 'Slot taken');
      }, 'Fallback');
    });
    expect(value).toBeUndefined();
    expect(result.current.error).toBe('Slot taken');
    expect(result.current.busy).toBe(false);
  });

  it('uses the fallback for other errors and clears the error on the next run', async () => {
    const { result } = renderHook(() => useAction());
    await act(async () => {
      await result.current.run(async () => {
        throw new Error('boom');
      }, 'Fallback');
    });
    expect(result.current.error).toBe('Fallback');
    await act(async () => {
      await result.current.run(async () => 1, 'Fallback');
    });
    expect(result.current.error).toBeNull();
  });

  it('lets the caller set the error', () => {
    const { result } = renderHook(() => useAction());
    act(() => result.current.setError('Manual'));
    expect(result.current.error).toBe('Manual');
  });
});
