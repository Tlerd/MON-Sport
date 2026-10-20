import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/** Runs public/sw.js in a fake service worker scope and returns the handlers that it registers. */
function loadWorker() {
  const code = readFileSync(join(import.meta.dirname, '../public/sw.js'), 'utf8');
  const handlers: Record<string, (event: unknown) => void> = {};
  const showNotification = vi.fn((_title: string, _options?: unknown) => Promise.resolve());
  const focus = vi.fn(() => Promise.resolve());
  const scope = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlers[type] = handler;
    },
    registration: { showNotification },
    skipWaiting: vi.fn(() => Promise.resolve()),
    clients: {
      matchAll: vi.fn((): Promise<{ focus: typeof focus }[]> => Promise.resolve([])),
      openWindow: vi.fn(() => Promise.resolve()),
      claim: vi.fn(() => Promise.resolve()),
    },
  };
  new Function('self', code)(scope);
  return { handlers, scope, showNotification, focus };
}

/** An event whose `waitUntil` keeps the promise, so the test can wait for it like the browser does. */
function lifecycleEvent<T extends object>(extra: T) {
  const waited: Promise<unknown>[] = [];
  return { ...extra, waitUntil: vi.fn((p: Promise<unknown>) => void waited.push(p)), waited };
}

const NOTIFICATION_ID = '0199a1b2-0000-7000-8000-000000000010';

describe('sw.js', () => {
  it('AC-17: push shows the title and body inside event.waitUntil', async () => {
    const { handlers, showNotification } = loadWorker();
    const event = lifecycleEvent({
      data: { json: () => ({ title: 'Yêu cầu đặt sân mới', body: 'Có yêu cầu tại Cầu lông A - Sân 1', notificationId: NOTIFICATION_ID }) },
    });

    handlers.push!(event);

    expect(event.waitUntil).toHaveBeenCalledTimes(1);
    await Promise.all(event.waited);
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith('Yêu cầu đặt sân mới', {
      body: 'Có yêu cầu tại Cầu lông A - Sân 1',
      data: { notificationId: NOTIFICATION_ID },
      icon: '/icon-192.png',
    });
  });

  it('AC-17: a push with data that is not JSON still shows the fallback "MONSPORT: Bạn có thông báo mới"', async () => {
    const { handlers, showNotification } = loadWorker();
    const event = lifecycleEvent({
      data: {
        json: () => {
          throw new SyntaxError('Unexpected token');
        },
      },
    });

    handlers.push!(event);

    expect(event.waitUntil).toHaveBeenCalledTimes(1);
    await Promise.all(event.waited);
    expect(showNotification).toHaveBeenCalledTimes(1);
    const [title, options] = showNotification.mock.calls[0] as unknown as [string, { body: string }];
    expect(title).toBe('MONSPORT: Bạn có thông báo mới');
    expect(options.body).toBe('');
  });

  it('AC-17: a push with no data, or with a payload that misses the fields, shows the fallback', async () => {
    for (const data of [null, { json: () => ({}) }, { json: () => null }, { json: () => ({ title: 5, body: [] }) }]) {
      const { handlers, showNotification } = loadWorker();
      const event = lifecycleEvent({ data });

      handlers.push!(event);

      expect(event.waitUntil).toHaveBeenCalledTimes(1);
      await Promise.all(event.waited);
      expect(showNotification).toHaveBeenCalledTimes(1);
      expect(showNotification.mock.calls[0]![0]).toBe('MONSPORT: Bạn có thông báo mới');
    }
  });

  it('AC-17: notificationclick closes the notification and focuses the first open window', async () => {
    const { handlers, scope, focus } = loadWorker();
    scope.clients.matchAll.mockResolvedValue([{ focus }]);
    const close = vi.fn();
    const event = lifecycleEvent({ notification: { close } });

    handlers.notificationclick!(event);

    expect(close).toHaveBeenCalledTimes(1);
    expect(event.waitUntil).toHaveBeenCalledTimes(1);
    await Promise.all(event.waited);
    expect(scope.clients.matchAll).toHaveBeenCalledWith({ type: 'window', includeUncontrolled: true });
    expect(focus).toHaveBeenCalledTimes(1);
    expect(scope.clients.openWindow).not.toHaveBeenCalled();
  });

  it('AC-17: notificationclick opens "/" when no window is open', async () => {
    const { handlers, scope } = loadWorker();
    const event = lifecycleEvent({ notification: { close: vi.fn() } });

    handlers.notificationclick!(event);
    await Promise.all(event.waited);

    expect(scope.clients.openWindow).toHaveBeenCalledWith('/');
  });

  it('AC-17: the worker takes control at once, caches nothing, and has no fetch handler', async () => {
    const { handlers, scope } = loadWorker();

    handlers.install!({});
    const activate = lifecycleEvent({});
    handlers.activate!(activate);
    await Promise.all(activate.waited);

    expect(scope.skipWaiting).toHaveBeenCalledTimes(1);
    expect(scope.clients.claim).toHaveBeenCalledTimes(1);
    expect(Object.keys(handlers).sort()).toEqual(['activate', 'install', 'notificationclick', 'push']);
  });
});
