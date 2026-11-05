import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import type { FinancialChartPoint, FinancialDashboardView, FinancialPeriod, VenueView } from '@monsport/shared';
import { BarsProvider } from '../../app/bars';
import * as sessionModule from '../../app/session';
import { BAR_MAX_HEIGHT_PX } from './RevenueChart';
import { RevenueScreen } from './RevenueScreen';

vi.mock('@monsport/client', async () => {
  const actual = await vi.importActual<typeof import('@monsport/client')>('@monsport/client');
  return {
    ...actual,
    api: vi.fn(),
  };
});

type User = sessionModule.SessionContextType['user'];

const USER: User = { id: 'u1', name: 'An', role: 'USER' };
const OWNER: User = { id: 'o1', name: 'Bình', role: 'OWNER' };
const ADMIN: User = { id: 'a1', name: 'Admin', role: 'ADMIN' };

const NOW_ISO = '2026-11-06T15:10:00+07:00';
const TODAY = '2026-11-06';

const VA = '00000000-0000-4000-8000-000000000010';
const VB = '00000000-0000-4000-8000-000000000020';
const C1 = '00000000-0000-4000-8000-000000000001';
const CB1 = '00000000-0000-4000-8000-000000000003';

const VENUE_A: VenueView = {
  id: VA,
  name: 'Cầu lông A',
  address: 'Quận 1',
  phone: '0912345678',
  opensAt: 480,
  closesAt: 960,
  courts: [
    { id: C1, name: 'Sân 1', sport: 'BADMINTON', priceNormal: 100000, pricePeak: 150000 },
  ],
};

const VENUE_B: VenueView = {
  id: VB,
  name: 'Bóng đá B',
  address: 'Quận 2',
  phone: '0987654321',
  opensAt: 360,
  closesAt: 1320,
  courts: [
    { id: CB1, name: 'Sân B1', sport: 'FOOTBALL', priceNormal: 300000, pricePeak: 500000 },
  ],
};

const WEEK_CHART: FinancialChartPoint[] = [
  { label: 'T2 02/11', revenue: 0, bookedHours: 0, bookingCount: 0 },
  { label: 'T3 03/11', revenue: 120000, bookedHours: 2, bookingCount: 2 },
  { label: 'T4 04/11', revenue: 0, bookedHours: 0, bookingCount: 0 },
  { label: 'T5 05/11', revenue: 320000, bookedHours: 4, bookingCount: 3 },
  { label: 'T6 06/11', revenue: 200000, bookedHours: 3, bookingCount: 2 },
  { label: 'T7 07/11', revenue: 160000, bookedHours: 2.5, bookingCount: 2 },
  { label: 'CN 08/11', revenue: 160000, bookedHours: 2.5, bookingCount: 1 },
];

function mkFinancials(over: Partial<FinancialDashboardView> = {}): FinancialDashboardView {
  return {
    venueId: VA,
    venueName: 'Cầu lông A',
    period: 'week',
    date: TODAY,
    startDate: '2026-11-01T17:00:00.000Z',
    endDate: '2026-11-08T16:59:59.999Z',
    revenue: 960000,
    totalBookings: 13,
    paidBookings: 8,
    unpaidBookings: 2,
    bookedHours: 14,
    openingHours: 56,
    occupancyRate: 0.25,
    peakHours: 6,
    normalHours: 8,
    cancelledBookings: 2,
    rejectedBookings: 1,
    cancellationRate: 0.1538,
    rejectionRate: 0.0769,
    totalCustomers: 5,
    returningCustomers: 2,
    chartData: WEEK_CHART,
    ...over,
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const calls = (path: string) => vi.mocked(clientModule.api).mock.calls.filter((c) => c[0] === path);

function Probe() {
  const location = useLocation();
  return (
    <>
      <p data-testid="path">{location.pathname}</p>
      <RevenueScreen />
    </>
  );
}

function Shell() {
  return (
    <BarsProvider>
      <Outlet context={{}} />
    </BarsProvider>
  );
}

function renderScreen(user: User = OWNER) {
  vi.spyOn(sessionModule, 'useSession').mockReturnValue({
    user,
    setUser: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    loading: false,
  });
  return render(
    <MemoryRouter initialEntries={['/chu-san/doanh-thu']}>
      <Routes>
        <Route element={<Shell />}>
          <Route path="*" element={<Probe />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function mockStandardApi(options?: {
  venues?: () => unknown;
  financials?: (venueId: string, period: FinancialPeriod, date: string) => unknown;
}) {
  vi.mocked(clientModule.api).mockImplementation((async (path: string, init?: { method?: string; json?: unknown }) => {
    if (path === '/api/owner/venues') {
      return options?.venues ? options.venues() : [VENUE_A];
    }
    if (path === '/api/auth/login' && init?.method === 'POST') {
      return { user: OWNER };
    }
    const m = /^\/api\/owner\/venues\/([^/]+)\/financials\?period=(day|week|month)&date=(\d{4}-\d{2}-\d{2})$/.exec(
      path,
    );
    if (m) {
      const [, venueId, period, date] = m;
      if (options?.financials) {
        return options.financials(venueId!, period as FinancialPeriod, date!);
      }
      return mkFinancials({
        venueId: venueId!,
        period: period as FinancialPeriod,
        date: date!,
      });
    }
    throw new ApiError(404, `Unexpected ${path}`);
  }) as never);
}

describe('RevenueScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW_ISO));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC-1: calls financials API once with period=week and date=2026-11-06, selects "Tuần", formats week heading from UTC instants via vnDateString, and renders revenue and 5 metric cards', async () => {
    mockStandardApi();
    renderScreen(OWNER);

    const revenueCard = await screen.findByRole('article', { name: 'Doanh thu' });
    expect(screen.getByRole('heading', { name: 'Tuần 02/11–08/11/2026' })).toBeDefined();
    expect(calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-11-06`)).toHaveLength(1);

    const periodGroup = screen.getByRole('group', { name: 'Kỳ' });
    expect(within(periodGroup).getByRole('button', { name: 'Tuần' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(periodGroup).getByRole('button', { name: 'Ngày' }).getAttribute('aria-pressed')).toBe('false');
    expect(within(periodGroup).getByRole('button', { name: 'Tháng' }).getAttribute('aria-pressed')).toBe('false');

    expect(within(revenueCard).getByText('960.000đ')).toBeDefined();
    expect(within(revenueCard).getByText('8 đã thu · 2 chưa thu')).toBeDefined();

    expect(screen.getByRole('article', { name: 'Giờ đã đặt' }).textContent).toBe('Giờ đã đặt 14 giờ');
    expect(screen.getByRole('article', { name: 'Lấp đầy' }).textContent).toBe('Lấp đầy 25%');
    expect(screen.getByRole('article', { name: 'Hủy' }).textContent).toBe('Hủy 15%');
    expect(screen.getByRole('article', { name: 'Từ chối' }).textContent).toBe('Từ chối 8%');
    expect(screen.getByRole('article', { name: 'Khách quay lại' }).textContent).toBe('Khách quay lại 2/5');
  });

  it('AC-2: clicking "Ngày" then "Tháng" calls financials API with period=day then period=month, updates heading, and sets aria-pressed="true" on selected chip', async () => {
    mockStandardApi();
    renderScreen(OWNER);

    await screen.findByRole('heading', { name: 'Tuần 02/11–08/11/2026' });
    const periodGroup = screen.getByRole('group', { name: 'Kỳ' });

    fireEvent.click(within(periodGroup).getByRole('button', { name: 'Ngày' }));
    expect(await screen.findByRole('heading', { name: 'Thứ Sáu, 06/11/2026' })).toBeDefined();
    expect(calls(`/api/owner/venues/${VA}/financials?period=day&date=2026-11-06`)).toHaveLength(1);
    expect(within(periodGroup).getByRole('button', { name: 'Ngày' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(periodGroup).getByRole('button', { name: 'Tuần' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(within(periodGroup).getByRole('button', { name: 'Tháng' }));
    expect(await screen.findByRole('heading', { name: 'Tháng 11/2026' })).toBeDefined();
    expect(calls(`/api/owner/venues/${VA}/financials?period=month&date=2026-11-06`)).toHaveLength(1);
    expect(within(periodGroup).getByRole('button', { name: 'Tháng' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(periodGroup).getByRole('button', { name: 'Ngày' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('AC-3: shifts period date with "Kỳ trước" and "Kỳ sau" by week, month, and day, and disables "Kỳ sau" when the viewed period contains today', async () => {
    mockStandardApi();
    renderScreen(OWNER);

    await screen.findByRole('heading', { name: 'Tuần 02/11–08/11/2026' });
    const prevBtn = screen.getByRole('button', { name: 'Kỳ trước' }) as HTMLButtonElement;
    const nextBtn = screen.getByRole('button', { name: 'Kỳ sau' }) as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);

    // Week: back twice (2026-10-30, 2026-10-23), then forward once (2026-10-30), then forward to 2026-11-06
    fireEvent.click(prevBtn);
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-10-30`)).toHaveLength(1),
    );
    expect(nextBtn.disabled).toBe(false);

    fireEvent.click(prevBtn);
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-10-23`)).toHaveLength(1),
    );

    fireEvent.click(nextBtn);
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-10-30`)).toHaveLength(2),
    );
    expect(nextBtn.disabled).toBe(false);

    fireEvent.click(nextBtn);
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-11-06`)).toHaveLength(2),
    );
    expect(nextBtn.disabled).toBe(true);

    // Month: shift by month
    fireEvent.click(screen.getByRole('button', { name: 'Tháng' }));
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VA}/financials?period=month&date=2026-11-06`)).toHaveLength(1),
    );
    expect(nextBtn.disabled).toBe(true);

    fireEvent.click(prevBtn);
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VA}/financials?period=month&date=2026-10-06`)).toHaveLength(1),
    );
    expect(nextBtn.disabled).toBe(false);

    fireEvent.click(nextBtn);
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VA}/financials?period=month&date=2026-11-06`)).toHaveLength(2),
    );
    expect(nextBtn.disabled).toBe(true);

    // Day: shift by day
    fireEvent.click(screen.getByRole('button', { name: 'Ngày' }));
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VA}/financials?period=day&date=2026-11-06`)).toHaveLength(1),
    );
    expect(nextBtn.disabled).toBe(true);

    fireEvent.click(prevBtn);
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VA}/financials?period=day&date=2026-11-05`)).toHaveLength(1),
    );
    expect(nextBtn.disabled).toBe(false);

    fireEvent.click(nextBtn);
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VA}/financials?period=day&date=2026-11-06`)).toHaveLength(2),
    );
    expect(nextBtn.disabled).toBe(true);
  });

  it('AC-4: renders 7 chart bars scaled by revenue / max (min 2px), keeps labels on 0-revenue bars, and sets aria-label with formatVnd', async () => {
    mockStandardApi();
    renderScreen(OWNER);

    const chart = await screen.findByRole('region', { name: 'Biểu đồ doanh thu' });
    const bars = within(chart).getAllByRole('img');
    expect(bars).toHaveLength(7);

    expect(bars.map((b) => b.getAttribute('aria-label'))).toEqual([
      'T2 02/11: 0đ',
      'T3 03/11: 120.000đ',
      'T4 04/11: 0đ',
      'T5 05/11: 320.000đ',
      'T6 06/11: 200.000đ',
      'T7 07/11: 160.000đ',
      'CN 08/11: 160.000đ',
    ]);

    const expectedRatios = [0, 120000 / 320000, 0, 1, 200000 / 320000, 160000 / 320000, 160000 / 320000];
    bars.forEach((bar, i) => {
      const r = expectedRatios[i]!;
      const expectedPx = Math.max(2, Math.round(r * BAR_MAX_HEIGHT_PX));
      expect(bar.style.height).toBe(`${expectedPx}px`);
    });

    for (const point of WEEK_CHART) {
      expect(within(chart).getByText(point.label)).toBeDefined();
    }
  });

  it('AC-5: sorts venue chips by name, selects the first venue by name, fetches another venue on tap, and hides venue chips when owner has 1 venue', async () => {
    const venueSoccerB: VenueView = { ...VENUE_B, name: 'Sân bóng đá B' };
    mockStandardApi({
      venues: () => [venueSoccerB, VENUE_A, VENUE_B],
    });
    const { unmount } = renderScreen(OWNER);

    const venueGroup = await screen.findByRole('group', { name: 'Đơn vị' });
    const chips = within(venueGroup).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['Bóng đá B', 'Cầu lông A', 'Sân bóng đá B']);
    expect(chips[0]!.getAttribute('aria-pressed')).toBe('true');
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VB}/financials?period=week&date=2026-11-06`)).toHaveLength(1),
    );

    fireEvent.click(within(venueGroup).getByRole('button', { name: 'Cầu lông A' }));
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-11-06`)).toHaveLength(1),
    );
    expect(within(venueGroup).getByRole('button', { name: 'Cầu lông A' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(within(venueGroup).getByRole('button', { name: 'Bóng đá B' }));
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VB}/financials?period=week&date=2026-11-06`)).toHaveLength(2),
    );
    expect(within(venueGroup).getByRole('button', { name: 'Bóng đá B' }).getAttribute('aria-pressed')).toBe('true');

    unmount();
    mockStandardApi({ venues: () => [VENUE_A] });
    renderScreen(OWNER);
    await screen.findByRole('heading', { name: 'Tuần 02/11–08/11/2026' });
    expect(screen.queryByRole('group', { name: 'Đơn vị' })).toBeNull();
  });

  it('AC-9: drops stale financials replies when period, venue, or date changes before the previous request resolves', async () => {
    const pending = new Map<string, ReturnType<typeof deferred<FinancialDashboardView>>>();
    mockStandardApi({
      venues: () => [VENUE_A, { ...VENUE_B, name: 'Sân bóng đá B' }],
      financials: (venueId, period, date) => {
        const key = `${venueId}|${period}|${date}`;
        const d = deferred<FinancialDashboardView>();
        pending.set(key, d);
        return d.promise;
      },
    });
    renderScreen(OWNER);

    // 1. Initial load for VA | week | 2026-11-06 starts; switch to month before it resolves
    await waitFor(() => expect(pending.has(`${VA}|week|${TODAY}`)).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Tháng' }));
    await waitFor(() => expect(pending.has(`${VA}|month|${TODAY}`)).toBe(true));

    await act(async () => {
      pending.get(`${VA}|month|${TODAY}`)!.resolve(
        mkFinancials({ period: 'month', date: TODAY, revenue: 4500000 }),
      );
    });
    expect(await screen.findByText('4.500.000đ')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Tháng 11/2026' })).toBeDefined();

    // Late week reply arrives -> must be dropped
    await act(async () => {
      pending.get(`${VA}|week|${TODAY}`)!.resolve(
        mkFinancials({ period: 'week', date: TODAY, revenue: 960000 }),
      );
    });
    expect(screen.getByText('4.500.000đ')).toBeDefined();
    expect(screen.queryByText('960.000đ')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Tháng 11/2026' })).toBeDefined();

    // 2. Switch venue from VA to VB while a new VA request (prev month) is pending
    fireEvent.click(screen.getByRole('button', { name: 'Kỳ trước' }));
    await waitFor(() => expect(pending.has(`${VA}|month|2026-10-06`)).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: 'Sân bóng đá B' }));
    await waitFor(() => expect(pending.has(`${VB}|month|2026-10-06`)).toBe(true));

    await act(async () => {
      pending.get(`${VB}|month|2026-10-06`)!.resolve(
        mkFinancials({ venueId: VB, period: 'month', date: '2026-10-06', revenue: 7200000 }),
      );
    });
    expect(await screen.findByText('7.200.000đ')).toBeDefined();

    // Late VA | month | 2026-10-06 reply arrives -> must be dropped
    await act(async () => {
      pending.get(`${VA}|month|2026-10-06`)!.resolve(
        mkFinancials({ venueId: VA, period: 'month', date: '2026-10-06', revenue: 1100000 }),
      );
    });
    expect(screen.getByText('7.200.000đ')).toBeDefined();
    expect(screen.queryByText('1.100.000đ')).toBeNull();
  });

  it('AC-10: guest sees login prompt, USER redirects to /, neither calls owner APIs, and 401 opens session login sheet and reloads after login', async () => {
    vi.mocked(clientModule.api).mockResolvedValue([]);

    // 1. Guest
    const { unmount: unmountGuest } = renderScreen(null);
    expect(screen.getByText('Đăng nhập để xem doanh thu')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByRole('dialog', { name: 'Đăng nhập' })).toBeDefined();
    expect(vi.mocked(clientModule.api)).not.toHaveBeenCalled();
    unmountGuest();

    // 2. USER
    const { unmount: unmountUser } = renderScreen(USER);
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/'));
    expect(vi.mocked(clientModule.api)).not.toHaveBeenCalled();
    unmountUser();

    // 3. ADMIN
    const { unmount: unmountAdmin } = renderScreen(ADMIN);
    expect(screen.queryByRole('group', { name: 'Kỳ' })).toBeNull();
    expect(vi.mocked(clientModule.api)).not.toHaveBeenCalled();
    unmountAdmin();

    // 4. 401 on financials -> opens session login sheet and reloads after login
    let finCalls = 0;
    mockStandardApi({
      financials: () => {
        if (++finCalls === 1) throw new ApiError(401, 'Chưa đăng nhập');
        return mkFinancials();
      },
    });
    renderScreen(OWNER);

    const loginDialog = await screen.findByRole('dialog', { name: 'Đăng nhập' });
    expect(within(loginDialog).getByText('Phiên đăng nhập đã hết. Hãy đăng nhập lại.')).toBeDefined();

    fireEvent.change(within(loginDialog).getByLabelText('Số điện thoại'), {
      target: { value: '0912345678' },
    });
    fireEvent.change(within(loginDialog).getByLabelText('Mật khẩu'), {
      target: { value: 'password123' },
    });
    await act(async () => {
      fireEvent.click(within(loginDialog).getByRole('button', { name: 'Đăng nhập' }));
    });

    expect(await screen.findByText('960.000đ')).toBeDefined();
    expect(finCalls).toBe(2);
  });

  it('AC-11: handles venue load error with retry, financials load error with retry while keeping chips usable, and empty venue list', async () => {
    let venueCalls = 0;
    let finCalls = 0;
    mockStandardApi({
      venues: () => {
        if (++venueCalls === 1) throw new ApiError(500, 'Lỗi server');
        return [VENUE_A];
      },
      financials: () => {
        if (++finCalls === 1) throw new ApiError(500, 'Lỗi báo cáo');
        return mkFinancials();
      },
    });
    const { unmount } = renderScreen(OWNER);

    // 1. Venue error -> "Không tải được" + "Thử lại"
    expect(await screen.findByText('Không tải được')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    // 2. Financials error -> metrics block shows "Không tải được" + "Thử lại", period chips still usable
    expect(await screen.findByText('Không tải được')).toBeDefined();
    expect(screen.getByRole('group', { name: 'Kỳ' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByText('960.000đ')).toBeDefined();

    unmount();

    // 3. Empty venue list -> "Bạn chưa có đơn vị nào"
    mockStandardApi({ venues: () => [] });
    renderScreen(OWNER);
    expect(await screen.findByText('Bạn chưa có đơn vị nào')).toBeDefined();
  });

  it('AC-12: renders 0đ, 0% rates, and 2px minimum chart bars without dividing by 0 when period has no bookings', async () => {
    const zeroChart = WEEK_CHART.map((p) => ({ ...p, revenue: 0, bookedHours: 0, bookingCount: 0 }));
    mockStandardApi({
      financials: () =>
        mkFinancials({
          revenue: 0,
          totalBookings: 0,
          paidBookings: 0,
          unpaidBookings: 0,
          bookedHours: 0,
          occupancyRate: 0,
          cancelledBookings: 0,
          rejectedBookings: 0,
          cancellationRate: 0,
          rejectionRate: 0,
          totalCustomers: 0,
          returningCustomers: 0,
          chartData: zeroChart,
        }),
    });
    renderScreen(OWNER);

    const revenueCard = await screen.findByRole('article', { name: 'Doanh thu' });
    expect(within(revenueCard).getByText('0đ')).toBeDefined();
    expect(screen.getByRole('article', { name: 'Lấp đầy' }).textContent).toBe('Lấp đầy 0%');
    expect(screen.getByRole('article', { name: 'Hủy' }).textContent).toBe('Hủy 0%');
    expect(screen.getByRole('article', { name: 'Từ chối' }).textContent).toBe('Từ chối 0%');
    expect(screen.getByRole('article', { name: 'Khách quay lại' }).textContent).toBe('Khách quay lại 0/0');

    const chart = screen.getByRole('region', { name: 'Biểu đồ doanh thu' });
    const bars = within(chart).getAllByRole('img');
    expect(bars).toHaveLength(7);
    for (const bar of bars) {
      expect(bar.style.height).toBe('2px');
      expect(bar.getAttribute('data-ratio')).toBe('0');
    }
  });

  it('AC-13: wraps long venue names, keeps every button and chip at least 44px high, prevents horizontal overflow at 360px and 390px, and lays out metric cards in 2 columns', async () => {
    const longName = 'Đơn-vị-cầu-lông-rất-dài-'.repeat(12);
    mockStandardApi({
      venues: () => [
        { ...VENUE_A, name: longName },
        { ...VENUE_B, name: 'Sân bóng đá B' },
      ],
    });
    renderScreen(OWNER);

    const venueGroup = await screen.findByRole('group', { name: 'Đơn vị' });
    const longChip = within(venueGroup).getByRole('button', { name: longName });
    expect(longChip.style.minHeight).toBe('44px');
    expect(longChip.style.overflowWrap).toBe('anywhere');
    expect(longChip.style.whiteSpace).toBe('normal');

    const allButtons = screen.getAllByRole('button');
    for (const btn of allButtons) {
      expect(parseInt(btn.style.minHeight || btn.style.height, 10)).toBeGreaterThanOrEqual(44);
    }

    const metricGrid = await screen.findByTestId('metric-grid');
    expect(metricGrid.style.display).toBe('grid');
    expect(metricGrid.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    expect(metricGrid.style.minWidth).toBe('0px');
    expect(metricGrid.style.maxWidth).toBe('100%');

    const cards = within(metricGrid).getAllByRole('article');
    expect(cards).toHaveLength(6);
    for (const card of cards) {
      expect(card.style.minWidth).toBe('0px');
      expect(card.style.overflowWrap).toBe('anywhere');
    }
  });
});
