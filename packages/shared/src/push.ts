import { z } from 'zod';

export const PUSH_HOST_ALLOWLIST = {
  hosts: ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'],
  suffixes: ['.push.apple.com', '.notify.windows.com', '.push.services.mozilla.com'],
} as const;

const CANONICAL_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function isAllowedPushEndpoint(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.href !== url) return false;
    if (parsed.protocol !== 'https:' || parsed.port !== '' || parsed.username !== '' || parsed.password !== '') return false;
    const host = parsed.hostname;
    if (!CANONICAL_HOST.test(host) || host.length > 253 || host.split('.').some((label) => label.length > 63)) return false;
    return (
      (PUSH_HOST_ALLOWLIST.hosts as readonly string[]).includes(host) ||
      PUSH_HOST_ALLOWLIST.suffixes.some((suffix) => host.endsWith(suffix))
    );
  } catch {
    return false;
  }
}

export const PushSubscribeRequest = z.object({
  endpoint: z.string().max(2048).refine(isAllowedPushEndpoint),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});
export type PushSubscribeRequest = z.infer<typeof PushSubscribeRequest>;

export const PushUnsubscribeRequest = z.object({
  endpoint: z.string().max(2048),
});
export type PushUnsubscribeRequest = z.infer<typeof PushUnsubscribeRequest>;

export const PushPublicKeyResponse = z.object({
  publicKey: z.string().min(1),
});
export type PushPublicKeyResponse = z.infer<typeof PushPublicKeyResponse>;

export const PushPayload = z.object({
  title: z.string(),
  body: z.string(),
  notificationId: z.uuid(),
});
export type PushPayload = z.infer<typeof PushPayload>;
