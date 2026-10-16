import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MyVenues } from './MyVenues.tsx';

const court = (id: string, name: string) => ({ id, name, sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 });
const CAU_LONG_A = {
  id: '0199a1b2-0000-7000-8000-000000000001', name: 'Cầu lông A', address: '12 Lê Lợi', phone: '0912345678', opensAt: 360, closesAt: 1380,
  courts: [court('0199a1b2-0000-7000-8000-000000000002', 'Sân 1'), court('0199a1b2-0000-7000-8000-000000000003', 'Sân 2')],
};

describe('MyVenues', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-28: Bình sees "Cầu lông A" with its courts and prices, and no other venue', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([CAU_LONG_A]) });
    vi.stubGlobal('fetch', fetch);
    render(<MyVenues />);

    const venue = await screen.findByRole('article', { name: 'Cầu lông A' });
    expect(fetch).toHaveBeenCalledWith('/api/owner/venues', expect.anything());
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(within(venue).getByText('06:00–23:00')).toBeTruthy();
    for (const name of ['Sân 1', 'Sân 2']) {
      const row = within(venue).getByText(name).closest('li')!;
      expect(within(row as HTMLElement).getByText('80.000đ')).toBeTruthy();
      expect(within(row as HTMLElement).getByText('120.000đ')).toBeTruthy();
    }
  });

  it('says so when the owner has no venue yet', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([]) }));
    render(<MyVenues />);
    expect(await screen.findByText('Bạn chưa có đơn vị nào. Admin gắn đơn vị cho tài khoản của bạn.')).toBeTruthy();
  });
});
