import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import { App } from '../../app/App';
import type { ShellContextType } from '../../app/App';
import * as sessionModule from '../../app/session';
import { VenueListScreen } from './VenueListScreen';
import { VenueScreen } from './VenueScreen';

vi.mock('@monsport/client', async () => {
  const actual = await vi.importActual<typeof import('@monsport/client')>('@monsport/client');
  return { ...actual, api: vi.fn() };
});

const C1 = '00000000-0000-4000-8000-000000000001';
const C2 = '00000000-0000-4000-8000-000000000002';
const VENUE = {
  id: 'v1',
  name: 'Cầu lông A',
  address: 'Hà Nội',
  phone: '0912345678',
  opensAt: 360,
  closesAt: 1380,
  courts: [
    { id: C1, name: 'Sân 1', sport: 'BADMINTON', priceNormal: 80000, pricePeak: 120000 },
    { id: C2, name: 'Sân 2', sport: 'BADMINTON', priceNormal: 80000, pricePeak: 120000 },
  ],
};

const range = (date: string, from: string, to: string) => ({
  startAt: `${date}T${from}:00+07:00`,
  endAt: `${date}T${to}:00+07:00`,
});
/** Sân 1: 18:00-20:00 and 21:00-23:00. Sân 2: 17:00-19:00. */
const FREE_1 = [range('2026-10-30', '18:00', '20:00'), range('2026-10-30', '21:00', '23:00')];
const FREE_2 = [range('2026-10-30', '17:00', '19:00')];

type Handler = (courtId: string, date: string) => unknown;
const calls = (courtId: string, date: string) =>
  vi
    .mocked(clientModule.api)
    .mock.calls.filter((c) => c[0] === `/api/courts/${courtId}/availability?date=${date}`);

function mockApi(venues: unknown, availability: Handler) {
  vi.mocked(clientModule.api).mockImplementation((async (path: string) => {
    if (path === '/api/venues') return venues;
    const m = /^\/api\/courts\/([^/]+)\/availability\?date=(.+)$/.exec(path);
    if (m) return availability(m[1], m[2]);
    throw new ApiError(404, 'Không có');
  }) as never);
}
const standard: Handler = (courtId, date) => ({
  free: date === '2026-10-30' ? (courtId === C1 ? FREE_1 : FREE_2) : [],
});

/** A tiny shell: the outlet context of App, with the top bar parts shown as plain elements. */
function Shell() {
  const [title, setTitle] = useState<string | undefined>(undefined);
  const [onBack, setOnBack] = useState<(() => void) | undefined>(undefined);
  const [actions, setActions] = useState<ReactNode>(undefined);
  const context = {
    setTitle,
    setOnBack,
    setTopBarActions: setActions,
    unreadNotifications: 0,
    pendingRequests: 0,
    refreshCounts: () => {},
  } satisfies ShellContextType;
  return (
    <>
      <header>
        {title && <h1>{title}</h1>}
        {onBack && <button aria-label="Quay lại" onClick={onBack} />}
        {actions}
      </header>
      <Outlet context={context} />
    </>
  );
}

function openVenue(path = '/don-vi/v1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Shell />}>
          <Route index element={<p>Danh sách</p>} />
          <Route path="don-vi/:id" element={<VenueScreen />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const rowOf = (courtName: string) => screen.getByRole('group', { name: `Giờ trống ${courtName}` });
const buttonMinutes = (row: HTMLElement) =>
  Array.from(row.querySelectorAll('button')).map((b) => Number(b.getAttribute('data-minute')));

describe('VenueScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T10:00:00+07:00'));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
    delete (HTMLElement.prototype as { offsetLeft?: unknown }).offsetLeft;
  });

  it('AC-7: the list opens the venue with its title, no tab bar, 7 day chips, and back returns', async () => {
    vi.spyOn(sessionModule, 'useSession').mockReturnValue({
      user: null,
      setUser: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      loading: false,
    });
    mockApi([VENUE], standard);
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<App />}>
            <Route index element={<VenueListScreen />} />
            <Route path="don-vi/:id" element={<VenueScreen />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('monsport')).toBeDefined();
    fireEvent.click((await screen.findByText('Cầu lông A')).closest('button')!);

    expect(await screen.findByRole('heading', { level: 1, name: 'Cầu lông A' })).toBeDefined();
    expect(screen.queryByText('monsport')).toBeNull();
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Điều hướng' })).toBeNull();
    expect(screen.getByText('App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.')).toBeDefined();
    const chips = Array.from(within(screen.getByRole('navigation', { name: 'Ngày' })).getAllByRole('button'));
    expect(chips.map((c) => c.textContent)).toEqual([
      'Hôm nay',
      'T6 30/10',
      'T7 31/10',
      'CN 01/11',
      'T2 02/11',
      'T3 03/11',
      'T4 04/11',
    ]);
    expect(chips[0].getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(await screen.findByRole('navigation', { name: 'Điều hướng' })).toBeDefined();
    expect(screen.getByText('monsport')).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('AC-8: one request for each court, and a row of 34 cells with the right buttons and peak marks', async () => {
    mockApi([VENUE], standard);
    openVenue();
    fireEvent.click(await screen.findByRole('button', { name: 'T6 30/10' }));
    await waitFor(() => expect(buttonMinutes(rowOf('Sân 1'))).toEqual([1080, 1110, 1140, 1260, 1290, 1320]));

    expect(calls(C1, '2026-10-30')).toHaveLength(1);
    expect(calls(C2, '2026-10-30')).toHaveLength(1);
    const row = rowOf('Sân 1');
    const cells = Array.from(row.querySelectorAll<HTMLElement>('.slot-cell'));
    expect(cells).toHaveLength(34);
    expect(cells[0].getAttribute('data-minute')).toBe('360');
    expect(cells[33].getAttribute('data-minute')).toBe('1350');
    for (const cell of cells) {
      if (cell.tagName === 'BUTTON') continue;
      expect(cell.getAttribute('aria-disabled')).toBe('true');
      expect(cell.getAttribute('tabindex')).toBe('-1');
    }
    const peak = cells.filter((c) => c.classList.contains('peak-marker')).map((c) => Number(c.dataset.minute));
    expect(peak).toEqual([1020, 1050, 1080, 1110, 1140, 1170, 1200, 1230, 1260, 1290]);
  });

  it('AC-9: the rows scroll to the Tối window on another day, and to Sáng on its chip, without filtering', async () => {
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { value: scrollTo, configurable: true, writable: true });
    Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
      configurable: true,
      get(this: HTMLElement) {
        return ((Number(this.dataset.minute) - 360) / 30) * 40;
      },
    });
    mockApi([VENUE], standard);
    openVenue();
    fireEvent.click(await screen.findByRole('button', { name: 'T6 30/10' }));
    await waitFor(() => expect(buttonMinutes(rowOf('Sân 1'))).toHaveLength(6));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 880 });

    scrollTo.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Sáng 6–12' }));
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenNthCalledWith(1, { left: 0 });
    expect(scrollTo).toHaveBeenNthCalledWith(2, { left: 0 });
    expect(scrollTo.mock.contexts.map((c) => (c as HTMLElement).getAttribute('data-court-id')).sort()).toEqual(
      [C1, C2].sort(),
    );
    expect(rowOf('Sân 1').querySelectorAll('.slot-cell')).toHaveLength(34);
    expect(rowOf('Sân 2').querySelectorAll('.slot-cell')).toHaveLength(34);
    expect(screen.getByRole('button', { name: 'Chiều 12–17' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Tối 17–23' })).toBeDefined();
  });

  it('AC-10: a cell selects, the action bar shows the court, hours, price and call link, and a new day clears it', async () => {
    mockApi([VENUE], standard);
    openVenue();
    fireEvent.click(await screen.findByRole('button', { name: 'T6 30/10' }));
    const cell = await screen.findByRole('button', { name: 'Sân 1 18:00' });
    fireEvent.click(cell);

    expect(cell.classList.contains('slot-selected')).toBe(true);
    const bar = screen.getByRole('complementary', { name: 'Thanh hành động' });
    expect(within(bar).getByText('Sân 1 · 18:00–19:00')).toBeDefined();
    expect(within(bar).getByText('120k')).toBeDefined();
    expect(within(bar).getByRole('button', { name: 'Gửi yêu cầu' })).toBeDefined();
    const links = screen.getAllByRole('link', { name: 'Gọi chủ sân' });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link.getAttribute('href')).toBe('tel:0912345678');
    expect(bar.contains(links[1]) || bar.contains(links[0])).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'T7 31/10' }));
    expect(screen.queryByRole('complementary', { name: 'Thanh hành động' })).toBeNull();
    expect(document.querySelector('.slot-selected')).toBeNull();
  });

  it('AC-11: when every court has no free time, the screen says so and shows no cell buttons', async () => {
    mockApi([VENUE], () => ({ free: [] }));
    openVenue();
    expect(await screen.findByText('Hết giờ trống trong ngày này. Hãy chọn ngày khác.')).toBeDefined();
    expect(document.querySelectorAll('button.slot-cell')).toHaveLength(0);
  });

  it('AC-12: a late answer for an older date does not replace the rows', async () => {
    const pending = new Map<string, (value: unknown) => void>();
    mockApi([VENUE], (courtId, date) => {
      if (date === '2026-10-30' || date === '2026-10-31') {
        return new Promise((resolve) => pending.set(`${courtId}|${date}`, resolve));
      }
      return { free: [] };
    });
    openVenue();
    fireEvent.click(await screen.findByRole('button', { name: 'T6 30/10' }));
    await waitFor(() => expect(pending.has(`${C1}|2026-10-30`)).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'T7 31/10' }));
    await waitFor(() => expect(pending.has(`${C1}|2026-10-31`)).toBe(true));

    await act(async () => {
      pending.get(`${C1}|2026-10-31`)!({ free: [range('2026-10-31', '18:00', '20:00')] });
      pending.get(`${C2}|2026-10-31`)!({ free: [] });
    });
    await waitFor(() => expect(buttonMinutes(rowOf('Sân 1'))).toEqual([1080, 1110, 1140]));

    await act(async () => {
      pending.get(`${C1}|2026-10-30`)!({ free: [range('2026-10-30', '21:00', '23:00')] });
      pending.get(`${C2}|2026-10-30`)!({ free: [] });
    });
    expect(buttonMinutes(rowOf('Sân 1'))).toEqual([1080, 1110, 1140]);
  });

  it('AC-13: an unknown venue shows the message, and Về danh sách opens the list', async () => {
    mockApi([VENUE], standard);
    openVenue('/don-vi/khong-co');
    expect(await screen.findByText('Không tìm thấy đơn vị')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Về danh sách' }));
    expect(await screen.findByText('Danh sách')).toBeDefined();
  });

  it('AC-19: arrows move focus between startable cells, on a row and between courts', async () => {
    mockApi([VENUE], standard);
    openVenue();
    fireEvent.click(await screen.findByRole('button', { name: 'T6 30/10' }));
    await waitFor(() => expect(buttonMinutes(rowOf('Sân 2'))).toEqual([1020, 1050, 1080]));

    const start = within(rowOf('Sân 1')).getByRole('button', { name: 'Sân 1 18:00' });
    start.focus();
    fireEvent.keyDown(start, { key: 'ArrowRight' });
    const next = within(rowOf('Sân 1')).getByRole('button', { name: 'Sân 1 18:30' });
    expect(document.activeElement).toBe(next);

    fireEvent.keyDown(next, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(within(rowOf('Sân 2')).getByRole('button', { name: 'Sân 2 18:00' }));

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(within(rowOf('Sân 1')).getByRole('button', { name: 'Sân 1 18:00' }));

    // Sân 1 ends its cells at 20:00 and then jumps to 21:00: ArrowRight skips the disabled cells.
    const last = within(rowOf('Sân 1')).getByRole('button', { name: 'Sân 1 19:00' });
    last.focus();
    fireEvent.keyDown(last, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(within(rowOf('Sân 1')).getByRole('button', { name: 'Sân 1 21:00' }));
  });

  it('AC-22: a failed court shows its own error with a retry that loads that court only', async () => {
    let c1Calls = 0;
    mockApi([VENUE], (courtId) => {
      if (courtId === C1 && ++c1Calls === 1) throw new ApiError(500, 'Có lỗi');
      return { free: [] };
    });
    openVenue();
    expect(await screen.findByText('Không tải được giờ trống')).toBeDefined();
    await waitFor(() => expect(calls(C2, '2026-10-29')).toHaveLength(1));
    expect(screen.queryByText(/Hết giờ trống trong ngày này/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(calls(C1, '2026-10-29')).toHaveLength(2));
    expect(calls(C2, '2026-10-29')).toHaveLength(1);
    expect(await screen.findByText('Hết giờ trống trong ngày này. Hãy chọn ngày khác.')).toBeDefined();
  });
});
