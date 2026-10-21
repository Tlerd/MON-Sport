import 'reflect-metadata';
import http from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';

// Over the cap, GET /api/matches/stream answers 200 with one ping that carries `retry:`, and then ends.
// A 503 would make EventSource give up, so a viewer past the cap would never get live updates again.
let app: INestApplication;
let port = 0;

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
  await app?.close();
});

type Reply = { status: number | undefined; contentType: string; body: string; ended: boolean };

/** Reads the stream until the server ends it, or until `waitMs` has passed. Returns what came. */
function read(waitMs: number): Promise<{ reply: Reply; request: http.ClientRequest }> {
  return new Promise((resolve, reject) => {
    const reply: Reply = { status: undefined, contentType: '', body: '', ended: false };
    const request = http.get(`http://127.0.0.1:${port}/api/matches/stream`, (res) => {
      reply.status = res.statusCode;
      reply.contentType = String(res.headers['content-type'] ?? '');
      res.on('data', (chunk: Buffer) => {
        reply.body += chunk.toString('utf8');
      });
      res.on('end', () => {
        reply.ended = true;
        resolve({ reply, request });
      });
      setTimeout(() => resolve({ reply, request }), waitMs);
    });
    request.on('error', reject);
  });
}

describe('lobby stream cap over HTTP', () => {
  it('answers 200 with a retry ping and ends past the cap, then admits a client once a slot is free', async () => {
    const holder = await read(300);
    expect(holder.reply.status).toBe(200);
    expect(holder.reply.contentType).toMatch(/text\/event-stream/);
    expect(holder.reply.ended).toBe(false);
    expect(holder.reply.body).not.toContain('retry:');

    const refused = await read(2_000);
    expect(refused.reply.status).toBe(200);
    expect(refused.reply.contentType).toMatch(/text\/event-stream/);
    expect(refused.reply.body).toContain('retry: 30000');
    expect(refused.reply.ended).toBe(true);

    holder.request.destroy();
    let admitted = false;
    for (let attempt = 0; attempt < 20 && !admitted; attempt++) {
      const next = await read(300);
      admitted = !next.reply.ended && !next.reply.body.includes('retry:');
      next.request.destroy();
      if (!admitted) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(admitted).toBe(true);
  });
});
