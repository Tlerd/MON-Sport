import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TabBar } from './TabBar';

describe('TabBar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders player tabs for USER role and guest (null)', () => {
    const handleSelect = vi.fn();
    render(<TabBar role="USER" activePath="/" onSelect={handleSelect} unreadNotifications={3} />);

    expect(screen.getByRole('button', { name: 'Đặt sân' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Phòng chờ' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Lịch của tôi' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Thông báo' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Tôi' })).toBeDefined();

    // Check notification badge count
    expect(screen.getByText('3')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Phòng chờ' }));
    expect(handleSelect).toHaveBeenCalledWith('/phong-cho');
  });

  it('renders owner tabs for OWNER role', () => {
    const handleSelect = vi.fn();
    render(<TabBar role="OWNER" activePath="/chu-san/yeu-cau" onSelect={handleSelect} pendingRequests={5} />);

    expect(screen.getByRole('button', { name: 'Yêu cầu' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Lịch sân' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Doanh thu' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Thông báo' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Tôi' })).toBeDefined();

    // Check request badge count
    expect(screen.getByText('5')).toBeDefined();
  });

  it('renders nothing for ADMIN role', () => {
    const { container } = render(<TabBar role="ADMIN" activePath="/" onSelect={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders user initial avatar when provided', () => {
    render(<TabBar role="USER" activePath="/toi" onSelect={vi.fn()} userInitial="A" />);
    expect(screen.getByText('A')).toBeDefined();
  });
});
