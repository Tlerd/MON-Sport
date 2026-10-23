import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders message and triggers action button', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        message="Chưa có booking."
        actionLabel="Đặt sân"
        onAction={handleAction}
      />,
    );

    expect(screen.getByText('Chưa có booking.')).toBeDefined();
    const btn = screen.getByRole('button', { name: 'Đặt sân' });
    fireEvent.click(btn);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });
});
