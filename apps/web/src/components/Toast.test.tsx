import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './Toast.tsx';

function Demo() {
  const { toast, comingSoon } = useToast();
  return (
    <div>
      <button type="button" onClick={comingSoon}>
        Sắp ra mắt btn
      </button>
      <button type="button" onClick={() => toast('Đã lưu thay đổi', 'ok')}>
        Lưu btn
      </button>
    </div>
  );
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('AC-1: comingSoon shows "Sắp ra mắt" in role="status" and clears after 3400 ms', () => {
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');

    fireEvent.click(screen.getByRole('button', { name: 'Sắp ra mắt btn' }));
    const item = status.querySelector('.toast');
    expect(item?.textContent).toBe('Sắp ra mắt');

    act(() => {
      vi.advanceTimersByTime(3399);
    });
    expect(status.querySelector('.toast')?.textContent).toBe('Sắp ra mắt');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(status.querySelector('.toast')).toBeNull();
  });

  it('AC-1: toast renders a message with optional tone class and auto-clears', () => {
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lưu btn' }));
    const item = screen.getByRole('status').querySelector('.toast.ok');
    expect(item?.textContent).toBe('Đã lưu thay đổi');

    act(() => {
      vi.advanceTimersByTime(3400);
    });
    expect(screen.getByRole('status').querySelector('.toast')).toBeNull();
  });

  it('AC-1: useToast outside ToastProvider returns a safe no-op fallback', () => {
    render(<Demo />);
    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Sắp ra mắt btn' }));
      fireEvent.click(screen.getByRole('button', { name: 'Lưu btn' }));
    }).not.toThrow();
  });
});
