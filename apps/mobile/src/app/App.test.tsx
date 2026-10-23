import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import { ToiScreen } from '../features/auth/ToiScreen';
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
});
