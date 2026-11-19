import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { VenueView } from '@monsport/shared';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookPage, VenuesPage } from './pages.tsx';
import { SessionProvider } from './session.tsx';

const NOTICE = 'App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.';

describe('Venues to BookPage (F-017, F-033)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
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
        <SessionProvider>
          <Routes>
            <Route path="/san" element={<VenuesPage />} />
            <Route path="/san/:id" element={<BookPage />} />
          </Routes>
        </SessionProvider>
      </MemoryRouter>,
    );
  }

  it('AC-7: guest opens /san, sees 2 venue cards linking to /san/<id>, and clicking one opens its SlotGrid and full UC-2 notice', async () => {
    setupFetch();
    const { container } = renderAt('/san');

    const link1 = await screen.findByRole('link', { name: /Cầu lông A/ });
    const link2 = screen.getByRole('link', { name: /Bóng đá Phương Nam/ });
    expect(link1.getAttribute('href')).toBe('/san/v1');
    expect(link2.getAttribute('href')).toBe('/san/v2');
    expect(screen.getAllByText(NOTICE)).toHaveLength(1);
    expect(screen.getByText('từ 50k/giờ')).toBeTruthy();
    expect(screen.getByText('2 sân')).toBeTruthy();
    expect(container.querySelectorAll('.venue-card')).toHaveLength(2);

    fireEvent.click(link1);
    expect(await screen.findByRole('heading', { name: 'Cầu lông A' })).toBeTruthy();
    expect(container.querySelector('.slot-grid')).toBeTruthy();
    expect(screen.getAllByText(NOTICE)).toHaveLength(1);
  });

  it('a venue whose court is "Sân Đông", typing "san dong" shows that venue and does not preselect a court', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T22:30:00Z'));
    setupFetch();
    renderAt('/san');

    expect(await screen.findByText('Cầu lông A')).toBeTruthy();
    expect(screen.getByText('Bóng đá Phương Nam')).toBeTruthy();

    const searchInput = screen.getByLabelText('Tìm theo tên sân');
    fireEvent.change(searchInput, { target: { value: 'san dong' } });

    const list = screen.getByRole('list', { name: 'Danh sách đơn vị' });
    expect(within(list).getByText('Bóng đá Phương Nam')).toBeTruthy();
    expect(within(list).queryByText('Cầu lông A')).toBeNull();

    fireEvent.click(within(list).getByRole('link', { name: /Bóng đá Phương Nam/ }));
    expect(await screen.findByRole('heading', { name: 'Bóng đá Phương Nam' })).toBeTruthy();
    expect(screen.getAllByText('Chưa chọn')).toHaveLength(2);
  });
});
