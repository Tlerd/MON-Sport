import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FinancialDashboardView, VenueView } from '@monsport/shared';
import { FinancialDashboard } from './FinancialDashboard.tsx';

// Mock Recharts ResponsiveContainer for JSDOM
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>();
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div className="recharts-responsive-container" style={{ width: 600, height: 300 }}>
        {children}
      </div>
    ),
  };
});

const VENUE: VenueView = {
  id: '0199a1b2-0000-7000-8000-000000000001',
  name: 'Cầu lông A',
  address: '123 Đường 3/2, Quận 10',
  phone: '0901234567',
  opensAt: 360,
  closesAt: 1380,
  courts: [],
};

const FINANCIAL_DATA: FinancialDashboardView = {
  venueId: VENUE.id,
  venueName: 'Cầu lông A',
  period: 'week',
  date: '2026-11-20',
  startDate: '2026-11-16T00:00:00.000Z',
  endDate: '2026-11-22T23:59:59.999Z',
  revenue: 960_000,
  totalBookings: 10,
  paidBookings: 8,
  unpaidBookings: 2,
  bookedHours: 10,
  openingHours: 238,
  occupancyRate: 0.042,
  peakHours: 4,
  normalHours: 6,
  cancelledBookings: 2,
  rejectedBookings: 1,
  cancellationRate: 0.1538,
  rejectionRate: 0.0769,
  totalCustomers: 5,
  returningCustomers: 2,
  chartData: [
    { label: 'T2 16/11', revenue: 240_000, bookedHours: 2, bookingCount: 2 },
    { label: 'T3 17/11', revenue: 120_000, bookedHours: 1, bookingCount: 1 },
    { label: 'T4 18/11', revenue: 0, bookedHours: 0, bookingCount: 0 },
    { label: 'T5 19/11', revenue: 240_000, bookedHours: 2, bookingCount: 2 },
    { label: 'T6 20/11', revenue: 360_000, bookedHours: 3, bookingCount: 3 },
    { label: 'T7 21/11', revenue: 0, bookedHours: 0, bookingCount: 0 },
    { label: 'CN 22/11', revenue: 0, bookedHours: 2, bookingCount: 2 },
  ],
};

describe('FinancialDashboard', () => {
  beforeEach(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-11: displays metric cards and week chart for venue owner', async () => {
    const fetch = vi.fn((url: string) => {
      if (url === '/api/owner/venues') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([VENUE]) });
      }
      if (url.startsWith(`/api/owner/venues/${VENUE.id}/financials`)) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(FINANCIAL_DATA) });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ message: 'Not found' }) });
    });
    vi.stubGlobal('fetch', fetch);

    render(<FinancialDashboard />);

    expect(await screen.findByRole('heading', { name: 'Báo cáo tài chính' })).toBeTruthy();
    expect(await screen.findByText('960.000đ')).toBeTruthy();
    expect(screen.getByText('10 giờ')).toBeTruthy();
    expect(screen.getByText('4.2%')).toBeTruthy();
    expect(screen.getByText('4h / 6h')).toBeTruthy();
    expect(screen.getByText('2/5 khách')).toBeTruthy();
    expect(screen.getByText('Hủy 15.4% / Từ chối 7.7%')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Biểu đồ theo tuần' })).toBeTruthy();
  });

  it('switches period between day, week, and month', async () => {
    const fetch = vi.fn((url: string) => {
      if (url === '/api/owner/venues') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([VENUE]) });
      }
      if (url.includes('period=month')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ...FINANCIAL_DATA, period: 'month' }),
        });
      }
      if (url.startsWith(`/api/owner/venues/${VENUE.id}/financials`)) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(FINANCIAL_DATA) });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ message: 'Not found' }) });
    });
    vi.stubGlobal('fetch', fetch);

    render(<FinancialDashboard />);
    expect(await screen.findByText('960.000đ')).toBeTruthy();

    const monthBtn = screen.getByRole('button', { name: 'Tháng' });
    fireEvent.click(monthBtn);

    expect(await screen.findByRole('heading', { name: 'Biểu đồ theo tháng' })).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('period=month'),
      expect.anything(),
    );
  });

  it('shows empty message when owner has no venues', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/owner/venues') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ message: 'Not found' }) });
    }));

    render(<FinancialDashboard />);
    expect(await screen.findByText('Bạn chưa có đơn vị nào để xem báo cáo tài chính.')).toBeTruthy();
  });
});
