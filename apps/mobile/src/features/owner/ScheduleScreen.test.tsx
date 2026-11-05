import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import { PHONE_MESSAGE, type FreeRange, type OwnerBookingView, type VenueView } from '@monsport/shared';
import { BarsProvider } from '../../app/bars';
import * as sessionModule from '../../app/session';
import { ScheduleScreen } from './ScheduleScreen';

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
const TOMORROW = '2026-11-07';

const C1 = '00000000-0000-4000-8000-000000000001';
const C2 = '00000000-0000-4000-8000-000000000002';
const CB1 = '00000000-0000-4000-8000-000000000003';

const VENUE_A: VenueView = {
  id: '00000000-0000-4000-8000-000000000010',
  name: 'Cầu lông A',
  address: 'Quận 1',
  phone: '0912345678',
  opensAt: 360,
  closesAt: 1320,
  courts: [
    { id: C1, name: 'Sân 1', sport: 'BADMINTON', priceNormal: 100000, pricePeak: 150000 },
    { id: C2, name: 'Sân 2', sport: 'BADMINTON', priceNormal: 100000, pricePeak: 150000 },
  ],
};

const VENUE_B: VenueView = {
  id: '00000000-0000-4000-8000-000000000020',
  name: 'Cầu lông B',
  address: 'Quận 2',
  phone: '0987654321',
  opensAt: 360,
  closesAt: 1320,
  courts: [
    { id: CB1, name: 'Sân B1', sport: 'BADMINTON', priceNormal: 100000, pricePeak: 150000 },
  ],
};

const range = (date: string, from: string, to: string): FreeRange => ({
  startAt: `${date}T${from}:00+07:00`,
  endAt: `${date}T${to}:00+07:00`,
});

const FREE_SAN_1: FreeRange[] = [range(TODAY, '15:30', '22:00')];
const FREE_SAN_2: FreeRange[] = [range(TODAY, '15:30', '18:00'), range(TODAY, '20:00', '22:00')];

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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
    confirmedAt: '2026-11-06T10:00:00+07:00',
    cancelledAt: null,
    createdAt: '2026-11-06T10:00:00+07:00',
    paidAtVenue: false,
    customer: { name: 'Khách', phone: '0901234567' },
    ...over,
  };
}

const calls = (path: string) => vi.mocked(clientModule.api).mock.calls.filter((c) => c[0] === path);
const rowOf = (courtName: string) => screen.getByRole('group', { name: `Giờ trống ${courtName}` });
const buttonMinutes = (row: HTMLElement) =>
  Array.from(row.querySelectorAll('button')).map((b) => Number(b.getAttribute('data-minute')));

function Probe() {
  const location = useLocation();
  return (
    <>
      <p data-testid="path">{location.pathname}</p>
      <ScheduleScreen />
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
    <MemoryRouter initialEntries={['/chu-san/lich']}>
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
  confirmed?: () => unknown;
  pending?: () => unknown;
  availability?: (courtId: string, date: string) => unknown;
  postBooking?: (body: unknown) => unknown;
}) {
  vi.mocked(clientModule.api).mockImplementation((async (path: string, init?: { method?: string; json?: unknown }) => {
    if (path === '/api/owner/venues') {
      return options?.venues ? options.venues() : [VENUE_A];
    }
    if (path === '/api/owner/bookings?status=CONFIRMED') {
      return options?.confirmed ? options.confirmed() : [];
    }
    if (path === '/api/owner/bookings?status=PENDING') {
      return options?.pending ? options.pending() : [];
    }
    if (path === '/api/auth/login' && init?.method === 'POST') {
      return { user: OWNER };
    }
    if (path === '/api/owner/bookings' && init?.method === 'POST') {
      if (options?.postBooking) return options.postBooking(init.json);
      return mkBooking('b-new', {
        courtId: C1,
        startAt: '2026-11-06T09:00:00.000Z',
        endAt: '2026-11-06T11:00:00.000Z',
      });
    }
    const m = /^\/api\/courts\/([^/]+)\/availability\?date=(.+)$/.exec(path);
    if (m) {
      if (options?.availability) return options.availability(m[1]!, m[2]!);
      if (m[2] === TODAY) {
        return { free: m[1] === C1 ? FREE_SAN_1 : FREE_SAN_2 };
      }
      return { free: [] };
    }
    throw new ApiError(404, `Unexpected ${path}`);
  }) as never);
}

describe('ScheduleScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW_ISO));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC-1: renders 7 day chips ("Hôm nay" selected), one SlotRow per court with startable cells, 18:00-19:30 disabled on Sân 2, and one availability GET per court', async () => {
    mockStandardApi();
    renderScreen(OWNER);

    const dayNav = await screen.findByRole('navigation', { name: 'Ngày' });
    const dayChips = within(dayNav).getAllByRole('button');
    expect(dayChips.map((c) => c.textContent)).toEqual([
      'Hôm nay',
      'T7 07/11',
      'CN 08/11',
      'T2 09/11',
      'T3 10/11',
      'T4 11/11',
      'T5 12/11',
    ]);
    expect(dayChips[0]!.getAttribute('aria-pressed')).toBe('true');

    await waitFor(() =>
      expect(buttonMinutes(rowOf('Sân 1'))).toEqual([
        930, 960, 990, 1020, 1050, 1080, 1110, 1140, 1170, 1200, 1230, 1260,
      ]),
    );
    await waitFor(() =>
      expect(buttonMinutes(rowOf('Sân 2'))).toEqual([930, 960, 990, 1020, 1200, 1230, 1260]),
    );

    const san2Row = rowOf('Sân 2');
    for (const m of [1080, 1110, 1140, 1170]) {
      const cell = san2Row.querySelector<HTMLElement>(`[data-minute="${m}"]`)!;
      expect(cell.tagName).not.toBe('BUTTON');
      expect(cell.getAttribute('aria-disabled')).toBe('true');
    }

    expect(calls(`/api/courts/${C1}/availability?date=${TODAY}`)).toHaveLength(1);
    expect(calls(`/api/courts/${C2}/availability?date=${TODAY}`)).toHaveLength(1);
  });

  it('AC-2: shows venue chips sorted by name when owner has 2 venues, switches courts on tap, and hides venue chips when owner has 1 venue', async () => {
    mockStandardApi({
      venues: () => [VENUE_B, VENUE_A],
      availability: (courtId) => ({
        free: courtId === CB1 ? [range(TODAY, '16:00', '18:00')] : FREE_SAN_1,
      }),
    });
    const { unmount } = renderScreen(OWNER);

    const venueGroup = await screen.findByRole('group', { name: 'Đơn vị' });
    const venueChips = within(venueGroup).getAllByRole('button');
    expect(venueChips.map((c) => c.textContent)).toEqual(['Cầu lông A', 'Cầu lông B']);
    expect(venueChips[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(rowOf('Sân 1')).toBeDefined();
    expect(rowOf('Sân 2')).toBeDefined();
    expect(screen.queryByRole('group', { name: 'Giờ trống Sân B1' })).toBeNull();

    fireEvent.click(within(venueGroup).getByRole('button', { name: 'Cầu lông B' }));
    expect(await screen.findByRole('group', { name: 'Giờ trống Sân B1' })).toBeDefined();
    expect(screen.queryByRole('group', { name: 'Giờ trống Sân 1' })).toBeNull();

    unmount();
    mockStandardApi({ venues: () => [VENUE_A] });
    renderScreen(OWNER);
    await screen.findByRole('group', { name: 'Giờ trống Sân 1' });
    expect(screen.queryByRole('group', { name: 'Đơn vị' })).toBeNull();
  });

  it('AC-3: shows "Booking trong ngày" filtered by selected date and venue, sorted by startAt, with court, time, customer, tel link only when phone exists, status label, or empty message', async () => {
    const bLaterConfirmed = mkBooking('b2', {
      courtId: C2,
      startAt: '2026-11-06T18:00:00+07:00',
      endAt: '2026-11-06T19:30:00+07:00',
      status: 'CONFIRMED',
      customer: { name: 'Chị Lan', phone: '0909111222' },
    });
    const bEarlierPending = mkBooking('b1', {
      courtId: C1,
      startAt: '2026-11-06T16:00:00+07:00',
      endAt: '2026-11-06T17:00:00+07:00',
      status: 'PENDING',
      source: 'APP',
      customer: { name: 'Anh Minh', phone: null },
    });
    const bOtherDay = mkBooking('b3', {
      courtId: C1,
      startAt: '2026-11-07T18:00:00+07:00',
      endAt: '2026-11-07T19:00:00+07:00',
      status: 'CONFIRMED',
      customer: { name: 'Khách Ngày Mai', phone: '0909333444' },
    });
    const bOtherVenue = mkBooking('b4', {
      courtId: CB1,
      startAt: '2026-11-06T17:00:00+07:00',
      endAt: '2026-11-06T18:00:00+07:00',
      status: 'CONFIRMED',
      customer: { name: 'Khách Đơn Vị B', phone: '0909555666' },
    });

    mockStandardApi({
      confirmed: () => [bLaterConfirmed, bOtherDay, bOtherVenue],
      pending: () => [bEarlierPending],
    });
    renderScreen(OWNER);

    const section = await screen.findByRole('region', { name: 'Booking trong ngày' });
    await waitFor(() => expect(within(section).getAllByRole('listitem')).toHaveLength(2));
    const items = within(section).getAllByRole('listitem');

    // Sorted by startAt: bEarlierPending (16:00) first, bLaterConfirmed (18:00) second
    expect(within(items[0]!).getByText('Sân 1')).toBeDefined();
    expect(within(items[0]!).getByText('16:00–17:00')).toBeDefined();
    expect(within(items[0]!).getByText('Anh Minh')).toBeDefined();
    expect(within(items[0]!).getByText('Chờ xác nhận')).toBeDefined();
    expect(within(items[0]!).queryByRole('link')).toBeNull();

    expect(within(items[1]!).getByText('Sân 2')).toBeDefined();
    expect(within(items[1]!).getByText('18:00–19:30')).toBeDefined();
    expect(within(items[1]!).getByText('Chị Lan')).toBeDefined();
    expect(within(items[1]!).getByText('Đã xác nhận')).toBeDefined();
    const telLink = within(items[1]!).getByRole('link', { name: '0909111222' });
    expect(telLink.getAttribute('href')).toBe('tel:0909111222');

    expect(within(section).queryByText('Khách Ngày Mai')).toBeNull();
    expect(within(section).queryByText('Khách Đơn Vị B')).toBeNull();

    // Switch to a day with no bookings (CN 08/11)
    fireEvent.click(screen.getByRole('button', { name: 'CN 08/11' }));
    expect(await within(section).findByText('Chưa có booking trong ngày này')).toBeDefined();
  });

  it('AC-4: clicking 16:00 cell of Sân 1 opens "Nhập booking khách gọi" with court, date, fitting durations, "1 giờ" at "100.000đ", and "2 giờ" at "250.000đ"', async () => {
    mockStandardApi();
    renderScreen(OWNER);

    const cell = await screen.findByRole('button', { name: 'Sân 1 16:00' });
    fireEvent.click(cell);

    const dialog = screen.getByRole('dialog', { name: 'Nhập booking khách gọi' });
    expect(within(dialog).getByText('Sân 1')).toBeDefined();
    expect(within(dialog).getByText('16:00 ngày 06/11/2026')).toBeDefined();
    expect(within(dialog).getByText('100.000đ')).toBeDefined();

    const chips = within(within(dialog).getByRole('group', { name: 'Thời lượng' })).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['1 giờ', '1,5 giờ', '2 giờ', '2,5 giờ', '3 giờ']);
    expect(chips[0]!.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(within(dialog).getByRole('button', { name: '2 giờ' }));
    expect(within(dialog).getByText('250.000đ')).toBeDefined();

    const nameInput = within(dialog).getByLabelText('Tên khách') as HTMLInputElement;
    expect(nameInput.maxLength).toBe(100);
    expect(within(dialog).getByLabelText('Số điện thoại')).toBeDefined();
  });

  it('AC-5: saving a phone booking posts ISO times, closes sheet, shows "Đã lưu booking", and reloads Sân 1 availability and booking lists', async () => {
    let confirmedList: OwnerBookingView[] = [];
    const post = deferred<OwnerBookingView>();
    mockStandardApi({
      confirmed: () => confirmedList,
      postBooking: () => post.promise,
    });
    renderScreen(OWNER);

    fireEvent.click(await screen.findByRole('button', { name: 'Sân 1 16:00' }));
    expect(calls(`/api/courts/${C1}/availability?date=${TODAY}`)).toHaveLength(1);
    expect(calls(`/api/courts/${C2}/availability?date=${TODAY}`)).toHaveLength(1);
    expect(calls('/api/owner/bookings?status=CONFIRMED')).toHaveLength(1);
    expect(calls('/api/owner/bookings?status=PENDING')).toHaveLength(1);

    const dialog = screen.getByRole('dialog', { name: 'Nhập booking khách gọi' });
    fireEvent.click(within(dialog).getByRole('button', { name: '2 giờ' }));
    fireEvent.change(within(dialog).getByLabelText('Tên khách'), { target: { value: 'Chú Ba' } });
    fireEvent.change(within(dialog).getByLabelText('Số điện thoại'), { target: { value: '0901234567' } });

    const saveBtn = within(dialog).getByRole('button', { name: 'Lưu booking' }) as HTMLButtonElement;
    fireEvent.click(saveBtn);
    expect(saveBtn.disabled).toBe(true);
    expect(vi.mocked(clientModule.api)).toHaveBeenCalledWith('/api/owner/bookings', {
      method: 'POST',
      json: {
        courtId: C1,
        startAt: '2026-11-06T09:00:00.000Z',
        endAt: '2026-11-06T11:00:00.000Z',
        customerName: 'Chú Ba',
        customerPhone: '0901234567',
      },
    });

    const created = mkBooking('b-created', {
      courtId: C1,
      startAt: '2026-11-06T09:00:00.000Z',
      endAt: '2026-11-06T11:00:00.000Z',
      customer: { name: 'Chú Ba', phone: '0901234567' },
    });
    confirmedList = [created];

    await act(async () => {
      post.resolve(created);
    });

    expect(screen.queryByRole('dialog', { name: 'Nhập booking khách gọi' })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Đã lưu booking');
    await waitFor(() => expect(calls(`/api/courts/${C1}/availability?date=${TODAY}`)).toHaveLength(2));
    expect(calls(`/api/courts/${C2}/availability?date=${TODAY}`)).toHaveLength(1);
    await waitFor(() => expect(calls('/api/owner/bookings?status=CONFIRMED')).toHaveLength(2));
    expect(calls('/api/owner/bookings?status=PENDING')).toHaveLength(2);
    expect(await screen.findByText('Chú Ba')).toBeDefined();
  });

  it('AC-5: the sheet cannot close while saving, and the 201 still shows "Đã lưu booking" and reloads', async () => {
    const post = deferred<OwnerBookingView>();
    mockStandardApi({
      postBooking: () => post.promise,
    });
    renderScreen(OWNER);

    fireEvent.click(await screen.findByRole('button', { name: 'Sân 1 16:00' }));
    expect(calls(`/api/courts/${C1}/availability?date=${TODAY}`)).toHaveLength(1);
    expect(calls('/api/owner/bookings?status=CONFIRMED')).toHaveLength(1);
    expect(calls('/api/owner/bookings?status=PENDING')).toHaveLength(1);

    const dialog = screen.getByRole('dialog', { name: 'Nhập booking khách gọi' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu booking' }));

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    expect(screen.getByRole('dialog', { name: 'Nhập booking khách gọi' })).toBeDefined();

    const created = mkBooking('b-created', {
      courtId: C1,
      startAt: '2026-11-06T09:00:00.000Z',
      endAt: '2026-11-06T10:00:00.000Z',
    });
    await act(async () => {
      post.resolve(created);
    });

    expect(screen.queryByRole('dialog', { name: 'Nhập booking khách gọi' })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Đã lưu booking');
    await waitFor(() => expect(calls(`/api/courts/${C1}/availability?date=${TODAY}`)).toHaveLength(2));
    await waitFor(() => expect(calls('/api/owner/bookings?status=CONFIRMED')).toHaveLength(2));
    expect(calls('/api/owner/bookings?status=PENDING')).toHaveLength(2);
  });

  it('AC-6: handles 409 slot taken (close + alert + reload availability), 404 court gone (close + alert + reload venues), and 409 BUSY / 400 / network error inside sheet', async () => {
    let postErr: unknown = new ApiError(409, 'Yêu cầu đang được xử lý, hãy thử lại');
    mockStandardApi({
      postBooking: () => {
        throw postErr;
      },
    });
    renderScreen(OWNER);

    fireEvent.click(await screen.findByRole('button', { name: 'Sân 1 16:00' }));
    const dialog = screen.getByRole('dialog', { name: 'Nhập booking khách gọi' });
    fireEvent.click(within(dialog).getByRole('button', { name: '2 giờ' }));
    fireEvent.change(within(dialog).getByLabelText('Tên khách'), { target: { value: 'Chú Ba' } });
    fireEvent.change(within(dialog).getByLabelText('Số điện thoại'), { target: { value: '0901234567' } });
    const saveBtn = within(dialog).getByRole('button', { name: 'Lưu booking' }) as HTMLButtonElement;

    // 409 BUSY -> stays in sheet
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    expect(within(dialog).getByRole('alert').textContent).toBe('Yêu cầu đang được xử lý, hãy thử lại');
    expect(saveBtn.disabled).toBe(false);
    expect((within(dialog).getByLabelText('Tên khách') as HTMLInputElement).value).toBe('Chú Ba');

    // 400 phone message -> stays in sheet
    postErr = new ApiError(400, PHONE_MESSAGE);
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    expect(within(dialog).getByRole('alert').textContent).toBe(PHONE_MESSAGE);

    // 400 past start -> stays in sheet
    postErr = new ApiError(400, 'Giờ bắt đầu đã qua');
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    expect(within(dialog).getByRole('alert').textContent).toBe('Giờ bắt đầu đã qua');

    // Network error -> stays in sheet
    postErr = new TypeError('network');
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    expect(within(dialog).getByRole('alert').textContent).toBe('Không lưu được booking. Thử lại.');
    expect((within(dialog).getByLabelText('Tên khách') as HTMLInputElement).value).toBe('Chú Ba');

    // 409 slot taken -> closes sheet, shows screen alert, reloads availability
    postErr = new ApiError(409, 'Khung giờ này vừa có người đặt');
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    expect(screen.queryByRole('dialog', { name: 'Nhập booking khách gọi' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Khung giờ này vừa có người đặt');
    await waitFor(() => expect(calls(`/api/courts/${C1}/availability?date=${TODAY}`)).toHaveLength(2));

    // Reopen and trigger 404 -> closes sheet, shows screen alert, reloads venues
    fireEvent.click(await screen.findByRole('button', { name: 'Sân 1 16:00' }));
    postErr = new ApiError(404, 'Không tìm thấy sân');
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog', { name: 'Nhập booking khách gọi' })).getByRole('button', { name: 'Lưu booking' }));
    });
    expect(screen.queryByRole('dialog', { name: 'Nhập booking khách gọi' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Không tìm thấy sân');
    await waitFor(() => expect(calls('/api/owner/venues')).toHaveLength(2));
  });

  it('AC-7: at 15:10, cell 900 (15:00) and earlier cells are not buttons, while cell 930 (15:30) is a button', async () => {
    mockStandardApi({
      availability: () => ({ free: [range(TODAY, '06:00', '22:00')] }),
    });
    const { rerender } = renderScreen(OWNER);

    await waitFor(() => expect(buttonMinutes(rowOf('Sân 1'))[0]).toBe(930));
    const row = rowOf('Sân 1');
    const cell900 = row.querySelector<HTMLElement>('[data-minute="900"]')!;
    const cell930 = row.querySelector<HTMLElement>('[data-minute="930"]')!;
    expect(cell900.tagName).not.toBe('BUTTON');
    expect(cell900.getAttribute('aria-disabled')).toBe('true');
    expect(cell930.tagName).toBe('BUTTON');

    fireEvent.click(cell930);
    const dialog = screen.getByRole('dialog', { name: 'Nhập booking khách gọi' });
    vi.setSystemTime(new Date('2026-11-06T15:35:00+07:00'));
    rerender(
      <MemoryRouter initialEntries={['/chu-san/lich']}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="*" element={<Probe />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(within(dialog).getByRole('alert').textContent).toBe('Giờ bắt đầu đã qua');
    expect((within(dialog).getByRole('button', { name: 'Lưu booking' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('AC-8: switching from "Hôm nay" to "T7 07/11" while first replies are pending drops the late replies for 06/11', async () => {
    const pendingAvail = new Map<string, (v: unknown) => void>();
    const bToday = mkBooking('b-today', {
      courtId: C1,
      startAt: '2026-11-06T18:00:00+07:00',
      endAt: '2026-11-06T19:00:00+07:00',
      customer: { name: 'Khách Hôm Nay', phone: null },
    });
    const bTomorrow = mkBooking('b-tomorrow', {
      courtId: C1,
      startAt: '2026-11-07T08:00:00+07:00',
      endAt: '2026-11-07T09:00:00+07:00',
      customer: { name: 'Khách Ngày Mai', phone: null },
    });

    mockStandardApi({
      confirmed: () => [bToday, bTomorrow],
      availability: (courtId, date) =>
        new Promise((resolve) => {
          pendingAvail.set(`${courtId}|${date}`, resolve);
        }),
    });
    renderScreen(OWNER);

    await waitFor(() => expect(pendingAvail.has(`${C1}|${TODAY}`)).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'T7 07/11' }));
    await waitFor(() => expect(pendingAvail.has(`${C1}|${TOMORROW}`)).toBe(true));

    await act(async () => {
      pendingAvail.get(`${C1}|${TOMORROW}`)!({ free: [range(TOMORROW, '08:00', '10:00')] });
      pendingAvail.get(`${C2}|${TOMORROW}`)!({ free: [] });
    });
    await waitFor(() => expect(buttonMinutes(rowOf('Sân 1'))).toEqual([480, 510, 540]));
    expect(screen.getByText('Khách Ngày Mai')).toBeDefined();
    expect(screen.queryByText('Khách Hôm Nay')).toBeNull();

    // Now the stale 06/11 reply arrives late -> must be dropped
    await act(async () => {
      pendingAvail.get(`${C1}|${TODAY}`)!({ free: FREE_SAN_1 });
      pendingAvail.get(`${C2}|${TODAY}`)!({ free: FREE_SAN_2 });
    });
    expect(buttonMinutes(rowOf('Sân 1'))).toEqual([480, 510, 540]);
    expect(screen.getByText('Khách Ngày Mai')).toBeDefined();
    expect(screen.queryByText('Khách Hôm Nay')).toBeNull();
  });

  it('AC-9: guest sees login prompt, USER redirects to /, and ADMIN renders nothing (neither calls owner APIs)', async () => {
    vi.mocked(clientModule.api).mockResolvedValue([]);

    // 1. Guest
    const { unmount: unmountGuest } = renderScreen(null);
    expect(screen.getByText('Đăng nhập để xem lịch sân')).toBeDefined();
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
    expect(screen.queryByRole('navigation', { name: 'Ngày' })).toBeNull();
    expect(vi.mocked(clientModule.api)).not.toHaveBeenCalled();
    unmountAdmin();
  });

  it('AC-9: while the login sheet is open the booking sheet is hidden, and its inputs come back after login', async () => {
    mockStandardApi({
      postBooking: () => {
        throw new ApiError(401, 'Chưa đăng nhập');
      },
    });
    renderScreen(OWNER);

    fireEvent.click(await screen.findByRole('button', { name: 'Sân 1 16:00' }));
    const dialog = screen.getByRole('dialog', { name: 'Nhập booking khách gọi' });
    fireEvent.click(within(dialog).getByRole('button', { name: '2 giờ' }));
    fireEvent.change(within(dialog).getByLabelText('Tên khách'), { target: { value: 'Chú Ba' } });
    fireEvent.change(within(dialog).getByLabelText('Số điện thoại'), { target: { value: '0901234567' } });

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu booking' }));
    });

    const loginDialog = await screen.findByRole('dialog', { name: 'Đăng nhập' });
    expect(within(loginDialog).getByText('Phiên đăng nhập đã hết. Hãy đăng nhập lại.')).toBeDefined();
    expect(screen.queryByRole('dialog', { name: 'Nhập booking khách gọi' })).toBeNull();

    fireEvent.change(within(loginDialog).getByLabelText('Số điện thoại'), {
      target: { value: '0912345678' },
    });
    fireEvent.change(within(loginDialog).getByLabelText('Mật khẩu'), {
      target: { value: 'password123' },
    });
    await act(async () => {
      fireEvent.click(within(loginDialog).getByRole('button', { name: 'Đăng nhập' }));
    });

    expect(screen.queryByRole('dialog', { name: 'Đăng nhập' })).toBeNull();
    const reopened = await screen.findByRole('dialog', { name: 'Nhập booking khách gọi' });
    expect((within(reopened).getByLabelText('Tên khách') as HTMLInputElement).value).toBe('Chú Ba');
    expect((within(reopened).getByLabelText('Số điện thoại') as HTMLInputElement).value).toBe('0901234567');
    expect(within(reopened).getByRole('button', { name: '2 giờ' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('AC-10: handles venue load error with retry, single court availability error without blocking other courts, and empty venue list', async () => {
    let venueCalls = 0;
    let c1Calls = 0;
    mockStandardApi({
      venues: () => {
        venueCalls += 1;
        if (venueCalls === 1) throw new ApiError(500, 'Lỗi server');
        return [VENUE_A];
      },
      availability: (courtId) => {
        if (courtId === C1 && ++c1Calls === 1) throw new ApiError(500, 'Lỗi sân 1');
        return { free: FREE_SAN_2 };
      },
    });
    const { unmount } = renderScreen(OWNER);

    // 1. Venue error -> "Không tải được" + "Thử lại"
    expect(await screen.findByText('Không tải được')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    // 2. Sân 1 fails availability, Sân 2 still renders
    expect(await screen.findByText('Không tải được giờ trống')).toBeDefined();
    await waitFor(() =>
      expect(buttonMinutes(rowOf('Sân 2'))).toEqual([930, 960, 990, 1020, 1200, 1230, 1260]),
    );

    unmount();

    // 3. Empty venue list -> "Bạn chưa có đơn vị nào"
    mockStandardApi({ venues: () => [] });
    renderScreen(OWNER);
    expect(await screen.findByText('Bạn chưa có đơn vị nào')).toBeDefined();
  });

  it('AC-11: long text wraps with overflowWrap anywhere and minWidth 0, nothing forces sideways scroll, and interactive targets are at least 44px high', async () => {
    const long = 'Rất-dài'.repeat(40);
    mockStandardApi({
      venues: () => [
        {
          ...VENUE_A,
          name: long,
          courts: [{ id: C1, name: long, sport: 'BADMINTON', priceNormal: 100000, pricePeak: 150000 }],
        },
      ],
      confirmed: () => [
        mkBooking('b1', {
          courtId: C1,
          startAt: '2026-11-06T18:00:00+07:00',
          endAt: '2026-11-06T19:30:00+07:00',
          customer: { name: long, phone: '0901234567' },
        }),
      ],
    });
    renderScreen(OWNER);

    const card = (await screen.findByText(long, { selector: '[data-field="customer"]' })).closest(
      '[data-booking-id="b1"]',
    ) as HTMLElement;
    expect(card.style.minWidth).toBe('0px');
    expect(card.style.maxWidth).toBe('100%');

    for (const field of ['court', 'slot', 'customer', 'phone']) {
      const el = card.querySelector<HTMLElement>(`[data-field="${field}"]`)!;
      expect(el.style.overflowWrap).toBe('anywhere');
      expect(el.style.minWidth).toBe('0px');
      expect(el.style.whiteSpace).not.toBe('nowrap');
    }
    const phoneLink = card.querySelector<HTMLElement>('[data-field="phone"]')!;
    expect(phoneLink.style.minHeight).toBe('44px');
  });
});
