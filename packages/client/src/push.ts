import { PushPublicKeyResponse } from '@monsport/shared';
import type { PushSubscribeRequest, PushUnsubscribeRequest } from '@monsport/shared';
import { api, ApiError } from './api.ts';

// Brief F-014 (UC-14): the browser side of Web Push. The user turns it on by hand, one device at a time.

/** The `userId` of the person who turned Web Push on in this browser (Assumption 14). */
const USER_KEY = 'monsport.push.user';

/** Thrown when the user does not allow notifications in the browser dialog. */
export class PushPermissionError extends Error {
  constructor(readonly permission: NotificationPermission) {
    super('Chưa được phép gửi thông báo');
  }
}

// localStorage can throw (a blocked or full store), and Web Push still works without it.
function readStoredUser(): string | null {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}
function storeUser(userId: string) {
  try {
    localStorage.setItem(USER_KEY, userId);
  } catch {
    // Without the key, the next page load turns Web Push off again, and the user can turn it on again.
  }
}
function clearStoredUser() {
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    // Nothing to do.
  }
}

/** True when the browser has the service worker, push, and notification APIs. iPhone has them only in a home-screen app. */
export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in globalThis && 'Notification' in globalThis;
}

/** The public VAPID key, or null when the server has Web Push off (404). */
export async function getPublicKey(): Promise<string | null> {
  try {
    const parsed = PushPublicKeyResponse.safeParse(await api<unknown>('/api/push/public-key'));
    return parsed.success ? parsed.data.publicKey : null;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Decodes a base64url string, which is the form of the VAPID key, to the bytes that `subscribe` needs. */
export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const sameBytes = (a: ArrayBuffer | null | undefined, b: Uint8Array) => {
  if (!a || a.byteLength !== b.length) return false;
  const view = new Uint8Array(a);
  return b.every((byte, i) => byte === view[i]);
};

async function postSubscription(subscription: PushSubscription) {
  const { endpoint, keys } = subscription.toJSON();
  const body: PushSubscribeRequest = { endpoint: endpoint ?? subscription.endpoint, keys: { p256dh: keys?.p256dh ?? '', auth: keys?.auth ?? '' } };
  await api('/api/push/subscriptions', { method: 'POST', json: body });
}

/** The subscription of this browser, or null. It uses `getRegistration`, because `ready` never settles with no worker. */
async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** True when this browser has a subscription that the signed-in user turned on. */
export async function isPushOn(userId: string): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted' || readStoredUser() !== userId) return false;
  try {
    return (await currentSubscription()) !== null;
  } catch {
    return false;
  }
}

/** Asks for the permission, subscribes this device, and saves it for `userId`. Throws when a step fails. */
export async function enablePush(userId: string): Promise<void> {
  // The permission dialog must start from the tap, so nothing slow comes before it.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new PushPermissionError(permission);

  const publicKey = await getPublicKey();
  if (!publicKey) throw new Error('Thông báo đẩy chưa bật');
  const applicationServerKey = urlBase64ToUint8Array(publicKey);

  await navigator.serviceWorker.register('/sw.js');
  const registration = await navigator.serviceWorker.ready;

  // A subscription made with another key makes `subscribe` throw, so drop it first.
  const existing = await registration.pushManager.getSubscription();
  if (existing && existing.options?.applicationServerKey && !sameBytes(existing.options.applicationServerKey as ArrayBuffer, applicationServerKey)) {
    await existing.unsubscribe();
  }

  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  try {
    await postSubscription(subscription);
  } catch (e) {
    await subscription.unsubscribe().catch(() => undefined);
    throw e;
  }
  storeUser(userId);
}

/** Turns Web Push off on this device. It never throws, so a failure never blocks a logout (Assumption 13). */
export async function disablePush(): Promise<void> {
  try {
    if (!pushSupported()) return;
    const subscription = await currentSubscription();
    if (!subscription) return;
    const { endpoint } = subscription;
    await subscription.unsubscribe().catch(() => undefined);
    const body: PushUnsubscribeRequest = { endpoint };
    await api('/api/push/subscriptions', { method: 'DELETE', json: body }).catch(() => undefined);
  } catch {
    // Best effort.
  } finally {
    clearStoredUser();
  }
}

/**
 * Runs once for a signed-in user after a page load (Assumption 14). It touches nothing unless the permission is
 * granted and a subscription exists. The user who turned it on gets the subscription sent again (the key can change).
 * Any other user, or nobody, gets the subscription dropped, so a row never moves to a person who did not tap the button.
 */
export async function resyncPush(userId: string): Promise<void> {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return;
    const subscription = await currentSubscription();
    if (!subscription) return;
    if (readStoredUser() === userId) {
      await postSubscription(subscription);
    } else {
      await subscription.unsubscribe();
      clearStoredUser();
    }
  } catch {
    // Best effort: the next page load tries again.
  }
}
