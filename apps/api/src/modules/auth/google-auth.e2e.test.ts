import 'reflect-metadata';
import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { vnDateString } from '@monsport/shared';
import * as jose from 'jose';
import * as client from 'openid-client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { assertOtpConfig } from '../otp/otp-config.js';
import { OTP_SENDER, type OtpSender } from '../otp/otp-sender.js';
import { OtpService } from '../otp/otp.service.js';
import { assertGoogleConfig, GOOGLE_CONFIG, GOOGLE_OIDC_CONFIGURATION } from './google.config.js';
import {
  cookieKey,
  cookieValue,
  GOOGLE_FLOW_COOKIE,
  GOOGLE_PENDING_COOKIE,
  GOOGLE_VERIFY_COOKIE,
  issueSession,
  issueSignedJson,
  readSignedJson,
  SESSION_COOKIE,
} from './session.js';

const at = (time: string) => new Date(`2026-10-17T${time}+07:00`);
let now = at('10:00:00');
const clock = { now: () => now };

const CLIENT_ID = 'test-google-client-id';
const CLIENT_SECRET = 'test-google-client-secret';
const REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';

let app: INestApplication;
let db: PrismaService;
let otpService: OtpService;
let privateKey: jose.CryptoKey;
let jwk: jose.JWK;
let mockOidcConfig: client.Configuration;
interface MockTokenPayload {
  sub: string;
  email?: string | null;
  email_verified?: boolean;
  name?: string;
  nonce?: string;
  aud?: string;
  exp?: string | number;
}

let nextIdTokenPayload: MockTokenPayload | null = null;
let tokenEndpointStatus = 200;

const fakeOtpSender: OtpSender = {
  send: vi.fn().mockResolvedValue(undefined),
};

function getCookie(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'];
  const headers = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  for (const h of headers) {
    const part = h.split(';')[0];
    const [k, ...rest] = part.split('=');
    if (k.trim() === name) return rest.join('=');
  }
  return undefined;
}

beforeAll(async () => {
  const pair = await jose.generateKeyPair('RS256');
  privateKey = pair.privateKey;
  jwk = await jose.exportJWK(pair.publicKey);
  jwk.kid = 'test-key-id';
  jwk.alg = 'RS256';
  jwk.use = 'sig';

  const serverMetadata: client.ServerMetadata = {
    issuer: 'https://accounts.google.com',
    authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_endpoint: 'https://oauth2.googleapis.com/token',
    jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
    response_types_supported: ['code'],
    id_token_signing_alg_values_supported: ['RS256'],
    subject_types_supported: ['public'],
  };

  mockOidcConfig = new client.Configuration(serverMetadata, CLIENT_ID, CLIENT_SECRET);
  client.allowInsecureRequests(mockOidcConfig);

  mockOidcConfig[client.customFetch] = async (url, options) => {
    const urlStr = url.toString();
    if (urlStr === 'https://oauth2.googleapis.com/token') {
      if (tokenEndpointStatus !== 200) {
        return new Response('Token error', { status: tokenEndpointStatus });
      }
      const nonce = (options?.body as any)?.toString();
      const signed = await makeIdToken(nextIdTokenPayload ?? { sub: 'g-default' });
      return new Response(
        JSON.stringify({
          access_token: 'mock-access-token',
          token_type: 'Bearer',
          id_token: signed,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    if (urlStr === 'https://www.googleapis.com/oauth2/v3/certs') {
      return new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not found', { status: 404 });
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Clock)
    .useValue(clock)
    .overrideProvider(OTP_SENDER)
    .useValue(fakeOtpSender)
    .overrideProvider(GOOGLE_CONFIG)
    .useValue({
      enabled: true,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
    })
    .overrideProvider(GOOGLE_OIDC_CONFIGURATION)
    .useValue(mockOidcConfig)
    .compile();

  app = setupApp(moduleRef.createNestApplication());
  await app.init();
  db = app.get(PrismaService);
  otpService = app.get(OtpService);
});

afterAll(async () => {
  await app?.close();
});

beforeEach(async () => {
  now = at('10:00:00');
  vi.restoreAllMocks();
  tokenEndpointStatus = 200;
  nextIdTokenPayload = null;
  fakeOtpSender.send = vi.fn().mockResolvedValue(undefined);
  await db.$executeRawUnsafe('TRUNCATE "PhoneOtp", "AuthThrottle", "DevOtpOutbox", "User" CASCADE');
});

async function makeIdToken(claims: {
  sub: string;
  email?: string | null;
  email_verified?: boolean;
  name?: string;
  nonce?: string;
  aud?: string;
  exp?: number | string;
}): Promise<string> {
  const builder = new jose.SignJWT({
    sub: claims.sub,
    email: claims.email === null ? undefined : (claims.email ?? 'lan@example.com'),
    email_verified: claims.email_verified ?? true,
    name: claims.name ?? 'Lan',
    nonce: claims.nonce ?? 'test-nonce',
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-id' })
    .setIssuer('https://accounts.google.com')
    .setAudience(claims.aud ?? CLIENT_ID)
    .setIssuedAt();

  if (claims.exp !== undefined) {
    if (typeof claims.exp === 'number') {
      builder.setExpirationTime(claims.exp);
    } else {
      builder.setExpirationTime(claims.exp);
    }
  } else {
    builder.setExpirationTime('1h');
  }
  return await builder.sign(privateKey);
}

const http = () => request(app.getHttpServer());

describe('Google Auth flow and OTP endpoints (F-004 AC-1 to AC-47)', () => {
  it('AC-1: Không có User với sub "g-111"', async () => {
    // 1. Google returns sub "g-111"
    nextIdTokenPayload = { sub: 'g-111', name: 'Lan', email: 'lan@example.com', email_verified: true, nonce: 'nonce-1' };
    const flowCookie = issueSignedJson(GOOGLE_FLOW_COOKIE, {
      typ: 'google_flow',
      state: 'state-1',
      nonce: 'nonce-1',
      codeVerifier: 'verifier-1',
      mode: 'login',
      exp: now.getTime() + 10 * 60_000,
    });

    const cbRes = await http()
      .get('/api/auth/google/callback?code=code-1&state=state-1')
      .set('Cookie', `google_flow=${flowCookie}`)
      .expect(302);

    expect(cbRes.headers.location).toBe('/?google=complete');
    const pendingCookie = getCookie(cbRes, GOOGLE_PENDING_COOKIE);
    expect(pendingCookie).toBeDefined();

    // 2. Request OTP for 0901112233
    const otpRes = await http()
      .post('/api/auth/google/otp')
      .set('Cookie', `google_pending=${pendingCookie}`)
      .send({ purpose: 'google_signup', phone: '0901112233', consent: true })
      .expect(200);

    expect(otpRes.body).toEqual({ resendAfter: 60 });
    expect(fakeOtpSender.send).toHaveBeenCalledTimes(1);
    const [, sentCode] = vi.mocked(fakeOtpSender.send).mock.calls[0];

    // 3. Complete registration
    const compRes = await http()
      .post('/api/auth/google/complete')
      .set('Cookie', `google_pending=${pendingCookie}`)
      .send({ name: 'Lan', phone: '0901112233', code: sentCode, consent: true })
      .expect(201);

    expect(compRes.body).toEqual({ id: expect.any(String), name: 'Lan', role: 'USER' });
    const sessionCookie = getCookie(compRes, SESSION_COOKIE);
    expect(sessionCookie).toBeDefined();

    const rawCookies = compRes.headers['set-cookie'];
    const cookieList = Array.isArray(rawCookies) ? rawCookies : typeof rawCookies === 'string' ? [rawCookies] : [];
    const clearedPending = cookieList.find((c) => c.startsWith('google_pending=;'));
    expect(clearedPending).toBeDefined();

    const storedUser = await db.user.findUniqueOrThrow({ where: { phone: '0901112233' } });
    expect(storedUser.googleSub).toBe('g-111');
    expect(storedUser.passwordHash).toBeNull();
    expect(storedUser.consentAt).toEqual(now);
    expect(storedUser.phoneVerifiedAt).toEqual(now);
  });

  it('AC-2: Lan có googleSub "g-111"', async () => {
    const lan = await db.user.create({
      data: {
        name: 'Lan',
        phone: '0901112233',
        googleSub: 'g-111',
        phoneVerifiedAt: now,
      },
    });

    nextIdTokenPayload = { sub: 'g-111', nonce: 'nonce-2' };
    const flowCookie = issueSignedJson(GOOGLE_FLOW_COOKIE, {
      typ: 'google_flow',
      state: 'state-2',
      nonce: 'nonce-2',
      codeVerifier: 'verifier-2',
      mode: 'login',
      exp: now.getTime() + 10 * 60_000,
    });

    const res = await http()
      .get('/api/auth/google/callback?code=code-2&state=state-2')
      .set('Cookie', `google_flow=${flowCookie}`)
      .expect(302);

    expect(res.headers.location).toBe('/');
    const sessionCookie = getCookie(res, SESSION_COOKIE);
    expect(sessionCookie).toBeDefined();

    const me = await http().get('/api/auth/me').set('Cookie', `session=${sessionCookie}`).expect(200);
    expect(me.body.id).toBe(lan.id);
  });

  it('AC-3: An có tài khoản 0901234567, chưa có googleSub', async () => {
    const an = await db.user.create({
      data: {
        name: 'An',
        phone: '0901234567',
        passwordHash: await hash('test-password'),
        googleSub: null,
      },
    });

    const startRes = await http().get('/api/auth/google/start').expect(302);
    const flowCookie = getCookie(startRes, GOOGLE_FLOW_COOKIE);
    expect(flowCookie).toBeDefined();

    const locationUrl = new URL(startRes.headers.location);
    const state = locationUrl.searchParams.get('state');
    const nonce = locationUrl.searchParams.get('nonce');

    nextIdTokenPayload = {
      sub: 'g-other',
      email: 'other@example.com',
      name: 'Other',
      email_verified: true,
      nonce: nonce!,
    };

    const cbRes = await http()
      .get(`/api/auth/google/callback?code=c-ac3&state=${state}`)
      .set('Cookie', `google_flow=${flowCookie}`)
      .expect(302);

    expect(cbRes.headers.location).toBe('/?google=complete');
    const pendingCookie = getCookie(cbRes, GOOGLE_PENDING_COOKIE);
    expect(pendingCookie).toBeDefined();

    const otpRes = await http()
      .post('/api/auth/google/otp')
      .set('Cookie', `google_pending=${pendingCookie}`)
      .send({ purpose: 'google_signup', phone: '0901234567', consent: true })
      .expect(409);

    expect(otpRes.body.message).toBe('Số này đã có tài khoản. Hãy đăng nhập bằng mật khẩu, rồi liên kết Google');

    const compRes = await http()
      .post('/api/auth/google/complete')
      .set('Cookie', `google_pending=${pendingCookie}`)
      .send({ name: 'Other', phone: '0901234567', code: '123456', consent: true })
      .expect(409);

    expect(compRes.body.message).toBe('Số này đã có tài khoản. Hãy đăng nhập bằng mật khẩu, rồi liên kết Google');

    const freshAn = await db.user.findUniqueOrThrow({ where: { id: an.id } });
    expect(freshAn.googleSub).toBeNull();
    expect(freshAn.name).toBe('An');
  });

  it('AC-4: An đã đăng nhập bằng mật khẩu', async () => {
    const an = await db.user.create({
      data: {
        name: 'An',
        phone: '0901234567',
        passwordHash: await hash('an-password'),
      },
    });
    const sessionCookie = issueSession(an.id, now);

    const linkRes = await http()
      .post('/api/auth/google/link-start')
      .set('Cookie', `session=${sessionCookie}`)
      .send({ password: 'an-password' })
      .expect(200);

    expect(linkRes.body.url).toContain('https://accounts.google.com');
    const flowCookie = getCookie(linkRes, GOOGLE_FLOW_COOKIE);
    expect(flowCookie).toBeDefined();

    const flowData = readSignedJson<any>(GOOGLE_FLOW_COOKIE, flowCookie, now)!;
    expect(flowData.mode).toBe('link');
    expect(flowData.userId).toBe(an.id);

    nextIdTokenPayload = { sub: 'g-222', nonce: flowData.nonce };
    const cbRes = await http()
      .get(`/api/auth/google/callback?code=c-link&state=${flowData.state}`)
      .set('Cookie', `google_flow=${flowCookie}; session=${sessionCookie}`)
      .expect(302);

    expect(cbRes.headers.location).toBe('/');
    const freshAn = await db.user.findUniqueOrThrow({ where: { id: an.id } });
    expect(freshAn.googleSub).toBe('g-222');
  });

  it('AC-5: An đã đăng nhập', async () => {
    const an = await db.user.create({
      data: {
        name: 'An',
        phone: '0901234567',
        passwordHash: await hash('an-password'),
      },
    });
    const sessionCookie = issueSession(an.id, now);

    await http()
      .post('/api/auth/google/link-start')
      .set('Cookie', `session=${sessionCookie}`)
      .send({ password: 'wrong-password' })
      .expect(401);
  });

  it('AC-6: An bắt đầu liên kết, rồi đăng nhập tài khoản Chi ở tab khác', async () => {
    const an = await db.user.create({
      data: { name: 'An', phone: '0901234567', passwordHash: await hash('an-password') },
    });
    const chi = await db.user.create({
      data: { name: 'Chi', phone: '0909998888', passwordHash: await hash('chi-password') },
    });

    const flowCookie = issueSignedJson(GOOGLE_FLOW_COOKIE, {
      typ: 'google_flow',
      state: 'state-an',
      nonce: 'nonce-an',
      codeVerifier: 'verifier-an',
      mode: 'link',
      userId: an.id,
      exp: now.getTime() + 10 * 60_000,
    });

    nextIdTokenPayload = { sub: 'g-222', nonce: 'nonce-an' };
    const chiSession = issueSession(chi.id, now);

    const cbRes = await http()
      .get('/api/auth/google/callback?code=c1&state=state-an')
      .set('Cookie', `google_flow=${flowCookie}; session=${chiSession}`)
      .expect(302);

    expect(cbRes.headers.location).toBe('/?google_error=session');

    const freshAn = await db.user.findUniqueOrThrow({ where: { id: an.id } });
    const freshChi = await db.user.findUniqueOrThrow({ where: { id: chi.id } });
    expect(freshAn.googleSub).toBeNull();
    expect(freshChi.googleSub).toBeNull();
  });

  it('AC-7: sub "g-222" thuộc An', async () => {
    await db.user.create({
      data: { name: 'An', phone: '0901234567', googleSub: 'g-222' },
    });
    const chi = await db.user.create({
      data: { name: 'Chi', phone: '0909998888', passwordHash: await hash('chi-password') },
    });

    const flowCookie = issueSignedJson(GOOGLE_FLOW_COOKIE, {
      typ: 'google_flow',
      state: 'state-chi',
      nonce: 'nonce-chi',
      codeVerifier: 'verifier-chi',
      mode: 'link',
      userId: chi.id,
      exp: now.getTime() + 10 * 60_000,
    });

    nextIdTokenPayload = { sub: 'g-222', nonce: 'nonce-chi' };
    const chiSession = issueSession(chi.id, now);

    const cbRes = await http()
      .get('/api/auth/google/callback?code=c1&state=state-chi')
      .set('Cookie', `google_flow=${flowCookie}; session=${chiSession}`)
      .expect(302);

    expect(cbRes.headers.location).toBe('/?google_error=taken');
    const freshChi = await db.user.findUniqueOrThrow({ where: { id: chi.id } });
    expect(freshChi.googleSub).toBeNull();
  });

  it('AC-8: Hai cookie google_pending cùng sub "g-111". Hai số 0901112233 và 0901112244, mỗi số có mã đúng của mình', async () => {
    const pendingCookie = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-111',
      email: 'lan@example.com',
      name: 'Lan',
      exp: now.getTime() + 30 * 60_000,
    });

    await otpService.issue('0901112233', 'google_signup');
    const [, code1] = vi.mocked(fakeOtpSender.send).mock.calls[0];

    await otpService.issue('0901112244', 'google_signup');
    const [, code2] = vi.mocked(fakeOtpSender.send).mock.calls[1];

    const [r1, r2] = await Promise.all([
      http()
        .post('/api/auth/google/complete')
        .set('Cookie', `google_pending=${pendingCookie}`)
        .send({ name: 'Lan 1', phone: '0901112233', code: code1, consent: true }),
      http()
        .post('/api/auth/google/complete')
        .set('Cookie', `google_pending=${pendingCookie}`)
        .send({ name: 'Lan 2', phone: '0901112244', code: code2, consent: true }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const losingPhone = r1.status === 409 ? '0901112233' : '0901112244';
    const losingCode = losingPhone === '0901112233' ? code1 : code2;

    // Mã của request thua vẫn dùng được (transaction rollback did not delete it)
    await db.$transaction(async (tx) => {
      await expect(otpService.consume(tx, losingPhone, 'google_signup', losingCode)).resolves.not.toThrow();
    });
  });

  it('AC-9: state của callback khác state trong cookie', async () => {
    const flowCookie = issueSignedJson(GOOGLE_FLOW_COOKIE, {
      typ: 'google_flow',
      state: 'expected-state',
      nonce: 'n1',
      codeVerifier: 'v1',
      mode: 'login',
      exp: now.getTime() + 10 * 60_000,
    });

    const res = await http()
      .get('/api/auth/google/callback?code=c1&state=wrong-state')
      .set('Cookie', `google_flow=${flowCookie}`)
      .expect(302);

    expect(res.headers.location).toBe('/?google_error=state');
    expect(getCookie(res, SESSION_COOKIE)).toBeUndefined();
  });

  it('AC-10: id_token có aud khác GOOGLE_CLIENT_ID, hoặc nonce sai, hoặc đã hết hạn', async () => {
    // 1. Wrong aud
    const flowCookieAud = issueSignedJson(GOOGLE_FLOW_COOKIE, {
      typ: 'google_flow',
      state: 'state-10-aud',
      nonce: 'nonce-10-aud',
      codeVerifier: 'verifier-10-aud',
      mode: 'login',
      exp: now.getTime() + 10 * 60_000,
    });
    nextIdTokenPayload = { sub: 'g-10-aud', aud: 'wrong-audience', nonce: 'nonce-10-aud' };
    const resAud = await http()
      .get('/api/auth/google/callback?code=c1&state=state-10-aud')
      .set('Cookie', `google_flow=${flowCookieAud}`)
      .expect(302);
    expect(resAud.headers.location).toBe('/?google_error=token');
    expect(getCookie(resAud, SESSION_COOKIE)).toBeUndefined();

    // 2. Wrong nonce
    const flowCookieNonce = issueSignedJson(GOOGLE_FLOW_COOKIE, {
      typ: 'google_flow',
      state: 'state-10-nonce',
      nonce: 'nonce-expected',
      codeVerifier: 'verifier-10-nonce',
      mode: 'login',
      exp: now.getTime() + 10 * 60_000,
    });
    nextIdTokenPayload = { sub: 'g-10-nonce', nonce: 'wrong-nonce' };
    const resNonce = await http()
      .get('/api/auth/google/callback?code=c2&state=state-10-nonce')
      .set('Cookie', `google_flow=${flowCookieNonce}`)
      .expect(302);
    expect(resNonce.headers.location).toBe('/?google_error=token');
    expect(getCookie(resNonce, SESSION_COOKIE)).toBeUndefined();

    // 3. Expired exp
    const flowCookieExp = issueSignedJson(GOOGLE_FLOW_COOKIE, {
      typ: 'google_flow',
      state: 'state-10-exp',
      nonce: 'nonce-10-exp',
      codeVerifier: 'verifier-10-exp',
      mode: 'login',
      exp: now.getTime() + 10 * 60_000,
    });
    nextIdTokenPayload = {
      sub: 'g-10-exp',
      nonce: 'nonce-10-exp',
      exp: Math.floor((now.getTime() - 60_000) / 1000),
    };
    const resExp = await http()
      .get('/api/auth/google/callback?code=c3&state=state-10-exp')
      .set('Cookie', `google_flow=${flowCookieExp}`)
      .expect(302);
    expect(resExp.headers.location).toBe('/?google_error=token');
    expect(getCookie(resExp, SESSION_COOKIE)).toBeUndefined();
  });

  it('AC-11: Google trả error=access_denied', async () => {
    const res = await http().get('/api/auth/google/callback?error=access_denied').expect(302);
    expect(res.headers.location).toBe('/?google_error=access_denied');
  });

  it('AC-12: Lan có googleSub "g-111" và bị khóa', async () => {
    await db.user.create({
      data: {
        name: 'Lan',
        phone: '0901112233',
        googleSub: 'g-111',
        lockedAt: now,
      },
    });

    const flowCookie = issueSignedJson(GOOGLE_FLOW_COOKIE, {
      typ: 'google_flow',
      state: 'state-12',
      nonce: 'nonce-12',
      codeVerifier: 'verifier-12',
      mode: 'login',
      exp: now.getTime() + 10 * 60_000,
    });

    nextIdTokenPayload = { sub: 'g-111', nonce: 'nonce-12' };

    const res = await http()
      .get('/api/auth/google/callback?code=c1&state=state-12')
      .set('Cookie', `google_flow=${flowCookie}`)
      .expect(302);

    expect(res.headers.location).toBe('/?google_error=locked');
  });

  it('AC-13: id_token có email_verified = false', async () => {
    const flowCookie = issueSignedJson(GOOGLE_FLOW_COOKIE, {
      typ: 'google_flow',
      state: 'state-13',
      nonce: 'nonce-13',
      codeVerifier: 'verifier-13',
      mode: 'login',
      exp: now.getTime() + 10 * 60_000,
    });

    nextIdTokenPayload = { sub: 'g-13', email: 'lan@example.com', email_verified: false, nonce: 'nonce-13' };

    const cbRes = await http()
      .get('/api/auth/google/callback?code=c1&state=state-13')
      .set('Cookie', `google_flow=${flowCookie}`)
      .expect(302);

    const pendingCookie = getCookie(cbRes, GOOGLE_PENDING_COOKIE)!;

    await otpService.issue('0901112233', 'google_signup');
    const [, code] = vi.mocked(fakeOtpSender.send).mock.calls[0];

    await http()
      .post('/api/auth/google/complete')
      .set('Cookie', `google_pending=${pendingCookie}`)
      .send({ name: 'Lan', phone: '0901112233', code, consent: true })
      .expect(201);

    const user = await db.user.findUniqueOrThrow({ where: { phone: '0901112233' } });
    expect(user.email).toBeNull();
  });

  it('AC-14: Cookie google_pending hết hạn hoặc bị sửa', async () => {
    const expiredPending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-14',
      email: 'lan@example.com',
      name: 'Lan',
      exp: now.getTime() - 1000,
    });

    await http()
      .post('/api/auth/google/complete')
      .set('Cookie', `google_pending=${expiredPending}`)
      .send({ name: 'Lan', phone: '0901112233', code: '123456', consent: true })
      .expect(400);

    await http()
      .post('/api/auth/google/complete')
      .set('Cookie', 'google_pending=tampered.signature')
      .send({ name: 'Lan', phone: '0901112233', code: '123456', consent: true })
      .expect(400);

    expect(await db.user.count()).toBe(0);
  });

  it('AC-15: Lan chỉ có Google, không có mật khẩu', async () => {
    await db.user.create({
      data: {
        name: 'Lan',
        phone: '0901112233',
        googleSub: 'g-111',
        passwordHash: null,
      },
    });

    const res = await http()
      .post('/api/auth/login')
      .send({ phone: '0901112233', password: 'any-password' })
      .expect(401);

    expect(res.body.message).toBe('Sai số điện thoại hoặc mật khẩu');
  });

  it('AC-16: Lan chỉ có Google', async () => {
    const lan = await db.user.create({
      data: {
        name: 'Lan',
        phone: '0901112233',
        googleSub: 'g-111',
        passwordHash: null,
      },
    });
    const session = issueSession(lan.id, now);

    const res = await http()
      .post('/api/auth/google/unlink')
      .set('Cookie', `session=${session}`)
      .expect(400);

    expect(res.body.message).toBe('Hãy đặt mật khẩu trước khi gỡ Google');
  });

  it('AC-17: An có mật khẩu và googleSub "g-222"', async () => {
    const an = await db.user.create({
      data: {
        name: 'An',
        phone: '0901234567',
        passwordHash: await hash('password'),
        googleSub: 'g-222',
      },
    });
    const session = issueSession(an.id, now);

    await http()
      .post('/api/auth/google/unlink')
      .set('Cookie', `session=${session}`)
      .expect(200);

    const freshAn = await db.user.findUniqueOrThrow({ where: { id: an.id } });
    expect(freshAn.googleSub).toBeNull();
  });

  it('AC-18: Email Google của Chi trùng email đã lưu của An', async () => {
    await db.user.create({
      data: {
        name: 'An',
        phone: '0901234567',
        email: 'an@example.com',
      },
    });

    const flowCookie = issueSignedJson(GOOGLE_FLOW_COOKIE, {
      typ: 'google_flow',
      state: 'state-chi',
      nonce: 'nonce-chi',
      codeVerifier: 'verifier-chi',
      mode: 'login',
      exp: now.getTime() + 10 * 60_000,
    });

    nextIdTokenPayload = { sub: 'g-chi', email: 'an@example.com', email_verified: true, nonce: 'nonce-chi' };

    const res = await http()
      .get('/api/auth/google/callback?code=c1&state=state-chi')
      .set('Cookie', `google_flow=${flowCookie}`)
      .expect(302);

    expect(res.headers.location).toBe('/?google=complete');
    const an = await db.user.findUniqueOrThrow({ where: { phone: '0901234567' } });
    expect(an.googleSub).toBeNull();
  });

  it('AC-19: GOOGLE_CLIENT_ID không có trong môi trường', async () => {
    // Test disabled module behavior
    const disabledModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GOOGLE_CONFIG)
      .useValue({ enabled: false, clientId: '', clientSecret: '', redirectUri: '' })
      .overrideProvider(GOOGLE_OIDC_CONFIGURATION)
      .useValue(null)
      .compile();

    const disabledApp = setupApp(disabledModule.createNestApplication());
    await disabledApp.init();

    const dHttp = () => request(disabledApp.getHttpServer());

    const provRes = await dHttp().get('/api/auth/providers').expect(200);
    expect(provRes.body).toEqual({ google: false });

    await dHttp().get('/api/auth/google/start').expect(404);
    await dHttp().post('/api/auth/google/link-start').expect(404);
    await dHttp().get('/api/auth/google/callback').expect(404);
    await dHttp().get('/api/auth/google/pending').expect(404);
    await dHttp().post('/api/auth/google/otp').expect(404);
    await dHttp().post('/api/auth/google/complete').expect(404);
    await dHttp().post('/api/auth/google/verify').expect(404);
    await dHttp().post('/api/auth/google/unlink').expect(404);

    await disabledApp.close();
  });

  it('discovery failure redirects /google/start to /?google_error=config and returns 503 for link-start', async () => {
    const origFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('Discovery unreachable'));
    try {
      const discModule = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(Clock)
        .useValue(clock)
        .overrideProvider(OTP_SENDER)
        .useValue(fakeOtpSender)
        .overrideProvider(GOOGLE_CONFIG)
        .useValue({
          enabled: true,
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          redirectUri: REDIRECT_URI,
        })
        .compile();

      const discApp = setupApp(discModule.createNestApplication());
      await discApp.init();

      const dHttp = () => request(discApp.getHttpServer());

      const startRes = await dHttp().get('/api/auth/google/start').expect(302);
      expect(startRes.headers.location).toBe('/?google_error=config');

      const user = await db.user.create({
        data: {
          name: 'DiscUser',
          phone: '0909998877',
          passwordHash: await hash('password123'),
        },
      });
      const sessionCookie = issueSession(user.id, now);

      await dHttp()
        .post('/api/auth/google/link-start')
        .set('Cookie', `session=${sessionCookie}`)
        .send({ password: 'password123' })
        .expect(503);

      await discApp.close();
    } finally {
      global.fetch = origFetch;
    }
  });

  it('AC-20: Có một trong ba biến GOOGLE_*, thiếu GOOGLE_CLIENT_SECRET hoặc GOOGLE_REDIRECT_URI', () => {
    expect(() => assertGoogleConfig({ GOOGLE_CLIENT_ID: 'id' })).toThrow();
    expect(() => assertGoogleConfig({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'sec' })).toThrow();
    expect(() => assertGoogleConfig({ GOOGLE_CLIENT_ID: 'id', GOOGLE_REDIRECT_URI: 'uri' })).toThrow();
    expect(() =>
      assertGoogleConfig({
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: 'sec',
        GOOGLE_REDIRECT_URI: 'uri',
      }),
    ).not.toThrow();
    expect(() => assertGoogleConfig({})).not.toThrow();
  });

  it('AC-21: Một giá trị google_pending hoặc google_flow hợp lệ', async () => {
    const validPending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-111',
      email: 'lan@example.com',
      name: 'Lan',
      exp: now.getTime() + 30 * 60_000,
    });

    await http().get('/api/auth/me').set('Cookie', `session=${validPending}`).expect(401);

    const validFlow = issueSignedJson(GOOGLE_FLOW_COOKIE, {
      typ: 'google_flow',
      state: 's1',
      nonce: 'n1',
      codeVerifier: 'v1',
      mode: 'login',
      exp: now.getTime() + 10 * 60_000,
    });

    await http().get('/api/auth/me').set('Cookie', `session=${validFlow}`).expect(401);
  });

  it('AC-22: An có googleSub "g-222"', async () => {
    const an = await db.user.create({
      data: {
        name: 'An',
        phone: '0901234567',
        passwordHash: await hash('password'),
        googleSub: 'g-222',
      },
    });
    const session = issueSession(an.id, now);

    const flowCookie = issueSignedJson(GOOGLE_FLOW_COOKIE, {
      typ: 'google_flow',
      state: 'state-an',
      nonce: 'nonce-an',
      codeVerifier: 'verifier-an',
      mode: 'link',
      userId: an.id,
      exp: now.getTime() + 10 * 60_000,
    });

    nextIdTokenPayload = { sub: 'g-333', nonce: 'nonce-an' };

    const res = await http()
      .get('/api/auth/google/callback?code=c1&state=state-an')
      .set('Cookie', `google_flow=${flowCookie}; session=${session}`)
      .expect(302);

    expect(res.headers.location).toBe('/?google_error=taken');
    const freshAn = await db.user.findUniqueOrThrow({ where: { id: an.id } });
    expect(freshAn.googleSub).toBe('g-222');
  });

  it('AC-23: Hai request liên kết cùng sub "g-444" từ hai tài khoản gửi cùng lúc', async () => {
    const u1 = await db.user.create({ data: { name: 'U1', phone: '0901000001', passwordHash: await hash('p1') } });
    const u2 = await db.user.create({ data: { name: 'U2', phone: '0901000002', passwordHash: await hash('p2') } });

    const s1 = issueSession(u1.id, now);
    const s2 = issueSession(u2.id, now);

    const f1 = issueSignedJson(GOOGLE_FLOW_COOKIE, {
      typ: 'google_flow',
      state: 's1',
      nonce: 'n1',
      codeVerifier: 'v1',
      mode: 'link',
      userId: u1.id,
      exp: now.getTime() + 10 * 60_000,
    });
    const f2 = issueSignedJson(GOOGLE_FLOW_COOKIE, {
      typ: 'google_flow',
      state: 's2',
      nonce: 'n1',
      codeVerifier: 'v1',
      mode: 'link',
      userId: u2.id,
      exp: now.getTime() + 10 * 60_000,
    });

    nextIdTokenPayload = { sub: 'g-444', nonce: 'n1' };

    const [r1, r2] = await Promise.all([
      http().get('/api/auth/google/callback?code=c1&state=s1').set('Cookie', `google_flow=${f1}; session=${s1}`),
      http().get('/api/auth/google/callback?code=c1&state=s2').set('Cookie', `google_flow=${f2}; session=${s2}`),
    ]);

    const locations = [r1.headers.location, r2.headers.location].sort();
    expect(locations).toEqual(['/', '/?google_error=taken']);

    const usersWithSub = await db.user.findMany({ where: { googleSub: 'g-444' } });
    expect(usersWithSub).toHaveLength(1);
  });

  it('AC-24: Hai cookie google_pending với sub "g-111" và "g-555". Số 0901112233 có một mã đúng', async () => {
    const p1 = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-111',
      email: 'lan1@example.com',
      name: 'Lan 1',
      exp: now.getTime() + 30 * 60_000,
    });
    const p2 = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-555',
      email: 'lan2@example.com',
      name: 'Lan 2',
      exp: now.getTime() + 30 * 60_000,
    });

    await otpService.issue('0901112233', 'google_signup');
    const [, code] = vi.mocked(fakeOtpSender.send).mock.calls[0];

    const [r1, r2] = await Promise.all([
      http()
        .post('/api/auth/google/complete')
        .set('Cookie', `google_pending=${p1}`)
        .send({ name: 'Lan 1', phone: '0901112233', code, consent: true }),
      http()
        .post('/api/auth/google/complete')
        .set('Cookie', `google_pending=${p2}`)
        .send({ name: 'Lan 2', phone: '0901112233', code, consent: true }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 400]);

    const failRes = r1.status === 400 ? r1 : r2;
    expect(failRes.body.message).toBe('Mã đã hết hạn. Hãy xin mã mới');
  });

  it('AC-25: Lan có cookie google_pending', async () => {
    const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-111',
      email: 'lan@example.com',
      name: 'Lan',
      exp: now.getTime() + 30 * 60_000,
    });

    const res = await http()
      .post('/api/auth/google/otp')
      .set('Cookie', `google_pending=${pending}`)
      .send({ purpose: 'google_signup', phone: '0901112233', consent: true })
      .expect(200);

    expect(res.body).toEqual({ resendAfter: 60 });
    expect(fakeOtpSender.send).toHaveBeenCalledTimes(1);
    const [phone, code, channel] = vi.mocked(fakeOtpSender.send).mock.calls[0];
    expect(phone).toBe('0901112233');
    expect(code).toMatch(/^\d{6}$/);
    expect(channel).toBe('sms');

    const row = await db.phoneOtp.findFirstOrThrow();
    expect(row.codeHash).toBeDefined();
    expect(row.codeHash).not.toBe(code);
    expect(JSON.stringify(row)).not.toContain(code);
  });

  it('AC-26: Lan có mã đúng 123456', async () => {
    const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-111',
      email: 'lan@example.com',
      name: 'Lan',
      exp: now.getTime() + 30 * 60_000,
    });

    fakeOtpSender.send = vi.fn().mockImplementation(async (phone, code) => {
      // simulate fixed code
    });

    await otpService.issue('0901112233', 'google_signup');
    // Ensure row has the hash of 123456
    const { hashOtpCode } = await import('../otp/otp.service.js');
    await db.phoneOtp.updateMany({
      where: { purpose: 'google_signup' },
      data: { codeHash: hashOtpCode('0901112233', '123456') },
    });

    const res = await http()
      .post('/api/auth/google/complete')
      .set('Cookie', `google_pending=${pending}`)
      .send({ name: 'Lan', phone: '0901112233', code: '654321', consent: true })
      .expect(400);

    expect(res.body.message).toBe('Mã không đúng');
    expect(await db.user.count()).toBe(0);

    const otpRow = await db.phoneOtp.findFirstOrThrow();
    expect(otpRow.attempts).toBe(1);
  });

  it('AC-27: Lan đã nhập sai 4 lần', async () => {
    const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-111',
      email: 'lan@example.com',
      name: 'Lan',
      exp: now.getTime() + 30 * 60_000,
    });

    await otpService.issue('0901112233', 'google_signup');
    const { hashOtpCode } = await import('../otp/otp.service.js');
    await db.phoneOtp.updateMany({
      where: { purpose: 'google_signup' },
      data: { codeHash: hashOtpCode('0901112233', '123456'), attempts: 4 },
    });

    // 5th wrong attempt
    const r5 = await http()
      .post('/api/auth/google/complete')
      .set('Cookie', `google_pending=${pending}`)
      .send({ name: 'Lan', phone: '0901112233', code: '654321', consent: true })
      .expect(400);

    expect(r5.body.message).toBe('Mã không đúng');
    expect(await db.phoneOtp.count()).toBe(0);

    // subsequent attempt with right code
    const rNext = await http()
      .post('/api/auth/google/complete')
      .set('Cookie', `google_pending=${pending}`)
      .send({ name: 'Lan', phone: '0901112233', code: '123456', consent: true })
      .expect(400);

    expect(rNext.body.message).toBe('Mã đã hết hạn. Hãy xin mã mới');
  });

  it('AC-28: Mã được tạo lúc 10:00:00', async () => {
    const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-111',
      email: 'lan@example.com',
      name: 'Lan',
      exp: now.getTime() + 30 * 60_000,
    });

    now = at('10:00:00');
    await otpService.issue('0901112233', 'google_signup');
    const [, code] = vi.mocked(fakeOtpSender.send).mock.calls[0];

    now = at('10:05:01');
    const res = await http()
      .post('/api/auth/google/complete')
      .set('Cookie', `google_pending=${pending}`)
      .send({ name: 'Lan', phone: '0901112233', code, consent: true })
      .expect(400);

    expect(res.body.message).toBe('Mã đã hết hạn. Hãy xin mã mới');
  });

  it('AC-29: Lan xin mã lúc 10:00:00', async () => {
    const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-111',
      email: 'lan@example.com',
      name: 'Lan',
      exp: now.getTime() + 30 * 60_000,
    });

    now = at('10:00:00');
    await http()
      .post('/api/auth/google/otp')
      .set('Cookie', `google_pending=${pending}`)
      .send({ purpose: 'google_signup', phone: '0901112233', consent: true })
      .expect(200);
    const [, code1] = vi.mocked(fakeOtpSender.send).mock.calls[0];

    now = at('10:00:30');
    await http()
      .post('/api/auth/google/otp')
      .set('Cookie', `google_pending=${pending}`)
      .send({ purpose: 'google_signup', phone: '0901112233', consent: true })
      .expect(429);

    now = at('10:01:01');
    await http()
      .post('/api/auth/google/otp')
      .set('Cookie', `google_pending=${pending}`)
      .send({ purpose: 'google_signup', phone: '0901112233', consent: true })
      .expect(200);

    // Old code no longer usable
    await http()
      .post('/api/auth/google/complete')
      .set('Cookie', `google_pending=${pending}`)
      .send({ name: 'Lan', phone: '0901112233', code: code1, consent: true })
      .expect(400);
  });

  it('AC-30: Số 0901112233 đã nhận 5 mã trong giờ này', async () => {
    for (let i = 0; i < 5; i++) {
      now = new Date(at('10:00:00').getTime() + i * 65_000);
      const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
        typ: 'google_pending',
        sub: `g-sub-${i}`,
        email: `lan${i}@example.com`,
        name: `Lan ${i}`,
        exp: now.getTime() + 60 * 60_000,
      });
      await http()
        .post('/api/auth/google/otp')
        .set('X-Forwarded-For', `198.51.100.${i + 1}`)
        .set('Cookie', `google_pending=${pending}`)
        .send({ purpose: 'google_signup', phone: '0901112233', consent: true })
        .expect(200);
    }
    expect(fakeOtpSender.send).toHaveBeenCalledTimes(5);

    now = new Date(at('10:00:00').getTime() + 5 * 65_000);
    const pending6 = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-sub-5',
      email: 'lan5@example.com',
      name: 'Lan 5',
      exp: now.getTime() + 60 * 60_000,
    });
    await http()
      .post('/api/auth/google/otp')
      .set('X-Forwarded-For', '198.51.100.6')
      .set('Cookie', `google_pending=${pending6}`)
      .send({ purpose: 'google_signup', phone: '0901112233', consent: true })
      .expect(429);

    expect(fakeOtpSender.send).toHaveBeenCalledTimes(5);
  });

  it('AC-31: Hai request "Hoàn tất đăng ký" cùng sub "g-111", cùng số, cùng mã đúng, gửi cùng lúc', async () => {
    const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-111',
      email: 'lan@example.com',
      name: 'Lan',
      exp: now.getTime() + 30 * 60_000,
    });

    await otpService.issue('0901112233', 'google_signup');
    const [, code] = vi.mocked(fakeOtpSender.send).mock.calls[0];

    const [r1, r2] = await Promise.all([
      http()
        .post('/api/auth/google/complete')
        .set('Cookie', `google_pending=${pending}`)
        .send({ name: 'Lan', phone: '0901112233', code, consent: true }),
      http()
        .post('/api/auth/google/complete')
        .set('Cookie', `google_pending=${pending}`)
        .send({ name: 'Lan', phone: '0901112233', code, consent: true }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 400]);

    const failRes = r1.status === 400 ? r1 : r2;
    expect(failRes.body.message).toBe('Mã đã hết hạn. Hãy xin mã mới');
  });

  it('AC-32: Số 0901234567 đã có tài khoản của An', async () => {
    await db.user.create({
      data: { name: 'An', phone: '0901234567' },
    });

    const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-pending',
      email: 'p@example.com',
      name: 'P',
      exp: now.getTime() + 30 * 60_000,
    });

    await http()
      .post('/api/auth/google/otp')
      .set('Cookie', `google_pending=${pending}`)
      .send({ purpose: 'google_signup', phone: '0901234567', consent: true })
      .expect(409);

    expect(fakeOtpSender.send).not.toHaveBeenCalled();
  });

  it('AC-33: OtpSender.send ném lỗi', async () => {
    fakeOtpSender.send = vi.fn().mockRejectedValue(new Error('Network error'));

    const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-111',
      email: 'lan@example.com',
      name: 'Lan',
      exp: now.getTime() + 30 * 60_000,
    });

    const res = await http()
      .post('/api/auth/google/otp')
      .set('Cookie', `google_pending=${pending}`)
      .send({ purpose: 'google_signup', phone: '0901112233', consent: true })
      .expect(503);

    expect(res.body.message).toBe('Không gửi được mã. Thử lại sau');
    expect(await db.phoneOtp.count()).toBe(0);
  });

  it('AC-34: NODE_ENV = production và OTP_PROVIDER = dev', () => {
    expect(() => assertOtpConfig({ NODE_ENV: 'production', OTP_PROVIDER: 'dev' })).toThrow(
      'OTP_PROVIDER must not be dev in production.',
    );
  });

  it('AC-35: Lan không có cookie google_pending', async () => {
    await http()
      .post('/api/auth/google/otp')
      .send({ purpose: 'google_signup', phone: '0901112233', consent: true })
      .expect(400);

    expect(fakeOtpSender.send).not.toHaveBeenCalled();
  });

  it('AC-36: Số 0901112233 có mã đúng 123456', async () => {
    const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-111',
      email: 'lan@example.com',
      name: 'Lan',
      exp: now.getTime() + 30 * 60_000,
    });

    await otpService.issue('0901112233', 'google_signup');
    const { hashOtpCode } = await import('../otp/otp.service.js');
    await db.phoneOtp.updateMany({
      where: { purpose: 'google_signup' },
      data: { codeHash: hashOtpCode('0901112233', '123456') },
    });

    // 20 requests with 20 wrong codes concurrently
    const wrongCodes = Array.from({ length: 20 }, (_, i) => (i + 1).toString().padStart(6, '0'));
    await Promise.all(
      wrongCodes.map((code) =>
        http()
          .post('/api/auth/google/complete')
          .set('Cookie', `google_pending=${pending}`)
          .send({ name: 'Lan', phone: '0901112233', code, consent: true }),
      ),
    );

    // attempts does not exceed 5: since 5th wrong attempt deletes the code, row is deleted
    const count = await db.phoneOtp.count();
    expect(count).toBe(0);

    // Request with correct 123456
    const rightRes = await http()
      .post('/api/auth/google/complete')
      .set('Cookie', `google_pending=${pending}`)
      .send({ name: 'Lan', phone: '0901112233', code: '123456', consent: true })
      .expect(400);

    expect(rightRes.body.message).toBe('Mã đã hết hạn. Hãy xin mã mới');
  });

  it('AC-37: Lan có cookie google_pending', async () => {
    const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-111',
      email: 'lan@example.com',
      name: 'Lan',
      exp: now.getTime() + 30 * 60_000,
    });

    const [r1, r2] = await Promise.all([
      http()
        .post('/api/auth/google/otp')
        .set('Cookie', `google_pending=${pending}`)
        .send({ purpose: 'google_signup', phone: '0901112233', consent: true }),
      http()
        .post('/api/auth/google/otp')
        .set('Cookie', `google_pending=${pending}`)
        .send({ purpose: 'google_signup', phone: '0901112233', consent: true }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 429]);
    expect(fakeOtpSender.send).toHaveBeenCalledTimes(1);
  });

  it('AC-38: IP 203.0.113.7 đã gửi 10 request /otp trong giờ này, với 10 cookie khác sub', async () => {
    const ip = '203.0.113.7';

    for (let i = 1; i <= 10; i++) {
      const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
        typ: 'google_pending',
        sub: `g-${i}`,
        email: `u${i}@example.com`,
        name: `U${i}`,
        exp: now.getTime() + 30 * 60_000,
      });

      await http()
        .post('/api/auth/google/otp')
        .set('X-Forwarded-For', ip)
        .set('Cookie', `google_pending=${pending}`)
        .send({ purpose: 'google_signup', phone: `09011100${i.toString().padStart(2, '0')}`, consent: true })
        .expect(200);
    }
    expect(fakeOtpSender.send).toHaveBeenCalledTimes(10);

    const pending11 = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-11',
      email: 'u11@example.com',
      name: 'U11',
      exp: now.getTime() + 30 * 60_000,
    });

    const res = await http()
      .post('/api/auth/google/otp')
      .set('X-Forwarded-For', ip)
      .set('Cookie', `google_pending=${pending11}`)
      .send({ purpose: 'google_signup', phone: '0901110099', consent: true })
      .expect(429);

    expect(res.headers['retry-after']).toBeDefined();
    expect(typeof res.body.retryAfter).toBe('number');
    expect(res.body.retryAfter).toBeGreaterThan(0);
    expect(fakeOtpSender.send).toHaveBeenCalledTimes(10);
  });

  it('AC-39: Cookie có sub "g-111" đã gửi 5 request /otp trong giờ này, cho 5 số khác nhau', async () => {
    const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-111',
      email: 'lan@example.com',
      name: 'Lan',
      exp: now.getTime() + 30 * 60_000,
    });

    for (let i = 1; i <= 5; i++) {
      await http()
        .post('/api/auth/google/otp')
        .set('X-Forwarded-For', `203.0.113.${10 + i}`)
        .set('Cookie', `google_pending=${pending}`)
        .send({ purpose: 'google_signup', phone: `090111000${i}`, consent: true })
        .expect(200);
    }
    expect(fakeOtpSender.send).toHaveBeenCalledTimes(5);

    const res = await http()
      .post('/api/auth/google/otp')
      .set('X-Forwarded-For', '203.0.113.99')
      .set('Cookie', `google_pending=${pending}`)
      .send({ purpose: 'google_signup', phone: '0901110006', consent: true })
      .expect(429);

    expect(res.headers['retry-after']).toBeDefined();
    expect(typeof res.body.retryAfter).toBe('number');
    expect(res.body.retryAfter).toBeGreaterThan(0);
    expect(fakeOtpSender.send).toHaveBeenCalledTimes(5);
  });

  it('AC-40: IP 203.0.113.8 đã gửi 9 request /otp, mỗi request cho một số đã có tài khoản và nhận 409', async () => {
    const ip = '203.0.113.8';
    await db.user.create({ data: { name: 'An', phone: '0901234567' } });

    const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-test-40',
      email: 'test@example.com',
      name: 'Test',
      exp: now.getTime() + 60 * 60_000,
    });

    for (let i = 1; i <= 9; i++) {
      const p = issueSignedJson(GOOGLE_PENDING_COOKIE, {
        typ: 'google_pending',
        sub: `g-sub-${i}`,
        email: 't@example.com',
        name: 'T',
        exp: now.getTime() + 60 * 60_000,
      });
      await http()
        .post('/api/auth/google/otp')
        .set('X-Forwarded-For', ip)
        .set('Cookie', `google_pending=${p}`)
        .send({ purpose: 'google_signup', phone: '0901234567', consent: true })
        .expect(409);
    }

    // 10th request
    const p10 = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-sub-10',
      email: 't@example.com',
      name: 'T',
      exp: now.getTime() + 60 * 60_000,
    });
    await http()
      .post('/api/auth/google/otp')
      .set('X-Forwarded-For', ip)
      .set('Cookie', `google_pending=${p10}`)
      .send({ purpose: 'google_signup', phone: '0901234567', consent: true })
      .expect(409);

    // 11th request
    const p11 = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-sub-11',
      email: 't@example.com',
      name: 'T',
      exp: now.getTime() + 60 * 60_000,
    });
    await http()
      .post('/api/auth/google/otp')
      .set('X-Forwarded-For', ip)
      .set('Cookie', `google_pending=${p11}`)
      .send({ purpose: 'google_signup', phone: '0901234567', consent: true })
      .expect(429);
  });

  it('AC-41: Lan có cookie google_pending', async () => {
    const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-111',
      email: 'lan@example.com',
      name: 'Lan',
      exp: now.getTime() + 30 * 60_000,
    });

    await http()
      .post('/api/auth/google/otp')
      .set('Cookie', `google_pending=${pending}`)
      .send({ purpose: 'google_signup', phone: '0901112233', consent: false })
      .expect(400);

    expect(fakeOtpSender.send).not.toHaveBeenCalled();
  });

  it('AC-42: An có mật khẩu, phoneVerifiedAt = null, đã liên kết sub "g-222"', async () => {
    const an = await db.user.create({
      data: {
        name: 'An',
        phone: '0901234567',
        passwordHash: await hash('password'),
        phoneVerifiedAt: null,
        googleSub: 'g-222',
      },
    });

    const flowCookie = issueSignedJson(GOOGLE_FLOW_COOKIE, {
      typ: 'google_flow',
      state: 'state-an',
      nonce: 'nonce-an',
      codeVerifier: 'verifier-an',
      mode: 'login',
      exp: now.getTime() + 10 * 60_000,
    });

    nextIdTokenPayload = { sub: 'g-222', nonce: 'nonce-an' };

    const cbRes = await http()
      .get('/api/auth/google/callback?code=c1&state=state-an')
      .set('Cookie', `google_flow=${flowCookie}`)
      .expect(302);

    expect(cbRes.headers.location).toBe('/?google=verify');
    expect(getCookie(cbRes, SESSION_COOKIE)).toBeUndefined();
    const verifyCookie = getCookie(cbRes, GOOGLE_VERIFY_COOKIE)!;
    expect(verifyCookie).toBeDefined();

    // Xin mã (google_verify)
    await http()
      .post('/api/auth/google/otp')
      .set('Cookie', `google_verify=${verifyCookie}`)
      .send({ purpose: 'google_verify' })
      .expect(200);

    expect(fakeOtpSender.send).toHaveBeenCalledTimes(1);
    const [phone, code] = vi.mocked(fakeOtpSender.send).mock.calls[0];
    expect(phone).toBe('0901234567');

    // Nhập mã đúng
    const verifyRes = await http()
      .post('/api/auth/google/verify')
      .set('Cookie', `google_verify=${verifyCookie}`)
      .send({ code })
      .expect(200);

    expect(verifyRes.body).toEqual({ id: an.id, name: 'An', role: 'USER' });
    const sessionCookie = getCookie(verifyRes, SESSION_COOKIE);
    expect(sessionCookie).toBeDefined();

    const freshAn = await db.user.findUniqueOrThrow({ where: { id: an.id } });
    expect(freshAn.phoneVerifiedAt).toEqual(now);

    // Lần đăng nhập Google sau không hỏi mã
    const flowCookie2 = issueSignedJson(GOOGLE_FLOW_COOKIE, {
      typ: 'google_flow',
      state: 'state-an2',
      nonce: 'nonce-an2',
      codeVerifier: 'verifier-an2',
      mode: 'login',
      exp: now.getTime() + 10 * 60_000,
    });
    nextIdTokenPayload = { sub: 'g-222', nonce: 'nonce-an2' };

    const cbRes2 = await http()
      .get('/api/auth/google/callback?code=c2&state=state-an2')
      .set('Cookie', `google_flow=${flowCookie2}`)
      .expect(302);

    expect(cbRes2.headers.location).toBe('/');
    expect(getCookie(cbRes2, SESSION_COOKIE)).toBeDefined();
    expect(getCookie(cbRes2, GOOGLE_VERIFY_COOKIE)).toBeUndefined();
  });

  it('AC-43: Server đã gửi 200 tin hôm nay', async () => {
    const warnSpy = vi.spyOn(Logger.prototype, 'warn');
    const dayKey = `otp-day:${vnDateString(now)}`;
    await db.authThrottle.create({
      data: {
        key: dayKey,
        count: 200,
        windowStart: now,
      },
    });

    const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-111',
      email: 'lan@example.com',
      name: 'Lan',
      exp: now.getTime() + 30 * 60_000,
    });

    const res = await http()
      .post('/api/auth/google/otp')
      .set('Cookie', `google_pending=${pending}`)
      .send({ purpose: 'google_signup', phone: '0901112233', consent: true })
      .expect(503);

    expect(res.body.message).toBe('Không gửi được mã. Thử lại sau');
    expect(fakeOtpSender.send).not.toHaveBeenCalled();

    expect(warnSpy).toHaveBeenCalledWith('otp daily cap reached');
    for (const call of warnSpy.mock.calls) {
      const text = call.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
      expect(text).not.toContain('0901112233');
    }
  });

  it('AC-44: Số 0901112233 đã nhận 4 mã trong giờ này, gửi từ cookie và IP khác của Lan. Mã thứ 5 gửi lúc 10:00', async () => {
    for (let i = 1; i <= 4; i++) {
      now = at(`09:5${i}:00`);
      await otpService.issue('0901112233', 'google_signup');
    }

    now = at('10:00:00');
    await otpService.issue('0901112233', 'google_signup');
    const [, code5] = vi.mocked(fakeOtpSender.send).mock.calls[4];

    // Lan xin mã lần nữa lúc 10:02
    now = at('10:02:00');
    const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-111',
      email: 'lan@example.com',
      name: 'Lan',
      exp: now.getTime() + 30 * 60_000,
    });

    await http()
      .post('/api/auth/google/otp')
      .set('Cookie', `google_pending=${pending}`)
      .send({ purpose: 'google_signup', phone: '0901112233', consent: true })
      .expect(429);

    // Mã gửi lúc 10:00 vẫn dùng được tới 10:05
    now = at('10:04:59');
    await http()
      .post('/api/auth/google/complete')
      .set('Cookie', `google_pending=${pending}`)
      .send({ name: 'Lan', phone: '0901112233', code: code5, consent: true })
      .expect(201);
  });

  it('AC-45: An có cookie google_verify hợp lệ. Admin khóa An sau khi cookie được tạo', async () => {
    const an = await db.user.create({
      data: {
        name: 'An',
        phone: '0901234567',
        passwordHash: await hash('password'),
        googleSub: 'g-222',
        phoneVerifiedAt: null,
      },
    });

    const verifyCookie = issueSignedJson(GOOGLE_VERIFY_COOKIE, {
      typ: 'google_verify',
      userId: an.id,
      sub: 'g-222',
      exp: now.getTime() + 10 * 60_000,
    });

    await otpService.issue('0901234567', 'google_verify');
    const [, code] = vi.mocked(fakeOtpSender.send).mock.calls[0];

    // Admin khóa An
    await db.user.update({
      where: { id: an.id },
      data: { lockedAt: now },
    });

    // An gửi mã đúng tới /verify -> 403
    const verifyRes = await http()
      .post('/api/auth/google/verify')
      .set('Cookie', `google_verify=${verifyCookie}`)
      .send({ code })
      .expect(403);

    expect(verifyRes.body.message).toBe('Tài khoản đã bị khóa');
    expect(getCookie(verifyRes, SESSION_COOKIE)).toBeUndefined();

    const freshAn = await db.user.findUniqueOrThrow({ where: { id: an.id } });
    expect(freshAn.phoneVerifiedAt).toBeNull();

    // /otp với cookie đó trả 403 và không gửi tin
    fakeOtpSender.send = vi.fn();
    const otpRes = await http()
      .post('/api/auth/google/otp')
      .set('Cookie', `google_verify=${verifyCookie}`)
      .send({ purpose: 'google_verify' })
      .expect(403);

    expect(otpRes.body.message).toBe('Tài khoản đã bị khóa');
    expect(fakeOtpSender.send).not.toHaveBeenCalled();
  });

  it('AC-46: Có dòng PhoneOtp và dòng AuthThrottle cũ hơn 1 ngày. Đây là lần gửi đầu tiên trong ngày', async () => {
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60_000);
    const { keyedDigest } = await import('./session.js');

    await db.phoneOtp.create({
      data: {
        phoneKey: keyedDigest('0909999999'),
        purpose: 'google_signup',
        codeHash: 'oldhash',
        attempts: 0,
        sentAt: twoDaysAgo,
        expiresAt: twoDaysAgo,
      },
    });

    await db.authThrottle.create({
      data: {
        key: `login-phone:${keyedDigest('0909999999')}`,
        count: 5,
        windowStart: twoDaysAgo,
      },
    });

    const p1 = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-46-1',
      email: 'p1@example.com',
      name: 'P1',
      exp: now.getTime() + 30 * 60_000,
    });
    const p2 = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-46-2',
      email: 'p2@example.com',
      name: 'P2',
      exp: now.getTime() + 30 * 60_000,
    });

    const [r1, r2] = await Promise.all([
      http()
        .post('/api/auth/google/otp')
        .set('Cookie', `google_pending=${p1}`)
        .send({ purpose: 'google_signup', phone: '0901112233', consent: true }),
      http()
        .post('/api/auth/google/otp')
        .set('Cookie', `google_pending=${p2}`)
        .send({ purpose: 'google_signup', phone: '0901112244', consent: true }),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.resendAfter).toBe(60);
    expect(r2.body.resendAfter).toBe(60);
  });

  it('AC-47: OtpSender.send ném lỗi', async () => {
    fakeOtpSender.send = vi.fn().mockRejectedValue(new Error('SMS fail'));

    const pending = issueSignedJson(GOOGLE_PENDING_COOKIE, {
      typ: 'google_pending',
      sub: 'g-111',
      email: 'lan@example.com',
      name: 'Lan',
      exp: now.getTime() + 30 * 60_000,
    });

    const { keyedDigest } = await import('./session.js');
    const phoneKey = `otp-phone:${keyedDigest('0901112233')}`;
    const dayKey = `otp-day:${vnDateString(now)}`;

    const res = await http()
      .post('/api/auth/google/otp')
      .set('Cookie', `google_pending=${pending}`)
      .send({ purpose: 'google_signup', phone: '0901112233', consent: true })
      .expect(503);

    expect(res.body.message).toBe('Không gửi được mã. Thử lại sau');

    const phoneThrottle = await db.authThrottle.findUnique({ where: { key: phoneKey } });
    expect(phoneThrottle?.count ?? 0).toBe(0);

    const dayThrottle = await db.authThrottle.findUnique({ where: { key: dayKey } });
    expect(dayThrottle?.count ?? 0).toBe(0);
  });
});
