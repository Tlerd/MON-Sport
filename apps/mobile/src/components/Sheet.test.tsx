import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BarsContext, type BarsContextValue } from '../app/bars';
import { Sheet } from './Sheet';

function createBarsLockHelper() {
  let held = 0;
  const lock = vi.fn(() => {
    held += 1;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        held -= 1;
      }
    };
  });
  const value: BarsContextValue = {
    topHidden: false,
    tabHidden: false,
    hidden: false,
    setLocked: vi.fn(),
    lock,
  };
  return {
    value,
    isHeld: () => held > 0,
  };
}

function SheetTestWrapper() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Mở sheet
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Tiêu đề sheet">
        <p>Nội dung sheet</p>
      </Sheet>
    </div>
  );
}

describe('Sheet', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders title, content, and primary action when open is true', () => {
    const handleClose = vi.fn();
    const handlePrimary = vi.fn();

    render(
      <Sheet
        open
        onClose={handleClose}
        title="Gửi yêu cầu"
        primaryAction={{ label: 'Xác nhận gửi', onClick: handlePrimary }}
      >
        <p>Chi tiết booking</p>
      </Sheet>,
    );

    expect(screen.getByRole('heading', { name: 'Gửi yêu cầu' })).toBeDefined();
    expect(screen.getByText('Chi tiết booking')).toBeDefined();

    const submitBtn = screen.getByRole('button', { name: 'Xác nhận gửi' });
    fireEvent.click(submitBtn);
    expect(handlePrimary).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByRole('button', { name: 'Đóng' });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('AC-16: Sheet closes on Escape and on backdrop click, focus returns to the opener', () => {
    vi.useFakeTimers();
    render(<SheetTestWrapper />);

    const openButton = screen.getByRole('button', { name: 'Mở sheet' });
    openButton.focus();
    expect(document.activeElement).toBe(openButton);

    // Open sheet
    fireEvent.click(openButton);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Close on Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('heading', { name: 'Tiêu đề sheet' })).toBeNull();
    expect(document.activeElement).toBe(openButton);

    // Open sheet again
    fireEvent.click(openButton);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    const dialogAgain = screen.getByRole('dialog');
    expect(dialogAgain.contains(document.activeElement)).toBe(true);

    // Close on backdrop click
    const backdrop = screen.getByTestId('sheet-backdrop');
    fireEvent.click(backdrop);
    expect(screen.queryByRole('heading', { name: 'Tiêu đề sheet' })).toBeNull();
    expect(document.activeElement).toBe(openButton);
  });

  it('D-6: the "Đóng" button is at least 44px high and wide', () => {
    render(
      <Sheet open onClose={() => undefined} title="T">
        <p>x</p>
      </Sheet>,
    );
    const close = screen.getByRole('button', { name: 'Đóng' });
    expect(close.style.minHeight).toBe('44px');
    expect(close.style.minWidth).toBe('44px');
  });

  it.each([
    [true, '90dvh'],
    [false, '90vh'],
  ])('D-5: with CSS.supports(90dvh) = %s the scroll area is capped at %s', async (supported, expected) => {
    vi.stubGlobal('CSS', { supports: () => supported });
    vi.resetModules();
    const { Sheet: FreshSheet } = await import('./Sheet');
    render(
      <FreshSheet open onClose={() => undefined} title="T">
        <p>x</p>
      </FreshSheet>,
    );
    const scroller = [...screen.getByRole('dialog').querySelectorAll<HTMLElement>('div')].find((d) => d.style.overflowY === 'auto')!;
    expect(scroller.style.maxHeight).toBe(expected);
  });

  it('renders nothing when open is false', () => {
    const { container } = render(
      <Sheet open={false} onClose={vi.fn()} title="Tiêu đề">
        <div>Nội dung</div>
      </Sheet>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('AC-16: with closeDisabled, Escape, backdrop, "Đóng", and swipe > 60px do not call onClose and keep the bars lock held; after rerender with closeDisabled=false, each closes again', () => {
    vi.useFakeTimers();
    const triggers: Array<{ name: string; fire: (dialog: HTMLElement) => void }> = [
      {
        name: 'Escape',
        fire: () => {
          fireEvent.keyDown(window, { key: 'Escape' });
        },
      },
      {
        name: 'backdrop',
        fire: () => {
          fireEvent.click(screen.getByTestId('sheet-backdrop'));
        },
      },
      {
        name: 'Đóng',
        fire: () => {
          fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
        },
      },
      {
        name: 'swipe',
        fire: () => {
          const closeBtn = screen.getByRole('button', { name: 'Đóng' });
          fireEvent.touchStart(closeBtn, { touches: [{ clientY: 100 }] });
          fireEvent.touchEnd(closeBtn, { changedTouches: [{ clientY: 200 }] });
        },
      },
    ];

    for (const trigger of triggers) {
      const bars = createBarsLockHelper();
      const onClose = vi.fn();
      const opener = document.createElement('button');
      document.body.appendChild(opener);
      opener.focus();

      const { rerender, unmount } = render(
        <BarsContext.Provider value={bars.value}>
          <Sheet open closeDisabled onClose={onClose} title="Tiêu đề sheet">
            <button type="button">Bên trong</button>
          </Sheet>
        </BarsContext.Provider>,
      );

      act(() => {
        vi.advanceTimersByTime(50);
      });
      const dialog = screen.getByRole('dialog');
      expect(bars.isHeld()).toBe(true);
      expect(dialog.contains(document.activeElement)).toBe(true);

      // While closeDisabled is true, none of the four triggers closes or releases the lock or moves focus
      for (const t of triggers) {
        t.fire(dialog);
      }
      expect(onClose).not.toHaveBeenCalled();
      expect(bars.isHeld()).toBe(true);
      expect(dialog.contains(document.activeElement)).toBe(true);

      // Rerender with closeDisabled=false: the current trigger now closes and releases the lock
      rerender(
        <BarsContext.Provider value={bars.value}>
          <Sheet open closeDisabled={false} onClose={onClose} title="Tiêu đề sheet">
            <button type="button">Bên trong</button>
          </Sheet>
        </BarsContext.Provider>,
      );

      trigger.fire(dialog);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(bars.isHeld()).toBe(false);
      expect(document.activeElement).toBe(opener);

      unmount();
      opener.remove();
    }
  });
});
