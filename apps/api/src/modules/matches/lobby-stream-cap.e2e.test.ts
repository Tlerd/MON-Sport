import 'reflect-metadata';
import http from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';

// Over the cap, GET /api/matches/stream answers 200 with one ping that carries `retry:`, and then ends.
// A 503 would make EventSource give up, so a viewer past the cap would never get live updates again.
// "retry: 3000" is a prefix of "retry: 30000", so the short one is matched with its line end.
const OPEN_RETRY = 'retry: 3000\n';
const FULL_RETRY = 'retry: 30000\n';

let app: INestApplication;
let port = 0;
// Every request is closed in afterAll, so a failed assertion cannot leave an open stream that makes app.close() wait.
const requests: http.ClientRequest[] = [];

beforeAll(async () => {
  process.env.LOBBY_STREAM_MAX = '1';
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = setupApp(mod.createNestApplication());
  await app.listen(0);
  const address = app.getHttpServer().address();
  port = typeof address === 'object' && address ? address.port : 0;
});

afterAll(async () => {
  delete process.env.LOBBY_STREAM_MAX;
  delete process.env.LOBBY_STREAM_MAX_PER_IP;
  for (const request of requests) request.destroy();
  await app?.close();
});

type Reply = { status: number | undefined; contentType: string; body: string; ended: boolean };

/** Reads the stream until the server ends it, or until `waitMs` has passed. Returns what came. */
function read(waitMs: number, ip?: string): Promise<{ reply: Reply; request: http.ClientRequest }> {
  return new Promise((resolve, reject) => {
    const reply: Reply = { status: undefined, contentType: '', body: '', ended: false };
    const headers = ip ? { 'X-Forwarded-For': ip } : undefined;
    const request = http.get(`http://127.0.0.1:${port}/api/matches/stream`, { headers }, (res) => {
      reply.status = res.statusCode;
      reply.contentType = String(res.headers['content-type'] ?? '');
      const timer = setTimeout(() => resolve({ reply, request }), waitMs);
      res.on('data', (chunk: Buffer) => {
        reply.body += chunk.toString('utf8');
      });
      res.on('end', () => {
        clearTimeout(timer);
        reply.ended = true;
        resolve({ reply, request });
      });
    });
    requests.push(request);
    request.on('error', reject);
  });
}

describe('lobby stream cap over HTTP', () => {
  it('answers 200 with a retry ping and ends past the cap, then admits a client once a slot is free', async () => {
    const holder = await read(300);
    expect(holder.reply.status).toBe(200);
    expect(holder.reply.contentType).toMatch(/text\/event-stream/);
    expect(holder.reply.ended).toBe(false);
    expect(holder.reply.body).toContain(OPEN_RETRY);
    expect(holder.reply.body).not.toContain(FULL_RETRY);

    const refused = await read(2_000);
    expect(refused.reply.status).toBe(200);
    expect(refused.reply.contentType).toMatch(/text\/event-stream/);
    expect(refused.reply.body).toContain(FULL_RETRY);
    expect(refused.reply.ended).toBe(true);

    holder.request.destroy();
    let admitted = false;
    for (let attempt = 0; attempt < 20 && !admitted; attempt++) {
      const next = await read(300);
      admitted = !next.reply.ended && next.reply.body.includes(OPEN_RETRY) && !next.reply.body.includes(FULL_RETRY);
      next.request.destroy();
      if (!admitted) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(admitted).toBe(true);
  });

  it('caps a single IP without refusing another IP over HTTP', async () => {
    process.env.LOBBY_STREAM_MAX = '4';
    process.env.LOBBY_STREAM_MAX_PER_IP = '1';
    try {
      const ipA = await read(300, '203.0.113.71');
      expect(ipA.reply.ended).toBe(false);
      expect(ipA.reply.body).toContain(OPEN_RETRY);

      const ipASecond = await read(2_000, '203.0.113.71');
      expect(ipASecond.reply.ended).toBe(true);
      expect(ipASecond.reply.body).toContain(FULL_RETRY);

      const ipB = await read(300, '203.0.113.72');
      expect(ipB.reply.ended).toBe(false);
      expect(ipB.reply.body).toContain(OPEN_RETRY);

      ipA.request.destroy();
      ipB.request.destroy();
    } finally {
      process.env.LOBBY_STREAM_MAX = '1';
      delete process.env.LOBBY_STREAM_MAX_PER_IP;
    }
  });
});
