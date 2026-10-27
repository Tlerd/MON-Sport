import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionBar } from './ActionBar';

describe('ActionBar', () => {
  afterEach(cleanup);

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

  it('renders the secondary link next to the primary button', () => {
    render(
      <ActionBar
        title="Sân 1"
        actionLabel="Gửi yêu cầu"
        onAction={vi.fn()}
        secondary={{ label: 'Gọi chủ sân', href: 'tel:0912345678' }}
      />,
    );
    const link = screen.getByRole('link', { name: 'Gọi chủ sân' });
    expect(link.getAttribute('href')).toBe('tel:0912345678');
    expect(link.style.width).toBe('44px');
    expect(link.style.height).toBe('44px');
    expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('button', { name: 'Gửi yêu cầu' })).toBeDefined();
  });

  it('renders no link without the secondary prop', () => {
    render(<ActionBar title="Sân 1" actionLabel="Gửi yêu cầu" onAction={vi.fn()} />);
    expect(screen.queryByRole('link')).toBeNull();
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
