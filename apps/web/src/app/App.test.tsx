import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';

vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>();
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div className="recharts-responsive-container" style={{ width: 600, height: 300 }}>
        {children}
      </div>
    ),
  };
});

describe('App', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the login form when nobody is signed in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({ message: 'Bạn cần đăng nhập' }) }));
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Đăng nhập' }));
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeTruthy();
  });

  it('AC-25: after the sign-up, the booking form and the name "Lan" in the top bar show', async () => {
    const lan = { id: '0199a1b2-0000-7000-8000-000000000009', name: 'Lan', role: 'USER' };
    const sampleVenue = {
      id: 'v1', name: 'Sân Cầu Lông 1', address: '12 Nguyễn Trãi', phone: '0901234567',
      opensAt: 360, closesAt: 1320,
      courts: [{ id: 'c1', venueId: 'v1', name: 'Sân 1', sport: 'BADMINTON', priceNormal: 80000, pricePeak: 110000, peakStart: 1020, peakEnd: 1260 }],
    };
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const [status, body] = url === '/api/auth/me' ? [401, { message: 'Bạn cần đăng nhập' }] : url === '/api/auth/register' ? [201, lan] : url === '/api/venues' ? [200, [sampleVenue]] : [200, []];
      return Promise.resolve({ ok: (status as number) < 400, status, json: () => Promise.resolve(body) });
    }));
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Đăng nhập' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo tài khoản' }));
    fireEvent.change(screen.getByLabelText('Tên của bạn'), { target: { value: 'Lan' } });
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901112233' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau123' } });
    fireEvent.change(screen.getByLabelText('Trình độ'), { target: { value: 'BEGINNER' } });
    expect((screen.getByRole('button', { name: 'Tạo tài khoản' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(await screen.findByRole('heading', { name: 'Trận đang mở' })).toBeTruthy();
    expect(within(screen.getByRole('banner')).getByText('Lan')).toBeTruthy();
    fireEvent.click(await screen.findByRole('link', { name: /Sân Cầu Lông 1/ }));
    expect(await screen.findByRole('heading', { name: 'Đặt sân' })).toBeTruthy();
  });

  it('shows the owner requests to an owner', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(url === '/api/auth/me' ? { id: 'x', name: 'Bình', role: 'OWNER' } : []) }),
    ));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Yêu cầu đặt sân' })).toBeTruthy();
  });

  it('owner opens /chu-san/yeu-cau, a confirmed booking shows, click "Hủy", and fetch is called with POST /api/owner/bookings/<id>/cancel', async () => {
    const bookingId = '0199a1b2-0000-7000-8000-000000000101';
    const futureStart = new Date(Date.now() + 3600_000).toISOString();
    const futureEnd = new Date(Date.now() + 7200_000).toISOString();
    const confirmedBooking = {
      id: bookingId,
      courtId: 'court-1',
      startAt: futureStart,
      endAt: futureEnd,
      status: 'CONFIRMED',
      source: 'APP',
      priceTotal: 120_000,
      confirmDeadline: null,
      confirmedAt: new Date().toISOString(),
      cancelledAt: null,
      createdAt: new Date().toISOString(),
      customer: { name: 'Chú Tư', phone: '0987654321' },
    };
    const fetchMock = vi.fn((url: string, opts?: RequestInit) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'x', name: 'Bình', role: 'OWNER' }) });
      }
      if (url === '/api/owner/bookings?status=CONFIRMED') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([confirmedBooking]) });
      }
      if (url === `/api/owner/bookings/${bookingId}/cancel` && opts?.method === 'POST') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ...confirmedBooking, status: 'CANCELLED' }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    });
    vi.stubGlobal('fetch', fetchMock);

    window.history.pushState({}, '', '/chu-san/yeu-cau');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Booking đã xác nhận' })).toBeTruthy();
    expect(await screen.findByText('Chú Tư')).toBeTruthy();

    const cancelButton = screen.getByRole('button', { name: /^Hủy/ });
    fireEvent.click(cancelButton);

    const confirmButton = screen.getByRole('button', { name: /^Xác nhận hủy/ });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/owner/bookings/${bookingId}/cancel`,
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  // Brief F-008 (AC-14): a guest and a user see the free hours, an owner and an admin do not.
  // The notice shows once for each role: the guest sees it in the free hours, the user in the booking form.
  const NOTICE = 'App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.';
  const as = (me: unknown) => vi.stubGlobal('fetch', vi.fn((url: string) => {
    const [status, body] = url === '/api/auth/me' ? (me ? [200, me] : [401, { message: 'Bạn cần đăng nhập' }]) : [200, []];
    return Promise.resolve({ ok: (status as number) < 400, status, json: () => Promise.resolve(body) });
  }));

  const sampleVenueForSan = {
    id: 'v1', name: 'Sân Cầu Lông 1', address: '12 Nguyễn Trãi', phone: '0901234567',
    opensAt: 360, closesAt: 1320,
    courts: [{ id: 'c1', venueId: 'v1', name: 'Sân 1', sport: 'BADMINTON', priceNormal: 80000, pricePeak: 110000, peakStart: 1020, peakEnd: 1260 }],
  };
  const asWithVenue = (me: unknown) => vi.stubGlobal('fetch', vi.fn((url: string) => {
    const [status, body] = url === '/api/auth/me' ? (me ? [200, me] : [401, { message: 'Bạn cần đăng nhập' }]) : url === '/api/venues' ? [200, [sampleVenueForSan]] : [200, []];
    return Promise.resolve({ ok: (status as number) < 400, status, json: () => Promise.resolve(body) });
  }));

  it('AC-14: a guest sees the free hours and the notice once', async () => {
    as(null);
    window.history.pushState({}, '', '/san');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Giờ trống' })).toBeTruthy();
    expect(screen.getAllByText(NOTICE)).toHaveLength(1);
  });

  it('AC-14: a user sees the free hours and the booking form, and the notice once', async () => {
    asWithVenue({ id: 'x', name: 'An', role: 'USER' });
    window.history.pushState({}, '', '/san');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Giờ trống' })).toBeTruthy();
    expect(screen.getAllByText(NOTICE)).toHaveLength(1);

    fireEvent.click(await screen.findByRole('link', { name: /Sân Cầu Lông 1/ }));
    expect(await screen.findByRole('heading', { name: 'Đặt sân' })).toBeTruthy();
    expect(screen.getAllByText(NOTICE)).toHaveLength(1);
  });

  it('AC-7: a user sees the search box once, in the free hours, and the booking form has none', async () => {
    asWithVenue({ id: 'x', name: 'An', role: 'USER' });
    window.history.pushState({}, '', '/san');
    render(<App />);
    const freeHours = (await screen.findByRole('heading', { name: 'Giờ trống' })).closest('section')!;
    expect(screen.getAllByLabelText('Tìm theo tên sân')).toHaveLength(1);
    expect(within(freeHours).getByLabelText('Tìm theo tên sân')).toBeTruthy();

    fireEvent.click(await screen.findByRole('link', { name: /Sân Cầu Lông 1/ }));
    const bookingForm = (await screen.findByRole('heading', { name: 'Đặt sân' })).closest('section')!;
    expect(within(bookingForm).queryByLabelText('Tìm theo tên sân')).toBeNull();
  });

  it.each([['OWNER', 'Yêu cầu đặt sân'], ['ADMIN', null]] as const)('AC-14: a %s does not see the free hours', async (role, heading) => {
    as({ id: 'x', name: 'Bình', role });
    render(<App />);
    if (heading) await screen.findByRole('heading', { name: heading });
    else await screen.findByRole('heading', { name: 'Số liệu toàn trang' });
    expect(screen.queryByRole('heading', { name: 'Giờ trống' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Phòng chờ' })).toBeNull();
  });

  it('AC-16: both a guest and a USER see "Phòng chờ"', async () => {
    as(null);
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Ghép trận' }));
    expect(await screen.findByRole('heading', { name: 'Phòng chờ' })).toBeTruthy();
    cleanup();

    as({ id: 'x', name: 'An', role: 'USER' });
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Ghép trận' }));
    expect(await screen.findByRole('heading', { name: 'Phòng chờ' })).toBeTruthy();
  });

  it('AC-13: a USER sees "Trận đã vào", while guests, owners, and admins do not', async () => {
    as({ id: 'x', name: 'An', role: 'USER' });
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Lịch' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Trận đã vào' }));
    expect(await screen.findByRole('heading', { name: 'Trận đã vào' })).toBeTruthy();
    cleanup();

    window.history.pushState({}, '', '/');
    as(null);
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'Ghép trận' }));
    expect(await screen.findByRole('heading', { name: 'Phòng chờ' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Trận đã vào' })).toBeNull();
    cleanup();

    as({ id: 'x', name: 'Bình', role: 'OWNER' });
    render(<App />);
    await screen.findByRole('heading', { name: 'Yêu cầu đặt sân' });
    expect(screen.queryByRole('heading', { name: 'Trận đã vào' })).toBeNull();
    cleanup();

    as({ id: 'x', name: 'Admin', role: 'ADMIN' });
    render(<App />);
    await screen.findByRole('heading', { name: 'Số liệu toàn trang' });
    expect(screen.queryByRole('heading', { name: 'Trận đã vào' })).toBeNull();
  });

  it('AC-10: an OWNER sees the notification bell with unread badge in the top bar and can open notifications', async () => {
    const mockNotifs = {
      unreadCount: 1,
      items: [
        {
          id: '0199a1b2-0000-7000-8000-000000000010',
          type: 'BOOKING_REQUESTED',
          bookingId: '0199a1b2-0000-7000-8000-000000000020',
          matchId: null,
          readAt: null,
          createdAt: '2026-11-20T02:00:00.000Z',
          title: 'Yêu cầu đặt sân mới',
          message: 'Có yêu cầu đặt sân tại Cầu lông A - Sân 1 khung 20:00 - 21:00 ngày 20/11/2026.',
          venueName: 'Cầu lông A',
          courtName: 'Sân 1',
          startAt: '2026-11-20T13:00:00.000Z',
          endAt: '2026-11-20T14:00:00.000Z',
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
      if (url === '/api/auth/me') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'x', name: 'Bình', role: 'OWNER' }) });
      if (url === '/api/notifications' && (!opts || !opts.method || opts.method === 'GET')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(mockNotifs) });
      if (url === `/api/notifications/${mockNotifs.items[0].id}/read` && opts?.method === 'POST') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: mockNotifs.items[0].id, readAt: '2026-11-20T03:00:00.000Z' }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    render(<App />);
    await screen.findByRole('heading', { name: 'Yêu cầu đặt sân' });
    const bell = await within(screen.getByRole('banner')).findByRole('button', { name: /Thông báo/ });
    expect(await within(screen.getByRole('banner')).findByText('1')).toBeTruthy();

    fireEvent.click(bell);
    expect(await screen.findByRole('heading', { name: 'Thông báo' })).toBeTruthy();
    expect(screen.getByText('Yêu cầu đặt sân mới')).toBeTruthy();

    // Click unread notification
    fireEvent.click(screen.getByText('Yêu cầu đặt sân mới').closest('li')!);
    await waitFor(() => {
      expect(screen.queryByText('1')).toBeNull();
    });
  });

  it('AC-11: a USER with no notifications sees "Chưa có thông báo nào" on clicking bell', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/auth/me') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'x', name: 'An', role: 'USER' }) });
      if (url === '/api/notifications') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ unreadCount: 0, items: [] }) });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    render(<App />);
    const bell = await screen.findByRole('button', { name: /Thông báo/ });
    fireEvent.click(bell);
    expect(await screen.findByRole('heading', { name: 'Thông báo' })).toBeTruthy();
    expect(screen.getByText('Chưa có thông báo nào')).toBeTruthy();
  });

  /** A signed-in browser that holds a Web Push subscription. `calls` records the order of the steps. */
  function withPush(options: { unsubscribeFails?: boolean; deleteStatus?: number } = {}) {
    const calls: string[] = [];
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
      toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys: { p256dh: 'p', auth: 'a' } }),
      unsubscribe: vi.fn(() => {
        calls.push('unsubscribe');
        return options.unsubscribeFails ? Promise.reject(new Error('boom')) : Promise.resolve(true);
      }),
    };
    const registration = { pushManager: { getSubscription: () => Promise.resolve(subscription) } };
    Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistration: () => Promise.resolve(registration) }, configurable: true });
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', { permission: 'granted' });
    localStorage.setItem('monsport.push.user', 'x');
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      let status = 200;
      let body: unknown = [];
      if (url === '/api/auth/me') body = { id: 'x', name: 'An', role: 'USER' };
      else if (url === '/api/auth/logout') {
        calls.push('logout');
        body = {};
      } else if (url === '/api/push/subscriptions') {
        calls.push(`${method} push`);
        if (method === 'DELETE') status = options.deleteStatus ?? 204;
      }
      return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
    }));
    return { calls, subscription };
  }

  const cleanupPush = () => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
    localStorage.clear();
  };

  it('AC-20: "Đăng xuất" unsubscribes and sends DELETE for the endpoint before it calls logout', async () => {
    const { calls, subscription } = withPush();
    try {
      render(<App />);
      fireEvent.click(await within(screen.getByRole('banner')).findByRole('button', { name: /An/ }));
      const logoutButton = await screen.findByRole('button', { name: 'Đăng xuất' });
      // resyncPush runs once after the page load; wait for it, or a slow run can read the stored user after the logout cleared it.
      await waitFor(() => expect(calls).toContain('POST push'));
      fireEvent.click(logoutButton);

      expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeTruthy();
      expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
      expect(calls.slice(calls.indexOf('unsubscribe'))).toEqual(['unsubscribe', 'DELETE push', 'logout']);
      const del = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(([, init]) => init?.method === 'DELETE')!;
      expect(JSON.parse(del[1].body)).toEqual({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc123' });
      expect(localStorage.getItem('monsport.push.user')).toBeNull();
    } finally {
      cleanupPush();
    }
  });

  it('AC-20: an error of the unsubscribe and of the DELETE does not block the logout', async () => {
    const { calls } = withPush({ unsubscribeFails: true, deleteStatus: 500 });
    try {
      render(<App />);
      fireEvent.click(await within(screen.getByRole('banner')).findByRole('button', { name: /An/ }));
      const logoutButton = await screen.findByRole('button', { name: 'Đăng xuất' });
      // resyncPush runs once after the page load; wait for it, or a slow run can read the stored user after the logout cleared it.
      await waitFor(() => expect(calls).toContain('POST push'));
      fireEvent.click(logoutButton);

      expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeTruthy();
      expect(calls).toContain('logout');
      expect(calls.indexOf('logout')).toBeGreaterThan(calls.indexOf('DELETE push'));
    } finally {
      cleanupPush();
    }
  });

  it('AC-22: a signed-in user who turned Web Push on sends the subscription again once, after the page loads', async () => {
    const { calls } = withPush();
    try {
      render(<App />);
      await within(screen.getByRole('banner')).findByRole('button', { name: /An/ });

      await waitFor(() => expect(calls).toEqual(['POST push']));
    } finally {
      cleanupPush();
    }
  });

  it('AC-11: an OWNER switches to "Doanh thu" tab and sees the financial dashboard', async () => {
    const venue = { id: '0199a1b2-0000-7000-8000-000000000001', name: 'Cầu lông A', address: '123 Đường 3/2', phone: '0901234567', opensAt: 360, closesAt: 1380, courts: [] };
    const financialData = {
      venueId: venue.id,
      venueName: 'Cầu lông A',
      period: 'week',
      date: '2026-11-20',
      startDate: '2026-11-16T00:00:00.000Z',
      endDate: '2026-11-22T23:59:59.999Z',
      revenue: 960_000,
      totalBookings: 10,
      paidBookings: 8,
      unpaidBookings: 2,
      bookedHours: 10,
      openingHours: 238,
      occupancyRate: 0.042,
      peakHours: 4,
      normalHours: 6,
      cancelledBookings: 2,
      rejectedBookings: 1,
      cancellationRate: 0.1538,
      rejectionRate: 0.0769,
      totalCustomers: 5,
      returningCustomers: 2,
      chartData: [],
    };
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/auth/me') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'x', name: 'Bình', role: 'OWNER' }) });
      if (url === '/api/notifications') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ unreadCount: 0, items: [] }) });
      if (url === '/api/owner/venues') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([venue]) });
      if (url.startsWith(`/api/owner/venues/${venue.id}/financials`)) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(financialData) });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Yêu cầu đặt sân' })).toBeTruthy();

    const financeTab = await screen.findByRole('link', { name: /Doanh thu/ });
    fireEvent.click(financeTab);

    expect(await screen.findByRole('heading', { name: 'Báo cáo tài chính' })).toBeTruthy();
    expect(await screen.findByText('960.000đ')).toBeTruthy();
  });

  it('renders topnav with brand, nav items, and account area, and routes /san/:id to the venue in BookPage', async () => {
    const venue = { id: '0199a1b2-0000-7000-8000-000000000002', name: 'Sân Cầu Lông B', address: '456 Lê Lợi', phone: '0907654321', opensAt: 360, closesAt: 1380, courts: [] };
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/auth/me') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'u1', name: 'Minh', role: 'USER' }) });
      if (url === '/api/notifications') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ unreadCount: 0, items: [] }) });
      if (url === '/api/venues') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([venue]) });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    window.history.pushState({}, '', '/san/0199a1b2-0000-7000-8000-000000000002');
    render(<App />);

    const banner = screen.getByRole('banner');
    expect(await within(banner).findByText('Minh')).toBeTruthy();
    expect(within(banner).getByText('MONSPORT')).toBeTruthy();
    expect(within(banner).getByRole('link', { name: 'Sân' })).toBeTruthy();
    expect(within(banner).getByRole('link', { name: 'Ghép trận' })).toBeTruthy();
    expect(within(banner).getByRole('link', { name: 'Lịch' })).toBeTruthy();
    expect(within(banner).getByText('Minh')).toBeTruthy();

    expect(await screen.findByRole('heading', { name: 'Sân Cầu Lông B' })).toBeTruthy();
  });

  it('renders "Hoàn tất đăng ký" screen when ?google=complete', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/auth/me') return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ message: 'Bạn cần đăng nhập' }) });
      if (url === '/api/auth/google/pending') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ name: 'Lan', email: 'lan@example.com' }) });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    window.history.pushState({}, '', '/?google=complete');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Hoàn tất đăng ký' })).toBeTruthy();
    expect(await screen.findByText('lan@example.com')).toBeTruthy();
  });

  it('renders "Xác minh số điện thoại" screen when ?google=verify', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/auth/me') return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ message: 'Bạn cần đăng nhập' }) });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    window.history.pushState({}, '', '/?google=verify');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Xác minh số điện thoại' })).toBeTruthy();
    expect(screen.getByText(/số điện thoại của tài khoản/)).toBeTruthy();
  });

  it('renders login screen with clear Vietnamese message when ?google_error=access_denied', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/auth/me') return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ message: 'Bạn cần đăng nhập' }) });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    window.history.pushState({}, '', '/?google_error=access_denied');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeTruthy();
    expect((await screen.findByRole('alert')).textContent).toBe('Bạn đã hủy đăng nhập bằng Google.');
  });

  it('F-004 review: a signed-in USER on /?google_error=taken sees the message and no Đăng nhập heading', async () => {
    const message = 'Tài khoản Google này đã được liên kết với một tài khoản khác.';
    as({ id: 'x', name: 'An', role: 'USER' });
    window.history.pushState({}, '', '/?google_error=taken');
    render(<App />);

    const alert = (await screen.findByText(message)).closest('[role="alert"]') as HTMLElement;
    expect(alert).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Trận đang mở' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Đăng nhập' })).toBeNull();
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(screen.getByText(message)).toBeTruthy();

    fireEvent.click(within(alert).getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByText(message)).toBeNull();
  });

  it('AC-11: on "Đơn vị của tôi", owner sees the "Nhân viên" section for each venue', async () => {
    const venue = {
      id: '0199a1b2-0000-7000-8000-000000000010',
      name: 'Sân Cầu Lông ABC',
      address: '123 Đường 1',
      phone: '0901234567',
      opensAt: 360,
      closesAt: 1320,
      courts: [],
    };
    const staffList = [
      {
        id: 'staff-1',
        name: 'Nhân Viên Một',
        phone: '0901111111',
        venueId: venue.id,
        lockedAt: null,
      },
      {
        id: 'staff-2',
        name: 'Nhân Viên Hai',
        phone: '0902222222',
        venueId: venue.id,
        lockedAt: '2026-11-12T10:00:00Z',
      },
    ];

    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'owner-1', name: 'Bình', role: 'OWNER' }) });
      }
      if (url === '/api/owner/venues') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([venue]) });
      }
      if (url === `/api/owner/venues/${venue.id}/staff`) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(staffList) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    window.history.pushState({}, '', '/chu-san/don-vi');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Đơn vị của tôi' })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Nhân viên' })).toBeTruthy();

    expect(await screen.findByText(/Nhân Viên Một/)).toBeTruthy();
    expect(screen.getByText('0901111111')).toBeTruthy();
    expect(screen.getByText('Đang làm')).toBeTruthy();

    expect(screen.getByText(/Nhân Viên Hai/)).toBeTruthy();
    expect(screen.getByText('0902222222')).toBeTruthy();
    expect(screen.getByText('Đã khóa')).toBeTruthy();

    expect(screen.getByLabelText('Tên nhân viên')).toBeTruthy();
    expect(screen.getByLabelText('Số điện thoại')).toBeTruthy();
    expect(screen.getByLabelText('Mật khẩu')).toBeTruthy();
    expect(screen.getByLabelText(/đồng ý với thông báo về dữ liệu cá nhân/i)).toBeTruthy();

    const lockButtons = screen.getAllByRole('button', { name: 'Khóa' });
    expect(lockButtons.length).toBe(1);
    fireEvent.click(lockButtons[0]);
    expect(screen.getByRole('dialog', { name: 'Xác nhận khóa Nhân Viên Một' })).toBeTruthy();
  });

  it('AC-12: a STAFF user gets the owner shell with only "Lịch sân" and "Yêu cầu", and no "Doanh thu" or "Đơn vị và giá"', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'staff-1', name: 'Hoàng', role: 'STAFF' }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    window.history.pushState({}, '', '/chu-san/lich');
    render(<App />);

    const sidebar = await screen.findByRole('navigation', { name: 'Chức năng chủ sân' });
    expect(within(sidebar).getByText('Yêu cầu')).toBeTruthy();
    expect(within(sidebar).getByText('Lịch sân')).toBeTruthy();
    expect(within(sidebar).queryByText('Doanh thu')).toBeNull();
    expect(within(sidebar).queryByText('Đơn vị và giá')).toBeNull();
  });

  it('AC-12: opening the revenue path directly sends a STAFF to "Lịch sân"', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'staff-1', name: 'Hoàng', role: 'STAFF' }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    window.history.pushState({}, '', '/chu-san/doanh-thu');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Lịch sân' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Báo cáo doanh thu' })).toBeNull();
  });

  it('AC-12: a STAFF user on /chu-san/yeu-cau sees no cancel or "đã thu tiền" controls', async () => {
    const bookingId = '0199a1b2-0000-7000-8000-000000000101';
    const futureStart = new Date(Date.now() + 3600_000).toISOString();
    const futureEnd = new Date(Date.now() + 7200_000).toISOString();
    const confirmedBooking = {
      id: bookingId,
      courtId: 'court-1',
      startAt: futureStart,
      endAt: futureEnd,
      status: 'CONFIRMED',
      source: 'APP',
      priceTotal: 120_000,
      confirmDeadline: null,
      confirmedAt: new Date().toISOString(),
      cancelledAt: null,
      createdAt: new Date().toISOString(),
      customer: { name: 'Khách Một', phone: '0987654321' },
      paidAtVenue: false,
    };

    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'staff-1', name: 'Hoàng', role: 'STAFF' }) });
      }
      if (url === '/api/owner/bookings?status=CONFIRMED') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([confirmedBooking]) });
      }
      if (url === '/api/owner/bookings') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([confirmedBooking]) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    window.history.pushState({}, '', '/chu-san/yeu-cau');
    render(<App />);

    expect((await screen.findAllByText(/Khách Một/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^hủy/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /thu tiền/i })).toBeNull();
  });

  it('AC-12: a STAFF user\'s shell has no notification bell', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'staff-1', name: 'Hoàng', role: 'STAFF' }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    window.history.pushState({}, '', '/chu-san/lich');
    render(<App />);

    await screen.findByRole('heading', { name: 'Lịch sân' });
    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('Hoàng')).toBeTruthy();
    expect(within(banner).queryByRole('button', { name: /thông báo/i })).toBeNull();
  });

  it('AC-2: guest sees MONSPORT and player nav links Trang chủ, Ghép trận, Sân, Đội, Lịch', async () => {
    as(null);
    render(<App />);

    const banner = await screen.findByRole('banner');
    expect(within(banner).getByText('MONSPORT')).toBeTruthy();
    expect(within(banner).getByRole('link', { name: 'Trang chủ' }).getAttribute('href')).toBe('/');
    expect(within(banner).getByRole('link', { name: 'Ghép trận' }).getAttribute('href')).toBe('/phong-cho');
    expect(within(banner).getByRole('link', { name: 'Sân' }).getAttribute('href')).toBe('/san');
    expect(within(banner).getByRole('link', { name: 'Đội' }).getAttribute('href')).toBe('/doi');
    expect(within(banner).getByRole('link', { name: 'Lịch' }).getAttribute('href')).toBe('/lich-cua-toi');
  });

  it('AC-8: /doi shows "Đội", "Sắp ra mắt", and clicking "Lập đội mới" triggers toast "Sắp ra mắt"', async () => {
    as(null);
    window.history.pushState({}, '', '/doi');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Đội' })).toBeTruthy();
    expect(screen.getByText('Sắp ra mắt')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Lập đội mới' }));
    expect(within(screen.getByRole('status')).getByText('Sắp ra mắt')).toBeTruthy();
  });

  it('AC-10: a STAFF opening /chu-san/tong-quan lands on /chu-san/lich without "Tổng quan" in sidebar', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'staff-1', name: 'Hoàng', role: 'STAFF' }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    window.history.pushState({}, '', '/chu-san/tong-quan');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Lịch sân' })).toBeTruthy();
    expect(window.location.pathname).toBe('/chu-san/lich');
    const sidebar = screen.getByRole('navigation', { name: 'Chức năng chủ sân' });
    expect(within(sidebar).queryByText('Tổng quan')).toBeNull();
  });

  it('AC-11: an ADMIN opens /admin, /admin/tai-khoan, /admin/bao-cao, and /admin/mon', async () => {
    const STATS = {
      date: '2026-11-20',
      weekStart: '2026-11-16',
      weekEnd: '2026-11-22',
      accounts: { ADMIN: 1, OWNER: 2, USER: 10, STAFF: 0 },
      newUsers: 1,
      activeUsers: 1,
      avgConfirmMinutes: null,
      expiryRate: 0,
      venues: [],
    };
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'admin-1', name: 'Admin', role: 'ADMIN' }) });
      }
      if (url.startsWith('/api/admin/stats')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(STATS) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    window.history.pushState({}, '', '/admin');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Số liệu toàn trang' })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Chức năng quản trị' });
    const expectActiveNav = (activeName: string) => {
      const target = within(nav).getByRole('link', { name: activeName });
      for (const link of within(nav).getAllByRole('link')) {
        const isTarget = link === target;
        expect(link.classList.contains('on')).toBe(isTarget);
        expect(link.classList.contains('active')).toBe(isTarget);
        expect(link.getAttribute('aria-current')).toBe(isTarget ? 'page' : null);
      }
    };
    expectActiveNav('Tổng quan');

    fireEvent.click(within(nav).getByRole('link', { name: 'Tài khoản và đơn vị' }));
    expect(await screen.findByRole('heading', { name: 'Chủ sân' })).toBeTruthy();
    expectActiveNav('Tài khoản và đơn vị');

    fireEvent.click(within(nav).getByRole('link', { name: 'Báo cáo vi phạm' }));
    expect(await screen.findByRole('heading', { name: 'Báo cáo vi phạm' })).toBeTruthy();
    expect(screen.getByText('Sắp ra mắt')).toBeTruthy();
    expectActiveNav('Báo cáo vi phạm');

    fireEvent.click(within(nav).getByRole('link', { name: 'Môn thể thao' }));
    expect(await screen.findByRole('heading', { name: 'Môn thể thao' })).toBeTruthy();
    expect(screen.getByText('Sắp ra mắt')).toBeTruthy();
    expectActiveNav('Môn thể thao');
  });

  it('AC-12: signed-in USER "Lan" opens /ho-so and clicks "Sửa hồ sơ" to see "Sắp ra mắt"', async () => {
    as({ id: 'u-lan', name: 'Lan', role: 'USER' });
    window.history.pushState({}, '', '/ho-so');
    render(<App />);

    const main = await screen.findByRole('main');
    expect(await within(main).findByRole('heading', { name: 'Lan' })).toBeTruthy();
    fireEvent.click(within(main).getByRole('button', { name: 'Sửa hồ sơ' }));
    expect(within(screen.getByRole('status')).getByText('Sắp ra mắt')).toBeTruthy();
  });

  it('AC-3: USER at / clicks "Tin nhắn" then "Tạo trận đội" to see "Sắp ra mắt" with no navigation or fetch', async () => {
    const fetchMock = vi.fn((url: string) => {
      const [status, body] = url === '/api/auth/me' ? [200, { id: 'u-an', name: 'An', role: 'USER' }] : [200, []];
      return Promise.resolve({ ok: (status as number) < 400, status, json: () => Promise.resolve(body) });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Trận đang mở' })).toBeTruthy();
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([url]) => url);
      expect(urls).toContain('/api/notifications');
      expect(urls).toContain('/api/matches');
      expect(urls).toContain('/api/bookings/mine');
      expect(urls).toContain('/api/venues');
    });

    const callsBefore = fetchMock.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Tin nhắn' }));
    expect(within(screen.getByRole('status')).getAllByText('Sắp ra mắt')).toHaveLength(1);
    expect(window.location.pathname).toBe('/');
    expect(fetchMock.mock.calls.length).toBe(callsBefore);

    fireEvent.click(screen.getByRole('button', { name: 'Tạo trận đội' }));
    expect(within(screen.getByRole('status')).getAllByText('Sắp ra mắt')).toHaveLength(2);
    expect(window.location.pathname).toBe('/');
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });
});
