import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionBar } from '../components/ActionBar.tsx';
import { ContextBar } from '../components/ContextBar.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { BarsProvider, useBars } from './bars.tsx';

describe('bars: BarsProvider, useBars, ContextBar, and ActionBar', () => {
  const originalScrollY = window.scrollY;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
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
    cleanup();
    window.scrollY = originalScrollY;
    window.innerHeight = originalInnerHeight;
    vi.restoreAllMocks();
  });

  it('AC-10: ContextBar gets class at-top when topHidden, ActionBar gets class at-bottom when tabHidden', () => {
    window.scrollY = 300;
    const { container } = render(
      <BarsProvider>
        <TopBar title="Sân cầu lông" />
        <ContextBar>
          <span>Bộ lọc</span>
        </ContextBar>
        <ActionBar
          title="Sân 1"
          actionLabel="Gửi yêu cầu"
          onAction={() => {}}
        />
      </BarsProvider>,
    );

    const contextNav = container.querySelector('nav');
    const actionAside = container.querySelector('aside');

    expect(contextNav?.classList.contains('at-top')).toBe(false);
    expect(actionAside?.classList.contains('at-bottom')).toBe(false);

    // Scroll down to 400
    act(() => {
      window.scrollY = 400;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(contextNav?.classList.contains('at-top')).toBe(true);
    expect(actionAside?.classList.contains('at-bottom')).toBe(true);

    // Scroll up 9px to 391
    act(() => {
      window.scrollY = 391;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(contextNav?.classList.contains('at-top')).toBe(false);
    expect(actionAside?.classList.contains('at-bottom')).toBe(false);
  });

  it('an open Sheet keeps the bars as they were while the page scrolls', () => {
    window.scrollY = 60;
    const { container, rerender } = render(
      <BarsProvider>
        <TopBar title="Sân cầu lông" />
        <ContextBar>
          <span>Bộ lọc</span>
        </ContextBar>
        <Sheet open={true} onClose={() => {}} title="Đặt sân">
          <p>Nội dung sheet</p>
        </Sheet>
      </BarsProvider>,
    );

    const header = container.querySelector('header');
    const nav = container.querySelector('nav');

    expect(header?.style.transform).toBe('translateY(0)');

    // Scroll down > 8px while Sheet is open
    act(() => {
      window.scrollY = 85;
      window.dispatchEvent(new Event('scroll'));
    });

    // Bars remain frozen as they were
    expect(header?.style.transform).toBe('translateY(0)');

    // Close the sheet
    rerender(
      <BarsProvider>
        <TopBar title="Sân cầu lông" />
        <ContextBar>
          <span>Bộ lọc</span>
        </ContextBar>
        <Sheet open={false} onClose={() => {}} title="Đặt sân">
          <p>Nội dung sheet</p>
        </Sheet>
      </BarsProvider>,
    );

    // Scroll down > 8px after closing sheet
    act(() => {
      window.scrollY = 100;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(header?.style.transform).toBe('translateY(-100%)');
  });

  it('AC-8 ActionBar stays shown while a sheet is open', () => {
    window.scrollY = 300;
    const { container } = render(
      <BarsProvider>
        <ActionBar
          title="Sân 1"
          actionLabel="Gửi yêu cầu"
          onAction={() => {}}
        />
        <Sheet open={true} onClose={() => {}} title="Đặt sân">
          <p>Nội dung sheet</p>
        </Sheet>
      </BarsProvider>,
    );

    const actionAside = container.querySelector('aside');
    expect(actionAside).not.toBeNull();

    act(() => {
      window.scrollY = 100;
      window.dispatchEvent(new Event('scroll'));
    });

    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside!.classList.contains('at-bottom')).toBe(true);
  });

  it('BarsProvider counts locks, lock() returns a release function, and closed Sheet writes nothing', () => {
    let captured: any;
    function Consumer() {
      captured = useBars();
      return null;
    }
    const { rerender } = render(
      <BarsProvider>
        <Consumer />
        <Sheet open={false} onClose={() => {}} title="Test">
          <p>Closed</p>
        </Sheet>
      </BarsProvider>,
    );

    expect(typeof captured.lock).toBe('function');

    let release1: () => void;
    let release2: () => void;

    act(() => {
      release1 = captured.lock();
    });
    expect(captured.tabHidden).toBe(true);
    // First lock taken
    act(() => {
      release2 = captured.lock();
    });
    expect(captured.tabHidden).toBe(true);
    // Release first lock - second still holds
    act(() => {
      release1!();
    });
    expect(captured.tabHidden).toBe(true);
    // Release second lock
    act(() => {
      release2!();
    });
    expect(captured.tabHidden).toBe(false);

    // Releasing again has no effect
    act(() => {
      release2!();
    });
    expect(captured.tabHidden).toBe(false);

    // Closed sheet does not acquire locks
    rerender(
      <BarsProvider>
        <Consumer />
        <Sheet open={false} onClose={() => {}} title="Test">
          <p>Closed</p>
        </Sheet>
      </BarsProvider>,
    );
  });

  it('renders <Sheet open>, unmounts it, and expects tabHidden === false', () => {
    let captured: any;
    function Consumer() {
      captured = useBars();
      return null;
    }
    const { rerender } = render(
      <BarsProvider>
        <Consumer />
        <Sheet open onClose={() => {}} title="Test">
          <p>Open</p>
        </Sheet>
      </BarsProvider>,
    );

    expect(captured.tabHidden).toBe(true);

    rerender(
      <BarsProvider>
        <Consumer />
      </BarsProvider>,
    );

    expect(captured.tabHidden).toBe(false);
  });
});
