import { Injectable } from '@nestjs/common';
import { isAllowedPushEndpoint, type PushPayload } from '@monsport/shared';
import webpush from 'web-push';

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushVapid = { publicKey: string; privateKey: string; subject: string };
export type PushOptions = { ttl: number; urgency: 'high'; timeoutMs: number };

export class PushSendError extends Error {
  constructor(readonly kind: 'timeout' | 'network' | 'invalid') {
    super(`Push send failed (${kind})`);
  }
}

@Injectable()
export abstract class PushSender {
  abstract send(sub: PushTarget, payload: PushPayload, vapid: PushVapid, options: PushOptions): Promise<{ statusCode: number }>;
}

@Injectable()
export class WebPushSender extends PushSender {
  async send(sub: PushTarget, payload: PushPayload, vapid: PushVapid, options: PushOptions): Promise<{ statusCode: number }> {
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
      const code = (error as { code?: unknown } | null)?.code;
      throw new PushSendError(typeof code === 'string' && !code.startsWith('ERR_CRYPTO_') ? 'network' : 'invalid');
    }
  }
}

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
