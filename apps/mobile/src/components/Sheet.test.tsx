import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

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

  it('renders nothing when open is false', () => {
    const { container } = render(
      <Sheet open={false} onClose={vi.fn()} title="Tiêu đề">
        <div>Nội dung</div>
      </Sheet>,
    );
    expect(container.firstChild).toBeNull();
  });
});
