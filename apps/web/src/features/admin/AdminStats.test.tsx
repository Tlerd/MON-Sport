import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminStatsView } from '@monsport/shared';
import { AdminStats } from './AdminStats.tsx';

const VA = '0199a1b2-0000-7000-8000-0000000000a1';
const VB = '0199a1b2-0000-7000-8000-0000000000a2';

/** The week of Monday 16/11/2026, as the API of brief F-016 answers for `date=2026-11-20`. */
const WEEK: AdminStatsView = {
  date: '2026-11-20',
  weekStart: '2026-11-16',
  weekEnd: '2026-11-22',
  accounts: { ADMIN: 1, OWNER: 3, USER: 40, STAFF: 2 },
  newUsers: 5,
  activeUsers: 3,
  avgConfirmMinutes: 25,
  expiryRate: 0.2,
  venues: [
    { venueId: VA, venueName: 'Cầu lông A', bookingCount: 4, matchCount: 1 },
    { venueId: VB, venueName: 'Cầu lông B', bookingCount: 0, matchCount: 0 },
  ],
};

/** Another week of the same data: `date` is the day that the client asked for. */
function weekOf(date: string, weekStart: string, weekEnd: string): AdminStatsView {
  return { ...WEEK, date, weekStart, weekEnd };
}

const ok = (json: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(json) });

/** A request that the test settles by hand, so a slow answer can arrive late. */
function deferred() {
  let resolve!: (json: unknown) => void;
  const promise = new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>((r) => {
    resolve = (json) => r({ ok: true, status: 200, json: () => Promise.resolve(json) });
  });
  return { promise, resolve };
}

const card = (label: string) => screen.getByText(label, { selector: '.k' }).closest('.tile') as HTMLElement;

describe('AdminStats', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-13: shows the cards for accounts by role, new users, active users, confirm time, and expiry rate', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok(WEEK)));
    render(<AdminStats />);

    expect(await screen.findByText('16/11 – 22/11/2026')).toBeTruthy();
    expect(within(card('Admin')).getByText('1')).toBeTruthy();
    expect(within(card('Chủ sân')).getByText('3')).toBeTruthy();
    expect(within(card('Nhân viên')).getByText('2')).toBeTruthy();
    expect(within(card('Người dùng')).getByText('40')).toBeTruthy();
    expect(within(card('Người dùng mới')).getByText('5')).toBeTruthy();
    expect(within(card('Người dùng hoạt động')).getByText('3')).toBeTruthy();
    expect(within(card('Thời gian xác nhận trung bình')).getByText('25 phút')).toBeTruthy();
    expect(within(card('Tỉ lệ hết hạn')).getByText('20%')).toBeTruthy();
  });

  it('AC-13: shows the booking and match count of each venue in a table', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok(WEEK)));
    render(<AdminStats />);

    const table = await screen.findByRole('table', { name: 'Booking và trận theo đơn vị' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Đơn vị', 'Booking', 'Trận']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => [...r.children].map((c) => c.textContent))).toEqual([
      ['Cầu lông A', '4', '1'],
      ['Cầu lông B', '0', '0'],
    ]);
  });

  it('AC-13: shows "Chưa có dữ liệu" for a null confirm time, and 0% for an expiry rate of 0', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok({ ...WEEK, avgConfirmMinutes: null, expiryRate: 0, venues: [] })));
    render(<AdminStats />);

    await screen.findByText('16/11 – 22/11/2026');
    expect(within(card('Thời gian xác nhận trung bình')).getByText('Chưa có dữ liệu')).toBeTruthy();
    expect(within(card('Tỉ lệ hết hạn')).getByText('0%')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('Chưa có đơn vị nào.')).toBeTruthy();
  });

  it('AC-13: shows an error with role alert, and does not crash, when the answer fails AdminStatsView', async () => {
    const bad = { ...WEEK, accounts: { ADMIN: 'một' } };
    expect(AdminStatsView.safeParse(bad).success).toBe(false);
    vi.stubGlobal('fetch', vi.fn(() => ok(bad)));
    render(<AdminStats />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Số liệu nhận về không đúng dạng. Hãy thử lại sau.');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('Người dùng mới')).toBeNull();
  });

  it('AC-13: shows the message of the API when the call fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({ message: 'Không có quyền' }) })));
    render(<AdminStats />);

    expect((await screen.findByRole('alert')).textContent).toBe('Không có quyền');
  });

  it('AC-13: "Thử lại" asks again after the first load fails, and shows the numbers', async () => {
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ message: 'Lỗi máy chủ' }) }))
      .mockImplementation(() => ok(WEEK));
    vi.stubGlobal('fetch', fetch);
    render(<AdminStats />);

    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByText('Người dùng mới')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('AC-13: asks for the week of today first, with no date in the request', async () => {
    const fetch = vi.fn((_url: string) => ok(WEEK));
    vi.stubGlobal('fetch', fetch);
    render(<AdminStats />);

    await screen.findByText('16/11 – 22/11/2026');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe('/api/admin/stats');
  });

  it('AC-14: "Tuần trước" asks for date=2026-11-13 and shows the label 09/11 – 15/11/2026', async () => {
    const fetch = vi.fn((url: string) => ok(url.endsWith('date=2026-11-13') ? weekOf('2026-11-13', '2026-11-09', '2026-11-15') : WEEK));
    vi.stubGlobal('fetch', fetch);
    render(<AdminStats />);
    await screen.findByText('16/11 – 22/11/2026');

    fireEvent.click(screen.getByRole('button', { name: 'Tuần trước' }));

    expect(await screen.findByText('09/11 – 15/11/2026')).toBeTruthy();
    expect(fetch.mock.calls.at(-1)![0]).toBe('/api/admin/stats?date=2026-11-13');
  });

  it('AC-14: "Tuần sau" moves the date forward 7 days', async () => {
    const fetch = vi.fn((url: string) => ok(url.endsWith('date=2026-11-27') ? weekOf('2026-11-27', '2026-11-23', '2026-11-29') : WEEK));
    vi.stubGlobal('fetch', fetch);
    render(<AdminStats />);
    await screen.findByText('16/11 – 22/11/2026');

    fireEvent.click(screen.getByRole('button', { name: 'Tuần sau' }));

    expect(await screen.findByText('23/11 – 29/11/2026')).toBeTruthy();
    expect(fetch.mock.calls.at(-1)![0]).toBe('/api/admin/stats?date=2026-11-27');
  });

  it('AC-14: a slow answer for an older week that arrives late is ignored', async () => {
    const slow = deferred();
    const fetch = vi.fn((url: string) => {
      if (url.endsWith('date=2026-11-13')) return slow.promise;
      if (url.endsWith('date=2026-11-06')) return ok(weekOf('2026-11-06', '2026-11-02', '2026-11-08'));
      return ok(WEEK);
    });
    vi.stubGlobal('fetch', fetch);
    render(<AdminStats />);
    await screen.findByText('16/11 – 22/11/2026');

    fireEvent.click(screen.getByRole('button', { name: 'Tuần trước' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tuần trước' }));
    expect(await screen.findByText('02/11 – 08/11/2026')).toBeTruthy();
    expect(fetch.mock.calls.at(-1)![0]).toBe('/api/admin/stats?date=2026-11-06');

    slow.resolve(weekOf('2026-11-13', '2026-11-09', '2026-11-15'));
    await new Promise((r) => setTimeout(r, 20));
    await waitFor(() => expect(screen.queryByText('09/11 – 15/11/2026')).toBeNull());
    expect(screen.getByText('02/11 – 08/11/2026')).toBeTruthy();
  });

  it('AC-14: writes a week that crosses a year as dd/MM – dd/MM/yyyy', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok(weekOf('2026-12-30', '2026-12-28', '2027-01-03'))));
    render(<AdminStats />);

    expect(await screen.findByText('28/12 – 03/01/2027')).toBeTruthy();
  });
});
