import { afterEach, expect, test, vi } from 'vitest';
import { api, ApiError } from './api.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubAnswer(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status, json: () => Promise.resolve(body) }));
}

test('a 429 answer with retryAfter gives an ApiError that carries retryAfter', async () => {
  stubAnswer(429, { message: 'x', retryAfter: 30 });
  const err: unknown = await api('/api/x').catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toMatchObject({ status: 429, message: 'x', retryAfter: 30 });
});

test('an error answer without retryAfter gives retryAfter undefined', async () => {
  stubAnswer(429, { message: 'x' });
  const err: unknown = await api('/api/x').catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toMatchObject({ status: 429, retryAfter: undefined });
});
