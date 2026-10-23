import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHideOnScroll } from './useHideOnScroll';

describe('useHideOnScroll', () => {
  const originalScrollY = window.scrollY;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 812, writable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 2000, configurable: true });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    window.scrollY = originalScrollY;
    window.innerHeight = originalInnerHeight;
    vi.restoreAllMocks();
  });

  it('AC-3: scroll down 9px in one event from scrollY = 300 to 309 hides top bar and tab bar', () => {
    window.scrollY = 300;
    const { result } = renderHook(() => useHideOnScroll({ locked: false }));

    expect(result.current.topHidden).toBe(false);
    expect(result.current.tabHidden).toBe(false);

    act(() => {
      window.scrollY = 309;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.topHidden).toBe(true);
    expect(result.current.tabHidden).toBe(true);
  });

  it('AC-4: 9 events of 1px down from scrollY = 300 to 309 hides top bar and tab bar', () => {
    window.scrollY = 300;
    const { result } = renderHook(() => useHideOnScroll({ locked: false }));

    expect(result.current.topHidden).toBe(false);
    expect(result.current.tabHidden).toBe(false);

    act(() => {
      for (let y = 301; y <= 309; y++) {
        window.scrollY = y;
        window.dispatchEvent(new Event('scroll'));
      }
    });

    expect(result.current.topHidden).toBe(true);
    expect(result.current.tabHidden).toBe(true);
  });

  it('AC-5: start at 590, scroll down to 600, assert both hidden at 600; then scroll up to 591 and assert both shown', () => {
    window.scrollY = 590;
    const { result } = renderHook(() => useHideOnScroll({ locked: false }));

    expect(result.current.topHidden).toBe(false);
    expect(result.current.tabHidden).toBe(false);

    // Scroll down to 600
    act(() => {
      window.scrollY = 600;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.topHidden).toBe(true);
    expect(result.current.tabHidden).toBe(true);

    // Scroll up to 591
    act(() => {
      window.scrollY = 591;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.topHidden).toBe(false);
    expect(result.current.tabHidden).toBe(false);
  });

  it('AC-6: mount at 47, scroll to 56 in one event (9px down), assert both hidden; then scroll to 50 (6px up), assert both shown', () => {
    window.scrollY = 47;
    const { result } = renderHook(() => useHideOnScroll({ locked: false }));

    expect(result.current.topHidden).toBe(false);
    expect(result.current.tabHidden).toBe(false);

    // Scroll to 56 in one event (9px down)
    act(() => {
      window.scrollY = 56;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.topHidden).toBe(true);
    expect(result.current.tabHidden).toBe(true);

    // Scroll to 50 (6px up, only the < 52 rule can show them)
    act(() => {
      window.scrollY = 50;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.topHidden).toBe(false);
    expect(result.current.tabHidden).toBe(false);
  });

  it('AC-7: two bars hidden at scrollY = 1100, scroll down to end of page (scrollY = 1187.5, height = 2000, frame = 812) shows tab bar and leaves top bar unchanged', () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 2000, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 812, configurable: true });
    window.scrollY = 1050;
    const { result } = renderHook(() => useHideOnScroll({ locked: false }));

    act(() => {
      window.scrollY = 1100;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.topHidden).toBe(true);
    expect(result.current.tabHidden).toBe(true);

    act(() => {
      window.scrollY = 1187.5; // 1187.5 + 812 = 1999.5 >= 2000 - 1
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.topHidden).toBe(true);
    expect(result.current.tabHidden).toBe(false);
  });

  it('AC-8: two bars hidden at scrollY = 300, locked = true, scroll up to 100 freezes top bar and hides tab bar; unlocking keeps state until next scroll > 8px', () => {
    window.scrollY = 290;
    const { result, rerender } = renderHook(({ locked }) => useHideOnScroll({ locked }), {
      initialProps: { locked: false },
    });

    act(() => {
      window.scrollY = 300;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.topHidden).toBe(true);
    expect(result.current.tabHidden).toBe(true);

    rerender({ locked: true });
    expect(result.current.topHidden).toBe(true);
    expect(result.current.tabHidden).toBe(true);

    act(() => {
      window.scrollY = 100;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.topHidden).toBe(true);
    expect(result.current.tabHidden).toBe(true);

    rerender({ locked: false });
    // Keep state
    expect(result.current.topHidden).toBe(true);
    expect(result.current.tabHidden).toBe(true);

    // Scroll up by 5px (not exceeding 8px)
    act(() => {
      window.scrollY = 95;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.topHidden).toBe(true);
    expect(result.current.tabHidden).toBe(true);

    // Scroll up further to 91 (total 9px > 8px from 100)
    act(() => {
      window.scrollY = 91;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.topHidden).toBe(false);
    expect(result.current.tabHidden).toBe(false);
  });

  it('AC-8b: two bars shown at scrollY = 300, locked = true with no scroll hides tab bar; unlock with no scroll gives tabHidden = false', () => {
    window.scrollY = 300;
    const { result, rerender } = renderHook(({ locked }) => useHideOnScroll({ locked }), {
      initialProps: { locked: false },
    });

    expect(result.current.topHidden).toBe(false);
    expect(result.current.tabHidden).toBe(false);

    rerender({ locked: true });
    expect(result.current.topHidden).toBe(false);
    expect(result.current.tabHidden).toBe(true);

    rerender({ locked: false });
    expect(result.current.topHidden).toBe(false);
    expect(result.current.tabHidden).toBe(false);
  });

  it('AC-9: prefers-reduced-motion: reduce keeps both bars shown when scrolling from 0 to 200', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    window.scrollY = 0;
    const { result } = renderHook(() => useHideOnScroll({ locked: false }));

    expect(result.current.topHidden).toBe(false);
    expect(result.current.tabHidden).toBe(false);

    act(() => {
      window.scrollY = 200;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.topHidden).toBe(false);
    expect(result.current.tabHidden).toBe(false);
  });
});
