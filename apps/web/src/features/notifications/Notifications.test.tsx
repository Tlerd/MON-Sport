import type { NotificationsListResponse } from '@monsport/shared';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Notifications } from './Notifications.tsx';

describe('Notifications', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const mockNotifs: NotificationsListResponse = {
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
      {
        id: '0199a1b2-0000-7000-8000-000000000011',
        type: 'BOOKING_CONFIRMED',
        bookingId: '0199a1b2-0000-7000-8000-000000000021',
        matchId: null,
        readAt: '2026-11-20T03:00:00.000Z',
        createdAt: '2026-11-20T01:00:00.000Z',
        title: 'Yêu cầu đặt sân đã được xác nhận',
        message: 'Chủ sân đã xác nhận yêu cầu đặt sân tại Cầu lông A - Sân 1 khung 18:00 - 19:00 ngày 20/11/2026.',
        venueName: 'Cầu lông A',
        courtName: 'Sân 1',
        startAt: '2026-11-20T11:00:00.000Z',
        endAt: '2026-11-20T12:00:00.000Z',
      },
    ],
  };

  it('AC-10: displays bell with unread badge, opens drawer on click, and marks as read', async () => {
    const fetchMock = vi.fn((url: string, opts?: RequestInit) => {
      if (url === '/api/notifications' && (!opts || !opts.method || opts.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockNotifs),
        });
      }
      if (url === `/api/notifications/${mockNotifs.items[0].id}/read` && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: mockNotifs.items[0].id, readAt: '2026-11-20T04:00:00.000Z' }),
        });
      }
      if (url === '/api/notifications/read-all' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ count: 1 }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<Notifications userId="0199a1b2-0000-7000-8000-000000000001" />);

    // Shows bell with badge "1"
    const bell = await screen.findByRole('button', { name: 'Thông báo' });
    expect(screen.getByText('1')).toBeTruthy();

    // Click bell opens drawer
    fireEvent.click(bell);
    expect(await screen.findByRole('heading', { name: 'Thông báo' })).toBeTruthy();
    expect(screen.getByText('Yêu cầu đặt sân mới')).toBeTruthy();
    expect(screen.getByText('Yêu cầu đặt sân đã được xác nhận')).toBeTruthy();

    // Click unread notification marks as read
    const unreadItem = screen.getByText('Yêu cầu đặt sân mới').closest('li')!;
    fireEvent.click(unreadItem);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/notifications/${mockNotifs.items[0].id}/read`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    // Badge decreases to 0 (badge element removed)
    await waitFor(() => {
      expect(screen.queryByText('1')).toBeNull();
    });

    // Mark all as read button
    const readAllBtn = screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' });
    expect(readAllBtn).toBeTruthy();
  });

  it('AC-10: marking all as read calls POST /api/notifications/read-all', async () => {
    const fetchMock = vi.fn((url: string, opts?: RequestInit) => {
      if (url === '/api/notifications' && (!opts || !opts.method || opts.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockNotifs),
        });
      }
      if (url === '/api/notifications/read-all' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ count: 1 }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<Notifications userId="0199a1b2-0000-7000-8000-000000000001" />);
    const bell = await screen.findByRole('button', { name: 'Thông báo' });
    fireEvent.click(bell);

    const readAllBtn = await screen.findByRole('button', { name: 'Đánh dấu tất cả đã đọc' });
    fireEvent.click(readAllBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/notifications/read-all',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(screen.queryByText('1')).toBeNull();
  });

  it('AC-11: shows "Chưa có thông báo nào" when notifications list is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/notifications') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ unreadCount: 0, items: [] }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch ${url}`));
      }),
    );

    render(<Notifications userId="0199a1b2-0000-7000-8000-000000000001" />);
    const bell = await screen.findByRole('button', { name: 'Thông báo' });
    expect(screen.queryByText('0')).toBeNull();

    fireEvent.click(bell);
    expect(await screen.findByRole('heading', { name: 'Thông báo' })).toBeTruthy();
    expect(screen.getByText('Chưa có thông báo nào')).toBeTruthy();
  });

  it('AC-13: the drawer holds the button "Nhận thông báo trên thiết bị này" when the server has Web Push on', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistration: () => Promise.resolve(undefined) }, configurable: true });
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const body = url === '/api/push/public-key' ? { publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' } : { unreadCount: 0, items: [] };
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
      }),
    );

    try {
      render(<Notifications userId="0199a1b2-0000-7000-8000-000000000001" />);
      expect(screen.queryByRole('button', { name: 'Nhận thông báo trên thiết bị này' })).toBeNull();
      fireEvent.click(await screen.findByRole('button', { name: 'Thông báo' }));

      expect(await screen.findByRole('button', { name: 'Nhận thông báo trên thiết bị này' })).toBeTruthy();
    } finally {
      Reflect.deleteProperty(navigator, 'serviceWorker');
    }
  });

  it('AC-21: the drawer shows no Web Push button and no hint when the server answers 404', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/push/public-key') {
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ message: 'Thông báo đẩy chưa bật' }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ unreadCount: 0, items: [] }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<Notifications userId="0199a1b2-0000-7000-8000-000000000001" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thông báo' }));
    await screen.findByText('Chưa có thông báo nào');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/push/public-key', expect.anything()));
    await act(async () => {});

    expect(screen.queryByText(/thiết bị này/)).toBeNull();
    expect(screen.queryByText(/chưa hỗ trợ thông báo/)).toBeNull();
  });

  describe('AC-23: the list follows the server without a click', () => {
    const empty: NotificationsListResponse = { unreadCount: 0, items: [] };
    const reply = (body: NotificationsListResponse) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

    /** The first answer is the empty list. Every later answer holds one unread item, like a request from the other side. */
    function stubServer() {
      let calls = 0;
      const fetchMock = vi.fn((url: string) => {
        if (url === '/api/notifications') return Promise.resolve(reply(++calls === 1 ? empty : mockNotifs));
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      });
      vi.stubGlobal('fetch', fetchMock);
      return fetchMock;
    }

    it('reloads when the tab becomes visible again', async () => {
      stubServer();
      render(<Notifications userId="u1" />);
      await waitFor(() => expect(screen.queryByText('1')).toBeNull());

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
    });

    it('reloads on a timer while the tab is visible', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        stubServer();
        render(<Notifications userId="u1" />);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(15_000);
        });
        await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
      } finally {
        vi.useRealTimers();
      }
    });

    it('reloads when the service worker reports a push', async () => {
      const worker = new EventTarget();
      vi.stubGlobal('navigator', { ...navigator, serviceWorker: worker });
      stubServer();
      render(<Notifications userId="u1" />);
      await waitFor(() => expect(screen.queryByText('1')).toBeNull());

      await act(async () => {
        worker.dispatchEvent(new MessageEvent('message', { data: { type: 'push-received' } }));
      });

      await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
    });

    it('keeps the list on screen when a background reload fails', async () => {
      let calls = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (url !== '/api/notifications') return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
          return ++calls === 1 ? Promise.resolve(reply(mockNotifs)) : Promise.reject(new Error('offline'));
        }),
      );
      render(<Notifications userId="u1" />);
      await waitFor(() => expect(screen.getByText('1')).toBeTruthy());

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(screen.getByText('1')).toBeTruthy();
    });
  });
});
