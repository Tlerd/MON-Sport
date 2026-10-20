import { Injectable } from '@nestjs/common';
import { isAllowedPushEndpoint, type PushPayload } from '@monsport/shared';
import webpush from 'web-push';

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushVapid = { publicKey: string; privateKey: string; subject: string };
export type PushOptions = { ttl: number; urgency: 'high'; timeoutMs: number };

/**
 * Thrown when a send fails without an HTTP answer. The kind is `timeout`, `network` (a socket error), or `invalid` (web-push
 * refused the VAPID key or the key of the device before any request). The text names the kind only. The error of the
 * HTTP client can hold the endpoint of a device, which is personal data, so it never leaves this file.
 */
export class PushSendError extends Error {
  constructor(readonly kind: 'timeout' | 'network' | 'invalid') {
    super(`Push send failed (${kind})`);
  }
}

/**
 * Brief F-014, Contract 4. One call sends one message to one device. It resolves with the HTTP status of the push service,
 * and it throws a `PushSendError` when there was no answer. Tests replace this class with a fake.
 */
@Injectable()
export abstract class PushSender {
  abstract send(sub: PushTarget, payload: PushPayload, vapid: PushVapid, options: PushOptions): Promise<{ statusCode: number }>;
}

@Injectable()
export class WebPushSender extends PushSender {
  async send(sub: PushTarget, payload: PushPayload, vapid: PushVapid, options: PushOptions): Promise<{ statusCode: number }> {
    // The server calls this URL, so it checks the URL again here, not only when the device was saved (SSRF, Assumption 8).
    if (!isAllowedPushEndpoint(sub.endpoint)) return { statusCode: 400 };
    try {
      const result = await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
        vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
        TTL: options.ttl,
        urgency: options.urgency,
        timeout: options.timeoutMs,
      });
      return { statusCode: result.statusCode };
    } catch (error) {
      const statusCode = (error as { statusCode?: unknown } | null)?.statusCode;
      if (typeof statusCode === 'number') return { statusCode };
      const message = String((error as Error | null)?.message ?? '');
      if (/timeout|timed out/i.test(message)) throw new PushSendError('timeout');
      // A socket error carries a `code` (ECONNREFUSED, ECONNRESET). An error with no code, or with an ERR_CRYPTO_ code, comes
      // from web-push itself, before any request: a bad VAPID key or a bad key of the device.
      const code = (error as { code?: unknown } | null)?.code;
      throw new PushSendError(typeof code === 'string' && !code.startsWith('ERR_CRYPTO_') ? 'network' : 'invalid');
    }
  }
}

/**
 * True when web-push accepts the three VAPID values (subject, public key, private key). `setVapidDetails` validates them and
 * also stores them as global defaults, so the call is undone at once. `send` passes the values on each call.
 */
export function isValidVapid(vapid: PushVapid): boolean {
  const lib = webpush as unknown as { setVapidDetails(...args: (string | null)[]): void };
  try {
    lib.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    return true;
  } catch {
    return false;
  } finally {
    lib.setVapidDetails(null);
  }
}
