import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the login form when nobody is signed in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({ message: 'Bạn cần đăng nhập' }) }));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeTruthy();
  });

  it('AC-25: after the sign-up, the booking form and the name "Lan" in the top bar show', async () => {
    const lan = { id: '0199a1b2-0000-7000-8000-000000000009', name: 'Lan', role: 'USER' };
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const [status, body] = url === '/api/auth/me' ? [401, { message: 'Bạn cần đăng nhập' }] : url === '/api/auth/register' ? [201, lan] : [200, []];
      return Promise.resolve({ ok: (status as number) < 400, status, json: () => Promise.resolve(body) });
    }));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo tài khoản' }));
    fireEvent.change(screen.getByLabelText('Tên của bạn'), { target: { value: 'Lan' } });
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901112233' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau123' } });
    expect((screen.getByRole('button', { name: 'Tạo tài khoản' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(await screen.findByRole('heading', { name: 'Đặt sân' })).toBeTruthy();
    expect(within(screen.getByRole('banner')).getByText('Lan')).toBeTruthy();
  });

  it('shows the owner requests to an owner', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(url === '/api/auth/me' ? { id: 'x', name: 'Bình', role: 'OWNER' } : []) }),
    ));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Yêu cầu đặt sân' })).toBeTruthy();
  });

  // Brief F-008 (AC-14): a guest and a user see the free hours, an owner and an admin do not.
  // The notice shows once for each role: the guest sees it in the free hours, the user in the booking form.
  const NOTICE = 'App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.';
  const as = (me: unknown) => vi.stubGlobal('fetch', vi.fn((url: string) => {
    const [status, body] = url === '/api/auth/me' ? (me ? [200, me] : [401, { message: 'Bạn cần đăng nhập' }]) : [200, []];
    return Promise.resolve({ ok: (status as number) < 400, status, json: () => Promise.resolve(body) });
  }));

  it('AC-14: a guest sees the free hours and the notice once', async () => {
    as(null);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Giờ trống' })).toBeTruthy();
    expect(screen.getAllByText(NOTICE)).toHaveLength(1);
  });

  it('AC-14: a user sees the free hours and the booking form, and the notice once', async () => {
    as({ id: 'x', name: 'An', role: 'USER' });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Giờ trống' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Đặt sân' })).toBeTruthy();
    expect(screen.getAllByText(NOTICE)).toHaveLength(1);
  });

  it('AC-7: a user sees the search box once, in the free hours, and the booking form has none', async () => {
    as({ id: 'x', name: 'An', role: 'USER' });
    render(<App />);
    const freeHours = (await screen.findByRole('heading', { name: 'Giờ trống' })).closest('section')!;
    expect(screen.getAllByLabelText('Tìm theo tên sân')).toHaveLength(1);
    expect(within(freeHours).getByLabelText('Tìm theo tên sân')).toBeTruthy();
    expect(within(screen.getByRole('heading', { name: 'Đặt sân' }).closest('section')!).queryByLabelText('Tìm theo tên sân')).toBeNull();
  });

  it.each([['OWNER', 'Yêu cầu đặt sân'], ['ADMIN', null]] as const)('AC-14: a %s does not see the free hours', async (role, heading) => {
    as({ id: 'x', name: 'Bình', role });
    render(<App />);
    if (heading) await screen.findByRole('heading', { name: heading });
    else await screen.findByText('Chào Bình');
    expect(screen.queryByRole('heading', { name: 'Giờ trống' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Phòng chờ' })).toBeNull();
  });

  it('AC-16: both a guest and a USER see "Phòng chờ"', async () => {
    as(null);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Phòng chờ' })).toBeTruthy();
    cleanup();

    as({ id: 'x', name: 'An', role: 'USER' });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Phòng chờ' })).toBeTruthy();
  });

  it('AC-13: a USER sees "Trận đã vào", while guests, owners, and admins do not', async () => {
    as({ id: 'x', name: 'An', role: 'USER' });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Trận đã vào' })).toBeTruthy();
    cleanup();

    as(null);
    render(<App />);
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
    await screen.findByText('Chào Admin');
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
    const bell = await screen.findByRole('button', { name: 'Thông báo' });
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
    const bell = await screen.findByRole('button', { name: 'Thông báo' });
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
      fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }));

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
      fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }));

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
      await screen.findByRole('button', { name: 'Đăng xuất' });

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

    const financeTab = screen.getByRole('button', { name: 'Doanh thu' });
    fireEvent.click(financeTab);

    expect(await screen.findByRole('heading', { name: 'Báo cáo tài chính' })).toBeTruthy();
    expect(await screen.findByText('960.000đ')).toBeTruthy();
  });
});
