import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import { ToiScreen } from '../features/auth/ToiScreen';
import { NotificationsScreen } from '../features/notifications/NotificationsScreen';
import { App } from './App';
import * as sessionModule from './session';
import { SessionProvider } from './session';

vi.mock('@monsport/client', async () => {
  const actual = await vi.importActual<typeof import('@monsport/client')>('@monsport/client');
  return {
    ...actual,
    api: vi.fn(),
  };
});

describe('App Shell', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('AC-11: guest opens /app/, tab bar has 5 tabs in order: Đặt sân, Phòng chờ, Lịch của tôi, Thông báo, Tôi', () => {
    vi.spyOn(sessionModule, 'useSession').mockReturnValue({
      user: null,
      setUser: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('monsport')).toBeDefined();
    const nav = screen.getByRole('navigation', { name: 'Điều hướng' });
    const buttons = nav.querySelectorAll('button');
    const tabNames = Array.from(buttons).map((btn) => btn.getAttribute('aria-label'));
    expect(tabNames).toEqual(['Đặt sân', 'Phòng chờ', 'Lịch của tôi', 'Thông báo', 'Tôi']);
  });

  it('AC-12: owner Bình logged in with 2 PENDING bookings has tabs: Yêu cầu (2), Lịch sân, Doanh thu, Thông báo, Tôi; 0 PENDING shows no badge', async () => {
    vi.mocked(clientModule.api).mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);

    vi.spyOn(sessionModule, 'useSession').mockReturnValue({
      user: { id: 'o1', name: 'Bình', role: 'OWNER' },
      setUser: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    const nav = screen.getByRole('navigation', { name: 'Điều hướng' });
    const buttons = nav.querySelectorAll('button');
    const tabNames = Array.from(buttons).map((btn) => btn.getAttribute('aria-label'));
    expect(tabNames).toEqual(['Yêu cầu', 'Lịch sân', 'Doanh thu', 'Thông báo', 'Tôi']);

    // Check count badge 2 within the Yêu cầu tab button
    const yeuCauButton = within(nav).getByRole('button', { name: 'Yêu cầu' });
    await waitFor(() => expect(within(yeuCauButton).getByText('2')).toBeDefined());

    expect(clientModule.api).toHaveBeenCalledWith('/api/owner/bookings?status=PENDING');

    // Now test with 0 PENDING bookings
    vi.mocked(clientModule.api).mockResolvedValue([]);
    cleanup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => expect(clientModule.api).toHaveBeenCalledWith('/api/owner/bookings?status=PENDING'));
    const navZero = screen.getByRole('navigation', { name: 'Điều hướng' });
    const yeuCauButtonZero = within(navZero).getByRole('button', { name: 'Yêu cầu' });
    expect(within(yeuCauButtonZero).queryByText(/\d+/)).toBeNull();
  });

  it('AC-13: admin logged in sees "Dùng web để quản trị", link to /admin, and no tab bar', () => {
    vi.spyOn(sessionModule, 'useSession').mockReturnValue({
      user: { id: 'a1', name: 'Admin', role: 'ADMIN' },
      setUser: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Dùng web để quản trị' })).toBeDefined();
    const link = screen.getByRole('link', { name: 'Đến trang quản trị web' });
    expect(link.getAttribute('href')).toBe('/admin');
    expect(screen.queryByRole('navigation', { name: 'Điều hướng' })).toBeNull();
  });

  it('AC-14: render SessionProvider + App at /toi, log in as an OWNER through the sheet, assert the owner tab labels appear', async () => {
    let currentUser: { id: string; name: string; role: 'ADMIN' | 'OWNER' | 'USER' } | null = null;

    vi.mocked(clientModule.api).mockImplementation(async (path: string, init?: any) => {
      if (path === '/api/auth/me') {
        if (!currentUser) throw new ApiError(401, 'Chưa đăng nhập');
        return currentUser;
      }
      if (path === '/api/auth/login') {
        const body = init?.json as { phone: string; password: string };
        if (body.phone === '0901234567' && body.password === 'matkhau123') {
          currentUser = { id: 'o1', name: 'Bình', role: 'OWNER' };
          return { ok: true };
        }
        throw new ApiError(401, 'Sai số điện thoại hoặc mật khẩu');
      }
      if (path === '/api/owner/bookings?status=PENDING') {
        return [{ id: 'b1' }, { id: 'b2' }];
      }
      return {};
    });

    render(
      <SessionProvider>
        <MemoryRouter initialEntries={['/toi']}>
          <Routes>
            <Route path="/" element={<App />}>
              <Route path="toi" element={<ToiScreen />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </SessionProvider>,
    );

    // Initial guest tab bar has guest tabs
    const nav = screen.getByRole('navigation', { name: 'Điều hướng' });
    const guestButtons = nav.querySelectorAll('button');
    const guestTabNames = Array.from(guestButtons).map((btn) => btn.getAttribute('aria-label'));
    expect(guestTabNames).toEqual(['Đặt sân', 'Phòng chờ', 'Lịch của tôi', 'Thông báo', 'Tôi']);

    // Guest sees "Đăng nhập" button on /toi
    const openBtn = await screen.findByRole('button', { name: 'Đăng nhập' });
    fireEvent.click(openBtn);

    // Fill login form
    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234567' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau123' } });

    // Submit form
    const submitBtn = screen.getAllByRole('button', { name: 'Đăng nhập' }).find((btn) => btn.getAttribute('type') === 'submit')!;
    fireEvent.click(submitBtn);

    // Assert the owner tab labels appear
    await waitFor(() => {
      const updatedNav = screen.getByRole('navigation', { name: 'Điều hướng' });
      const buttons = updatedNav.querySelectorAll('button');
      const tabNames = Array.from(buttons).map((btn) => btn.getAttribute('aria-label'));
      expect(tabNames).toEqual(['Yêu cầu', 'Lịch sân', 'Doanh thu', 'Thông báo', 'Tôi']);
    });

    expect(screen.queryByRole('heading', { name: 'Đăng nhập' })).toBeNull();
    expect(clientModule.api).toHaveBeenCalledWith('/api/auth/me');
    // The owner tab fetches its list after the tabs render, so a slow run sees the call later.
    await waitFor(() => expect(clientModule.api).toHaveBeenCalledWith('/api/owner/bookings?status=PENDING'));
  });

  it('AC-1: the Thông báo screen reports its unreadCount 2 to the tab badge, with one GET /api/notifications', async () => {
    const mk = (n: number, readAt: string | null) => ({
      id: `00000000-0000-4000-8000-00000000000${n}`,
      type: 'BOOKING_CONFIRMED',
      bookingId: `00000000-0000-4000-8000-00000000001${n}`,
      matchId: null,
      readAt,
      createdAt: '2026-11-03T01:00:00.000Z',
      title: `Tiêu đề ${n}`,
      message: `Nội dung ${n}`,
      venueName: 'Đơn vị',
      courtName: 'Sân',
      startAt: '2026-11-03T00:00:00.000Z',
      endAt: '2026-11-03T01:00:00.000Z',
    });
    vi.mocked(clientModule.api).mockResolvedValue({
      unreadCount: 2,
      items: [mk(1, null), mk(2, null), mk(3, '2026-11-03T02:00:00.000Z')],
    });
    vi.spyOn(sessionModule, 'useSession').mockReturnValue({
      user: { id: 'u1', name: 'An', role: 'USER' },
      setUser: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/thong-bao']}>
        <Routes>
          <Route path="/" element={<App />}>
            <Route path="thong-bao" element={<NotificationsScreen />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Tiêu đề 1');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng' });
    const tab = within(nav).getByRole('button', { name: 'Thông báo' });
    await waitFor(() => expect(within(tab).getByText('2')).toBeDefined());
    const gets = vi.mocked(clientModule.api).mock.calls.filter((c) => c[0] === '/api/notifications');
    expect(gets).toHaveLength(1);
  });

  describe('AC-9 shell unread count', () => {
    const asUser = (role: 'USER' | 'OWNER' | 'ADMIN' | null) =>
      vi.spyOn(sessionModule, 'useSession').mockReturnValue({
        user: role ? { id: 'u1', name: 'An', role } : null,
        setUser: vi.fn(),
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(),
        loading: false,
      });
    const getsOf = () => vi.mocked(clientModule.api).mock.calls.filter((c) => c[0] === '/api/notifications');
    const setVisibility = (state: 'visible' | 'hidden') => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    const badgeOf = () =>
      within(within(screen.getByRole('navigation', { name: 'Điều hướng' })).getByRole('button', { name: 'Thông báo' }));
    const renderApp = (path: string) =>
      render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={<App />}>
              <Route index element={<p>Trang đặt sân</p>} />
              <Route path="thong-bao" element={<p>Màn thông báo</p>} />
              <Route path="toi" element={<p>Màn tôi</p>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

    afterEach(() => {
      vi.useRealTimers();
      setVisibility('visible');
    });

    it('AC-9: a USER on the Đặt sân tab sees badge 2 from unreadCount without opening Thông báo', async () => {
      vi.mocked(clientModule.api).mockResolvedValue({ unreadCount: 2, items: [] });
      asUser('USER');
      renderApp('/');
      await waitFor(() => expect(badgeOf().getByText('2')).toBeDefined());
      expect(getsOf()).toHaveLength(1);
    });

    it('AC-9: a new unread item shows after 15 s, and a failed fetch keeps the old count', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      const mock = vi.mocked(clientModule.api);
      mock.mockResolvedValue({ unreadCount: 0, items: [] });
      asUser('USER');
      renderApp('/');
      await waitFor(() => expect(getsOf()).toHaveLength(1));

      mock.mockResolvedValue({ unreadCount: 3, items: [] });
      await vi.advanceTimersByTimeAsync(15_000);
      await waitFor(() => expect(badgeOf().getByText('3')).toBeDefined());
      expect(getsOf()).toHaveLength(2);

      mock.mockRejectedValue(new ApiError(500, 'Lỗi'));
      await vi.advanceTimersByTimeAsync(15_000);
      expect(getsOf()).toHaveLength(3);
      expect(badgeOf().getByText('3')).toBeDefined();
    });

    it('AC-9: guest and ADMIN do not call GET /api/notifications and see no badge', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      vi.mocked(clientModule.api).mockResolvedValue({ unreadCount: 5, items: [] });

      asUser(null);
      renderApp('/');
      await vi.advanceTimersByTimeAsync(15_000);
      expect(getsOf()).toHaveLength(0);
      expect(badgeOf().queryByText('5')).toBeNull();
      cleanup();

      asUser('ADMIN');
      renderApp('/');
      await vi.advanceTimersByTimeAsync(15_000);
      expect(getsOf()).toHaveLength(0);
    });

    it('AC-9: a hidden tab stops the fetch, and a visible tab fetches at once', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      vi.mocked(clientModule.api).mockResolvedValue({ unreadCount: 1, items: [] });
      asUser('USER');
      renderApp('/');
      await waitFor(() => expect(getsOf()).toHaveLength(1));

      setVisibility('hidden');
      await vi.advanceTimersByTimeAsync(45_000);
      expect(getsOf()).toHaveLength(1);

      setVisibility('visible');
      await waitFor(() => expect(getsOf()).toHaveLength(2));
      await vi.advanceTimersByTimeAsync(15_000);
      expect(getsOf()).toHaveLength(3);
    });

    it('AC-9: the shell pauses on /thong-bao and fetches once at once on leaving it', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      vi.mocked(clientModule.api).mockResolvedValue({ unreadCount: 4, items: [] });
      asUser('USER');
      renderApp('/thong-bao');
      await vi.advanceTimersByTimeAsync(45_000);
      expect(getsOf()).toHaveLength(0);

      fireEvent.click(within(screen.getByRole('navigation', { name: 'Điều hướng' })).getByRole('button', { name: 'Tôi' }));
      await waitFor(() => expect(getsOf()).toHaveLength(1));
      await waitFor(() => expect(badgeOf().getByText('4')).toBeDefined());
    });

    it('AC-9: a stale reply is dropped after a newer request', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      const mock = vi.mocked(clientModule.api);
      let releaseSlow: (v: unknown) => void = () => undefined;
      mock.mockImplementationOnce(() => new Promise((resolve) => (releaseSlow = resolve)));
      asUser('USER');
      renderApp('/');
      await waitFor(() => expect(getsOf()).toHaveLength(1));

      mock.mockResolvedValue({ unreadCount: 7, items: [] });
      await vi.advanceTimersByTimeAsync(15_000);
      await waitFor(() => expect(badgeOf().getByText('7')).toBeDefined());

      releaseSlow({ unreadCount: 1, items: [] });
      await vi.advanceTimersByTimeAsync(0);
      expect(badgeOf().getByText('7')).toBeDefined();
    });
  });

  it('fix-1 owner on / ends on /chu-san/yeu-cau', async () => {
    vi.mocked(clientModule.api).mockResolvedValue([]);
    vi.spyOn(sessionModule, 'useSession').mockReturnValue({
      user: { id: 'o1', name: 'Bình', role: 'OWNER' },
      setUser: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<App />}>
            <Route index element={<p>Trang đặt sân</p>} />
            <Route path="chu-san/yeu-cau" element={<p>Trang yêu cầu chủ sân</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Trang yêu cầu chủ sân')).toBeDefined();
    });
    expect(screen.queryByText('Trang đặt sân')).toBeNull();
  });
});
