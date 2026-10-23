import 'reflect-metadata';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Controller, Get, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';
import { PrismaService } from './modules/database/prisma.service.js';
import { serveMobile, serveWeb } from './serve-web.js';
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

  it('GET /API/ping with Accept text/html does not return index.html', async () => {
    const res = await request(app.getHttpServer()).get('/API/ping').set('Accept', 'text/html');
    expect(res.text).not.toContain('id="root"');
  });

  it('HEAD /chu-san/yeu-cau with Accept text/html is 200 with an html content-type', async () => {
    const res = await request(app.getHttpServer()).head('/chu-san/yeu-cau').set('Accept', 'text/html').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  it('the Cache-Control of the page has no long max-age', async () => {
    const res = await request(app.getHttpServer()).get('/chu-san/yeu-cau').set('Accept', 'text/html').expect(200);
    const cacheControl = res.headers['cache-control'] ?? '';
    expect(cacheControl).not.toMatch(/max-age=[1-9]\d{4,}/);
  });
});

describe('serveMobile: the container serves the mobile app under /app/', () => {
  let app: NestExpressApplication;
  let webDir: string;
  let mobileDir: string;
  const testPhone = '0901234567';
  const testPassword = 'test-password';

  beforeAll(async () => {
    webDir = mkdtempSync(join(tmpdir(), 'monsport-web-'));
    writeFileSync(join(webDir, 'index.html'), '<!doctype html><div id="web-root"></div>');
    writeFileSync(join(webDir, 'app.js'), 'console.log("web")');

    mobileDir = mkdtempSync(join(tmpdir(), 'monsport-mobile-'));
    writeFileSync(join(mobileDir, 'index.html'), '<!doctype html><div id="mobile-root"></div>');
    mkdirSync(join(mobileDir, 'assets'), { recursive: true });
    writeFileSync(join(mobileDir, 'assets', 'main.js'), 'console.log("mobile")');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = setupApp(moduleRef.createNestApplication<NestExpressApplication>());
    serveMobile(app, mobileDir);
    serveWeb(app, webDir);
    await app.init();

    const db = app.get(PrismaService);
    await db.$executeRawUnsafe('TRUNCATE "Booking", "Court", "Venue", "User", "AuthThrottle" CASCADE');
    await db.user.create({
      data: { name: 'An', phone: testPhone, role: 'USER', passwordHash: await hash(testPassword) },
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('AC-17: container serves mobile under /app/ and web under /, with shared auth cookie', async () => {
    // 1. GET /app/lich-cua-toi with Accept: text/html -> 200 with index.html of apps/mobile, no long max-age
    const resPage = await request(app.getHttpServer()).get('/app/lich-cua-toi').set('Accept', 'text/html').expect(200);
    expect(resPage.text).toContain('id="mobile-root"');
    expect(resPage.text).not.toContain('id="web-root"');
    expect(resPage.headers['cache-control'] ?? '').not.toMatch(/max-age=[1-9]\d{4,}/);

    // 2. GET /app/ with Accept: text/html -> 200 with index.html of apps/mobile, no long max-age
    const resAppSlash = await request(app.getHttpServer()).get('/app/').set('Accept', 'text/html').expect(200);
    expect(resAppSlash.text).toContain('id="mobile-root"');
    expect(resAppSlash.headers['cache-control'] ?? '').not.toMatch(/max-age=[1-9]\d{4,}/);

    // 3. GET /app -> 301 to /app/
    const resRedirect = await request(app.getHttpServer()).get('/app').expect(301);
    expect(resRedirect.headers.location).toBe('/app/');

    // 4. GET /app/assets/<file>.js -> 200 JS
    const resJs = await request(app.getHttpServer()).get('/app/assets/main.js').expect(200);
    expect(resJs.text).toBe('console.log("mobile")');

    // 5. GET /app/missing.js -> 404
    await request(app.getHttpServer()).get('/app/missing.js').expect(404);

    // 6. GET /lich-cua-toi -> 200 with index.html of web
    const resWeb = await request(app.getHttpServer()).get('/lich-cua-toi').set('Accept', 'text/html').expect(200);
    expect(resWeb.text).toContain('id="web-root"');

    // 7. GET /api/health -> health unchanged (200, db up)
    const resHealth = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(resHealth.body.status).toBe('ok');

    // 8. POST /api/auth/login and GET /api/auth/me with cookie
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone: testPhone, password: testPassword })
      .expect(200);
    const cookieHeader = loginRes.headers['set-cookie'];
    const cookieList = Array.isArray(cookieHeader) ? cookieHeader : [String(cookieHeader ?? '')];
    const cookie = cookieList.find((c) => c.startsWith('session='));
    expect(cookie).toBeDefined();

    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie!)
      .expect(200);
    expect(meRes.body.name).toBe('An');
    expect(meRes.body.role).toBe('USER');
  });

  it('AC-19: without MOBILE_DIST, GET /app/ returns web index.html as before', async () => {
    const moduleRefNoMobile = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const appNoMobile = setupApp(moduleRefNoMobile.createNestApplication<NestExpressApplication>());
    serveWeb(appNoMobile, webDir);
    await appNoMobile.init();
    try {
      const res = await request(appNoMobile.getHttpServer()).get('/app/').set('Accept', 'text/html').expect(200);
      expect(res.text).toContain('id="web-root"');
      expect(res.text).not.toContain('id="mobile-root"');
    } finally {
      await appNoMobile.close();
    }
  });
});
