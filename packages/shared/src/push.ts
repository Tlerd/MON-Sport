import { z } from 'zod';

// Brief F-014 (UC-14): Web Push. Names follow docs/requirements/data-dictionary.md.

/**
 * Hosts of the push services that the server may call (brief F-014, Assumption 8). The endpoint comes from the user,
 * and the server calls it, so only these hosts pass. A suffix starts with a dot, so `evilnotify.windows.com` fails.
 */
export const PUSH_HOST_ALLOWLIST = {
  hosts: ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'],
  suffixes: ['.push.apple.com', '.notify.windows.com', '.push.services.mozilla.com'],
} as const;

// Lowercase letters, digits, and hyphens in labels, with at least one dot and no empty label.
const CANONICAL_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/**
 * True for an https URL without port or userinfo, on an allowed host. Never throws. A non-string gives false.
 * It accepts the canonical form only (`new URL(url).href === url`). The WHATWG parser decodes `%2E`, drops a tab, and maps
 * the ideographic full stop to a dot, while the legacy `url.parse` of `web-push` reads another host from the same text.
 * `https://10.0.0.5%2E.push.apple.com/x` is one such text. A canonical text has one reading in both parsers.
 */
export function isAllowedPushEndpoint(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.href !== url) return false;
    if (parsed.protocol !== 'https:' || parsed.port !== '' || parsed.username !== '' || parsed.password !== '') return false;
    const host = parsed.hostname;
    if (!CANONICAL_HOST.test(host)) return false;
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

/** The content of one push. It holds no name and no phone number (BR-20). */
export const PushPayload = z.object({
  title: z.string(),
  body: z.string(),
  notificationId: z.uuid(),
});
export type PushPayload = z.infer<typeof PushPayload>;
