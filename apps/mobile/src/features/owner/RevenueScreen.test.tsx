import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import type {
  FinancialChartPoint,
  FinancialDashboardView,
  FinancialPeriod,
  OwnerBookingView,
  VenueView,
} from '@monsport/shared';
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
const C2 = '00000000-0000-4000-8000-000000000002';
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
    { id: C2, name: 'Sân 2', sport: 'BADMINTON', priceNormal: 100000, pricePeak: 150000 },
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

function mkBooking(
  id: string,
  over: Partial<OwnerBookingView> & { courtId: string; startAt: string; endAt: string },
): OwnerBookingView {
  return {
    id,
    status: 'CONFIRMED',
    source: 'PHONE',
    priceTotal: 150000,
    confirmDeadline: null,
    confirmedAt: '2026-11-02T10:00:00+07:00',
    cancelledAt: null,
    createdAt: '2026-11-02T10:00:00+07:00',
    paidAtVenue: false,
    customer: { name: 'Khách', phone: '0901234567' },
    ...over,
  };
}

const B_UNPAID_1 = mkBooking('00000000-0000-4000-8000-000000000101', {
  courtId: C1,
  startAt: '2026-11-03T09:00:00+07:00',
  endAt: '2026-11-03T10:00:00+07:00',
  priceTotal: 100000,
  paidAtVenue: false,
  customer: { name: 'Anh Minh', phone: '0901234567' },
});

const B_UNPAID_2 = mkBooking('00000000-0000-4000-8000-000000000102', {
  courtId: C2,
  startAt: '2026-11-06T18:00:00+07:00',
  endAt: '2026-11-06T19:30:00+07:00',
  priceTotal: 225000,
  paidAtVenue: false,
  customer: { name: 'Chị Lan', phone: '0909111222' },
});

const B_PAID_IN_WEEK = mkBooking('00000000-0000-4000-8000-000000000103', {
  courtId: C1,
  startAt: '2026-11-04T10:00:00+07:00',
  endAt: '2026-11-04T11:00:00+07:00',
  priceTotal: 100000,
  paidAtVenue: true,
  customer: { name: 'Khách Đã Thu', phone: '0902222333' },
});

const B_UNPAID_NEXT_WEEK = mkBooking('00000000-0000-4000-8000-000000000104', {
  courtId: C1,
  startAt: '2026-11-12T18:00:00+07:00',
  endAt: '2026-11-12T19:00:00+07:00',
  priceTotal: 150000,
  paidAtVenue: false,
  customer: { name: 'Khách Tuần Sau', phone: '0903333444' },
});

// 4 CONFIRMED bookings: 3 of "Cầu lông A" inside 02/11–08/11 (2 unpaid out of order, 1 paid) and 1 unpaid on 12/11.
const AC6_BOOKINGS: OwnerBookingView[] = [
  B_UNPAID_2,
  B_PAID_IN_WEEK,
  B_UNPAID_1,
  B_UNPAID_NEXT_WEEK,
];

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
  bookings?: () => unknown;
  markPaid?: (bookingId: string, body: unknown) => unknown;
}) {
  vi.mocked(clientModule.api).mockImplementation((async (path: string, init?: { method?: string; json?: unknown }) => {
    if (path === '/api/owner/venues') {
      return options?.venues ? options.venues() : [VENUE_A];
    }
    if (path === '/api/owner/bookings?status=CONFIRMED') {
      return options?.bookings ? options.bookings() : [];
    }
    if (path === '/api/auth/login' && init?.method === 'POST') {
      return { user: OWNER };
    }
    const patchMatch = /^\/api\/owner\/bookings\/([^/]+)\/paid$/.exec(path);
    if (patchMatch && init?.method === 'PATCH') {
      const bookingId = patchMatch[1]!;
      if (options?.markPaid) return options.markPaid(bookingId, init.json);
      return { id: bookingId, paidAtVenue: true };
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

    // Cross-period sequence: Tuần -> Kỳ trước (2026-10-30) -> Tháng -> Kỳ sau -> Ngày must clamp to <= 2026-11-06
    fireEvent.click(screen.getByRole('button', { name: 'Tuần' }));
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-11-06`)).toHaveLength(3),
    );
    fireEvent.click(prevBtn);
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-10-30`)).toHaveLength(3),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tháng' }));
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VA}/financials?period=month&date=2026-10-30`)).toHaveLength(1),
    );
    fireEvent.click(nextBtn);
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VA}/financials?period=month&date=2026-11-06`)).toHaveLength(3),
    );
    expect(nextBtn.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Ngày' }));
    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VA}/financials?period=day&date=2026-11-06`)).toHaveLength(3),
    );
    expect(screen.getByRole('heading', { name: 'Thứ Sáu, 06/11/2026' })).toBeDefined();
    expect(nextBtn.disabled).toBe(true);

    const financialDates = vi
      .mocked(clientModule.api)
      .mock.calls.map((c) => String(c[0]))
      .map((p) => /&date=(\d{4}-\d{2}-\d{2})$/.exec(p)?.[1])
      .filter((d): d is string => Boolean(d));
    expect(financialDates.length).toBeGreaterThan(0);
    for (const d of financialDates) {
      expect(d <= TODAY).toBe(true);
    }
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

    // QA D-3: a week label shows the day name on one line and the date on the next
    const weekLabelSpans = Array.from(chart.querySelectorAll('span.tnum')) as HTMLElement[];
    expect(weekLabelSpans).toHaveLength(7);
    weekLabelSpans.forEach((span, i) => {
      const [dayName, dateText] = WEEK_CHART[i]!.label.split(' ');
      const lines = Array.from(span.children) as HTMLElement[];
      expect(lines.map((l) => l.textContent)).toEqual([dayName, dateText]);
      for (const line of lines) {
        expect(line.style.display).toBe('block');
        expect(line.style.whiteSpace).toBe('nowrap');
      }
    });
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

  it('AC-6: shows only the 2 unpaid CONFIRMED bookings of the selected venue and viewed period sorted by startAt, with court name, slot, price, data-field customer/phone, and >=44px "Đã thu tiền" button', async () => {
    const finView = mkFinancials();
    mockStandardApi({
      financials: (venueId, period, date) =>
        period === 'month'
          ? mkFinancials({
              venueId,
              period,
              date,
              startDate: '2026-10-31T17:00:00.000Z',
              endDate: '2026-11-30T16:59:59.999Z',
              unpaidBookings: 3,
            })
          : finView,
      bookings: () => AC6_BOOKINGS,
    });
    renderScreen(OWNER);

    const unpaidSection = await screen.findByRole('region', { name: 'Chưa thu tiền' });
    expect(calls('/api/owner/bookings?status=CONFIRMED')).toHaveLength(1);

    const items = await within(unpaidSection).findAllByRole('listitem');
    expect(items).toHaveLength(finView.unpaidBookings);
    expect(items).toHaveLength(2);

    // Row 0: B_UNPAID_1 (2026-11-03 09:00–10:00, Sân 1, 100.000đ, Anh Minh)
    const row0 = items[0]!;
    expect(within(row0).getByText('Sân 1')).toBeDefined();
    expect(within(row0).getByText('09:00–10:00 ngày 03/11/2026')).toBeDefined();
    expect(within(row0).getByText('100.000đ')).toBeDefined();
    const customer0 = row0.querySelector<HTMLElement>('[data-field="customer"]');
    expect(customer0?.textContent).toBe('Anh Minh');
    const phone0 = row0.querySelector<HTMLElement>('[data-field="phone"]');
    expect(phone0?.textContent).toBe('0901234567');
    const btn0 = within(row0).getByRole('button', { name: 'Đã thu tiền' });
    expect(parseInt(btn0.style.minHeight || btn0.style.height, 10)).toBeGreaterThanOrEqual(44);

    // Row 1: B_UNPAID_2 (2026-11-06 18:00–19:30, Sân 2, 225.000đ, Chị Lan)
    const row1 = items[1]!;
    expect(within(row1).getByText('Sân 2')).toBeDefined();
    expect(within(row1).getByText('18:00–19:30 ngày 06/11/2026')).toBeDefined();
    expect(within(row1).getByText('225.000đ')).toBeDefined();
    const customer1 = row1.querySelector<HTMLElement>('[data-field="customer"]');
    expect(customer1?.textContent).toBe('Chị Lan');
    const phone1 = row1.querySelector<HTMLElement>('[data-field="phone"]');
    expect(phone1?.textContent).toBe('0909111222');
    const btn1 = within(row1).getByRole('button', { name: 'Đã thu tiền' });
    expect(parseInt(btn1.style.minHeight || btn1.style.height, 10)).toBeGreaterThanOrEqual(44);

    // Paid booking in period and unpaid booking outside period are excluded
    expect(within(unpaidSection).queryByText('Khách Đã Thu')).toBeNull();
    expect(within(unpaidSection).queryByText('Khách Tuần Sau')).toBeNull();

    // Switching to "Tháng" includes the 12/11 unpaid booking without refetching bookings
    fireEvent.click(screen.getByRole('button', { name: 'Tháng' }));
    expect(await screen.findByText('Khách Tuần Sau')).toBeDefined();
    const monthSection = screen.getByRole('region', { name: 'Chưa thu tiền' });
    expect(within(monthSection).getAllByRole('listitem')).toHaveLength(3);
    expect(calls('/api/owner/bookings?status=CONFIRMED')).toHaveLength(1);
  });

  it('AC-7: clicking "Đã thu tiền" sends one PATCH with { paidAtVenue: true }, locks button and ignores double click while pending, removes the row on 200, and reloads financials from the server', async () => {
    let finCalls = 0;
    const patch = deferred<{ id: string; paidAtVenue: boolean }>();
    mockStandardApi({
      bookings: () => AC6_BOOKINGS,
      financials: () => {
        finCalls++;
        if (finCalls === 1) return mkFinancials({ revenue: 960000, paidBookings: 8, unpaidBookings: 2 });
        return mkFinancials({ revenue: 1234000, paidBookings: 9, unpaidBookings: 1 });
      },
      markPaid: () => patch.promise,
    });
    renderScreen(OWNER);

    const unpaidSection = await screen.findByRole('region', { name: 'Chưa thu tiền' });
    const items = await within(unpaidSection).findAllByRole('listitem');
    expect(items).toHaveLength(2);

    const firstBtn = within(items[0]!).getByRole('button', { name: 'Đã thu tiền' }) as HTMLButtonElement;
    const secondBtn = within(items[1]!).getByRole('button', { name: 'Đã thu tiền' }) as HTMLButtonElement;

    // Click twice consecutively while pending -> sends only one PATCH
    fireEvent.click(firstBtn);
    fireEvent.click(firstBtn);

    expect(calls(`/api/owner/bookings/${B_UNPAID_1.id}/paid`)).toHaveLength(1);
    expect(vi.mocked(clientModule.api)).toHaveBeenCalledWith(
      `/api/owner/bookings/${B_UNPAID_1.id}/paid`,
      {
        method: 'PATCH',
        json: { paidAtVenue: true },
      },
    );
    expect(firstBtn.disabled).toBe(true);
    expect(secondBtn.disabled).toBe(false);

    // Revenue does not change before server financials reload
    const revenueCard = screen.getByRole('article', { name: 'Doanh thu' });
    expect(within(revenueCard).getByText('960.000đ')).toBeDefined();

    await act(async () => {
      patch.resolve({ id: B_UNPAID_1.id, paidAtVenue: true });
    });

    // Row disappears and financials reload updates "Doanh thu" with server numbers
    await waitFor(() => expect(within(unpaidSection).getAllByRole('listitem')).toHaveLength(1));
    expect(within(unpaidSection).queryByText('Anh Minh')).toBeNull();
    expect(within(unpaidSection).getByText('Chị Lan')).toBeDefined();

    await waitFor(() =>
      expect(calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-11-06`)).toHaveLength(2),
    );
    expect(await within(revenueCard).findByText('1.234.000đ')).toBeDefined();
    expect(within(revenueCard).getByText('9 đã thu · 1 chưa thu')).toBeDefined();
  });

  it('AC-8: handles PATCH errors (400, 404 show alert above list and reload bookings+financials; 409, network error keep row, show error in row, re-enable button, no reload) and settles cross-view PATCH by updating bookings, keeping per-row busy lock, and reloading current view financials', async () => {
    let currentBookings: OwnerBookingView[] = [...AC6_BOOKINGS];
    let patchImpl: (bookingId: string) => unknown = () => {
      throw new ApiError(409, 'Yêu cầu đang được xử lý, hãy thử lại');
    };

    mockStandardApi({
      bookings: () => currentBookings,
      markPaid: (bookingId) => patchImpl(bookingId),
    });
    const { unmount } = renderScreen(OWNER);

    const unpaidSection = await screen.findByRole('region', { name: 'Chưa thu tiền' });
    let items = await within(unpaidSection).findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(calls('/api/owner/bookings?status=CONFIRMED')).toHaveLength(1);
    expect(calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-11-06`)).toHaveLength(1);

    // 1. 409 -> row stays, error shown inside row, button re-enabled, no reload
    const row0 = items[0]!;
    const btn0 = within(row0).getByRole('button', { name: 'Đã thu tiền' }) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(btn0);
    });
    expect(within(row0).getByText('Yêu cầu đang được xử lý, hãy thử lại')).toBeDefined();
    expect(btn0.disabled).toBe(false);
    expect(within(unpaidSection).getAllByRole('listitem')).toHaveLength(2);
    expect(calls('/api/owner/bookings?status=CONFIRMED')).toHaveLength(1);
    expect(calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-11-06`)).toHaveLength(1);
    expect(within(screen.getByRole('article', { name: 'Doanh thu' })).getByText('960.000đ')).toBeDefined();

    // 2. Network error -> row stays, "Không cập nhật được. Thử lại." shown inside row, button re-enabled, no reload
    patchImpl = () => {
      throw new TypeError('Failed to fetch');
    };
    await act(async () => {
      fireEvent.click(btn0);
    });
    expect(within(row0).getByText('Không cập nhật được. Thử lại.')).toBeDefined();
    expect(btn0.disabled).toBe(false);
    expect(within(unpaidSection).getAllByRole('listitem')).toHaveLength(2);
    expect(calls('/api/owner/bookings?status=CONFIRMED')).toHaveLength(1);
    expect(calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-11-06`)).toHaveLength(1);
    expect(within(screen.getByRole('article', { name: 'Doanh thu' })).getByText('960.000đ')).toBeDefined();

    // 3. 400 -> shows API error in role="alert" ABOVE the list (not inside row), reloads both bookings and financials; row vanishes
    currentBookings = [B_UNPAID_2];
    patchImpl = () => {
      throw new ApiError(400, 'Chỉ đánh dấu thu tiền cho booking đã xác nhận');
    };
    await act(async () => {
      fireEvent.click(btn0);
    });
    const alert400 = await screen.findByRole('alert');
    expect(alert400.textContent).toBe('Chỉ đánh dấu thu tiền cho booking đã xác nhận');
    items = within(unpaidSection).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(within(items[0]!).queryByRole('alert')).toBeNull();
    const listEl = within(unpaidSection).getByRole('list');
    expect(Boolean(alert400.compareDocumentPosition(listEl) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(calls('/api/owner/bookings?status=CONFIRMED')).toHaveLength(2);
    expect(calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-11-06`)).toHaveLength(2);

    // 4. 404 -> shows API error in role="alert" ABOVE the list, reloads both bookings and financials; remaining row vanishes
    currentBookings = [];
    patchImpl = () => {
      throw new ApiError(404, 'Không tìm thấy booking');
    };
    const remainingBtn = within(items[0]!).getByRole('button', { name: 'Đã thu tiền' });
    await act(async () => {
      fireEvent.click(remainingBtn);
    });
    const alert404 = await screen.findByRole('alert');
    expect(alert404.textContent).toBe('Không tìm thấy booking');
    expect(await within(unpaidSection).findByText('Không có booking cần thu tiền')).toBeDefined();
    expect(calls('/api/owner/bookings?status=CONFIRMED')).toHaveLength(3);
    expect(calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-11-06`)).toHaveLength(3);

    unmount();
    vi.mocked(clientModule.api).mockClear();

    // 5. Cross-view PATCH: pending PATCH in "Tuần", switch to "Tháng", month financials resolve, button stays disabled in month view, then PATCH resolves 200 -> row gone in month view, month financials refetched
    const stalePatch200 = deferred<{ id: string; paidAtVenue: boolean }>();
    const stalePatch400 = deferred<{ id: string; paidAtVenue: boolean }>();
    const unmountedPatch = deferred<{ id: string; paidAtVenue: boolean }>();
    let crossBookings: OwnerBookingView[] = [...AC6_BOOKINGS];
    let patchTurn = 0;
    mockStandardApi({
      bookings: () => crossBookings,
      financials: (venueId, period, date) =>
        period === 'month'
          ? mkFinancials({
              venueId,
              period,
              date,
              startDate: '2026-10-31T17:00:00.000Z',
              endDate: '2026-11-30T16:59:59.999Z',
              unpaidBookings: 3,
            })
          : mkFinancials({ venueId, period, date }),
      markPaid: () => {
        patchTurn++;
        if (patchTurn === 1) return stalePatch200.promise;
        if (patchTurn === 2) return stalePatch400.promise;
        return unmountedPatch.promise;
      },
    });
    const { unmount: unmount2 } = renderScreen(OWNER);
    const section2 = await screen.findByRole('region', { name: 'Chưa thu tiền' });
    const rows2 = await within(section2).findAllByRole('listitem');
    fireEvent.click(within(rows2[0]!).getByRole('button', { name: 'Đã thu tiền' }));
    expect(calls(`/api/owner/bookings/${B_UNPAID_1.id}/paid`)).toHaveLength(1);

    // Switch to "Tháng" and wait for month financials to resolve
    fireEvent.click(screen.getByRole('button', { name: 'Tháng' }));
    await screen.findByRole('heading', { name: 'Tháng 11/2026' });
    const monthSection = await screen.findByRole('region', { name: 'Chưa thu tiền' });
    const monthRowsBefore = await within(monthSection).findAllByRole('listitem');
    expect(monthRowsBefore).toHaveLength(3);

    // The same booking's button is STILL disabled in the month view while pending, and clicking it sends no second PATCH
    const monthBtn0 = within(monthRowsBefore[0]!).getByRole('button', {
      name: 'Đã thu tiền',
    }) as HTMLButtonElement;
    expect(monthBtn0.disabled).toBe(true);
    fireEvent.click(monthBtn0);
    expect(calls(`/api/owner/bookings/${B_UNPAID_1.id}/paid`)).toHaveLength(1);

    const monthFinCallsBefore200 = calls(
      `/api/owner/venues/${VA}/financials?period=month&date=2026-11-06`,
    ).length;

    // Now the pending PATCH resolves 200 -> row is removed in month view and month financials are fetched again
    await act(async () => {
      stalePatch200.resolve({ id: B_UNPAID_1.id, paidAtVenue: true });
    });
    await waitFor(() => expect(within(monthSection).getAllByRole('listitem')).toHaveLength(2));
    expect(within(monthSection).queryByText('Anh Minh')).toBeNull();
    expect(calls(`/api/owner/venues/${VA}/financials?period=month&date=2026-11-06`)).toHaveLength(
      monthFinCallsBefore200 + 1,
    );
    expect(calls(`/api/owner/bookings/${B_UNPAID_1.id}/paid`)).toHaveLength(1);

    // Switch back to "Tuần" to verify the row is also gone from the week view when switching back
    fireEvent.click(screen.getByRole('button', { name: 'Tuần' }));
    await screen.findByRole('heading', { name: 'Tuần 02/11–08/11/2026' });
    const weekSectionAfter = await screen.findByRole('region', { name: 'Chưa thu tiền' });
    expect(within(weekSectionAfter).queryByText('Anh Minh')).toBeNull();
    expect(within(weekSectionAfter).getAllByRole('listitem')).toHaveLength(1);

    // Switch back to "Tháng" for step 6
    fireEvent.click(screen.getByRole('button', { name: 'Tháng' }));
    await screen.findByRole('heading', { name: 'Tháng 11/2026' });

    // 6. Stale 400 variant: PATCH started in "Tháng", switch back to "Tuần", then PATCH rejects 400 -> bookings and current view financials are reloaded
    const monthSectionAgain = await screen.findByRole('region', { name: 'Chưa thu tiền' });
    const remainingMonthRows = within(monthSectionAgain).getAllByRole('listitem');
    fireEvent.click(within(remainingMonthRows[0]!).getByRole('button', { name: 'Đã thu tiền' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tuần' }));
    await screen.findByRole('heading', { name: 'Tuần 02/11–08/11/2026' });
    const bookingsCallsBefore400 = calls('/api/owner/bookings?status=CONFIRMED').length;
    const weekFinCallsBefore400 = calls(
      `/api/owner/venues/${VA}/financials?period=week&date=2026-11-06`,
    ).length;

    crossBookings = [B_UNPAID_NEXT_WEEK];
    await act(async () => {
      stalePatch400.reject(new ApiError(400, 'Chỉ đánh dấu thu tiền cho booking đã xác nhận'));
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(calls('/api/owner/bookings?status=CONFIRMED')).toHaveLength(bookingsCallsBefore400 + 1);
    expect(calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-11-06`)).toHaveLength(
      weekFinCallsBefore400 + 1,
    );

    // 7. Unmount while PATCH is pending -> does not write or reload after unmount
    fireEvent.click(screen.getByRole('button', { name: 'Tháng' }));
    const sectionBeforeUnmount = await screen.findByRole('region', { name: 'Chưa thu tiền' });
    const rowsBeforeUnmount = await within(sectionBeforeUnmount).findAllByRole('listitem');
    fireEvent.click(within(rowsBeforeUnmount[0]!).getByRole('button', { name: 'Đã thu tiền' }));
    const monthFinCallsAtUnmount = calls(
      `/api/owner/venues/${VA}/financials?period=month&date=2026-11-06`,
    ).length;
    unmount2();
    await act(async () => {
      unmountedPatch.resolve({ id: B_UNPAID_NEXT_WEEK.id, paidAtVenue: true });
    });
    expect(calls(`/api/owner/venues/${VA}/financials?period=month&date=2026-11-06`)).toHaveLength(
      monthFinCallsAtUnmount,
    );

    // 8. 200 on row B does not cancel an in-flight bookings reload triggered by 400 on row A
    const patchRowA = deferred<{ id: string; paidAtVenue: boolean }>();
    const patchRowB = deferred<{ id: string; paidAtVenue: boolean }>();
    const reloadBookingsFlight = deferred<OwnerBookingView[]>();
    let bookingsCallCount = 0;
    mockStandardApi({
      bookings: () => {
        bookingsCallCount++;
        if (bookingsCallCount === 1) return [B_UNPAID_1, B_UNPAID_2];
        return reloadBookingsFlight.promise;
      },
      markPaid: (bookingId) => (bookingId === B_UNPAID_1.id ? patchRowA.promise : patchRowB.promise),
    });
    renderScreen(OWNER);
    const section3 = await screen.findByRole('region', { name: 'Chưa thu tiền' });
    const rows3 = await within(section3).findAllByRole('listitem');
    fireEvent.click(within(rows3[0]!).getByRole('button', { name: 'Đã thu tiền' }));
    fireEvent.click(within(rows3[1]!).getByRole('button', { name: 'Đã thu tiền' }));

    await act(async () => {
      patchRowA.reject(new ApiError(400, 'Chỉ đánh dấu thu tiền cho booking đã xác nhận'));
    });
    expect(bookingsCallCount).toBe(2);

    await act(async () => {
      patchRowB.resolve({ id: B_UNPAID_2.id, paidAtVenue: true });
    });

    await act(async () => {
      reloadBookingsFlight.resolve([]);
    });
    expect(await within(section3).findByText('Không có booking cần thu tiền')).toBeDefined();
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

  it('AC-10: guest sees login prompt, USER redirects to /, neither calls owner APIs, and 401 on venues, financials, bookings, or PATCH opens session login sheet and reloads after login', async () => {
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

    // 4. 401 on venues -> opens session login sheet; closing shows "Không tải được" and "Thử lại", and "Thử lại" loads again
    let venueAuthCalls = 0;
    mockStandardApi({
      venues: () => {
        if (++venueAuthCalls === 1) throw new ApiError(401, 'Chưa đăng nhập');
        return [VENUE_A];
      },
    });
    const { unmount: unmountVenue401 } = renderScreen(OWNER);

    const venueLoginDialog = await screen.findByRole('dialog', { name: 'Đăng nhập' });
    expect(
      within(venueLoginDialog).getByText('Phiên đăng nhập đã hết. Hãy đăng nhập lại.'),
    ).toBeDefined();
    fireEvent.click(within(venueLoginDialog).getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog', { name: 'Đăng nhập' })).toBeNull();
    expect(screen.getByText('Không tải được')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('960.000đ')).toBeDefined();
    expect(venueAuthCalls).toBe(2);
    unmountVenue401();

    // 5. 401 on financials -> opens session login sheet; closing shows "Không tải được" and "Thử lại", "Thử lại" reloads, and login sheet also reloads
    let finCalls = 0;
    mockStandardApi({
      financials: () => {
        finCalls++;
        if (finCalls <= 2) throw new ApiError(401, 'Chưa đăng nhập');
        return mkFinancials();
      },
    });
    const { unmount: unmountFin401 } = renderScreen(OWNER);

    const finLoginDialog1 = await screen.findByRole('dialog', { name: 'Đăng nhập' });
    expect(
      within(finLoginDialog1).getByText('Phiên đăng nhập đã hết. Hãy đăng nhập lại.'),
    ).toBeDefined();
    fireEvent.click(within(finLoginDialog1).getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog', { name: 'Đăng nhập' })).toBeNull();
    expect(screen.getByText('Không tải được')).toBeDefined();

    // Clicking "Thử lại" triggers another load (which 401s on call 2 and opens dialog; logging in triggers call 3 and succeeds)
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
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
    expect(finCalls).toBe(3);
    unmountFin401();

    // 6. 401 on GET /api/owner/bookings?status=CONFIRMED -> opens session login sheet AND sets failed flag; closing shows "Không tải được" and "Thử lại" in "Chưa thu tiền"
    let bookingAuthCalls = 0;
    mockStandardApi({
      bookings: () => {
        if (++bookingAuthCalls === 1) throw new ApiError(401, 'Chưa đăng nhập');
        return AC6_BOOKINGS;
      },
      markPaid: () => {
        throw new ApiError(401, 'Chưa đăng nhập');
      },
    });
    const { unmount: unmountBooking401 } = renderScreen(OWNER);

    const bookingLoginDialog = await screen.findByRole('dialog', { name: 'Đăng nhập' });
    expect(
      within(bookingLoginDialog).getByText('Phiên đăng nhập đã hết. Hãy đăng nhập lại.'),
    ).toBeDefined();
    fireEvent.click(within(bookingLoginDialog).getByRole('button', { name: 'Đóng' }));
    const unpaidSection = await screen.findByRole('region', { name: 'Chưa thu tiền' });
    expect(within(unpaidSection).getByText('Không tải được')).toBeDefined();
    fireEvent.click(within(unpaidSection).getByRole('button', { name: 'Thử lại' }));
    expect(await within(unpaidSection).findByText('Anh Minh')).toBeDefined();
    expect(bookingAuthCalls).toBe(2);

    // 7. 401 on PATCH /api/owner/bookings/:id/paid -> opens session login sheet without reloading, then reloads after login
    const finCallsBeforePatch = calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-11-06`).length;
    const rows = within(unpaidSection).getAllByRole('listitem');
    await act(async () => {
      fireEvent.click(within(rows[0]!).getByRole('button', { name: 'Đã thu tiền' }));
    });
    const patchLoginDialog = await screen.findByRole('dialog', { name: 'Đăng nhập' });
    expect(
      within(patchLoginDialog).getByText('Phiên đăng nhập đã hết. Hãy đăng nhập lại.'),
    ).toBeDefined();
    expect(calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-11-06`)).toHaveLength(
      finCallsBeforePatch,
    );
    expect(bookingAuthCalls).toBe(2);

    fireEvent.change(within(patchLoginDialog).getByLabelText('Số điện thoại'), {
      target: { value: '0912345678' },
    });
    fireEvent.change(within(patchLoginDialog).getByLabelText('Mật khẩu'), {
      target: { value: 'password123' },
    });
    await act(async () => {
      fireEvent.click(within(patchLoginDialog).getByRole('button', { name: 'Đăng nhập' }));
    });
    await waitFor(() => expect(bookingAuthCalls).toBe(3));
    expect(calls(`/api/owner/venues/${VA}/financials?period=week&date=2026-11-06`).length).toBeGreaterThan(
      finCallsBeforePatch,
    );
    unmountBooking401();

    // 8. Both /api/owner/venues and /api/owner/bookings?status=CONFIRMED return 401 once -> after login, unpaid section shows rows and bookings GET was called twice
    vi.mocked(clientModule.api).mockClear();
    let bothVenueCalls = 0;
    let bothBookingCalls = 0;
    mockStandardApi({
      venues: () => {
        if (++bothVenueCalls === 1) throw new ApiError(401, 'Chưa đăng nhập');
        return [VENUE_A];
      },
      bookings: () => {
        if (++bothBookingCalls === 1) throw new ApiError(401, 'Chưa đăng nhập');
        return AC6_BOOKINGS;
      },
    });
    renderScreen(OWNER);

    const bothLoginDialog = await screen.findByRole('dialog', { name: 'Đăng nhập' });
    fireEvent.change(within(bothLoginDialog).getByLabelText('Số điện thoại'), {
      target: { value: '0912345678' },
    });
    fireEvent.change(within(bothLoginDialog).getByLabelText('Mật khẩu'), {
      target: { value: 'password123' },
    });
    await act(async () => {
      fireEvent.click(within(bothLoginDialog).getByRole('button', { name: 'Đăng nhập' }));
    });

    const unpaidAfterBoth = await screen.findByRole('region', { name: 'Chưa thu tiền' });
    expect(await within(unpaidAfterBoth).findByText('Anh Minh')).toBeDefined();
    expect(within(unpaidAfterBoth).getByText('Chị Lan')).toBeDefined();
    expect(within(unpaidAfterBoth).getAllByRole('listitem')).toHaveLength(2);
    expect(calls('/api/owner/bookings?status=CONFIRMED')).toHaveLength(2);
  });

  it('AC-11: handles venue load error with retry, financials load error with retry while keeping chips usable, bookings load error with retry, and empty venue list', async () => {
    let venueCalls = 0;
    let finCalls = 0;
    let bookingCalls = 0;
    mockStandardApi({
      venues: () => {
        if (++venueCalls === 1) throw new ApiError(500, 'Lỗi server');
        return [VENUE_A];
      },
      financials: () => {
        if (++finCalls === 1) throw new ApiError(500, 'Lỗi báo cáo');
        return mkFinancials();
      },
      bookings: () => {
        if (++bookingCalls === 1) throw new ApiError(500, 'Lỗi danh sách booking');
        return AC6_BOOKINGS;
      },
    });
    const { unmount } = renderScreen(OWNER);

    // 1. Venue error -> "Không tải được" + "Thử lại"
    expect(await screen.findByText('Không tải được')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    // 2. Financials error -> metrics block shows "Không tải được" + "Thử lại", period chips still usable
    const unpaidSection = await screen.findByRole('region', { name: 'Chưa thu tiền' });
    await waitFor(() => expect(finCalls).toBe(1));
    await waitFor(() =>
      expect(
        screen.getAllByText('Không tải được').filter((el) => !unpaidSection.contains(el)),
      ).toHaveLength(1),
    );
    expect(screen.getByRole('group', { name: 'Kỳ' })).toBeDefined();
    const financialsRetry = screen
      .getAllByRole('button', { name: 'Thử lại' })
      .find((btn) => !unpaidSection.contains(btn))!;
    fireEvent.click(financialsRetry);

    expect(await screen.findByText('960.000đ')).toBeDefined();

    // 3. Bookings error -> "Chưa thu tiền" shows "Không tải được" + "Thử lại", and retrying loads the unpaid list
    expect(within(unpaidSection).getByText('Không tải được')).toBeDefined();
    fireEvent.click(within(unpaidSection).getByRole('button', { name: 'Thử lại' }));
    expect(await within(unpaidSection).findByText('Anh Minh')).toBeDefined();
    expect(bookingCalls).toBe(2);

    unmount();

    // 4. Empty venue list -> "Bạn chưa có đơn vị nào"
    mockStandardApi({ venues: () => [] });
    renderScreen(OWNER);
    expect(await screen.findByText('Bạn chưa có đơn vị nào')).toBeDefined();
  });

  it('AC-12: renders 0đ, 0% rates, "Không có booking cần thu tiền", and 2px minimum chart bars without dividing by 0 when period has no bookings', async () => {
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
      bookings: () => [],
    });
    renderScreen(OWNER);

    const revenueCard = await screen.findByRole('article', { name: 'Doanh thu' });
    expect(within(revenueCard).getByText('0đ')).toBeDefined();
    expect(screen.getByRole('article', { name: 'Lấp đầy' }).textContent).toBe('Lấp đầy 0%');
    expect(screen.getByRole('article', { name: 'Hủy' }).textContent).toBe('Hủy 0%');
    expect(screen.getByRole('article', { name: 'Từ chối' }).textContent).toBe('Từ chối 0%');
    expect(screen.getByRole('article', { name: 'Khách quay lại' }).textContent).toBe('Khách quay lại 0/0');

    const unpaidSection = screen.getByRole('region', { name: 'Chưa thu tiền' });
    expect(within(unpaidSection).getByText('Không có booking cần thu tiền')).toBeDefined();

    const chart = screen.getByRole('region', { name: 'Biểu đồ doanh thu' });
    const bars = within(chart).getAllByRole('img');
    expect(bars).toHaveLength(7);
    for (const bar of bars) {
      expect(bar.style.height).toBe('2px');
      expect(bar.getAttribute('data-ratio')).toBe('0');
    }
  });

  it('AC-13: wraps long venue and customer names, keeps every button and chip (including "Đã thu tiền") at least 44px high, prevents horizontal overflow at 360px and 390px, lays out metric cards in 2 columns, and thins chart labels when >7 points', async () => {
    const longName = 'Đơn-vị-cầu-lông-rất-dài-'.repeat(12);
    const longCustomer = 'Khách-hàng-tên-rất-dài-'.repeat(12);
    const monthChart: FinancialChartPoint[] = Array.from({ length: 30 }, (_, i) => ({
      label: `${String(i + 1).padStart(2, '0')}/11`,
      revenue: i === 0 ? 0 : (i + 1) * 10000,
      bookedHours: 1,
      bookingCount: 1,
    }));
    mockStandardApi({
      venues: () => [
        { ...VENUE_A, name: longName },
        { ...VENUE_B, name: 'Sân bóng đá B' },
      ],
      financials: (venueId, period, date) =>
        mkFinancials({
          venueId,
          period,
          date,
          chartData: monthChart,
        }),
      bookings: () => [
        mkBooking('b-long-customer', {
          courtId: C1,
          startAt: '2026-11-06T18:00:00+07:00',
          endAt: '2026-11-06T19:00:00+07:00',
          paidAtVenue: false,
          customer: { name: longCustomer, phone: '0901234567' },
        }),
      ],
    });
    renderScreen(OWNER);

    const venueGroup = await screen.findByRole('group', { name: 'Đơn vị' });
    const longChip = within(venueGroup).getByRole('button', { name: longName });
    expect(longChip.style.minHeight).toBe('44px');
    expect(longChip.style.overflowWrap).toBe('anywhere');
    expect(longChip.style.whiteSpace).toBe('normal');

    const unpaidSection = await screen.findByRole('region', { name: 'Chưa thu tiền' });
    const customerEl = await within(unpaidSection).findByText(longCustomer, {
      selector: '[data-field="customer"]',
    });
    expect(customerEl.style.overflowWrap).toBe('anywhere');
    expect(customerEl.style.minWidth).toBe('0px');
    const markPaidBtn = within(unpaidSection).getByRole('button', { name: 'Đã thu tiền' });
    expect(parseInt(markPaidBtn.style.minHeight || markPaidBtn.style.height, 10)).toBeGreaterThanOrEqual(44);

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

    const chart = screen.getByRole('region', { name: 'Biểu đồ doanh thu' });
    const list = within(chart).getByRole('list', { name: 'Cột doanh thu' });
    expect(list.style.overflowX).toBe('');

    const bars = within(chart).getAllByRole('img');
    expect(bars).toHaveLength(30);
    monthChart.forEach((p, i) => {
      expect(bars[i]!.getAttribute('aria-label')).toBe(
        `${p.label}: ${clientModule.formatVnd(p.revenue)}`,
      );
      const ratio = p.revenue / 300000;
      const expectedPx = Math.max(2, Math.round(ratio * BAR_MAX_HEIGHT_PX));
      expect(bars[i]!.style.height).toBe(`${expectedPx}px`);
    });

    const labelSpans = Array.from(chart.querySelectorAll('span.tnum')) as HTMLElement[];
    expect(labelSpans).toHaveLength(30);
    for (const span of labelSpans) {
      expect(span.style.overflowWrap).not.toBe('anywhere');
      expect(span.style.whiteSpace).toBe('nowrap');
    }
    const visibleLabels = labelSpans.map((s) => (s.textContent ?? '').replace(/ /g, '')).filter((t) => t !== '');
    expect(visibleLabels).toEqual(['01/11', '06/11', '11/11', '16/11', '21/11', '26/11']);
    const hiddenLabels = labelSpans.filter((_, i) => i % 5 !== 0);
    expect(hiddenLabels).toHaveLength(24);
    for (const span of hiddenLabels) {
      expect(span.textContent).toBe('\u00a0');
    }
  });

  it('AC-11: keeps the "Chưa thu tiền" list and its buttons while financials load or fail', async () => {
    const pendingFin = deferred<FinancialDashboardView>();
    mockStandardApi({
      financials: () => pendingFin.promise,
      bookings: () => AC6_BOOKINGS,
    });
    const { unmount } = renderScreen(OWNER);

    // Financials pending: the list shows the 2 unpaid bookings of the week
    const pendingSection = await screen.findByRole('region', { name: 'Chưa thu tiền' });
    expect(await within(pendingSection).findAllByRole('listitem')).toHaveLength(2);
    expect(within(pendingSection).getAllByRole('button', { name: 'Đã thu tiền' })).toHaveLength(2);
    expect(screen.getByText('Đang tải')).toBeDefined();
    unmount();

    // Financials failed: the list shows next to "Không tải được"
    mockStandardApi({
      financials: () => {
        throw new ApiError(500, 'Lỗi báo cáo');
      },
      bookings: () => AC6_BOOKINGS,
    });
    renderScreen(OWNER);
    const failedSection = await screen.findByRole('region', { name: 'Chưa thu tiền' });
    expect(await within(failedSection).findAllByRole('listitem')).toHaveLength(2);
    expect(within(failedSection).getAllByRole('button', { name: 'Đã thu tiền' })).toHaveLength(2);
    expect(await screen.findByText('Không tải được')).toBeDefined();
    expect(within(failedSection).queryByText('Không tải được')).toBeNull();
  });

  it('AC-8: a bookings reload that returns after another row got 200 does not put the paid row back (QA D-2)', async () => {
    const patchRowA = deferred<{ id: string; paidAtVenue: boolean }>();
    const patchRowB = deferred<{ id: string; paidAtVenue: boolean }>();
    const reloadFlight = deferred<OwnerBookingView[]>();
    let bookingsCallCount = 0;
    mockStandardApi({
      bookings: () => {
        bookingsCallCount++;
        if (bookingsCallCount === 1) return [B_UNPAID_1, B_UNPAID_2];
        return reloadFlight.promise;
      },
      markPaid: (bookingId) => (bookingId === B_UNPAID_1.id ? patchRowA.promise : patchRowB.promise),
    });
    renderScreen(OWNER);
    const section = await screen.findByRole('region', { name: 'Chưa thu tiền' });
    const rows = await within(section).findAllByRole('listitem');
    fireEvent.click(within(rows[0]!).getByRole('button', { name: 'Đã thu tiền' }));
    fireEvent.click(within(rows[1]!).getByRole('button', { name: 'Đã thu tiền' }));

    await act(async () => {
      patchRowA.reject(new ApiError(400, 'Chỉ đánh dấu thu tiền cho booking đã xác nhận'));
    });
    expect(bookingsCallCount).toBe(2);
    await act(async () => {
      patchRowB.resolve({ id: B_UNPAID_2.id, paidAtVenue: true });
    });
    await waitFor(() => expect(within(section).queryByText('Chị Lan')).toBeNull());

    // The late reload still lists B as unpaid: B stays out, A stays in
    await act(async () => {
      reloadFlight.resolve([B_UNPAID_1, B_UNPAID_2]);
    });
    expect(within(section).queryByText('Chị Lan')).toBeNull();
    expect(within(section).getByText('Anh Minh')).toBeDefined();
    expect(within(section).getAllByRole('listitem')).toHaveLength(1);
  });

  it('AC-1: shows "Giờ đã đặt" with a Vietnamese decimal comma (QA D-4)', async () => {
    mockStandardApi({ financials: () => mkFinancials({ bookedHours: 1.5 }) });
    renderScreen(OWNER);
    const card = await screen.findByRole('article', { name: 'Giờ đã đặt' });
    expect(card.textContent).toBe('Giờ đã đặt 1,5 giờ');
  });
});
