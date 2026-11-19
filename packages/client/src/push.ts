import { PushPublicKeyResponse } from '@monsport/shared';
import type { PushSubscribeRequest, PushUnsubscribeRequest } from '@monsport/shared';
import { api, ApiError } from './api.ts';

const USER_KEY = 'monsport.push.user';

export class PushPermissionError extends Error {
  constructor(readonly permission: NotificationPermission) {
    super('Chưa được phép gửi thông báo');
  }
}

function readStoredUser(): string | null {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}
function writeStorage(write: () => void): boolean {
  try {
    write();
    return true;
  } catch {
    return false;
  }
}
function storeUser(userId: string): boolean {
  return writeStorage(() => localStorage.setItem(USER_KEY, userId));
}
function clearStoredUser(): boolean {
  return writeStorage(() => localStorage.removeItem(USER_KEY));
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in globalThis && 'Notification' in globalThis;
}

export async function getPublicKey(): Promise<string | null> {
  try {
    const parsed = PushPublicKeyResponse.safeParse(await api<unknown>('/api/push/public-key'));
    return parsed.success ? parsed.data.publicKey : null;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

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

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function isPushOn(userId: string): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted' || readStoredUser() !== userId) return false;
  try {
    return (await currentSubscription()) !== null;
  } catch {
    return false;
  }
}

export async function enablePush(userId: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new PushPermissionError(permission);

  const publicKey = await getPublicKey();
  if (!publicKey) throw new Error('Thông báo đẩy chưa bật');
  const applicationServerKey = urlBase64ToUint8Array(publicKey);

  await navigator.serviceWorker.register('/sw.js');
  const registration = await navigator.serviceWorker.ready;

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

async function disable(): Promise<void> {
  if (!pushSupported()) return;
  const subscription = await currentSubscription();
  if (!subscription) return;
  const { endpoint } = subscription;
  await subscription.unsubscribe().catch(() => undefined);
  const body: PushUnsubscribeRequest = { endpoint };
  await api('/api/push/subscriptions', { method: 'DELETE', json: body });
}

export async function disablePush(): Promise<void> {
  try {
    await disable().catch(() => undefined);
  } finally {
    clearStoredUser();
  }
}

async function resync(userId: string): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const subscription = await currentSubscription();
  if (!subscription) return;
  if (readStoredUser() === userId) {
    await postSubscription(subscription);
  } else {
    await subscription.unsubscribe();
    clearStoredUser();
  }
}

export async function resyncPush(userId: string): Promise<void> {
  await resync(userId).catch(() => undefined);
}
