import 'reflect-metadata';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Controller, Get, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveWeb } from './serve-web.js';
import { setupApp } from './setup-app.js';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

@Module({ controllers: [PingController] })
class TestModule {}

describe('serveWeb: the container serves the built web app', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const dir = mkdtempSync(join(tmpdir(), 'monsport-web-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><div id="root"></div>');
    writeFileSync(join(dir, 'app.js'), 'console.log(1)');
    const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile();
    app = setupApp(moduleRef.createNestApplication<NestExpressApplication>());
    serveWeb(app, dir);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('a deep link of the web app, such as /chu-san/yeu-cau, answers index.html', async () => {
    const res = await request(app.getHttpServer()).get('/chu-san/yeu-cau').set('Accept', 'text/html').expect(200);
    expect(res.text).toContain('id="root"');
  });

  it('a file of the build is served as it is', async () => {
    const res = await request(app.getHttpServer()).get('/app.js').expect(200);
    expect(res.text).toBe('console.log(1)');
  });

  it('an API route still answers JSON, and an unknown API route is a JSON 404, not index.html', async () => {
    await request(app.getHttpServer()).get('/api/ping').expect(200, { ok: true });
    const res = await request(app.getHttpServer()).get('/api/nothing').set('Accept', 'text/html').expect(404);
    expect(res.text).not.toContain('id="root"');
  });

  it('a missing file that is not a page stays a 404', async () => {
    await request(app.getHttpServer()).get('/missing.js').set('Accept', '*/*').expect(404);
  });
});
