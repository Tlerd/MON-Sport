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
    const bell = await screen.findByRole('button', { name: /Thông báo/ });
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
    const bell = await screen.findByRole('button', { name: /Thông báo/ });
    fireEvent.click(bell);

    const readAllBtn = await screen.findByRole('button', { name: 'Đánh dấu tất cả đã đọc' });
    expect(await screen.findByText('1')).toBeTruthy();
    fireEvent.click(readAllBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/notifications/read-all',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    // The badge goes when the POST answers, one render after the call.
    await waitFor(() => expect(screen.queryByText('1')).toBeNull());
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
    const bell = await screen.findByRole('button', { name: /Thông báo/ });
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
      fireEvent.click(await screen.findByRole('button', { name: /Thông báo/ }));

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
    fireEvent.click(await screen.findByRole('button', { name: /Thông báo/ }));
    await screen.findByText('Chưa có thông báo nào');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/push/public-key', expect.anything()));
    await act(async () => {});

    expect(screen.queryByText(/thiết bị này/)).toBeNull();
    expect(screen.queryByText(/chưa hỗ trợ thông báo/)).toBeNull();
  });

  describe('AC-23: the list follows the server without a click', () => {
    const empty: NotificationsListResponse = { unreadCount: 0, items: [] };
    const reply = (body: NotificationsListResponse) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
    const setVisibility = (state: 'visible' | 'hidden') =>
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });

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
    const listCalls = (fetchMock: ReturnType<typeof stubServer>) => fetchMock.mock.calls.filter(([url]) => url === '/api/notifications').length;

    /** Renders the bell after its first load, with no unread badge. */
    async function renderLoaded() {
      const fetchMock = stubServer();
      render(<Notifications userId="u1" />);
      await waitFor(() => expect(listCalls(fetchMock)).toBe(1));
      await waitFor(() => expect(screen.getByRole('button', { name: /Thông báo/ })).toBeTruthy());
      expect(screen.queryByText('1')).toBeNull();
      return fetchMock;
    }

    afterEach(() => setVisibility('visible'));

    it('AC-23: reloads when the tab becomes visible again', async () => {
      const fetchMock = await renderLoaded();

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
      expect(listCalls(fetchMock)).toBe(2);
    });

    it('AC-23: reloads when the window gets focus', async () => {
      const fetchMock = await renderLoaded();

      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });

      await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
      expect(listCalls(fetchMock)).toBe(2);
    });

    it('AC-23: reloads on a timer while the tab is visible', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const fetchMock = await renderLoaded();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(15_000);
        });
        await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
        expect(listCalls(fetchMock)).toBe(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('AC-23: reloads when the service worker reports a push', async () => {
      const worker = new EventTarget();
      vi.stubGlobal('navigator', { ...navigator, serviceWorker: worker });
      const fetchMock = await renderLoaded();

      await act(async () => {
        worker.dispatchEvent(new MessageEvent('message', { data: { type: 'push-received' } }));
      });

      await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
      expect(listCalls(fetchMock)).toBe(2);
    });

    it('AC-23: asks nothing while the tab is hidden', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const worker = new EventTarget();
        vi.stubGlobal('navigator', { ...navigator, serviceWorker: worker });
        const fetchMock = await renderLoaded();
        setVisibility('hidden');

        await act(async () => {
          await vi.advanceTimersByTimeAsync(45_000);
          document.dispatchEvent(new Event('visibilitychange'));
          window.dispatchEvent(new Event('focus'));
          worker.dispatchEvent(new MessageEvent('message', { data: { type: 'push-received' } }));
        });

        expect(listCalls(fetchMock)).toBe(1);
        expect(screen.queryByText('1')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('AC-23: a return to the tab that fires visibilitychange and focus together asks once', async () => {
      const fetchMock = await renderLoaded();

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('focus'));
      });

      await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
      expect(listCalls(fetchMock)).toBe(2);
    });

    it('AC-23: keeps the list on screen when a background reload fails', async () => {
      let calls = 0;
      const fetchMock = vi.fn((url: string) => {
        if (url !== '/api/notifications') return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
        return ++calls === 1 ? Promise.resolve(reply(mockNotifs)) : Promise.reject(new Error('offline'));
      });
      vi.stubGlobal('fetch', fetchMock);
      render(<Notifications userId="u1" />);
      await waitFor(() => expect(screen.getByText('1')).toBeTruthy());

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await waitFor(() => expect(calls).toBe(2));
      expect(screen.getByText('1')).toBeTruthy();
    });

    it('AC-23: a push that comes while a reload is running makes one more reload when it ends', async () => {
      const worker = new EventTarget();
      vi.stubGlobal('navigator', { ...navigator, serviceWorker: worker });
      let calls = 0;
      let releaseSecond: () => void = () => undefined;
      const fetchMock = vi.fn((url: string) => {
        if (url !== '/api/notifications') return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
        if (++calls === 2) {
          return new Promise((resolve) => {
            releaseSecond = () => resolve(reply(empty));
          });
        }
        return Promise.resolve(reply(calls === 1 ? empty : mockNotifs));
      });
      vi.stubGlobal('fetch', fetchMock);
      render(<Notifications userId="u1" />);
      await waitFor(() => expect(calls).toBe(1));
      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });
      await waitFor(() => expect(calls).toBe(2));

      await act(async () => {
        worker.dispatchEvent(new MessageEvent('message', { data: { type: 'push-received' } }));
      });
      expect(calls).toBe(2);
      await act(async () => {
        releaseSecond();
      });

      await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
      expect(calls).toBe(3);
    });

    it('AC-23: a reload that never answers does not stop the next reloads', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        let calls = 0;
        const fetchMock = vi.fn((url: string) => {
          if (url !== '/api/notifications') return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
          return ++calls === 2 ? new Promise(() => undefined) : Promise.resolve(reply(calls === 1 ? empty : mockNotifs));
        });
        vi.stubGlobal('fetch', fetchMock);
        render(<Notifications userId="u1" />);
        await waitFor(() => expect(calls).toBe(1));

        await act(async () => {
          await vi.advanceTimersByTimeAsync(60_000);
        });

        await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
        expect(calls).toBeGreaterThanOrEqual(3);
      } finally {
        vi.useRealTimers();
      }
    });

    it('AC-23: a refresh reload that hangs and is aborted keeps the old badge', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        let calls = 0;
        const fetchMock = vi.fn((url: string, opts?: RequestInit) => {
          if (url !== '/api/notifications') return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
          if (++calls === 1) return Promise.resolve(reply(mockNotifs));
          return new Promise((_, reject) => opts?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
        });
        vi.stubGlobal('fetch', fetchMock);
        const { rerender } = render(<Notifications userId="u1" />);
        await waitFor(() => expect(screen.getByText('1')).toBeTruthy());

        rerender(<Notifications userId="u1" refresh={1} />);
        await waitFor(() => expect(calls).toBe(2));
        await act(async () => {
          await vi.advanceTimersByTimeAsync(30_001);
        });

        expect(screen.getByText('1')).toBeTruthy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('AC-23: a slow reload that started before "mark all read" does not bring the badge back', async () => {
      let calls = 0;
      let releaseSlow: () => void = () => undefined;
      const fetchMock = vi.fn((url: string, opts?: RequestInit) => {
        if (url === '/api/notifications/read-all' && opts?.method === 'POST') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ count: 1 }) });
        if (url !== '/api/notifications') return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
        if (++calls === 1) return Promise.resolve(reply(mockNotifs));
        return new Promise((resolve) => {
          releaseSlow = () => resolve(reply(mockNotifs));
        });
      });
      vi.stubGlobal('fetch', fetchMock);
      render(<Notifications userId="u1" />);
      await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await waitFor(() => expect(calls).toBe(2));

      fireEvent.click(screen.getByRole('button', { name: /thông báo/i }));
      fireEvent.click(await screen.findByText(/Đánh dấu tất cả đã đọc/));
      await waitFor(() => expect(screen.queryByText('1')).toBeNull());
      await act(async () => {
        releaseSlow();
      });

      expect(screen.queryByText('1')).toBeNull();
    });

    it('AC-23: one GET hangs, then a push message arrives while a later GET runs, and one more GET follows', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const worker = new EventTarget();
        vi.stubGlobal('navigator', { ...navigator, serviceWorker: worker });
        let calls = 0;
        let releaseThird: () => void = () => undefined;
        const fetchMock = vi.fn((url: string, opts?: RequestInit) => {
          if (url !== '/api/notifications') return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
          calls++;
          if (calls === 1) return Promise.resolve(reply(empty));
          if (calls === 2) {
            return new Promise((_, reject) => {
              opts?.signal?.addEventListener('abort', () => {
                reject(new DOMException('The operation was aborted.', 'AbortError'));
              });
            });
          }
          if (calls === 3) {
            return new Promise((resolve) => {
              releaseThird = () => resolve(reply(empty));
            });
          }
          return Promise.resolve(reply(mockNotifs));
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<Notifications userId="u1" />);
        await waitFor(() => expect(calls).toBe(1));

        await act(async () => {
          await vi.advanceTimersByTimeAsync(45_000);
        });
        await waitFor(() => expect(calls).toBe(3));

        await act(async () => {
          worker.dispatchEvent(new MessageEvent('message', { data: { type: 'push-received' } }));
        });
        expect(calls).toBe(3);

        await act(async () => {
          releaseThird();
        });

        await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
        expect(calls).toBe(4);
      } finally {
        vi.useRealTimers();
      }
    });

    it('AC-23: a focus reload starts while the read-all POST is pending and answers with unread items after the POST, and one more GET follows, and the badge shows the result of that last GET, not the stale one', async () => {
      let getCalls = 0;
      let releasePost: () => void = () => undefined;
      let releaseFocusGet: () => void = () => undefined;

      const fetchMock = vi.fn((url: string, opts?: RequestInit) => {
        if (url === '/api/notifications/read-all' && opts?.method === 'POST') {
          return new Promise((resolve) => {
            releasePost = () => resolve({ ok: true, status: 200, json: () => Promise.resolve({ count: 1 }) });
          });
        }
        if (url !== '/api/notifications') {
          return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
        }
        getCalls++;
        if (getCalls === 1) {
          return Promise.resolve(reply(mockNotifs));
        }
        if (getCalls === 2) {
          return new Promise((resolve) => {
            releaseFocusGet = () => resolve(reply(mockNotifs));
          });
        }
        return Promise.resolve(reply(empty));
      });
      vi.stubGlobal('fetch', fetchMock);

      render(<Notifications userId="u1" />);
      await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
      expect(getCalls).toBe(1);

      fireEvent.click(screen.getByRole('button', { name: /thông báo/i }));
      const readAllBtn = await screen.findByRole('button', { name: 'Đánh dấu tất cả đã đọc' });
      fireEvent.click(readAllBtn);

      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });
      await waitFor(() => expect(getCalls).toBe(2));

      await act(async () => {
        releasePost();
      });

      await act(async () => {
        releaseFocusGet();
      });

      await waitFor(() => expect(getCalls).toBe(3));
      await waitFor(() => expect(screen.queryByText('1')).toBeNull());
    });
  });

  it('AC-8: 3 unread: an svg inside the button, no "🔔" text, button name "Thông báo, 3 chưa đọc", badge "3"', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/notifications') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              unreadCount: 3,
              items: mockNotifs.items,
            }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<Notifications userId="0199a1b2-0000-7000-8000-000000000001" />);
    const bell = await screen.findByRole('button', { name: 'Thông báo, 3 chưa đọc' });
    expect(bell.querySelector('svg')).toBeTruthy();
    expect(bell.textContent).not.toContain('\u{1F514}');
    expect(bell.textContent).not.toContain('🔔');
    expect(screen.getByText('3')).toBeTruthy();
    expect(bell.className).toContain('icon-button');
    expect(screen.getByText('3').className).toContain('count-badge');
  });
});
