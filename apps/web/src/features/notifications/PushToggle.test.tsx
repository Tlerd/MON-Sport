import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resyncPush, urlBase64ToUint8Array } from '@monsport/client';
import { PushToggle } from './PushToggle.tsx';

const AN = '0199a1b2-0000-7000-8000-000000000001';
const BINH = '0199a1b2-0000-7000-8000-000000000002';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123';
const KEYS = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };
const PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const USER_KEY = 'monsport.push.user';

const ENABLE = 'Nhận thông báo trên thiết bị này';
const DISABLE = 'Tắt thông báo trên thiết bị này';
const DENIED = 'Trình duyệt đang chặn thông báo. Hãy bật lại trong cài đặt của trình duyệt';
const UNSUPPORTED =
  'Trình duyệt này chưa hỗ trợ thông báo. Trên iPhone, hãy chọn Chia sẻ, rồi Thêm vào Màn hình chính, rồi mở app từ biểu tượng. Trên Android, hãy mở app bằng Chrome';

type Options = {
  /** The permission state at the start. */
  permission?: NotificationPermission;
  /** What the browser dialog answers when the user is asked. */
  dialog?: NotificationPermission;
  /** The status of GET /api/push/public-key. */
  keyStatus?: number;
  /** The browser has PushManager and a service worker. */
  supported?: boolean;
  /** The browser already holds a subscription. */
  subscribed?: boolean;
  /** localStorage `monsport.push.user` at the start. */
  storedUser?: string | null;
  /** `subscribe` rejects. */
  subscribeFails?: boolean;
  /** The status of POST /api/push/subscriptions. */
  postStatus?: number;
};

/** A browser double: service worker, PushManager, Notification, and a fetch that logs every call. */
function setup(options: Options = {}) {
  const { permission = 'default', dialog = 'granted', keyStatus = 200, supported = true, subscribed = false, storedUser = null, subscribeFails = false, postStatus = 201 } = options;

  let current: { endpoint: string; toJSON: () => unknown; unsubscribe: ReturnType<typeof vi.fn> } | null = null;
  const makeSubscription = () => {
    const subscription = {
      endpoint: ENDPOINT,
      toJSON: () => ({ endpoint: ENDPOINT, keys: KEYS }),
      unsubscribe: vi.fn(() => {
        current = null;
        return Promise.resolve(true);
      }),
    };
    current = subscription;
    return subscription;
  };
  if (subscribed) makeSubscription();

  const pushManager = {
    getSubscription: vi.fn(() => Promise.resolve(current)),
    subscribe: vi.fn((_options: unknown) => (subscribeFails ? Promise.reject(new Error('push service error')) : Promise.resolve(makeSubscription()))),
  };
  const registration = { pushManager };
  const serviceWorker = {
    register: vi.fn(() => Promise.resolve(registration)),
    ready: Promise.resolve(registration),
    getRegistration: vi.fn(() => Promise.resolve(registration)),
  };

  if (supported) {
    Object.defineProperty(navigator, 'serviceWorker', { value: serviceWorker, configurable: true });
    vi.stubGlobal('PushManager', class {});
  }
  const notification = {
    permission,
    requestPermission: vi.fn(() => {
      notification.permission = dialog;
      return Promise.resolve(dialog);
    }),
  };
  vi.stubGlobal('Notification', notification);

  if (storedUser) localStorage.setItem(USER_KEY, storedUser);

  const fetch = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    let status = 200;
    let body: unknown = {};
    if (url === '/api/push/public-key') {
      status = keyStatus;
      body = keyStatus === 200 ? { publicKey: PUBLIC_KEY } : { message: 'Thông báo đẩy chưa bật' };
    } else if (url === '/api/push/subscriptions' && method === 'POST') {
      status = postStatus;
    } else if (url === '/api/push/subscriptions' && method === 'DELETE') {
      status = 204;
    }
    return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
  });
  vi.stubGlobal('fetch', fetch);

  /** The calls to one method of /api/push/subscriptions, with the parsed JSON body. */
  const calls = (method: string) =>
    fetch.mock.calls
      .filter(([url, init]) => url === '/api/push/subscriptions' && (init?.method ?? 'GET') === method)
      .map(([, init]) => JSON.parse(String(init?.body)));

  return { fetch, pushManager, serviceWorker, notification, calls, subscription: () => current };
}

describe('PushToggle', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
    localStorage.clear();
  });

  it('AC-13: the button asks for the permission, subscribes with the server key, saves it, and turns into "Tắt..."', async () => {
    const b = setup();
    render(<PushToggle userId={AN} />);

    const button = await screen.findByRole('button', { name: ENABLE });
    const fetchCallsBeforeTap = b.fetch.mock.calls.length;
    fireEvent.click(button);

    // iOS: the permission dialog must start inside the tap, so nothing async comes before it.
    expect(b.notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(b.fetch.mock.calls.length).toBe(fetchCallsBeforeTap);

    expect(await screen.findByRole('button', { name: DISABLE })).toBeTruthy();
    expect(b.notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(b.serviceWorker.register).toHaveBeenCalledWith('/sw.js');
    expect(b.fetch.mock.calls.filter(([url]) => url === '/api/push/public-key').length).toBeGreaterThan(0);
    expect(b.pushManager.subscribe).toHaveBeenCalledTimes(1);
    const subscribeOptions = b.pushManager.subscribe.mock.calls[0]![0] as { userVisibleOnly: boolean; applicationServerKey: Uint8Array };
    expect(subscribeOptions.userVisibleOnly).toBe(true);
    expect([...subscribeOptions.applicationServerKey]).toEqual([...urlBase64ToUint8Array(PUBLIC_KEY)]);
    expect(subscribeOptions.applicationServerKey).toHaveLength(65);
    expect(b.calls('POST')).toEqual([{ endpoint: ENDPOINT, keys: KEYS }]);
    expect(localStorage.getItem(USER_KEY)).toBe(AN);
  });

  it('AC-13: one button element stays in the page and keeps the keyboard focus after enabling and after disabling', async () => {
    setup();
    render(<PushToggle userId={AN} />);
    const button = await screen.findByRole('button', { name: ENABLE });
    button.focus();
    expect(document.activeElement).toBe(button);

    fireEvent.click(button);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await screen.findByRole('button', { name: DISABLE });
    await waitFor(() => expect(button.getAttribute('aria-disabled')).toBe('false'));
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: DISABLE })).toBe(button);
    expect(document.activeElement).toBe(button);

    fireEvent.click(button);
    await screen.findByRole('button', { name: ENABLE });
    expect(screen.getByRole('button', { name: ENABLE })).toBe(button);
    expect(document.activeElement).toBe(button);
  });

  it('AC-13: the button is disabled while it works, and a failed subscribe shows an alert and a working button', async () => {
    const b = setup({ subscribeFails: true });
    render(<PushToggle userId={AN} />);

    fireEvent.click(await screen.findByRole('button', { name: ENABLE }));

    expect((await screen.findByRole('alert')).textContent).toBe('Chưa bật được thông báo. Hãy thử lại.');
    expect((screen.getByRole('button', { name: ENABLE }) as HTMLButtonElement).disabled).toBe(false);
    expect(b.calls('POST')).toEqual([]);
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });

  it('AC-13: when the server refuses the subscription, the device is unsubscribed and nothing is saved', async () => {
    const b = setup({ postStatus: 400 });
    render(<PushToggle userId={AN} />);

    fireEvent.click(await screen.findByRole('button', { name: ENABLE }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(b.subscription()).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });

  it('AC-15: when the user blocks the permission dialog, the button goes and the blocked message shows', async () => {
    const b = setup({ dialog: 'denied' });
    render(<PushToggle userId={AN} />);

    fireEvent.click(await screen.findByRole('button', { name: ENABLE }));

    expect(await screen.findByText(DENIED)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(b.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('AC-14: "Tắt..." unsubscribes, sends DELETE with the endpoint, and the button returns to "Nhận..."', async () => {
    const b = setup({ permission: 'granted', subscribed: true, storedUser: AN });
    render(<PushToggle userId={AN} />);
    const subscription = b.subscription()!;

    fireEvent.click(await screen.findByRole('button', { name: DISABLE }));

    expect(await screen.findByRole('button', { name: ENABLE })).toBeTruthy();
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(b.calls('DELETE')).toEqual([{ endpoint: ENDPOINT }]);
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });

  it('AC-15: with the permission "denied", there is no button and the message shows', async () => {
    setup({ permission: 'denied' });
    render(<PushToggle userId={AN} />);

    expect(await screen.findByText(DENIED)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('AC-16: a browser with no PushManager sees the hint for iPhone and Android, and no button', async () => {
    setup({ supported: false });
    render(<PushToggle userId={AN} />);

    expect(await screen.findByText(UNSUPPORTED)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('AC-21: when the public key answers 404, the toggle renders nothing: no button and no hint', async () => {
    const b = setup({ keyStatus: 404 });
    const { container } = render(<PushToggle userId={AN} />);

    await waitFor(() => expect(b.fetch).toHaveBeenCalledWith('/api/push/public-key', expect.anything()));
    await act(async () => {});
    expect(container.innerHTML).toBe('');
  });

  it('AC-21: the same holds in a browser with no PushManager, and while the key still loads', async () => {
    const b = setup({ keyStatus: 404, supported: false });
    const { container } = render(<PushToggle userId={AN} />);
    expect(container.innerHTML).toBe('');

    await waitFor(() => expect(b.fetch).toHaveBeenCalledWith('/api/push/public-key', expect.anything()));
    await act(async () => {});
    expect(container.innerHTML).toBe('');
  });

  describe('AC-22: sync again after a page load', () => {
    it('AC-22: when localStorage holds the signed-in user, the subscription goes to the API once, and the button says "Tắt..."', async () => {
      const b = setup({ permission: 'granted', subscribed: true, storedUser: AN });

      await resyncPush(AN);
      render(<PushToggle userId={AN} />);

      expect(await screen.findByRole('button', { name: DISABLE })).toBeTruthy();
      expect(b.calls('POST')).toEqual([{ endpoint: ENDPOINT, keys: KEYS }]);
      expect(b.subscription()).not.toBeNull();
    });

    it('AC-22: when localStorage holds another user, there is no POST, the browser unsubscribes, and the button says "Nhận..."', async () => {
      const b = setup({ permission: 'granted', subscribed: true, storedUser: BINH });
      const subscription = b.subscription()!;

      await resyncPush(AN);
      render(<PushToggle userId={AN} />);

      expect(await screen.findByRole('button', { name: ENABLE })).toBeTruthy();
      expect(b.calls('POST')).toEqual([]);
      expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(USER_KEY)).toBeNull();
    });

    it('AC-22: when localStorage holds An and Bình is signed in, there is no POST, the browser unsubscribes, and the button says "Nhận..."', async () => {
      const b = setup({ permission: 'granted', subscribed: true, storedUser: AN });
      const subscription = b.subscription()!;

      await resyncPush(BINH);
      render(<PushToggle userId={BINH} />);

      expect(await screen.findByRole('button', { name: ENABLE })).toBeTruthy();
      expect(b.calls('POST')).toEqual([]);
      expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(USER_KEY)).toBeNull();
    });

    it('AC-22: when localStorage has no key, there is no POST, the browser unsubscribes, and the button says "Nhận..."', async () => {
      const b = setup({ permission: 'granted', subscribed: true, storedUser: null });
      const subscription = b.subscription()!;

      await resyncPush(AN);
      render(<PushToggle userId={AN} />);

      expect(await screen.findByRole('button', { name: ENABLE })).toBeTruthy();
      expect(b.calls('POST')).toEqual([]);
      expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('AC-22: without the permission, or without a subscription, the sync does nothing', async () => {
      const b = setup({ permission: 'default', subscribed: true, storedUser: AN });
      await resyncPush(AN);
      expect(b.calls('POST')).toEqual([]);
      expect(b.subscription()!.unsubscribe).not.toHaveBeenCalled();
      cleanup();
      vi.unstubAllGlobals();
      Reflect.deleteProperty(navigator, 'serviceWorker');

      const c = setup({ permission: 'granted', subscribed: false, storedUser: AN });
      await resyncPush(AN);
      expect(c.calls('POST')).toEqual([]);
      expect(localStorage.getItem(USER_KEY)).toBe(AN);
    });

    it('AC-22: an error in the sync never reaches the caller', async () => {
      const b = setup({ permission: 'granted', subscribed: true, storedUser: AN, postStatus: 500 });
      await expect(resyncPush(AN)).resolves.toBeUndefined();
      expect(b.calls('POST')).toHaveLength(1);
    });
  });
});
