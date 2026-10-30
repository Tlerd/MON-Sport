import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import type { MyBookingView } from '@monsport/shared';
import * as sessionModule from '../../app/session';
import { SessionProvider } from '../../app/session';
import { MyScreen } from './MyScreen';

vi.mock('@monsport/client', async () => {
  const actual = await vi.importActual<typeof import('@monsport/client')>('@monsport/client');
  return {
    ...actual,
    api: vi.fn(),
  };
});

function renderScreen(
  initialEntries = ['/lich-cua-toi'],
  user?: sessionModule.SessionContextType['user'],
  now?: Date,
) {
  if (user !== undefined) {
    vi.spyOn(sessionModule, 'useSession').mockReturnValue({
      user,
      setUser: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      loading: false,
    });
  }

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<p>Trang chủ đặt sân</p>} />
        <Route path="/lich-cua-toi" element={<MyScreen now={now} />} />
        <Route path="/chu-san/yeu-cau" element={<p>Trang yêu cầu chủ sân</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MyScreen', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders loading state when user session is undefined', () => {
    vi.spyOn(sessionModule, 'useSession').mockReturnValue({
      user: undefined,
      setUser: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      loading: true,
    });

    render(
      <MemoryRouter initialEntries={['/lich-cua-toi']}>
        <MyScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText('Đang tải')).toBeDefined();
  });

  it('AC-1: a guest sees "Đăng nhập để xem lịch của bạn" and the button; the button opens the login sheet; after a mocked login the list loads and the route stays /lich-cua-toi', async () => {
    let currentUser: { id: string; name: string; role: 'ADMIN' | 'OWNER' | 'USER' } | null = null;

    vi.mocked(clientModule.api).mockImplementation(async (path: string) => {
      if (path === '/api/auth/me') {
        if (!currentUser) throw new ApiError(401, 'Chưa đăng nhập');
        return currentUser;
      }
      if (path === '/api/auth/login') {
        currentUser = { id: '00000000-0000-4000-8000-000000000001', name: 'User 1', role: 'USER' };
        return { ok: true };
      }
      if (path === '/api/bookings/mine') {
        return [];
      }
      return {};
    });

    render(
      <SessionProvider>
        <MemoryRouter initialEntries={['/lich-cua-toi']}>
          <Routes>
            <Route path="/" element={<p>Trang chủ đặt sân</p>} />
            <Route path="/lich-cua-toi" element={<MyScreen />} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>,
    );

    expect(await screen.findByText('Đăng nhập để xem lịch của bạn')).toBeDefined();
    const loginBtn = screen.getByRole('button', { name: 'Đăng nhập' });
    fireEvent.click(loginBtn);

    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234567' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau123' } });

    const submitBtn = screen
      .getAllByRole('button', { name: 'Đăng nhập' })
      .find((btn) => btn.getAttribute('type') === 'submit')!;
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Đăng nhập' })).toBeNull();
    });

    await waitFor(() => {
      expect(clientModule.api).toHaveBeenCalledWith('/api/bookings/mine');
    });

    expect(await screen.findByRole('navigation', { name: 'Lịch của tôi' })).toBeDefined();
    expect(screen.getByText('Chưa có booking sắp tới')).toBeDefined();
    expect(screen.queryByText('Trang chủ đặt sân')).toBeNull();
  });

  it('AC-2: three chips; "Sắp tới" has aria-pressed="true"; a click on another chip moves the selection', async () => {
    vi.mocked(clientModule.api).mockResolvedValue([]);
    renderScreen(['/lich-cua-toi'], { id: '00000000-0000-4000-8000-000000000001', name: 'User 1', role: 'USER' });

    await screen.findByRole('navigation', { name: 'Lịch của tôi' });
    const chipUpcoming = screen.getByRole('button', { name: 'Sắp tới' });
    const chipJoined = screen.getByRole('button', { name: 'Trận đã vào' });
    const chipHistory = screen.getByRole('button', { name: 'Lịch sử' });

    expect(chipUpcoming.getAttribute('aria-pressed')).toBe('true');
    expect(chipJoined.getAttribute('aria-pressed')).toBe('false');
    expect(chipHistory.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(chipHistory);
    expect(chipUpcoming.getAttribute('aria-pressed')).toBe('false');
    expect(chipJoined.getAttribute('aria-pressed')).toBe('false');
    expect(chipHistory.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(chipJoined);
    expect(chipUpcoming.getAttribute('aria-pressed')).toBe('false');
    expect(chipJoined.getAttribute('aria-pressed')).toBe('true');
    expect(chipHistory.getAttribute('aria-pressed')).toBe('false');
  });

  it('AC-5: a PENDING booking of "Sân 1", venue "Cầu lông An Phú", 20:00–21:00 on 03/11/2026, priceTotal 120000, match with joinedCount 3 and capacity 10 shows all details and no phone number or tel: link in DOM', async () => {
    const pendingBooking: MyBookingView = {
      id: '00000000-0000-4000-8000-000000000001',
      courtId: '00000000-0000-4000-8000-000000000002',
      courtName: 'Sân 1',
      venueName: 'Cầu lông An Phú',
      venuePhone: '0912345678',
      sport: 'BADMINTON',
      startAt: '2026-11-03T20:00:00+07:00',
      endAt: '2026-11-03T21:00:00+07:00',
      status: 'PENDING',
      source: 'APP',
      priceTotal: 120000,
      confirmDeadline: null,
      confirmedAt: null,
      cancelledAt: null,
      createdAt: '2026-11-02T08:00:00+07:00',
      match: {
        id: '00000000-0000-4000-8000-000000000003',
        status: 'OPEN',
        joinedCount: 3,
        capacity: 10,
        pricePerSlot: 40000,
      },
    };

    vi.mocked(clientModule.api).mockResolvedValue([pendingBooking]);
    const now = new Date('2026-11-02T10:00:00+07:00');

    renderScreen(
      ['/lich-cua-toi'],
      { id: '00000000-0000-4000-8000-000000000001', name: 'User 1', role: 'USER' },
      now,
    );

    expect(await screen.findByText('Cầu lông An Phú')).toBeDefined();
    expect(screen.getByText('Sân 1')).toBeDefined();
    expect(screen.getByText('Thứ Ba, 03/11/2026')).toBeDefined();
    expect(screen.getByText('20:00–21:00')).toBeDefined();
    expect(screen.getByText('120.000đ')).toBeDefined();
    expect(screen.getByText('Chờ xác nhận')).toBeDefined();
    expect(screen.getByText('Trận mở: 3/10 suất')).toBeDefined();

    expect(document.body.textContent).not.toMatch(/0\d{9}/);
    expect(document.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it('shows confirmDeadline when status is PENDING and confirmDeadline is present', async () => {
    const pendingBookingWithDeadline: MyBookingView = {
      id: '00000000-0000-4000-8000-000000000001',
      courtId: '00000000-0000-4000-8000-000000000002',
      courtName: 'Sân 1',
      venueName: 'Cầu lông An Phú',
      venuePhone: '0912345678',
      sport: 'BADMINTON',
      startAt: '2026-11-03T20:00:00+07:00',
      endAt: '2026-11-03T21:00:00+07:00',
      status: 'PENDING',
      source: 'APP',
      priceTotal: 120000,
      confirmDeadline: '2026-11-03T18:00:00+07:00',
      confirmedAt: null,
      cancelledAt: null,
      createdAt: '2026-11-02T08:00:00+07:00',
      match: null,
    };

    vi.mocked(clientModule.api).mockResolvedValue([pendingBookingWithDeadline]);
    const now = new Date('2026-11-02T10:00:00+07:00');

    renderScreen(
      ['/lich-cua-toi'],
      { id: '00000000-0000-4000-8000-000000000001', name: 'User 1', role: 'USER' },
      now,
    );

    expect(await screen.findByText('Chủ sân xác nhận trước 18:00')).toBeDefined();
  });

  it('AC-6: the three empty texts; the button "Đặt sân" goes to /', async () => {
    vi.mocked(clientModule.api).mockResolvedValue([]);
    renderScreen(
      ['/lich-cua-toi'],
      { id: '00000000-0000-4000-8000-000000000001', name: 'User 1', role: 'USER' },
    );

    // 1. Sắp tới
    expect(await screen.findByText('Chưa có booking sắp tới')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Đặt sân' })).toBeDefined();

    // 2. Trận đã vào
    fireEvent.click(screen.getByRole('button', { name: 'Trận đã vào' }));
    expect(await screen.findByText('Bạn chưa vào trận nào')).toBeDefined();

    // 3. Lịch sử
    fireEvent.click(screen.getByRole('button', { name: 'Lịch sử' }));
    expect(await screen.findByText('Chưa có lịch sử')).toBeDefined();

    // Click "Đặt sân" navigates to /
    fireEvent.click(screen.getByRole('button', { name: 'Sắp tới' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đặt sân' }));
    expect(await screen.findByText('Trang chủ đặt sân')).toBeDefined();
  });

  it('AC-11: an OWNER on /lich-cua-toi ends on /chu-san/yeu-cau', async () => {
    renderScreen(
      ['/lich-cua-toi'],
      { id: '00000000-0000-4000-8000-000000000099', name: 'Chủ sân Bình', role: 'OWNER' },
    );

    await waitFor(() => {
      expect(screen.getByText('Trang yêu cầu chủ sân')).toBeDefined();
    });
    expect(screen.queryByRole('navigation', { name: 'Lịch của tôi' })).toBeNull();
  });

  it('AC-12: after the list loaded, a visibilitychange triggers exactly one more request; network failure shows "Không tải được", and "Thử lại" loads again', async () => {
    vi.mocked(clientModule.api).mockResolvedValueOnce([]);
    renderScreen(
      ['/lich-cua-toi'],
      { id: '00000000-0000-4000-8000-000000000001', name: 'User 1', role: 'USER' },
    );

    expect(await screen.findByText('Chưa có booking sắp tới')).toBeDefined();
    expect(clientModule.api).toHaveBeenCalledTimes(1);

    // visibilitychange when hidden should not trigger API call
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    fireEvent(document, new Event('visibilitychange'));
    expect(clientModule.api).toHaveBeenCalledTimes(1);

    // visibilitychange when visible triggers exactly one more request
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    fireEvent(document, new Event('visibilitychange'));
    await waitFor(() => expect(clientModule.api).toHaveBeenCalledTimes(2));

    // Second part: network error
    cleanup();
    vi.mocked(clientModule.api).mockReset();

    vi.mocked(clientModule.api).mockRejectedValueOnce(new ApiError(500, 'Network error'));
    renderScreen(
      ['/lich-cua-toi'],
      { id: '00000000-0000-4000-8000-000000000001', name: 'User 1', role: 'USER' },
    );

    expect(await screen.findByText('Không tải được')).toBeDefined();
    expect(clientModule.api).toHaveBeenCalledTimes(1);

    vi.mocked(clientModule.api).mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    await waitFor(() => expect(clientModule.api).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Chưa có booking sắp tới')).toBeDefined();
  });

  it('shows history bookings in Lịch sử tab', async () => {
    const historyBooking: MyBookingView = {
      id: '00000000-0000-4000-8000-000000000004',
      courtId: '00000000-0000-4000-8000-000000000002',
      courtName: 'Sân 2',
      venueName: 'Cầu lông An Phú',
      venuePhone: '0912345678',
      sport: 'BADMINTON',
      startAt: '2026-11-01T08:00:00+07:00',
      endAt: '2026-11-01T09:00:00+07:00',
      status: 'CONFIRMED',
      source: 'APP',
      priceTotal: 80000,
      confirmDeadline: null,
      confirmedAt: '2026-11-01T07:00:00+07:00',
      cancelledAt: null,
      createdAt: '2026-10-31T08:00:00+07:00',
      match: null,
    };

    vi.mocked(clientModule.api).mockResolvedValue([historyBooking]);
    const now = new Date('2026-11-02T10:00:00+07:00');

    renderScreen(
      ['/lich-cua-toi'],
      { id: '00000000-0000-4000-8000-000000000001', name: 'User 1', role: 'USER' },
      now,
    );

    expect(await screen.findByText('Chưa có booking sắp tới')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Lịch sử' }));
    expect(await screen.findByText('Sân 2')).toBeDefined();
    expect(screen.getByText('Đã xác nhận')).toBeDefined();
    expect(screen.getByText('80.000đ')).toBeDefined();
  });
});
