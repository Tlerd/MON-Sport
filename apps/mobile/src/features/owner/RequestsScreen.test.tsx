import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import type { OwnerBookingView, VenueView } from '@monsport/shared';
import * as sessionModule from '../../app/session';
import { RequestsScreen } from './RequestsScreen';

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

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const NOW = '2026-11-06T15:30:00+07:00';
const LIST = '/api/owner/bookings?status=PENDING';
const VENUES = '/api/owner/venues';
const CONFIRM = (n: number) => `/api/owner/bookings/${id(n)}/confirm`;
const REJECT = (n: number) => `/api/owner/bookings/${id(n)}/reject`;

function booking(n: number, over: Partial<OwnerBookingView> = {}): OwnerBookingView {
  return {
    id: id(n),
    courtId: id(n + 4),
    startAt: `2026-11-06T${17 + n}:00:00+07:00`,
    endAt: `2026-11-06T${18 + n}:00:00+07:00`,
    status: 'PENDING',
    source: 'ONLINE',
    priceTotal: 240000,
    confirmDeadline: '2026-11-06T17:00:00+07:00',
    confirmedAt: null,
    cancelledAt: null,
    createdAt: '2026-11-06T10:00:00+07:00',
    paidAtVenue: false,
    customer: { name: n === 1 ? 'Nguyễn Văn A' : `Khách ${n}`, phone: n === 1 ? '0901234567' : null },
    ...over,
  } as OwnerBookingView;
}

function venues(): VenueView[] {
  return [
    {
      id: id(8),
      name: 'Sân Cầu Lông An Phú',
      courts: [
        { id: id(5), name: 'Sân 1' },
        { id: id(6), name: 'Sân 2' },
      ],
    },
  ] as unknown as VenueView[];
}

function two() {
  return [booking(1), booking(2)];
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

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

function calls(path: string) {
  return vi.mocked(clientModule.api).mock.calls.filter((c) => c[0] === path);
}

/** Routes the mocked api by path. A handler may return a value, a promise, or throw. */
function mockApi(handlers: Record<string, () => unknown>) {
  vi.mocked(clientModule.api).mockImplementation((async (p: string) => {
    const h = handlers[p];
    if (!h) throw new Error(`unexpected ${p}`);
    return h();
  }) as typeof clientModule.api);
}

function lastCount(spy: ReturnType<typeof vi.fn>) {
  return spy.mock.calls.at(-1)?.[0];
}

function Probe() {
  const location = useLocation();
  return (
    <>
      <p data-testid="path">{location.pathname}</p>
      <RequestsScreen />
    </>
  );
}

function Shell({ ctx }: { ctx: Record<string, unknown> }) {
  return <Outlet context={ctx} />;
}

function renderScreen(user: User, ctx: Record<string, unknown> = {}) {
  const setPending = vi.fn();
  const refreshCounts = vi.fn();
  vi.spyOn(sessionModule, 'useSession').mockReturnValue({
    user,
    setUser: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    loading: false,
  });
  const view = render(
    <MemoryRouter initialEntries={['/chu-san/yeu-cau']}>
      <Routes>
        <Route element={<Shell ctx={{ setPendingRequests: setPending, refreshCounts, ...ctx }} />}>
          <Route path="*" element={<Probe />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  return { setPending, refreshCounts, ...view };
}

const cardOf = (n: number) => document.querySelector(`[data-booking-id="${id(n)}"]`) as HTMLElement | null;
const btn = (card: HTMLElement, name: string) => within(card).getByRole('button', { name }) as HTMLButtonElement;

describe('RequestsScreen', () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    vi.restoreAllMocks();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  it('AC-1: OWNER sees 2 cards in order with court, venue, slot, price, customer, tel link only on R1, deadline, buttons, data-booking-id, header', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    mockApi({ [LIST]: two, [VENUES]: venues });
    renderScreen(OWNER);

    await screen.findByText('Nguyễn Văn A');
    expect(screen.getByRole('heading', { name: '2 yêu cầu đang chờ' })).toBeDefined();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const r1 = cardOf(1)!;
    const r2 = cardOf(2)!;
    expect(rows[0]!.contains(r1)).toBe(true);
    expect(rows[1]!.contains(r2)).toBe(true);

    await waitFor(() => expect(within(r1).getByText('Sân 1')).toBeDefined());
    expect(within(r1).getByText('Sân Cầu Lông An Phú')).toBeDefined();
    expect(within(r1).getByText('18:00–19:00 ngày 06/11/2026')).toBeDefined();
    expect(within(r1).getByText('240.000đ')).toBeDefined();
    const tel = within(r1).getByRole('link', { name: '0901234567' });
    expect(tel.getAttribute('href')).toBe('tel:0901234567');
    expect(within(r1).getByText('Còn 1 giờ 30 phút')).toBeDefined();
    expect(btn(r1, 'Xác nhận')).toBeDefined();
    expect(btn(r1, 'Từ chối')).toBeDefined();

    expect(within(r2).getByText('Sân 2')).toBeDefined();
    expect(within(r2).queryByRole('link')).toBeNull();
  });

  it('AC-1: a failed GET /api/owner/venues still shows both cards with "Sân" and no venue name', async () => {
    mockApi({
      [LIST]: two,
      [VENUES]: () => {
        throw new ApiError(500, 'Lỗi');
      },
    });
    renderScreen(OWNER);

    await screen.findByText('Nguyễn Văn A');
    await waitFor(() => expect(calls(VENUES)).toHaveLength(1));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(within(cardOf(1)!).getByText('Sân')).toBeDefined();
    expect(within(cardOf(2)!).getByText('Sân')).toBeDefined();
    expect(screen.queryByText('Sân Cầu Lông An Phú')).toBeNull();
    expect(screen.getByRole('heading', { name: '2 yêu cầu đang chờ' })).toBeDefined();
  });

  it('AC-2: an empty list shows "Chưa có yêu cầu nào đang chờ"', async () => {
    mockApi({ [LIST]: () => [], [VENUES]: venues });
    renderScreen(OWNER);

    expect(await screen.findByText('Chưa có yêu cầu nào đang chờ')).toBeDefined();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('AC-2: a network error shows "Không tải được"; "Thử lại" reloads', async () => {
    let gets = 0;
    mockApi({
      [LIST]: () => {
        gets += 1;
        if (gets === 1) throw new TypeError('network');
        return two();
      },
      [VENUES]: venues,
    });
    renderScreen(OWNER);

    expect(await screen.findByText('Không tải được')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Nguyễn Văn A')).toBeDefined();
    expect(gets).toBe(2);
  });

  it('AC-2: a failed reload keeps the list and shows no error', async () => {
    let gets = 0;
    mockApi({
      [LIST]: () => {
        gets += 1;
        if (gets === 1) return two();
        throw new TypeError('network');
      },
      [VENUES]: venues,
    });
    renderScreen(OWNER);
    await screen.findByText('Nguyễn Văn A');

    act(() => setVisibility('visible'));
    await waitFor(() => expect(gets).toBe(2));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText('Không tải được')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('AC-3: a guest sees "Đăng nhập để xem yêu cầu"; "Đăng nhập" opens the sheet; no GET', async () => {
    vi.mocked(clientModule.api).mockResolvedValue([]);
    renderScreen(null);

    expect(screen.getByText('Đăng nhập để xem yêu cầu')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByRole('dialog')).toBeDefined();
    expect(calls(LIST)).toHaveLength(0);
    expect(vi.mocked(clientModule.api)).not.toHaveBeenCalled();
  });

  it('AC-3: a USER goes to / and makes no request', async () => {
    vi.mocked(clientModule.api).mockResolvedValue([]);
    renderScreen(USER);

    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/'));
    expect(vi.mocked(clientModule.api)).not.toHaveBeenCalled();
  });

  it('AC-3: an ADMIN renders nothing and makes no request', () => {
    vi.mocked(clientModule.api).mockResolvedValue([]);
    renderScreen(ADMIN);

    expect(screen.queryByRole('listitem')).toBeNull();
    expect(vi.mocked(clientModule.api)).not.toHaveBeenCalled();
  });

  it('AC-4: "Xác nhận" posts once, locks both buttons, removes the card, shows status, header 1, setPendingRequests', async () => {
    const post = deferred<unknown>();
    mockApi({ [LIST]: two, [VENUES]: venues, [CONFIRM(1)]: () => post.promise });
    const { refreshCounts, setPending } = renderScreen(OWNER);
    await screen.findByText('Nguyễn Văn A');

    const r1 = cardOf(1)!;
    fireEvent.click(btn(r1, 'Xác nhận'));
    await waitFor(() => expect(btn(r1, 'Xác nhận').disabled).toBe(true));
    expect(btn(r1, 'Từ chối').disabled).toBe(true);
    fireEvent.click(btn(r1, 'Xác nhận'));
    expect(calls(CONFIRM(1))).toHaveLength(1);
    expect(calls(CONFIRM(1))[0]![1]).toMatchObject({ method: 'POST' });

    await act(async () => post.resolve({}));
    await waitFor(() => expect(cardOf(1)).toBeNull());
    expect(cardOf(2)).not.toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Đã xác nhận yêu cầu');
    expect(screen.getByRole('heading', { name: '1 yêu cầu đang chờ' })).toBeDefined();
    expect(setPending).toHaveBeenLastCalledWith(1);
    expect(refreshCounts).not.toHaveBeenCalled();
  });

  it('AC-5: "Từ chối" opens the sheet; the sheet "Từ chối" posts reject once, removes the card, shows status, setPendingRequests', async () => {
    mockApi({ [LIST]: two, [VENUES]: venues, [REJECT(1)]: () => ({}) });
    const { refreshCounts, setPending } = renderScreen(OWNER);
    await screen.findByText('Nguyễn Văn A');

    fireEvent.click(btn(cardOf(1)!, 'Từ chối'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Từ chối yêu cầu này?' })).toBeDefined();
    expect(dialog.textContent).toContain('Nguyễn Văn A');
    expect(dialog.textContent).toContain('18:00–19:00 ngày 06/11/2026');
    expect(calls(REJECT(1))).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Từ chối' }));
    await waitFor(() => expect(cardOf(1)).toBeNull());
    expect(calls(REJECT(1))).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toBe('Đã từ chối yêu cầu');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(setPending).toHaveBeenLastCalledWith(1);
    expect(refreshCounts).not.toHaveBeenCalled();
  });

  it('AC-5: "Thôi" closes the sheet and sends nothing', async () => {
    mockApi({ [LIST]: two, [VENUES]: venues });
    const { refreshCounts } = renderScreen(OWNER);
    await screen.findByText('Nguyễn Văn A');

    fireEvent.click(btn(cardOf(1)!, 'Từ chối'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thôi' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls(REJECT(1))).toHaveLength(0);
    expect(cardOf(1)).not.toBeNull();
    expect(refreshCounts).not.toHaveBeenCalled();
  });

  for (const text of ['Yêu cầu đã hết hạn', 'Yêu cầu không còn chờ xác nhận']) {
    it(`AC-6: confirm with 409 "${text}" shows the text, removes the card, reports the new count`, async () => {
      mockApi({
        [LIST]: two,
        [VENUES]: venues,
        [CONFIRM(1)]: () => {
          throw new ApiError(409, text);
        },
      });
      const { refreshCounts, setPending } = renderScreen(OWNER);
      await screen.findByText('Nguyễn Văn A');

      fireEvent.click(btn(cardOf(1)!, 'Xác nhận'));
      await waitFor(() => expect(cardOf(1)).toBeNull());
      expect(screen.getByRole('alert').textContent).toBe(text);
      expect(setPending).toHaveBeenLastCalledWith(1);
      expect(refreshCounts).not.toHaveBeenCalled();
    });
  }

  it('AC-6: confirm with 409 BUSY keeps the card, unlocks the buttons, shows the API text', async () => {
    const text = 'Yêu cầu đang được xử lý, hãy thử lại';
    mockApi({
      [LIST]: two,
      [VENUES]: venues,
      [CONFIRM(1)]: () => {
        throw new ApiError(409, text);
      },
    });
    const { refreshCounts } = renderScreen(OWNER);
    await screen.findByText('Nguyễn Văn A');

    fireEvent.click(btn(cardOf(1)!, 'Xác nhận'));
    expect((await screen.findByRole('alert')).textContent).toBe(text);
    await waitFor(() => expect(btn(cardOf(1)!, 'Xác nhận').disabled).toBe(false));
    expect(btn(cardOf(1)!, 'Từ chối').disabled).toBe(false);
    expect(refreshCounts).not.toHaveBeenCalled();
  });

  it('AC-6: reject through the sheet with 409 BUSY keeps the card and unlocks the buttons', async () => {
    const text = 'Yêu cầu đang được xử lý, hãy thử lại';
    mockApi({
      [LIST]: two,
      [VENUES]: venues,
      [REJECT(1)]: () => {
        throw new ApiError(409, text);
      },
    });
    const { refreshCounts } = renderScreen(OWNER);
    await screen.findByText('Nguyễn Văn A');

    fireEvent.click(btn(cardOf(1)!, 'Từ chối'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Từ chối' }));

    expect((await screen.findByRole('alert')).textContent).toBe(text);
    expect(cardOf(1)).not.toBeNull();
    await waitFor(() => expect(btn(cardOf(1)!, 'Từ chối').disabled).toBe(false));
    expect(btn(cardOf(1)!, 'Xác nhận').disabled).toBe(false);
    expect(refreshCounts).not.toHaveBeenCalled();
  });

  for (const status of [403, 404]) {
    it(`AC-6: confirm with ${status} shows the not-in-list text, removes the card, reloads once`, async () => {
      let gets = 0;
      mockApi({
        [LIST]: () => {
          gets += 1;
          return gets === 1 ? two() : [booking(2)];
        },
        [VENUES]: venues,
        [CONFIRM(1)]: () => {
          throw new ApiError(status, 'Không tìm thấy');
        },
      });
      const { setPending } = renderScreen(OWNER);
      await screen.findByText('Nguyễn Văn A');

      fireEvent.click(btn(cardOf(1)!, 'Xác nhận'));
      await waitFor(() => expect(cardOf(1)).toBeNull());
      expect(setPending).toHaveBeenCalledWith(1);
      expect(screen.getByRole('alert').textContent).toBe('Yêu cầu này không còn trong danh sách của bạn');
      await waitFor(() => expect(gets).toBe(2));
      expect(cardOf(2)).not.toBeNull();
    });
  }

  it('AC-6: a network error keeps the card, unlocks the buttons, shows "Không lưu được quyết định. Thử lại."', async () => {
    mockApi({
      [LIST]: two,
      [VENUES]: venues,
      [CONFIRM(1)]: () => {
        throw new TypeError('network');
      },
    });
    const { refreshCounts } = renderScreen(OWNER);
    await screen.findByText('Nguyễn Văn A');

    fireEvent.click(btn(cardOf(1)!, 'Xác nhận'));
    expect((await screen.findByRole('alert')).textContent).toBe('Không lưu được quyết định. Thử lại.');
    await waitFor(() => expect(btn(cardOf(1)!, 'Xác nhận').disabled).toBe(false));
    expect(btn(cardOf(1)!, 'Từ chối').disabled).toBe(false);
    expect(refreshCounts).not.toHaveBeenCalled();
  });

  it('AC-7: reloads every 15 s, hidden stops, visible reloads once, reports the count with setPendingRequests', async () => {
    vi.useFakeTimers();
    let current: OwnerBookingView[] = two();
    mockApi({ [LIST]: () => current, [VENUES]: venues });
    const { setPending, unmount } = renderScreen(OWNER);
    const advance = (ms: number) =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });

    await advance(0);
    expect(calls(LIST)).toHaveLength(1);
    expect(lastCount(setPending)).toBe(2);

    current = [...two(), booking(3)];
    await advance(14_000);
    expect(calls(LIST)).toHaveLength(1);
    await advance(1_000);
    expect(calls(LIST)).toHaveLength(2);
    expect(cardOf(3)).not.toBeNull();
    expect(lastCount(setPending)).toBe(3);

    await act(async () => setVisibility('hidden'));
    await advance(60_000);
    expect(calls(LIST)).toHaveLength(2);

    await act(async () => setVisibility('visible'));
    await advance(0);
    expect(calls(LIST)).toHaveLength(3);
    await advance(14_000);
    expect(calls(LIST)).toHaveLength(3);
    await advance(1_000);
    expect(calls(LIST)).toHaveLength(4);

    unmount();
    await advance(60_000);
    expect(calls(LIST)).toHaveLength(4);
  });

  it('D-3: without setPendingRequests in the context, a decision calls refreshCounts once', async () => {
    mockApi({ [LIST]: two, [VENUES]: venues, [CONFIRM(1)]: () => ({}) });
    const { refreshCounts } = renderScreen(OWNER, { setPendingRequests: undefined });
    await screen.findByText('Nguyễn Văn A');

    fireEvent.click(btn(cardOf(1)!, 'Xác nhận'));
    await waitFor(() => expect(cardOf(1)).toBeNull());
    expect(refreshCounts).toHaveBeenCalledTimes(1);
  });

  it('D-4: a visible tab does not reload while the session login sheet is open', async () => {
    let gets = 0;
    mockApi({
      [LIST]: () => {
        gets += 1;
        if (gets === 2) throw new ApiError(401, 'Chưa đăng nhập');
        return two();
      },
      [VENUES]: venues,
    });
    renderScreen(OWNER);
    await screen.findByText('Nguyễn Văn A');

    act(() => setVisibility('visible'));
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
    expect(gets).toBe(2);

    await act(async () => setVisibility('hidden'));
    await act(async () => setVisibility('visible'));
    expect(gets).toBe(2);
  });

  it('AC-8: a slow list that returns after a confirm is dropped; R1 does not come back', async () => {
    const slow = deferred<OwnerBookingView[]>();
    let gets = 0;
    mockApi({
      [LIST]: () => {
        gets += 1;
        return gets === 1 ? two() : slow.promise;
      },
      [VENUES]: venues,
      [CONFIRM(1)]: () => ({}),
    });
    const { setPending } = renderScreen(OWNER);
    await screen.findByText('Nguyễn Văn A');

    act(() => setVisibility('visible'));
    await waitFor(() => expect(gets).toBe(2));
    fireEvent.click(btn(cardOf(1)!, 'Xác nhận'));
    await waitFor(() => expect(cardOf(1)).toBeNull());

    await act(async () => {
      slow.resolve(two());
    });
    expect(cardOf(1)).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(setPending).toHaveBeenCalledTimes(2);
    expect(setPending).toHaveBeenLastCalledWith(1);
  });

  it('AC-9: a 401 on load opens the login sheet with the notice and reloads after login', async () => {
    let gets = 0;
    mockApi({
      [LIST]: () => {
        gets += 1;
        if (gets === 1) throw new ApiError(401, 'Chưa đăng nhập');
        return two();
      },
      [VENUES]: venues,
      '/api/auth/login': () => ({ ok: true }),
    });
    renderScreen(OWNER);

    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
    expect(screen.getByText('Phiên đăng nhập đã hết. Hãy đăng nhập lại.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234567' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau123' } });
    const submit = screen.getAllByRole('button', { name: 'Đăng nhập' }).find((b) => b.getAttribute('type') === 'submit')!;
    fireEvent.click(submit);

    expect(await screen.findByText('Nguyễn Văn A')).toBeDefined();
    expect(gets).toBe(2);
  });

  it('AC-9: a 401 on a reload keeps the list, opens the login sheet, and reloads after login', async () => {
    let gets = 0;
    mockApi({
      [LIST]: () => {
        gets += 1;
        if (gets === 2) throw new ApiError(401, 'Chưa đăng nhập');
        return two();
      },
      [VENUES]: venues,
      '/api/auth/login': () => ({ ok: true }),
    });
    renderScreen(OWNER);
    await screen.findByText('Nguyễn Văn A');

    act(() => setVisibility('visible'));
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
    expect(screen.getByText('Phiên đăng nhập đã hết. Hãy đăng nhập lại.')).toBeDefined();
    expect(cardOf(1)).not.toBeNull();
    expect(cardOf(2)).not.toBeNull();
    expect(calls(LIST)).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234567' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau123' } });
    const submit = screen.getAllByRole('button', { name: 'Đăng nhập' }).find((b) => b.getAttribute('type') === 'submit')!;
    fireEvent.click(submit);

    await waitFor(() => expect(calls(LIST)).toHaveLength(3));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('AC-9: a login as another owner does not show the old cards', async () => {
    let gets = 0;
    mockApi({
      [LIST]: () => (++gets === 1 ? two() : [booking(3)]),
      [VENUES]: venues,
    });
    const { rerender } = renderScreen(OWNER);
    await screen.findByText('Nguyễn Văn A');

    const OWNER2: User = { id: 'o2', name: 'Cường', role: 'OWNER' };
    vi.mocked(sessionModule.useSession).mockReturnValue({
      user: OWNER2,
      setUser: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      loading: false,
    });
    rerender(
      <MemoryRouter initialEntries={['/chu-san/yeu-cau']}>
        <Routes>
          <Route element={<Shell ctx={{ setPendingRequests: vi.fn(), refreshCounts: vi.fn() }} />}>
            <Route path="*" element={<Probe />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    // The first paint for the new user holds no card of the old user.
    expect(cardOf(1)).toBeNull();
    expect(cardOf(2)).toBeNull();
    await waitFor(() => expect(cardOf(3)).not.toBeNull());
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('AC-9: a 401 on "Xác nhận" opens the login sheet and keeps the card', async () => {
    mockApi({
      [LIST]: two,
      [VENUES]: venues,
      [CONFIRM(1)]: () => {
        throw new ApiError(401, 'Chưa đăng nhập');
      },
    });
    const { refreshCounts } = renderScreen(OWNER);
    await screen.findByText('Nguyễn Văn A');

    fireEvent.click(btn(cardOf(1)!, 'Xác nhận'));
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
    expect(screen.getByText('Phiên đăng nhập đã hết. Hãy đăng nhập lại.')).toBeDefined();
    expect(cardOf(1)).not.toBeNull();
    expect(refreshCounts).not.toHaveBeenCalled();
  });

  it('AC-10: long text wraps, buttons are at least 44px high, nothing forces horizontal scroll', async () => {
    const long = 'Rất-dài'.repeat(40);
    mockApi({
      [LIST]: () => [booking(1, { customer: { name: long, phone: '0901234567' } })],
      [VENUES]: () => [
        { id: id(8), name: long, courts: [{ id: id(5), name: long }] },
      ],
    });
    renderScreen(OWNER);
    await screen.findByText(long, { selector: '[data-field="customer"]' });
    await waitFor(() => expect(document.querySelector('[data-field="venue"]')).not.toBeNull());

    const card = cardOf(1)!;
    expect(card.style.minWidth).toBe('0px');
    expect(card.style.maxWidth).toBe('100%');
    for (const field of ['court', 'venue', 'customer']) {
      const el = card.querySelector<HTMLElement>(`[data-field="${field}"]`)!;
      expect(el.style.overflowWrap).toBe('anywhere');
      expect(el.style.minWidth).toBe('0px');
      expect(el.style.whiteSpace).not.toBe('nowrap');
    }
    expect(btn(card, 'Xác nhận').style.minHeight).toBe('44px');
    expect(btn(card, 'Từ chối').style.minHeight).toBe('44px');
  });
});
