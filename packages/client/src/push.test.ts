import { afterEach, describe, expect, it, vi } from 'vitest';
import { disablePush } from './push.ts';

const USER_KEY = 'monsport.push.user';

function stubStorage(userId: string) {
  const store = new Map<string, string>([[USER_KEY, userId]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  });
  return store;
}

function stubSubscription(userId: string, subscription: { readonly endpoint: string; unsubscribe: () => Promise<boolean> }) {
  const store = stubStorage(userId);
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', { permission: 'granted' });
  vi.stubGlobal('navigator', {
    serviceWorker: {
      getRegistration: () =>
        Promise.resolve({
          pushManager: {
            getSubscription: () => Promise.resolve(subscription),
          },
        }),
    },
  });
  return store;
}

describe('disablePush', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves and clears the stored user when navigator.serviceWorker access throws', async () => {
    const store = stubStorage('user-1');
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal(
      'navigator',
      new Proxy(
        {},
        {
          has() {
            throw new Error('serviceWorker blocked');
          },
          get() {
            throw new Error('serviceWorker blocked');
          },
        },
      ),
    );

    await expect(disablePush()).resolves.toBeUndefined();
    expect(store.has(USER_KEY)).toBe(false);
  });

  it('resolves and clears the stored user when navigator.serviceWorker getter throws', async () => {
    const store = stubStorage('user-2');
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('navigator', {
      get serviceWorker(): never {
        throw new Error('serviceWorker getter failed');
      },
    });

    await expect(disablePush()).resolves.toBeUndefined();
    expect(store.has(USER_KEY)).toBe(false);
  });

  it('resolves and clears the stored user when subscription.endpoint getter throws', async () => {
    const endpoint = vi.fn(() => {
      throw new Error('endpoint failed');
    });
    const store = stubSubscription('user-3', {
      get endpoint(): string {
        return endpoint();
      },
      unsubscribe: () => Promise.resolve(true),
    });

    await expect(disablePush()).resolves.toBeUndefined();
    expect(endpoint).toHaveBeenCalledTimes(1);
    expect(store.has(USER_KEY)).toBe(false);
  });

  it('resolves and clears the stored user when unsubscribe() throws synchronously', async () => {
    const unsubscribe = vi.fn(() => {
      throw new Error('unsubscribe failed');
    });
    const store = stubSubscription('user-4', {
      endpoint: 'https://push.example/sub',
      unsubscribe,
    });

    await expect(disablePush()).resolves.toBeUndefined();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(store.has(USER_KEY)).toBe(false);
  });
});
