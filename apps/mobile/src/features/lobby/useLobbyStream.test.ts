import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLobbyStream } from './useLobbyStream.ts';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  closed = false;
  private listeners = new Map<string, (() => void)[]>();
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  close() {
    this.closed = true;
  }
  emit(type: string) {
    for (const fn of this.listeners.get(type) ?? []) fn();
  }
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useLobbyStream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('AC-4: a burst of match events calls onChange once, and a ping never does', () => {
    const onChange = vi.fn();
    renderHook(() => useLobbyStream(onChange));
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0]?.url).toBe('/api/matches/stream');
    const es = FakeEventSource.instances[0]!;
    es.emit('ping');
    vi.advanceTimersByTime(1000);
    expect(onChange).not.toHaveBeenCalled();
    es.emit('match');
    vi.advanceTimersByTime(200);
    es.emit('match');
    vi.advanceTimersByTime(200);
    es.emit('match');
    vi.advanceTimersByTime(499);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('AC-4: a steady stream of events still reloads within 1 s of the first event', () => {
    const onChange = vi.fn();
    renderHook(() => useLobbyStream(onChange));
    const es = FakeEventSource.instances[0]!;
    // An event every 300 ms: the 500 ms quiet period never comes, so only the maximum wait can reload.
    for (let t = 0; t < 3000; t += 300) {
      es.emit('match');
      vi.advanceTimersByTime(300);
    }
    expect(onChange.mock.calls.length).toBeGreaterThanOrEqual(2);
    // The first reload is at most 1 s after the first event.
    const solo = vi.fn();
    cleanup();
    FakeEventSource.instances = [];
    renderHook(() => useLobbyStream(solo));
    const es2 = FakeEventSource.instances[0]!;
    es2.emit('match');
    vi.advanceTimersByTime(300);
    es2.emit('match');
    vi.advanceTimersByTime(300);
    es2.emit('match');
    vi.advanceTimersByTime(300);
    es2.emit('match');
    expect(solo).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(solo).toHaveBeenCalledTimes(1);
  });

  it('AC-4: hidden closes the stream and cancels the debounce, visible reopens and calls once', () => {
    const onChange = vi.fn();
    renderHook(() => useLobbyStream(onChange));
    const first = FakeEventSource.instances[0]!;
    first.emit('match');
    setVisibility('hidden');
    expect(first.closed).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(onChange).not.toHaveBeenCalled();
    setVisibility('visible');
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[1]?.closed).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('AC-4: unmount and enabled=false close the stream and clear the timer', () => {
    const onChange = vi.fn();
    const { unmount } = renderHook(() => useLobbyStream(onChange));
    const es = FakeEventSource.instances[0]!;
    es.emit('match');
    unmount();
    expect(es.closed).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(onChange).not.toHaveBeenCalled();

    const { rerender } = renderHook(({ on }) => useLobbyStream(onChange, on), { initialProps: { on: true } });
    const second = FakeEventSource.instances[1]!;
    rerender({ on: false });
    expect(second.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('AC-4: a new onChange callback does not recreate the stream', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => useLobbyStream(cb), { initialProps: { cb: first } });
    rerender({ cb: second });
    expect(FakeEventSource.instances).toHaveLength(1);
    FakeEventSource.instances[0]!.emit('match');
    vi.advanceTimersByTime(500);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('AC-5: a ping then an error event does not create a second EventSource', () => {
    const onChange = vi.fn();
    renderHook(() => useLobbyStream(onChange));
    const es = FakeEventSource.instances[0]!;
    es.emit('ping');
    es.emit('error');
    vi.advanceTimersByTime(1000);
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(es.closed).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('AC-5: without EventSource the hook does nothing and does not crash', () => {
    vi.stubGlobal('EventSource', undefined);
    const onChange = vi.fn();
    expect(() => renderHook(() => useLobbyStream(onChange))).not.toThrow();
    vi.advanceTimersByTime(1000);
    expect(onChange).not.toHaveBeenCalled();
    expect(FakeEventSource.instances).toHaveLength(0);
  });
});
