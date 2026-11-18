import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/Toast.tsx';
import { OwnerOverview } from './OwnerOverview.tsx';

describe('OwnerOverview', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-9: fetches ?status=PENDING and ?status=CONFIRMED, counts 2 pending and 1 confirmed today, and shows no money amount', async () => {
    const now = new Date('2026-11-20T05:00:00.000Z');
    const pending = [
      {
        id: 'p1',
        courtId: 'c1',
        startAt: '2026-11-20T11:00:00.000Z',
        endAt: '2026-11-20T12:00:00.000Z',
        status: 'PENDING',
        source: 'APP',
        priceTotal: 150000,
        confirmDeadline: '2026-11-20T06:00:00.000Z',
        confirmedAt: null,
        cancelledAt: null,
        createdAt: '2026-11-20T04:00:00.000Z',
        paidAtVenue: false,
        customer: { name: 'Nguyễn An', phone: '0901112222' },
      },
      {
        id: 'p2',
        courtId: 'c2',
        startAt: '2026-11-21T11:00:00.000Z',
        endAt: '2026-11-21T12:00:00.000Z',
        status: 'PENDING',
        source: 'APP',
        priceTotal: 180000,
        confirmDeadline: '2026-11-20T07:00:00.000Z',
        confirmedAt: null,
        cancelledAt: null,
        createdAt: '2026-11-20T04:10:00.000Z',
        paidAtVenue: false,
        customer: { name: 'Trần Bình', phone: '0903334444' },
      },
    ];
    const confirmed = [
      {
        id: 'c1-today',
        courtId: 'c1',
        startAt: '2026-11-20T12:00:00.000Z',
        endAt: '2026-11-20T13:00:00.000Z',
        status: 'CONFIRMED',
        source: 'APP',
        priceTotal: 200000,
        confirmDeadline: null,
        confirmedAt: '2026-11-20T04:30:00.000Z',
        cancelledAt: null,
        createdAt: '2026-11-20T04:00:00.000Z',
        paidAtVenue: false,
        customer: { name: 'Lê Chi', phone: '0905556666' },
      },
      {
        id: 'c2-tomorrow',
        courtId: 'c2',
        startAt: '2026-11-21T12:00:00.000Z',
        endAt: '2026-11-21T13:00:00.000Z',
        status: 'CONFIRMED',
        source: 'PHONE',
        priceTotal: 220000,
        confirmDeadline: null,
        confirmedAt: '2026-11-20T04:40:00.000Z',
        cancelledAt: null,
        createdAt: '2026-11-20T04:20:00.000Z',
        paidAtVenue: false,
        customer: { name: 'Phạm Dũng', phone: '0907778888' },
      },
    ];

    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/owner/bookings?status=PENDING') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(pending) });
      }
      if (url === '/api/owner/bookings?status=CONFIRMED') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(confirmed) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <OwnerOverview now={now} />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Tổng quan' })).toBeTruthy();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/owner/bookings?status=PENDING', expect.anything());
      expect(fetchMock).toHaveBeenCalledWith('/api/owner/bookings?status=CONFIRMED', expect.anything());
    });

    const pendingTile = screen.getByText('Yêu cầu chờ duyệt').closest('.tile') as HTMLElement;
    expect(pendingTile).toBeTruthy();
    expect(pendingTile.classList.contains('warn')).toBe(true);
    expect(within(pendingTile).getByText('2')).toBeTruthy();

    const todayTile = screen.getByText('Lượt đặt hôm nay').closest('.tile') as HTMLElement;
    expect(todayTile).toBeTruthy();
    expect(within(todayTile).getByText('1')).toBeTruthy();

    expect(screen.getByRole('heading', { name: 'Yêu cầu sắp tới' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Yêu cầu mới nhất' })).toBeNull();
    expect(screen.getByText(/Nguyễn An/)).toBeTruthy();
    expect(screen.getByText(/Trần Bình/)).toBeTruthy();

    const processLink = screen.getByRole('link', { name: 'Xử lý yêu cầu' });
    expect(processLink.getAttribute('href')).toBe('/chu-san/yeu-cau');

    const revenueHeading = screen.getByRole('heading', { name: 'Doanh thu 7 ngày' });
    const revenueCard = revenueHeading.closest('section') as HTMLElement;
    expect(within(revenueCard).getByText('Sắp ra mắt')).toBeTruthy();

    expect(container.textContent).not.toMatch(/\d\s*đ\b/i);
    expect(container.textContent).not.toContain('150.000');
    expect(container.textContent).not.toContain('180.000');
    expect(container.textContent).not.toContain('200.000');
  });
});
