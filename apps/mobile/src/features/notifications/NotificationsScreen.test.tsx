import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import { formatNotificationContent, type NotificationItemView, type NotificationsListResponse } from '@monsport/shared';
import * as sessionModule from '../../app/session';
import { NotificationsScreen } from './NotificationsScreen';

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

function item(n: number, over: Partial<NotificationItemView> = {}): NotificationItemView {
  return {
    id: id(n),
    type: 'BOOKING_CONFIRMED',
    bookingId: id(n + 5),
    matchId: null,
    readAt: null,
    createdAt: '2026-11-03T01:00:00.000Z',
    title: `Tiêu đề ${n}`,
    message: `Nội dung ${n}`,
    venueName: `Đơn vị ${n}`,
    courtName: `Sân ${n}`,
    startAt: '2026-11-03T00:00:00.000Z',
    endAt: '2026-11-03T01:00:00.000Z',
    ...over,
  };
}

const READ_AT = '2026-11-03T02:00:00.000Z';

function threeItems(): NotificationsListResponse {
  return {
    unreadCount: 2,
    items: [
      item(1),
      item(2, { type: 'MATCH_CANCELLED' }),
      item(3, { type: 'BOOKING_REJECTED', readAt: READ_AT }),
    ],
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

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

function getCalls(path: string) {
  return vi.mocked(clientModule.api).mock.calls.filter((c) => c[0] === path);
}

function lastBadge(spy: ReturnType<typeof vi.fn>) {
  return spy.mock.calls.at(-1)?.[0];
}

function Probe() {
  const location = useLocation();
  return (
    <>
      <p data-testid="path">{location.pathname}</p>
      <NotificationsScreen />
    </>
  );
}

function Shell({ setUnread }: { setUnread: (n: number) => void }) {
  return <Outlet context={{ setUnreadNotifications: setUnread }} />;
}

function renderScreen(user: User, setUnread = vi.fn()) {
  vi.spyOn(sessionModule, 'useSession').mockReturnValue({
    user,
    setUser: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    loading: false,
  });
  const view = render(
    <MemoryRouter initialEntries={['/thong-bao']}>
      <Routes>
        <Route element={<Shell setUnread={setUnread} />}>
          <Route path="*" element={<Probe />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  return { setUnread, ...view };
}

const path = () => screen.getByTestId('path').textContent;

function cardOf(title: string) {
  return screen.getByText(title).closest('button') as HTMLButtonElement;
}

describe('NotificationsScreen', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  it('AC-1: USER sees 3 cards in order with title, message, venue, court, time; unread has dot and other background; badge 2; one GET', async () => {
    vi.mocked(clientModule.api).mockResolvedValue(threeItems());
    const { setUnread } = renderScreen(USER);

    await screen.findByText('Tiêu đề 1');
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]!.textContent).toContain('Tiêu đề 1');
    expect(rows[1]!.textContent).toContain('Tiêu đề 2');
    expect(rows[2]!.textContent).toContain('Tiêu đề 3');

    const first = rows[0]!;
    expect(first.textContent).toContain('Nội dung 1');
    expect(first.textContent).toContain('Đơn vị 1');
    expect(first.textContent).toContain('Sân 1');
    expect(first.textContent).toContain('07:00 - 08:00 ngày 03/11/2026');

    expect(within(rows[0]!).getByRole('img', { name: 'Chưa đọc' })).toBeDefined();
    expect(within(rows[1]!).getByRole('img', { name: 'Chưa đọc' })).toBeDefined();
    expect(within(rows[2]!).queryByRole('img', { name: 'Chưa đọc' })).toBeNull();
    const unreadBg = cardOf('Tiêu đề 1').style.backgroundColor;
    const readBg = cardOf('Tiêu đề 3').style.backgroundColor;
    expect(unreadBg).not.toBe('');
    expect(unreadBg).not.toBe(readBg);

    await waitFor(() => expect(lastBadge(setUnread)).toBe(2));
    expect(getCalls('/api/notifications')).toHaveLength(1);
  });

  it('AC-2: empty list shows "Chưa có thông báo"', async () => {
    vi.mocked(clientModule.api).mockResolvedValue({ unreadCount: 0, items: [] });
    renderScreen(USER);
    expect(await screen.findByText('Chưa có thông báo')).toBeDefined();
  });

  it('AC-2: a network error shows "Không tải được" and "Thử lại" reloads the list', async () => {
    vi.mocked(clientModule.api)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(threeItems());
    renderScreen(USER);

    expect(await screen.findByText('Không tải được')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Tiêu đề 1')).toBeDefined();
    expect(screen.queryByText('Không tải được')).toBeNull();
    expect(getCalls('/api/notifications')).toHaveLength(2);
  });

  it('AC-2: a failed reload keeps the old list and shows no error', async () => {
    vi.mocked(clientModule.api)
      .mockResolvedValueOnce(threeItems())
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderScreen(USER);
    await screen.findByText('Tiêu đề 1');

    act(() => setVisibility('visible'));
    await waitFor(() => expect(getCalls('/api/notifications')).toHaveLength(2));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Tiêu đề 1')).toBeDefined();
    expect(screen.getByText('Tiêu đề 3')).toBeDefined();
    expect(screen.queryByText('Không tải được')).toBeNull();
  });

  it('AC-3: a guest sees "Đăng nhập để xem thông báo", the button opens the login sheet, and no API call runs', async () => {
    renderScreen(null);

    expect(screen.getByText('Đăng nhập để xem thông báo')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
    expect(clientModule.api).not.toHaveBeenCalled();
  });

  it.each(['MATCH_JOIN_REQUESTED', 'MATCH_JOIN_APPROVED', 'MATCH_JOIN_REJECTED'] as const)(
    'AC-10: a %s card shows the title and message of packages/shared, and a tap opens the same target as MATCH_CANCELLED',
    async (type) => {
      const params = {
        type,
        venueName: 'Đơn vị 1',
        courtName: 'Sân 1',
        startAt: '2026-11-03T00:00:00.000Z',
        endAt: '2026-11-03T01:00:00.000Z',
      };
      const { title, message } = formatNotificationContent(params);
      vi.mocked(clientModule.api).mockImplementation(async (p: string) => {
        if (p === '/api/notifications') {
          return {
            unreadCount: 1,
            items: [item(1, { type, title, message, matchId: id(7) })],
          } satisfies NotificationsListResponse;
        }
        if (p === `/api/notifications/${id(1)}/read`) return { id: id(1), readAt: READ_AT };
        throw new Error(`unexpected ${p}`);
      });
      renderScreen(USER);

      await screen.findByText(title);
      const card = cardOf(title);
      expect(card.textContent).toContain(message);
      fireEvent.click(card);
      await waitFor(() => expect(path()).toBe('/lich-cua-toi'));
    },
  );

  it('AC-4: tapping unread N1 posts read, waits for the reply, then marks it read, badge 1, and opens /lich-cua-toi', async () => {
    const post = deferred<{ id: string; readAt: string }>();
    vi.mocked(clientModule.api).mockImplementation(async (p: string) => {
      if (p === '/api/notifications') return threeItems();
      if (p === `/api/notifications/${id(1)}/read`) return post.promise;
      throw new Error(`unexpected ${p}`);
    });
    const { setUnread } = renderScreen(USER);
    await screen.findByText('Tiêu đề 1');

    fireEvent.click(cardOf('Tiêu đề 1'));
    expect(clientModule.api).toHaveBeenCalledWith(`/api/notifications/${id(1)}/read`, { method: 'POST' });
    // The app waits for the reply: nothing moves yet.
    expect(path()).toBe('/thong-bao');
    expect(within(cardOf('Tiêu đề 1')).getByRole('img', { name: 'Chưa đọc' })).toBeDefined();

    await act(async () => {
      post.resolve({ id: id(1), readAt: READ_AT });
    });
    await waitFor(() => expect(path()).toBe('/lich-cua-toi'));
    expect(within(cardOf('Tiêu đề 1')).queryByRole('img', { name: 'Chưa đọc' })).toBeNull();
    expect(lastBadge(setUnread)).toBe(1);
  });

  it('AC-4: a network error on read still opens the target; the card stays unread and the badge stays 2', async () => {
    vi.mocked(clientModule.api).mockImplementation(async (p: string) => {
      if (p === '/api/notifications') return threeItems();
      throw new TypeError('Failed to fetch');
    });
    const { setUnread } = renderScreen(USER);
    await screen.findByText('Tiêu đề 1');

    fireEvent.click(cardOf('Tiêu đề 1'));
    await waitFor(() => expect(path()).toBe('/lich-cua-toi'));
    expect(within(cardOf('Tiêu đề 1')).getByRole('img', { name: 'Chưa đọc' })).toBeDefined();
    expect(lastBadge(setUnread)).toBe(2);
  });

  it('AC-4: a 404 on read still opens the target; the card stays unread and the badge stays 2', async () => {
    vi.mocked(clientModule.api).mockImplementation(async (p: string) => {
      if (p === '/api/notifications') return threeItems();
      throw new ApiError(404, 'Không tìm thấy thông báo');
    });
    const { setUnread } = renderScreen(USER);
    await screen.findByText('Tiêu đề 1');

    fireEvent.click(cardOf('Tiêu đề 2'));
    await waitFor(() => expect(path()).toBe('/lich-cua-toi'));
    expect(within(cardOf('Tiêu đề 2')).getByRole('img', { name: 'Chưa đọc' })).toBeDefined();
    expect(lastBadge(setUnread)).toBe(2);
  });

  it('AC-4: tapping an already read card sends no POST and only opens the target', async () => {
    vi.mocked(clientModule.api).mockResolvedValue(threeItems());
    renderScreen(USER);
    await screen.findByText('Tiêu đề 3');

    fireEvent.click(cardOf('Tiêu đề 3'));
    await waitFor(() => expect(path()).toBe('/lich-cua-toi'));
    expect(vi.mocked(clientModule.api).mock.calls.filter((c) => (c[1] as { method?: string } | undefined)?.method === 'POST')).toHaveLength(0);
  });

  it('AC-5: OWNER taps an unread BOOKING_REQUESTED card: POST read before navigating to /chu-san/yeu-cau, never /lich-cua-toi', async () => {
    const post = deferred<{ id: string; readAt: string }>();
    const paths: string[] = [];
    vi.mocked(clientModule.api).mockImplementation(async (p: string) => {
      if (p === '/api/notifications') {
        return { unreadCount: 1, items: [item(1, { type: 'BOOKING_REQUESTED', title: 'Yêu cầu đặt sân mới' })] };
      }
      return post.promise;
    });
    renderScreen(OWNER);
    await screen.findByText('Yêu cầu đặt sân mới');

    fireEvent.click(cardOf('Yêu cầu đặt sân mới'));
    expect(clientModule.api).toHaveBeenCalledWith(`/api/notifications/${id(1)}/read`, { method: 'POST' });
    expect(path()).toBe('/thong-bao');

    await act(async () => {
      post.resolve({ id: id(1), readAt: READ_AT });
    });
    await waitFor(() => expect(path()).toBe('/chu-san/yeu-cau'));
    paths.push(path()!);
    expect(paths).not.toContain('/lich-cua-toi');
  });

  it('AC-6: "Đọc hết" posts read-all once, is disabled while pending, marks every card read and clears the badge', async () => {
    const post = deferred<{ count: number }>();
    vi.mocked(clientModule.api).mockImplementation(async (p: string) => {
      if (p === '/api/notifications') return threeItems();
      if (p === '/api/notifications/read-all') return post.promise;
      throw new Error(`unexpected ${p}`);
    });
    const { setUnread } = renderScreen(USER);
    await screen.findByText('Tiêu đề 1');

    const button = screen.getByRole('button', { name: 'Đọc hết' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(getCalls('/api/notifications/read-all')).toHaveLength(1);
    expect(getCalls('/api/notifications/read-all')[0]![1]).toEqual({ method: 'POST' });
    expect(button.disabled).toBe(true);

    await act(async () => {
      post.resolve({ count: 2 });
    });
    await waitFor(() => expect(screen.queryAllByRole('img', { name: 'Chưa đọc' })).toHaveLength(0));
    expect(lastBadge(setUnread)).toBe(0);
    expect((screen.getByRole('button', { name: 'Đọc hết' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('AC-6: "Đọc hết" is disabled and sends no request when unreadCount is 0', async () => {
    vi.mocked(clientModule.api).mockResolvedValue({ unreadCount: 0, items: [item(3, { readAt: READ_AT })] });
    renderScreen(USER);
    await screen.findByText('Tiêu đề 3');

    const button = screen.getByRole('button', { name: 'Đọc hết' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(getCalls('/api/notifications/read-all')).toHaveLength(0);
  });

  it('AC-6: a network error on "Đọc hết" keeps cards unread and shows "Không đánh dấu được. Thử lại."', async () => {
    vi.mocked(clientModule.api).mockImplementation(async (p: string) => {
      if (p === '/api/notifications') return threeItems();
      throw new TypeError('Failed to fetch');
    });
    const { setUnread } = renderScreen(USER);
    await screen.findByText('Tiêu đề 1');

    fireEvent.click(screen.getByRole('button', { name: 'Đọc hết' }));
    expect(await screen.findByText('Không đánh dấu được. Thử lại.')).toBeDefined();
    expect(screen.getAllByRole('img', { name: 'Chưa đọc' })).toHaveLength(2);
    expect(lastBadge(setUnread)).toBe(2);
    expect((screen.getByRole('button', { name: 'Đọc hết' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('AC-7: reloads every 15 s while visible, stops when hidden, reloads at once on visible, stops on unmount', async () => {
    vi.useFakeTimers();
    let current: NotificationsListResponse = { unreadCount: 0, items: [] };
    vi.mocked(clientModule.api).mockImplementation(async () => current);
    const { setUnread, unmount } = renderScreen(USER);
    const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

    await advance(0);
    expect(getCalls('/api/notifications')).toHaveLength(1);
    expect(screen.getByText('Chưa có thông báo')).toBeDefined();
    expect(lastBadge(setUnread)).toBe(0);

    current = { unreadCount: 1, items: [item(1)] };
    await advance(14_000);
    expect(getCalls('/api/notifications')).toHaveLength(1);
    await advance(1_000);
    expect(getCalls('/api/notifications')).toHaveLength(2);
    expect(screen.getByText('Tiêu đề 1')).toBeDefined();
    expect(lastBadge(setUnread)).toBe(1);

    await act(async () => setVisibility('hidden'));
    await advance(60_000);
    expect(getCalls('/api/notifications')).toHaveLength(2);

    await act(async () => setVisibility('visible'));
    await advance(0);
    expect(getCalls('/api/notifications')).toHaveLength(3);
    await advance(14_000);
    expect(getCalls('/api/notifications')).toHaveLength(3);
    await advance(1_000);
    expect(getCalls('/api/notifications')).toHaveLength(4);

    unmount();
    await advance(60_000);
    expect(getCalls('/api/notifications')).toHaveLength(4);
  });

  it('AC-8: a slow load that returns after "Đọc hết" is dropped; the badge does not return to the old count', async () => {
    const slow = deferred<NotificationsListResponse>();
    let gets = 0;
    vi.mocked(clientModule.api).mockImplementation(async (p: string) => {
      if (p === '/api/notifications') {
        gets += 1;
        return gets === 1 ? threeItems() : slow.promise;
      }
      if (p === '/api/notifications/read-all') return { count: 2 };
      throw new Error(`unexpected ${p}`);
    });
    const { setUnread } = renderScreen(USER);
    await screen.findByText('Tiêu đề 1');

    act(() => setVisibility('visible'));
    await waitFor(() => expect(gets).toBe(2));
    fireEvent.click(screen.getByRole('button', { name: 'Đọc hết' }));
    await waitFor(() => expect(lastBadge(setUnread)).toBe(0));

    await act(async () => {
      slow.resolve(threeItems());
    });
    expect(screen.queryAllByRole('img', { name: 'Chưa đọc' })).toHaveLength(0);
    expect(lastBadge(setUnread)).toBe(0);
  });

  it('AC-8: a slow load that returns after a tap-read is dropped; the badge does not return to the old count', async () => {
    const slow = deferred<NotificationsListResponse>();
    let gets = 0;
    vi.mocked(clientModule.api).mockImplementation(async (p: string) => {
      if (p === '/api/notifications') {
        gets += 1;
        return gets === 1 ? threeItems() : slow.promise;
      }
      return { id: id(1), readAt: READ_AT };
    });
    const { setUnread } = renderScreen(USER);
    await screen.findByText('Tiêu đề 1');

    act(() => setVisibility('visible'));
    await waitFor(() => expect(gets).toBe(2));
    fireEvent.click(cardOf('Tiêu đề 1'));
    await waitFor(() => expect(lastBadge(setUnread)).toBe(1));

    await act(async () => {
      slow.resolve(threeItems());
    });
    expect(lastBadge(setUnread)).toBe(1);
    expect(within(cardOf('Tiêu đề 1')).queryByRole('img', { name: 'Chưa đọc' })).toBeNull();
  });

  it('AC-10: a 401 on load opens the login sheet with the notice and reloads after login', async () => {
    let gets = 0;
    vi.mocked(clientModule.api).mockImplementation(async (p: string) => {
      if (p === '/api/notifications') {
        gets += 1;
        if (gets === 1) throw new ApiError(401, 'Chưa đăng nhập');
        return threeItems();
      }
      if (p === '/api/auth/login') return { ok: true };
      throw new Error(`unexpected ${p}`);
    });
    renderScreen(USER);

    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
    expect(screen.getByText('Phiên đăng nhập đã hết. Hãy đăng nhập lại.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234567' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau123' } });
    const submit = screen.getAllByRole('button', { name: 'Đăng nhập' }).find((b) => b.getAttribute('type') === 'submit')!;
    fireEvent.click(submit);

    expect(await screen.findByText('Tiêu đề 1')).toBeDefined();
    expect(gets).toBe(2);
  });

  it('AC-10: a 401 on a reload keeps the list and opens the login sheet', async () => {
    let gets = 0;
    vi.mocked(clientModule.api).mockImplementation(async (p: string) => {
      if (p === '/api/notifications') {
        gets += 1;
        if (gets === 1) return threeItems();
        throw new ApiError(401, 'Chưa đăng nhập');
      }
      throw new ApiError(401, 'Chưa đăng nhập');
    });
    renderScreen(USER);
    await screen.findByText('Tiêu đề 1');

    act(() => setVisibility('visible'));
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
    expect(screen.getByText('Tiêu đề 1')).toBeDefined();
    expect(screen.getByText('Tiêu đề 3')).toBeDefined();
  });

  it('D-6: unmounting while POST .../read is pending does not navigate', async () => {
    const post = deferred<{ id: string; readAt: string }>();
    vi.mocked(clientModule.api).mockImplementation(async (p: string) => {
      if (p === '/api/notifications') return threeItems();
      return post.promise;
    });
    const { unmount } = renderScreen(USER);
    await screen.findByText('Tiêu đề 1');

    fireEvent.click(cardOf('Tiêu đề 1'));
    expect(clientModule.api).toHaveBeenCalledWith(`/api/notifications/${id(1)}/read`, { method: 'POST' });
    unmount();

    await act(async () => {
      post.resolve({ id: id(1), readAt: READ_AT });
    });
    expect(screen.queryByTestId('path')).toBeNull();
  });

  it('AC-10: a 401 on tapping a card opens the login sheet, keeps the list, and stays on /thong-bao', async () => {
    vi.mocked(clientModule.api).mockImplementation(async (p: string) => {
      if (p === '/api/notifications') return threeItems();
      throw new ApiError(401, 'Chưa đăng nhập');
    });
    renderScreen(USER);
    await screen.findByText('Tiêu đề 1');

    fireEvent.click(cardOf('Tiêu đề 1'));
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
    expect(screen.getByText('Phiên đăng nhập đã hết. Hãy đăng nhập lại.')).toBeDefined();
    expect(path()).toBe('/thong-bao');
    expect(screen.getByText('Tiêu đề 2')).toBeDefined();
  });

  it('AC-11: an ADMIN account makes no API call', async () => {
    vi.useFakeTimers();
    renderScreen(ADMIN);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(clientModule.api).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Đọc hết' })).toBeNull();
  });

  it('AC-12: long text wraps, cards and buttons are at least 44px high, nothing forces horizontal scroll', async () => {
    const long = 'Rất-dài'.repeat(40);
    vi.mocked(clientModule.api).mockResolvedValue({
      unreadCount: 1,
      items: [item(1, { venueName: long, message: long, title: 'Tiêu đề dài' })],
    });
    renderScreen(USER);
    await screen.findByText('Tiêu đề dài');

    const card = cardOf('Tiêu đề dài');
    expect(card.style.minHeight).toBe('44px');
    expect(card.style.minWidth).toBe('0px');
    expect(card.style.maxWidth).toBe('100%');
    const venue = screen.getByText(long, { selector: '[data-field="venue"]' });
    const message = screen.getByText(long, { selector: '[data-field="message"]' });
    expect(venue.style.overflowWrap).toBe('anywhere');
    expect(message.style.overflowWrap).toBe('anywhere');
    expect(venue.style.whiteSpace).not.toBe('nowrap');

    const readAll = screen.getByRole('button', { name: 'Đọc hết' });
    expect(readAll.style.minHeight).toBe('44px');
  });
});
