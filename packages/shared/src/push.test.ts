import { describe, expect, it } from 'vitest';
import {
  isAllowedPushEndpoint,
  PUSH_HOST_ALLOWLIST,
  PushPayload,
  PushPublicKeyResponse,
  PushSubscribeRequest,
  PushUnsubscribeRequest,
} from './push.ts';

describe('isAllowedPushEndpoint (brief F-014, Contract 1)', () => {
  it('AC-4: accepts https endpoints of the known push services', () => {
    for (const url of [
      'https://fcm.googleapis.com/fcm/send/abc123',
      'https://wns2-par02p.notify.windows.com/x',
      'https://web.push.apple.com/x',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://a.b.push.services.mozilla.com/x',
      'https://api.push.apple.com/3/device/abc',
    ]) {
      expect(isAllowedPushEndpoint(url), url).toBe(true);
    }
  });

  it('AC-4: rejects every case of the brief', () => {
    for (const url of [
      'http://fcm.googleapis.com/x',
      'https://internal.example.com/x',
      'https://169.254.169.254/x',
      'https://fcm.googleapis.com:8443/x',
      'https://user:pw@fcm.googleapis.com/x',
      'https://fcm.googleapis.com.evil.com/x',
      'https://evilnotify.windows.com/x',
    ]) {
      expect(isAllowedPushEndpoint(url), url).toBe(false);
    }
  });

  it('AC-4: rejects other tricks without a throw', () => {
    for (const url of [
      'https://user@fcm.googleapis.com/x',
      'https://:pw@fcm.googleapis.com/x',
      'https://fcm.googleapis.com./x',
      'https://notify.windows.com/x',
      'https://push.apple.com/x',
      'https://evil.com\\@fcm.googleapis.com/x',
      'https://evil.com/@fcm.googleapis.com/x',
      'https://[::1]/x',
      'https://127.0.0.1/x',
      'ftp://fcm.googleapis.com/x',
      'javascript:alert(1)',
      '//fcm.googleapis.com/x',
      'fcm.googleapis.com/x',
      '',
      '   ',
      'not a url',
    ]) {
      expect(isAllowedPushEndpoint(url), url).toBe(false);
    }
  });

  it('AC-4: accepts only the canonical form, so the WHATWG parser and the legacy url.parse of web-push read one host', () => {
    for (const url of [
      // The WHATWG host ends with .push.apple.com, and the legacy parser reads 10.0.0.5.
      'https://10.0.0.5%2E.push.apple.com/x',
      'https://10.0.0.5%2e.push.apple.com/x',
      'https://fcm.googleapis%2Ecom/x',
      // The parser strips a tab and a newline inside the host.
      'https://fcm.goo\tgleapis.com/x',
      'https://fcm.goo\ngleapis.com/x',
      // The ideographic full stop maps to a dot.
      'https://fcm.googleapis%E3%80%82com/x',
      'https://fcm.googleapis。com/x',
      // The parser lowercases the host and drops a default port, so the text differs from its href.
      'https://FCM.GoogleAPIs.com/x',
      'https://fcm.googleapis.com:443/x',
      // A trailing dot and an empty label.
      'https://fcm.googleapis.com./x',
      'https://x..push.apple.com/x',
      ' https://fcm.googleapis.com/x',
      'https://fcm.googleapis.com/x ',
    ]) {
      expect(isAllowedPushEndpoint(url), JSON.stringify(url)).toBe(false);
    }
  });

  it('returns false for any non-string and never throws', () => {
    for (const value of [undefined, null, 0, 1, true, {}, [], ['https://fcm.googleapis.com/x'], Symbol('x'), () => 'x', 10n]) {
      expect(isAllowedPushEndpoint(value), String(typeof value)).toBe(false);
    }
    const hostile = { toString: () => { throw new Error('boom'); } };
    expect(isAllowedPushEndpoint(hostile)).toBe(false);
  });

  it('keeps the allowlist to the brief', () => {
    expect(PUSH_HOST_ALLOWLIST.hosts).toEqual(['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com']);
    expect(PUSH_HOST_ALLOWLIST.suffixes).toEqual(['.push.apple.com', '.notify.windows.com', '.push.services.mozilla.com']);
  });
});

describe('push schemas', () => {
  const good = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys: { p256dh: 'BKey', auth: 'authKey' } };

  it('PushSubscribeRequest accepts a valid body', () => {
    expect(PushSubscribeRequest.safeParse(good).success).toBe(true);
  });

  it('PushSubscribeRequest refuses a bad endpoint, a missing key, and non-object input', () => {
    expect(PushSubscribeRequest.safeParse({ ...good, endpoint: 'http://fcm.googleapis.com/x' }).success).toBe(false);
    expect(PushSubscribeRequest.safeParse({ ...good, endpoint: 42 }).success).toBe(false);
    expect(PushSubscribeRequest.safeParse({ endpoint: good.endpoint, keys: { p256dh: 'k' } }).success).toBe(false);
    expect(PushSubscribeRequest.safeParse({ endpoint: good.endpoint }).success).toBe(false);
    expect(PushSubscribeRequest.safeParse({ ...good, keys: { p256dh: '', auth: 'a' } }).success).toBe(false);
    expect(PushSubscribeRequest.safeParse({ ...good, keys: { p256dh: 'k', auth: '' } }).success).toBe(false);
    expect(PushSubscribeRequest.safeParse(null).success).toBe(false);
    expect(PushSubscribeRequest.safeParse('x').success).toBe(false);
  });

  it('PushSubscribeRequest enforces the length limits: endpoint 2048, p256dh 200, auth 100', () => {
    const prefix = 'https://fcm.googleapis.com/';
    const endpoint = (length: number) => prefix + 'a'.repeat(length - prefix.length);
    expect(PushSubscribeRequest.safeParse({ ...good, endpoint: endpoint(2048) }).success).toBe(true);
    expect(PushSubscribeRequest.safeParse({ ...good, endpoint: endpoint(2049) }).success).toBe(false);
    expect(PushSubscribeRequest.safeParse({ ...good, keys: { p256dh: 'p'.repeat(200), auth: 'a' } }).success).toBe(true);
    expect(PushSubscribeRequest.safeParse({ ...good, keys: { p256dh: 'p'.repeat(201), auth: 'a' } }).success).toBe(false);
    expect(PushSubscribeRequest.safeParse({ ...good, keys: { p256dh: 'p', auth: 'a'.repeat(100) } }).success).toBe(true);
    expect(PushSubscribeRequest.safeParse({ ...good, keys: { p256dh: 'p', auth: 'a'.repeat(101) } }).success).toBe(false);
  });

  it('PushUnsubscribeRequest takes any string endpoint up to 2048', () => {
    expect(PushUnsubscribeRequest.safeParse({ endpoint: 'https://example.com/x' }).success).toBe(true);
    expect(PushUnsubscribeRequest.safeParse({ endpoint: 'x'.repeat(2048) }).success).toBe(true);
    expect(PushUnsubscribeRequest.safeParse({ endpoint: 'x'.repeat(2049) }).success).toBe(false);
    expect(PushUnsubscribeRequest.safeParse({}).success).toBe(false);
    expect(PushUnsubscribeRequest.safeParse({ endpoint: 1 }).success).toBe(false);
  });

  it('PushPublicKeyResponse needs a non-empty key', () => {
    expect(PushPublicKeyResponse.safeParse({ publicKey: 'BKey' }).success).toBe(true);
    expect(PushPublicKeyResponse.safeParse({ publicKey: '' }).success).toBe(false);
  });

  it('PushPayload needs title, body, and a uuid notificationId', () => {
    const id = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
    expect(PushPayload.safeParse({ title: 't', body: 'b', notificationId: id }).success).toBe(true);
    expect(PushPayload.safeParse({ title: 't', body: 'b', notificationId: 'x' }).success).toBe(false);
    expect(PushPayload.safeParse({ title: 't', notificationId: id }).success).toBe(false);
  });
});
