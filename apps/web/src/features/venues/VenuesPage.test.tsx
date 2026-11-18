import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { VenueView } from '@monsport/shared';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VenuesPage } from './VenuesPage.tsx';

describe('VenuesPage (F-033)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const venues: VenueView[] = [
    {
      id: 'v1',
      name: 'Cầu lông A',
      address: '123 Đường 3/2',
      phone: '0912345678',
      opensAt: 360,
      closesAt: 1380,
      courts: [
        { id: 'c1', name: 'Sân 1', sport: 'BADMINTON', priceNormal: 50_000, pricePeak: 70_000 },
        { id: 'c2', name: 'Sân 2', sport: 'BADMINTON', priceNormal: 60_000, pricePeak: 80_000 },
      ],
    },
    {
      id: 'v2',
      name: 'Bóng đá Phương Nam',
      address: '456 Lê Lợi',
      phone: '0988888888',
      opensAt: 360,
      closesAt: 1380,
      courts: [
        { id: 'c3', name: 'Sân Đông', sport: 'FOOTBALL', priceNormal: 200_000, pricePeak: 300_000 },
      ],
    },
  ];

  function setupFetch() {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ message: 'Bạn cần đăng nhập' }) });
      }
      if (url === '/api/venues') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(venues) });
      }
      if (url.includes('/availability')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ courtId: 'c1', free: [] }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/san" element={<VenuesPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('prefills court-name search from ?q= query param and filters venues', async () => {
    setupFetch();
    renderAt('/san?q=san+dong');

    const list = await screen.findByRole('list', { name: 'Danh sách đơn vị' });
    const searchInput = screen.getByLabelText('Tìm theo tên sân') as HTMLInputElement;
    expect(searchInput.value).toBe('san dong');
    expect(within(list).getByText('Bóng đá Phương Nam')).toBeTruthy();
    expect(within(list).queryByText('Cầu lông A')).toBeNull();
  });

  it('filters venues by sport chips on /san', async () => {
    setupFetch();
    renderAt('/san');

    const list = await screen.findByRole('list', { name: 'Danh sách đơn vị' });
    expect(within(list).getAllByRole('link')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Bóng đá' }));
    expect(within(list).queryByText('Cầu lông A')).toBeNull();
    expect(within(list).getByText('Bóng đá Phương Nam')).toBeTruthy();
  });
});
