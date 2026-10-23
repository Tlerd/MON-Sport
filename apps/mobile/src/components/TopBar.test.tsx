import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopBar } from './TopBar';

describe('TopBar', () => {
  it('renders default logo when no title or onBack is passed', () => {
    render(<TopBar />);
    expect(screen.getByText('monsport')).toBeDefined();
  });

  it('renders title and back button when onBack is passed', () => {
    const handleBack = vi.fn();
    render(<TopBar title="Chi tiết" onBack={handleBack} />);

    expect(screen.getByRole('heading', { name: 'Chi tiết' })).toBeDefined();
    const backBtn = screen.getByRole('button', { name: 'Quay lại' });
    fireEvent.click(backBtn);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('renders actions when provided', () => {
    render(<TopBar actions={<button type="button">Tìm kiếm</button>} />);
    expect(screen.getByText('Tìm kiếm')).toBeDefined();
  });

  it('applies translateY(-100%) when hidden is true', () => {
    const { container } = render(<TopBar hidden />);
    const header = container.querySelector('header');
    expect(header?.style.transform).toBe('translateY(-100%)');
  });
});
