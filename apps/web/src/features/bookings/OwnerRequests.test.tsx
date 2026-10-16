import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OwnerRequests } from './OwnerRequests.tsx';

const PENDING = {
  id: '0199a1b2-0000-7000-8000-000000000003', courtId: '0199a1b2-0000-7000-8000-000000000002',
  startAt: '2026-11-20T13:00:00.000Z', endAt: '2026-11-20T14:00:00.000Z', status: 'PENDING', source: 'APP',
  priceTotal: 120_000, confirmDeadline: '2026-11-20T05:00:00.000Z', confirmedAt: null, createdAt: '2026-11-20T03:00:00.000Z',
  customer: { name: 'An', phone: '0901234567' },
};

describe('OwnerRequests', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-21: Bình confirms the request of An, and the row shows "Đã xác nhận"', async () => {
    const fetch = vi.fn((url: string) => {
      const body = url === '/api/owner/bookings' ? [PENDING] : { ...PENDING, customer: undefined, status: 'CONFIRMED', confirmedAt: '2026-11-20T04:00:00.000Z' };
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    });
    vi.stubGlobal('fetch', fetch);
    render(<OwnerRequests />);

    expect(await screen.findByText('0901234567')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByText('Đã xác nhận')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(`/api/owner/bookings/${PENDING.id}/confirm`, expect.objectContaining({ method: 'POST' }));
    expect(screen.queryByRole('button', { name: 'Xác nhận' })).toBeNull();
  });
});
