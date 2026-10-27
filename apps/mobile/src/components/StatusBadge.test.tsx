import type { BookingStatus } from '@monsport/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge.tsx';

describe('StatusBadge', () => {
  afterEach(cleanup);

  const cases: Array<[BookingStatus, string, string]> = [
    ['PENDING', 'Chờ xác nhận', 'badge-wait'],
    ['CONFIRMED', 'Đã xác nhận', 'badge-ok'],
    ['REJECTED', 'Bị từ chối', 'badge-no'],
    ['EXPIRED', 'Hết hạn', 'badge-off'],
    ['CANCELLED', 'Đã hủy', 'badge-off'],
  ];

  it.each(cases)('shows the icon, word, and token class for %s', (status, label, token) => {
    const { container } = render(<StatusBadge status={status} />);
    const text = screen.getByText(label);
    const badge = text.closest('span.badge') ?? container.firstElementChild!;
    expect(badge.classList.contains(token)).toBe(true);
    expect(badge.querySelector('svg')).not.toBeNull();
  });
});
