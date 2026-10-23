import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionBar } from './ActionBar';

describe('ActionBar', () => {
  it('renders title, price, and action button', () => {
    const handleAction = vi.fn();
    render(
      <ActionBar
        title="Sân 1 · 20:00–21:00"
        price="120.000đ"
        actionLabel="Gửi yêu cầu"
        onAction={handleAction}
      />,
    );

    expect(screen.getByText('Sân 1 · 20:00–21:00')).toBeDefined();
    expect(screen.getByText('120.000đ')).toBeDefined();

    const btn = screen.getByRole('button', { name: 'Gửi yêu cầu' });
    fireEvent.click(btn);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when visible is false', () => {
    const { container } = render(
      <ActionBar
        visible={false}
        title="Sân 1"
        actionLabel="Gửi yêu cầu"
        onAction={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('moves down with translateY(72px) when hidden is true', () => {
    const { container } = render(
      <ActionBar
        hidden
        title="Sân 1"
        actionLabel="Gửi yêu cầu"
        onAction={vi.fn()}
      />,
    );
    const aside = container.querySelector('aside');
    expect(aside?.style.transform).toBe('translateY(72px)');
  });
});
