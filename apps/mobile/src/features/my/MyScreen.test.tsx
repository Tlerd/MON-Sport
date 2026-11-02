import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import type { MatchView, MyBookingView } from '@monsport/shared';
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
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
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
      if (path === '/api/matches/joined') {
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
    const upcomingBooking: MyBookingView = {
      id: '00000000-0000-4000-8000-000000000010',
      courtId: '00000000-0000-4000-8000-000000000002',
      courtName: 'Sân Sắp Tới',
      venueName: 'Cầu lông An Phú',
      venuePhone: '0912345678',
      sport: 'BADMINTON',
      startAt: '2026-11-03T20:00:00+07:00',
      endAt: '2026-11-03T21:00:00+07:00',
      status: 'CONFIRMED',
      source: 'APP',
      priceTotal: 100000,
      confirmDeadline: null,
      confirmedAt: null,
      cancelledAt: null,
      createdAt: '2026-11-02T08:00:00+07:00',
      match: null,
    };
    const historyBooking: MyBookingView = {
      id: '00000000-0000-4000-8000-000000000011',
      courtId: '00000000-0000-4000-8000-000000000002',
      courtName: 'Sân Lịch Sử',
      venueName: 'Cầu lông An Phú',
      venuePhone: '0912345678',
      sport: 'BADMINTON',
      startAt: '2026-11-01T08:00:00+07:00',
      endAt: '2026-11-01T09:00:00+07:00',
      status: 'CONFIRMED',
      source: 'APP',
      priceTotal: 80000,
      confirmDeadline: null,
      confirmedAt: null,
      cancelledAt: null,
      createdAt: '2026-10-31T08:00:00+07:00',
      match: null,
    };

    vi.mocked(clientModule.api).mockImplementation(async (path: string) => {
      if (path === '/api/bookings/mine') return [upcomingBooking, historyBooking];
      if (path === '/api/matches/joined') return [];
      return [];
    });
    const now = new Date('2026-11-02T10:00:00+07:00');
    renderScreen(
      ['/lich-cua-toi'],
      { id: '00000000-0000-4000-8000-000000000001', name: 'User 1', role: 'USER' },
      now,
    );

    await screen.findByRole('navigation', { name: 'Lịch của tôi' });
    const chipUpcoming = screen.getByRole('button', { name: 'Sắp tới' });
    const chipJoined = screen.getByRole('button', { name: 'Trận đã vào' });
    const chipHistory = screen.getByRole('button', { name: 'Lịch sử' });

    expect(chipUpcoming.getAttribute('aria-pressed')).toBe('true');
    expect(chipJoined.getAttribute('aria-pressed')).toBe('false');
    expect(chipHistory.getAttribute('aria-pressed')).toBe('false');

    // Initially on "Sắp tới": upcoming shows, history does not
    expect(screen.getByText('Sân Sắp Tới')).toBeDefined();
    expect(screen.queryByText('Sân Lịch Sử')).toBeNull();

    // After click on "Lịch sử": history card shows and upcoming does not
    fireEvent.click(chipHistory);
    expect(chipUpcoming.getAttribute('aria-pressed')).toBe('false');
    expect(chipJoined.getAttribute('aria-pressed')).toBe('false');
    expect(chipHistory.getAttribute('aria-pressed')).toBe('true');

    expect(screen.getByText('Sân Lịch Sử')).toBeDefined();
    expect(screen.queryByText('Sân Sắp Tới')).toBeNull();

    // After click on "Sắp tới" again: reverse
    fireEvent.click(chipUpcoming);
    expect(chipUpcoming.getAttribute('aria-pressed')).toBe('true');
    expect(chipJoined.getAttribute('aria-pressed')).toBe('false');
    expect(chipHistory.getAttribute('aria-pressed')).toBe('false');

    expect(screen.getByText('Sân Sắp Tới')).toBeDefined();
    expect(screen.queryByText('Sân Lịch Sử')).toBeNull();

    // Move to "Trận đã vào"
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

    vi.mocked(clientModule.api).mockImplementation(async (path: string) => {
      if (path === '/api/bookings/mine') return [pendingBooking];
      if (path === '/api/matches/joined') return [];
      return [];
    });
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

    vi.mocked(clientModule.api).mockImplementation(async (path: string) => {
      if (path === '/api/bookings/mine') return [pendingBookingWithDeadline];
      if (path === '/api/matches/joined') return [];
      return [];
    });
    const now = new Date('2026-11-02T10:00:00+07:00');

    renderScreen(
      ['/lich-cua-toi'],
      { id: '00000000-0000-4000-8000-000000000001', name: 'User 1', role: 'USER' },
      now,
    );

    expect(await screen.findByText('Chủ sân xác nhận trước 18:00')).toBeDefined();
  });

  it('AC-6: the three empty texts; the button "Đặt sân" goes to /', async () => {
    vi.mocked(clientModule.api).mockImplementation(async () => []);
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
    vi.mocked(clientModule.api).mockImplementation(async () => []);
    renderScreen(
      ['/lich-cua-toi'],
      { id: '00000000-0000-4000-8000-000000000001', name: 'User 1', role: 'USER' },
    );

    expect(await screen.findByText('Chưa có booking sắp tới')).toBeDefined();
    const initialCalls = vi.mocked(clientModule.api).mock.calls.length;

    // visibilitychange when hidden should not trigger API call
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    fireEvent(document, new Event('visibilitychange'));
    expect(vi.mocked(clientModule.api).mock.calls.length).toBe(initialCalls);

    // visibilitychange when visible triggers reload
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    fireEvent(document, new Event('visibilitychange'));
    await waitFor(() => expect(vi.mocked(clientModule.api).mock.calls.length).toBe(initialCalls + 2));

    // Second part: network error with TypeError('Failed to fetch')
    cleanup();
    vi.mocked(clientModule.api).mockReset();

    vi.mocked(clientModule.api).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderScreen(
      ['/lich-cua-toi'],
      { id: '00000000-0000-4000-8000-000000000001', name: 'User 1', role: 'USER' },
    );

    expect(await screen.findByText('Không tải được')).toBeDefined();

    vi.mocked(clientModule.api).mockImplementation(async () => []);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

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

    vi.mocked(clientModule.api).mockImplementation(async (path: string) => {
      if (path === '/api/bookings/mine') return [historyBooking];
      if (path === '/api/matches/joined') return [];
      return [];
    });
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

  it('AC-10: now = 2026-11-02T10:00:00+07:00, user id U. /api/matches/joined returns 5 matches: T1 hostId U. T2 other host, OPEN, 4 of 10, start 2026-11-03T20:00:00+07:00, bookingStatus CONFIRMED. T3 other host, FULL, 10 of 10, start 2026-11-04T18:00:00+07:00, bookingStatus PENDING. T4 other host, CANCELLED, start 2026-11-03T09:00:00+07:00. T5 other host, OPEN, start 2026-11-02T08:00:00+07:00. After the click on "Trận đã vào": T2 and T3 show, in that order. T2 shows "4/10 suất" and "Đã xác nhận". T3 shows "10/10 suất", "Đầy", and "Chưa xác nhận". T1, T4, T5 do not show. The DOM has no text that looks like a phone number.', async () => {
    const userId = '00000000-0000-4000-8000-000000000001';
    const otherHostId = '00000000-0000-4000-8000-000000000002';

    const t1: MatchView = {
      id: '00000000-0000-4000-8000-000000000011',
      bookingId: '00000000-0000-4000-8000-000000000021',
      hostId: userId,
      hostName: 'Host T1 User',
      sport: 'BADMINTON',
      capacity: 10,
      joinedCount: 2,
      pricePerSlot: 50000,
      status: 'OPEN',
      bookingStatus: 'CONFIRMED',
      startAt: '2026-11-03T18:00:00+07:00',
      endAt: '2026-11-03T19:00:00+07:00',
      courtName: 'Sân T1',
      venueName: 'Cụm sân T1',
      venueAddress: '123 Đường 1',
      createdAt: '2026-11-01T08:00:00+07:00',
    };

    const t2: MatchView = {
      id: '00000000-0000-4000-8000-000000000012',
      bookingId: '00000000-0000-4000-8000-000000000022',
      hostId: otherHostId,
      hostName: 'Host T2 Minh',
      sport: 'BADMINTON',
      capacity: 10,
      joinedCount: 4,
      pricePerSlot: 50000,
      status: 'OPEN',
      bookingStatus: 'CONFIRMED',
      startAt: '2026-11-03T20:00:00+07:00',
      endAt: '2026-11-03T21:00:00+07:00',
      courtName: 'Sân T2 Cầu Lông',
      venueName: 'Cầu lông An Phú T2',
      venueAddress: '123 Đường 2',
      createdAt: '2026-11-01T08:00:00+07:00',
    };

    const t3: MatchView = {
      id: '00000000-0000-4000-8000-000000000013',
      bookingId: '00000000-0000-4000-8000-000000000023',
      hostId: otherHostId,
      hostName: 'Host T3 Hùng',
      sport: 'FOOTBALL',
      capacity: 10,
      joinedCount: 10,
      pricePerSlot: 60000,
      status: 'FULL',
      bookingStatus: 'PENDING',
      startAt: '2026-11-04T18:00:00+07:00',
      endAt: '2026-11-04T19:00:00+07:00',
      courtName: 'Sân T3 Bóng Đá',
      venueName: 'Sân bóng Thảo Điền T3',
      venueAddress: '123 Đường 3',
      createdAt: '2026-11-01T08:00:00+07:00',
    };

    const t4: MatchView = {
      id: '00000000-0000-4000-8000-000000000014',
      bookingId: '00000000-0000-4000-8000-000000000024',
      hostId: otherHostId,
      hostName: 'Host T4 Cancelled',
      sport: 'BADMINTON',
      capacity: 10,
      joinedCount: 3,
      pricePerSlot: 40000,
      status: 'CANCELLED',
      bookingStatus: 'CONFIRMED',
      startAt: '2026-11-03T09:00:00+07:00',
      endAt: '2026-11-03T10:00:00+07:00',
      courtName: 'Sân T4',
      venueName: 'Cụm sân T4',
      venueAddress: '123 Đường 4',
      createdAt: '2026-11-01T08:00:00+07:00',
    };

    const t5: MatchView = {
      id: '00000000-0000-4000-8000-000000000015',
      bookingId: '00000000-0000-4000-8000-000000000025',
      hostId: otherHostId,
      hostName: 'Host T5 Past',
      sport: 'BADMINTON',
      capacity: 10,
      joinedCount: 5,
      pricePerSlot: 40000,
      status: 'OPEN',
      bookingStatus: 'CONFIRMED',
      startAt: '2026-11-02T08:00:00+07:00',
      endAt: '2026-11-02T09:00:00+07:00',
      courtName: 'Sân T5',
      venueName: 'Cụm sân T5',
      venueAddress: '123 Đường 5',
      createdAt: '2026-11-01T08:00:00+07:00',
    };

    vi.mocked(clientModule.api).mockImplementation(async (path: string) => {
      if (path === '/api/bookings/mine') return [];
      if (path === '/api/matches/joined') return [t1, t2, t3, t4, t5];
      return [];
    });

    const now = new Date('2026-11-02T10:00:00+07:00');
    renderScreen(
      ['/lich-cua-toi'],
      { id: userId, name: 'User 1', role: 'USER' },
      now,
    );

    await screen.findByRole('navigation', { name: 'Lịch của tôi' });
    fireEvent.click(screen.getByRole('button', { name: 'Trận đã vào' }));

    // T2 and T3 show, in that order
    expect(await screen.findByText('Cầu lông An Phú T2')).toBeDefined();
    expect(screen.getByText('Sân bóng Thảo Điền T3')).toBeDefined();

    const articles = document.querySelectorAll('article');
    expect(articles.length).toBe(2);
    expect(articles[0].textContent).toContain('Cầu lông An Phú T2');
    expect(articles[1].textContent).toContain('Sân bóng Thảo Điền T3');

    // T2 shows "4/10 suất" and "Đã xác nhận"
    expect(articles[0].textContent).toContain('4/10 suất');
    expect(articles[0].textContent).toContain('Đã xác nhận');
    expect(articles[0].textContent).toContain('Host T2 Minh');
    expect(articles[0].textContent).toContain('Sân T2 Cầu Lông');
    expect(articles[0].textContent).toContain('20:00–21:00');

    // T3 shows "10/10 suất", "Đầy", and "Chưa xác nhận"
    expect(articles[1].textContent).toContain('Host T3 Hùng');
    expect(articles[1].textContent).toContain('Sân T3 Bóng Đá');
    expect(articles[1].textContent).toContain('18:00–19:00');
    expect(articles[1].textContent).toContain('10/10 suất');
    expect(articles[1].textContent).toContain('Đầy');
    expect(articles[1].textContent).toContain('Chưa xác nhận');

    // T1, T4, T5 do not show
    expect(screen.queryByText('Cụm sân T1')).toBeNull();
    expect(screen.queryByText('Host T1 User')).toBeNull();
    expect(screen.queryByText('Cụm sân T4')).toBeNull();
    expect(screen.queryByText('Host T4 Cancelled')).toBeNull();
    expect(screen.queryByText('Cụm sân T5')).toBeNull();
    expect(screen.queryByText('Host T5 Past')).toBeNull();

    // The DOM has no text that looks like a phone number
    expect(document.body.textContent).not.toMatch(/0\d{9}/);
    expect(document.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it('AC-10: an empty joined list shows "Bạn chưa vào trận nào"', async () => {
    vi.mocked(clientModule.api).mockImplementation(async (path: string) => {
      if (path === '/api/bookings/mine') return [];
      if (path === '/api/matches/joined') return [];
      return [];
    });

    renderScreen(
      ['/lich-cua-toi'],
      { id: '00000000-0000-4000-8000-000000000001', name: 'User 1', role: 'USER' },
    );

    await screen.findByRole('navigation', { name: 'Lịch của tôi' });
    fireEvent.click(screen.getByRole('button', { name: 'Trận đã vào' }));
    expect(await screen.findByText('Bạn chưa vào trận nào')).toBeDefined();
  });

  it('fix-race: the session user changes from A to B while A\'s request is still pending; A\'s late response never shows, and B\'s list shows', async () => {
    let resolveA!: (value: any) => void;
    const promiseA = new Promise((resolve) => {
      resolveA = resolve;
    });

    const bookingB: MyBookingView = {
      id: '00000000-0000-4000-8000-000000000099',
      courtId: '00000000-0000-4000-8000-000000000002',
      courtName: 'Sân của User B',
      venueName: 'Sân B',
      venuePhone: '0912345678',
      sport: 'BADMINTON',
      startAt: '2026-11-03T20:00:00+07:00',
      endAt: '2026-11-03T21:00:00+07:00',
      status: 'CONFIRMED',
      source: 'APP',
      priceTotal: 100000,
      confirmDeadline: null,
      confirmedAt: null,
      cancelledAt: null,
      createdAt: '2026-11-02T08:00:00+07:00',
      match: null,
    };

    const bookingA: MyBookingView = {
      id: '00000000-0000-4000-8000-000000000088',
      courtId: '00000000-0000-4000-8000-000000000002',
      courtName: 'Sân của User A',
      venueName: 'Sân A',
      venuePhone: '0912345678',
      sport: 'BADMINTON',
      startAt: '2026-11-03T20:00:00+07:00',
      endAt: '2026-11-03T21:00:00+07:00',
      status: 'CONFIRMED',
      source: 'APP',
      priceTotal: 100000,
      confirmDeadline: null,
      confirmedAt: null,
      cancelledAt: null,
      createdAt: '2026-11-02T08:00:00+07:00',
      match: null,
    };

    let currentUser: { id: string; name: string; role: 'USER' } = {
      id: 'user-a',
      name: 'User A',
      role: 'USER',
    };

    vi.mocked(clientModule.api).mockImplementation(async (path: string) => {
      if (currentUser.id === 'user-a') {
        if (path === '/api/bookings/mine') return promiseA;
        if (path === '/api/matches/joined') return [];
      }
      if (currentUser.id === 'user-b') {
        if (path === '/api/bookings/mine') return [bookingB];
        if (path === '/api/matches/joined') return [];
      }
      return [];
    });

    vi.spyOn(sessionModule, 'useSession').mockImplementation(() => ({
      user: currentUser,
      setUser: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      loading: false,
    }));

    const now = new Date('2026-11-02T10:00:00+07:00');
    const { rerender } = render(
      <MemoryRouter initialEntries={['/lich-cua-toi']}>
        <Routes>
          <Route path="/lich-cua-toi" element={<MyScreen now={now} />} />
        </Routes>
      </MemoryRouter>,
    );

    // Initial render for User A has started, loading is shown
    expect(screen.getByText('Đang tải')).toBeDefined();

    // User changes to User B while User A's request is still pending
    currentUser = { id: 'user-b', name: 'User B', role: 'USER' };
    rerender(
      <MemoryRouter initialEntries={['/lich-cua-toi']}>
        <Routes>
          <Route path="/lich-cua-toi" element={<MyScreen now={now} />} />
        </Routes>
      </MemoryRouter>,
    );

    // User B's list resolves and shows
    expect(await screen.findByText('Sân của User B')).toBeDefined();

    // Now User A's slow request finally resolves
    resolveA([bookingA]);
    await new Promise((r) => setTimeout(r, 10));

    // User A's data must NOT overwrite or appear
    expect(screen.queryByText('Sân của User A')).toBeNull();
    expect(screen.getByText('Sân của User B')).toBeDefined();
  });
});

const CANCEL_USER = { id: '00000000-0000-4000-8000-000000000001', name: 'User 1', role: 'USER' as const };
const CANCEL_NOW = new Date('2026-11-02T10:00:00+07:00');

function makeBooking(overrides: Partial<MyBookingView> & { id: string }): MyBookingView {
  return {
    courtId: '00000000-0000-4000-8000-000000000002',
    courtName: 'Sân 1',
    venueName: 'Cầu lông An Phú',
    venuePhone: '0912345678',
    sport: 'BADMINTON',
    startAt: '2026-11-02T13:00:00+07:00',
    endAt: '2026-11-02T14:00:00+07:00',
    status: 'PENDING',
    source: 'APP',
    priceTotal: 120000,
    confirmDeadline: null,
    confirmedAt: null,
    cancelledAt: null,
    createdAt: '2026-11-02T08:00:00+07:00',
    match: null,
    ...overrides,
  };
}

function mockLists(bookings: () => MyBookingView[]) {
  vi.mocked(clientModule.api).mockImplementation(async (path: string) => {
    if (path === '/api/bookings/mine') return bookings();
    if (path === '/api/matches/joined') return [];
    return {};
  });
}

describe('MyScreen cancel', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('AC-7: a PENDING booking 3 hours ahead: "Hủy" opens the sheet "Hủy booking này?" with court, time and price; confirm sends POST /api/bookings/:id/cancel; the card moves to Lịch sử as "Đã hủy"', async () => {
    const id = '00000000-0000-4000-8000-0000000000a1';
    let cancelled = false;
    const row = () =>
      makeBooking({
        id,
        courtName: 'Sân Hủy',
        startAt: '2026-11-02T13:00:00+07:00',
        endAt: '2026-11-02T14:00:00+07:00',
        status: cancelled ? 'CANCELLED' : 'PENDING',
        cancelledAt: cancelled ? '2026-11-02T10:00:00+07:00' : null,
      });
    vi.mocked(clientModule.api).mockImplementation(async (path: string, init?: unknown) => {
      if (path === '/api/bookings/mine') return [row()];
      if (path === '/api/matches/joined') return [];
      if (path === `/api/bookings/${id}/cancel`) {
        expect((init as { method?: string }).method).toBe('POST');
        cancelled = true;
        return row();
      }
      return {};
    });

    renderScreen(['/lich-cua-toi'], CANCEL_USER, CANCEL_NOW);

    fireEvent.click(await screen.findByRole('button', { name: 'Hủy' }));
    const dialog = await screen.findByRole('dialog', { name: 'Hủy booking này?' });
    expect(dialog.textContent).toContain('Sân Hủy');
    expect(dialog.textContent).toContain('13:00–14:00');
    expect(dialog.textContent).toContain('120.000đ');

    fireEvent.click(screen.getByRole('button', { name: 'Hủy booking' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(clientModule.api).toHaveBeenCalledWith(`/api/bookings/${id}/cancel`, { method: 'POST' });
    expect(await screen.findByText('Chưa có booking sắp tới')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Lịch sử' }));
    expect(await screen.findByText('Sân Hủy')).toBeDefined();
    expect(screen.getByText('Đã hủy')).toBeDefined();
  });

  it('AC-8: at 10:00 a CONFIRMED booking at 17:00 (7 h) and one at 16:00 (exactly 6 h) show "Hủy"; the one at 15:00 (5 h) shows no "Hủy" and a "Gọi chủ sân để hủy" link to the venue tel:', async () => {
    const at = (h: number, n: string) =>
      makeBooking({
        id: `00000000-0000-4000-8000-0000000000b${n}`,
        courtName: `Sân ${h}h`,
        status: 'CONFIRMED',
        startAt: `2026-11-02T${h}:00:00+07:00`,
        endAt: `2026-11-02T${h + 1}:00:00+07:00`,
      });
    const rows = [at(17, '1'), at(16, '2'), at(15, '3')];
    mockLists(() => rows);

    renderScreen(['/lich-cua-toi'], CANCEL_USER, CANCEL_NOW);
    await screen.findByText('Sân 17h');

    const card = (court: string) => screen.getByText(court).closest('article') as HTMLElement;
    for (const court of ['Sân 17h', 'Sân 16h']) {
      const el = card(court);
      expect(Array.from(el.querySelectorAll('button')).map((b) => b.textContent)).toContain('Hủy');
      expect(el.querySelector('a[href^="tel:"]')).toBeNull();
    }
    const late = card('Sân 15h');
    expect(Array.from(late.querySelectorAll('button')).map((b) => b.textContent)).not.toContain('Hủy');
    const link = late.querySelector('a') as HTMLAnchorElement;
    expect(link.textContent).toBe('Gọi chủ sân để hủy');
    expect(link.getAttribute('href')).toBe('tel:0912345678');
  });

  it('AC-9: a 409 keeps the sheet open, shows the API message, and reloads the list', async () => {
    const id = '00000000-0000-4000-8000-0000000000c1';
    mockLists(() => [makeBooking({ id })]);
    const base = vi.mocked(clientModule.api).getMockImplementation()!;
    vi.mocked(clientModule.api).mockImplementation(async (path: string, init?: unknown) => {
      if (path === `/api/bookings/${id}/cancel`) throw new ApiError(409, 'Booking này không hủy được nữa');
      return base(path, init as never);
    });

    renderScreen(['/lich-cua-toi'], CANCEL_USER, CANCEL_NOW);
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy' }));
    await screen.findByRole('dialog', { name: 'Hủy booking này?' });
    const before = vi
      .mocked(clientModule.api)
      .mock.calls.filter(([p]) => p === '/api/bookings/mine').length;

    fireEvent.click(screen.getByRole('button', { name: 'Hủy booking' }));

    expect(await screen.findByText('Booking này không hủy được nữa')).toBeDefined();
    expect(screen.getByRole('dialog', { name: 'Hủy booking này?' })).toBeDefined();
    await waitFor(() => {
      const after = vi
        .mocked(clientModule.api)
        .mock.calls.filter(([p]) => p === '/api/bookings/mine').length;
      expect(after).toBe(before + 1);
    });
  });

  it('AC-9: a 401 closes the sheet and opens the login sheet with "Phiên đăng nhập đã hết. Hãy đăng nhập lại."', async () => {
    const id = '00000000-0000-4000-8000-0000000000c2';
    mockLists(() => [makeBooking({ id })]);
    const base = vi.mocked(clientModule.api).getMockImplementation()!;
    vi.mocked(clientModule.api).mockImplementation(async (path: string, init?: unknown) => {
      if (path === `/api/bookings/${id}/cancel`) throw new ApiError(401, 'Chưa đăng nhập');
      return base(path, init as never);
    });

    renderScreen(['/lich-cua-toi'], CANCEL_USER, CANCEL_NOW);
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy' }));
    await screen.findByRole('dialog', { name: 'Hủy booking này?' });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy booking' }));

    expect(await screen.findByRole('dialog', { name: 'Đăng nhập' })).toBeDefined();
    expect(screen.queryByRole('dialog', { name: 'Hủy booking này?' })).toBeNull();
    expect(screen.getByText('Phiên đăng nhập đã hết. Hãy đăng nhập lại.')).toBeDefined();
  });

  it('AC-9: the confirm button is disabled while the request runs', async () => {
    const id = '00000000-0000-4000-8000-0000000000c3';
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockLists(() => [makeBooking({ id })]);
    const base = vi.mocked(clientModule.api).getMockImplementation()!;
    vi.mocked(clientModule.api).mockImplementation(async (path: string, init?: unknown) => {
      if (path === `/api/bookings/${id}/cancel`) {
        await gate;
        return {};
      }
      return base(path, init as never);
    });

    renderScreen(['/lich-cua-toi'], CANCEL_USER, CANCEL_NOW);
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy' }));
    await screen.findByRole('dialog', { name: 'Hủy booking này?' });
    const confirm = screen.getByRole('button', { name: 'Hủy booking' }) as HTMLButtonElement;
    fireEvent.click(confirm);
    await waitFor(() => expect(confirm.disabled).toBe(true));
    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('AC-15: a PENDING booking 3 hours ahead with an OPEN match shows the note and no "Hủy"; the same with a FULL match also has no "Hủy"', async () => {
    const note = 'Booking có trận. Hủy trận trên web hoặc ở tab Phòng chờ khi có.';
    const match = (status: 'OPEN' | 'FULL' | 'CANCELLED') => ({
      id: '00000000-0000-4000-8000-0000000000d0',
      status,
      joinedCount: 3,
      capacity: 10,
      pricePerSlot: 40000,
    });
    for (const status of ['OPEN', 'FULL'] as const) {
      mockLists(() => [makeBooking({ id: '00000000-0000-4000-8000-0000000000d1', match: match(status) })]);
      renderScreen(['/lich-cua-toi'], CANCEL_USER, CANCEL_NOW);
      expect(await screen.findByText(note)).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Hủy' })).toBeNull();
      expect(document.querySelector('a[href^="tel:"]')).toBeNull();
      cleanup();
      vi.restoreAllMocks();
    }
  });

  it('AC-15: a CONFIRMED booking 5 hours ahead with an OPEN match shows "Gọi chủ sân để hủy" and no "Hủy"', async () => {
    mockLists(() => [
      makeBooking({
        id: '00000000-0000-4000-8000-0000000000d2',
        status: 'CONFIRMED',
        startAt: '2026-11-02T15:00:00+07:00',
        endAt: '2026-11-02T16:00:00+07:00',
        match: { id: '00000000-0000-4000-8000-0000000000d0', status: 'OPEN', joinedCount: 3, capacity: 10, pricePerSlot: 40000 },
      }),
    ]);
    renderScreen(['/lich-cua-toi'], CANCEL_USER, CANCEL_NOW);
    const link = (await screen.findByText('Gọi chủ sân để hủy')) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('tel:0912345678');
    expect(screen.queryByRole('button', { name: 'Hủy' })).toBeNull();
  });

  it('AC-15: a booking with match null or a CANCELLED match still has "Hủy" (BR-17)', async () => {
    mockLists(() => [
      makeBooking({ id: '00000000-0000-4000-8000-0000000000d3', courtName: 'Sân không trận', match: null }),
      makeBooking({
        id: '00000000-0000-4000-8000-0000000000d4',
        courtName: 'Sân trận hủy',
        startAt: '2026-11-02T14:00:00+07:00',
        endAt: '2026-11-02T15:00:00+07:00',
        match: { id: '00000000-0000-4000-8000-0000000000d0', status: 'CANCELLED', joinedCount: 3, capacity: 10, pricePerSlot: 40000 },
      }),
    ]);
    renderScreen(['/lich-cua-toi'], CANCEL_USER, CANCEL_NOW);
    await screen.findByText('Sân không trận');
    expect(screen.getAllByRole('button', { name: 'Hủy' }).length).toBe(2);
  });

  it('fix-race: a response for the old user is dropped after logout', async () => {
    let resolveA!: (value: MyBookingView[]) => void;
    const pending = new Promise<MyBookingView[]>((resolve) => {
      resolveA = resolve;
    });
    vi.mocked(clientModule.api).mockImplementation(async (path: string) => {
      if (path === '/api/bookings/mine') return pending;
      return [];
    });
    let current: sessionModule.SessionContextType['user'] = { id: 'user-a', name: 'A', role: 'USER' };
    vi.spyOn(sessionModule, 'useSession').mockImplementation(() => ({
      user: current,
      setUser: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      loading: false,
    }));
    // A new element each call: React skips a re-render for the same element object.
    const makeTree = () => (
      <MemoryRouter initialEntries={['/lich-cua-toi']}>
        <Routes>
          <Route path="/lich-cua-toi" element={<MyScreen now={CANCEL_NOW} />} />
        </Routes>
      </MemoryRouter>
    );
    const { rerender } = render(makeTree());
    current = null;
    rerender(makeTree());
    expect(await screen.findByText('Đăng nhập để xem lịch của bạn')).toBeDefined();
    resolveA([makeBooking({ id: '00000000-0000-4000-8000-0000000000e1', courtName: 'Sân của A' })]);
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByText('Sân của A')).toBeNull();
  });
});
