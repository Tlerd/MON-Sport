import 'reflect-metadata';
import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';
import { keyedDigest } from '../auth/session.js';
import { ThrottleService } from '../auth/throttle.service.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { assertOtpConfig } from './otp-config.js';
import { DevOtpSender, EsmsOtpSender, OTP_SENDER, type OtpSender } from './otp-sender.js';
import { hashOtpCode, OtpService } from './otp.service.js';

const at = (time: string) => new Date(`2026-10-17T${time}+07:00`);
let now = at('10:00:00');
const clock = { now: () => now };

let app: INestApplication;
let db: PrismaService;
let otpService: OtpService;
let throttleService: ThrottleService;

const fakeOtpSender: OtpSender = {
  send: vi.fn().mockResolvedValue(undefined),
};

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Clock)
    .useValue(clock)
    .overrideProvider(OTP_SENDER)
    .useValue(fakeOtpSender)
    .compile();
  app = setupApp(moduleRef.createNestApplication());
  await app.init();
  db = app.get(PrismaService);
  otpService = app.get(OtpService);
  throttleService = app.get(ThrottleService);
});

afterAll(async () => {
  await app?.close();
});

beforeEach(async () => {
  now = at('10:00:00');
  vi.restoreAllMocks();
  fakeOtpSender.send = vi.fn().mockResolvedValue(undefined);
  await db.$executeRawUnsafe('TRUNCATE "PhoneOtp", "AuthThrottle", "DevOtpOutbox", "User" CASCADE');
});

describe('OTP service', () => {
  it('issue stores a hash not the code', async () => {
    const res = await otpService.issue('0901112233', 'google_signup');
    expect(res).toEqual({ resendAfter: 60 });
    expect(fakeOtpSender.send).toHaveBeenCalledTimes(1);
    const [phone, code, channel] = vi.mocked(fakeOtpSender.send).mock.calls[0];
    expect(phone).toBe('0901112233');
    expect(code).toMatch(/^\d{6}$/);
    expect(channel).toBe('sms');

    const rows = await db.phoneOtp.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].codeHash).toBe(hashOtpCode('0901112233', code));
    expect(rows[0].codeHash).not.toBe(code);
    const json = JSON.stringify(rows[0]);
    expect(json).not.toContain(code);
    expect(json).not.toContain('0901112233');
    expect(rows[0].attempts).toBe(0);
  });

  it('resend before 60 s is 429 and keeps the old code', async () => {
    await otpService.issue('0901112233', 'google_signup');
    const [, code1] = vi.mocked(fakeOtpSender.send).mock.calls[0];

    now = at('10:00:30');
    let error: any;
    try {
      await otpService.issue('0901112233', 'google_signup');
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error.getStatus?.() ?? error.status).toBe(429);
    expect(error.retryAfter).toBe(30);
    expect(fakeOtpSender.send).toHaveBeenCalledTimes(1);

    // Old code remains valid
    await db.$transaction(async (tx) => {
      await otpService.consume(tx, '0901112233', 'google_signup', code1);
    });
    expect(await db.phoneOtp.count()).toBe(0);
  });

  it('after 60 s the old code fails', async () => {
    await otpService.issue('0901112233', 'google_signup');
    const [, code1] = vi.mocked(fakeOtpSender.send).mock.calls[0];

    now = at('10:01:01');
    await otpService.issue('0901112233', 'google_signup');
    const [, code2] = vi.mocked(fakeOtpSender.send).mock.calls[1];
    expect(code1).not.toBe(code2);

    let err1: any;
    try {
      await db.$transaction((tx) => otpService.consume(tx, '0901112233', 'google_signup', code1));
    } catch (err) {
      err1 = err;
    }
    expect(err1).toBeDefined();
    expect(err1.getStatus?.() ?? err1.status).toBe(400);
    expect(err1.getResponse?.() ?? err1.message).toBe('Mã không đúng');

    await db.$transaction((tx) => otpService.consume(tx, '0901112233', 'google_signup', code2));
    expect(await db.phoneOtp.count()).toBe(0);
  });

  it('5 wrong tries kill the code', async () => {
    await otpService.issue('0901112233', 'google_signup');
    const [, code] = vi.mocked(fakeOtpSender.send).mock.calls[0];
    const wrongCode = code === '000000' ? '111111' : '000000';

    for (let i = 0; i < 4; i++) {
      let err: any;
      try {
        await db.$transaction((tx) => otpService.consume(tx, '0901112233', 'google_signup', wrongCode));
      } catch (e) {
        err = e;
      }
      expect(err.getStatus?.() ?? err.status).toBe(400);
      expect(err.getResponse?.() ?? err.message).toBe('Mã không đúng');
      const row = await db.phoneOtp.findFirst();
      expect(row?.attempts).toBe(i + 1);
    }

    // 5th wrong try kills the code
    let err5: any;
    try {
      await db.$transaction((tx) => otpService.consume(tx, '0901112233', 'google_signup', wrongCode));
    } catch (e) {
      err5 = e;
    }
    expect(err5.getStatus?.() ?? err5.status).toBe(400);
    expect(err5.getResponse?.() ?? err5.message).toBe('Mã không đúng');
    expect(await db.phoneOtp.count()).toBe(0);

    // Now the right code fails
    let errRight: any;
    try {
      await db.$transaction((tx) => otpService.consume(tx, '0901112233', 'google_signup', code));
    } catch (e) {
      errRight = e;
    }
    expect(errRight.getStatus?.() ?? errRight.status).toBe(400);
    expect(errRight.getResponse?.() ?? errRight.message).toBe('Mã đã hết hạn. Hãy xin mã mới');
  });

  it('expiry after 5 min', async () => {
    await otpService.issue('0901112233', 'google_signup');
    const [, code] = vi.mocked(fakeOtpSender.send).mock.calls[0];

    now = at('10:05:01');
    let err: any;
    try {
      await db.$transaction((tx) => otpService.consume(tx, '0901112233', 'google_signup', code));
    } catch (e) {
      err = e;
    }
    expect(err.getStatus?.() ?? err.status).toBe(400);
    expect(err.getResponse?.() ?? err.message).toBe('Mã đã hết hạn. Hãy xin mã mới');
  });

  it('parallel 20 wrong consumes never pass attempts 5', async () => {
    await otpService.issue('0901112233', 'google_signup');
    const [, code] = vi.mocked(fakeOtpSender.send).mock.calls[0];

    await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        otpService.consume(db, '0901112233', 'google_signup', String(200000 + i).padStart(6, '0')),
      ),
    );

    const remaining = await db.phoneOtp.findMany();
    if (remaining.length > 0) {
      expect(remaining[0].attempts).toBeLessThanOrEqual(5);
    }

    let err: any;
    try {
      await db.$transaction((tx) => otpService.consume(tx, '0901112233', 'google_signup', code));
    } catch (e) {
      err = e;
    }
    expect(err.getStatus?.() ?? err.status).toBe(400);
    expect(err.getResponse?.() ?? err.message).toBe('Mã đã hết hạn. Hãy xin mã mới');
  });

  it('two parallel issue calls send once', async () => {
    const results = await Promise.allSettled([
      otpService.issue('0901112233', 'google_signup'),
      otpService.issue('0901112233', 'google_signup'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const err = (rejected[0] as PromiseRejectedResult).reason;
    expect(err.getStatus?.() ?? err.status).toBe(429);
    expect(fakeOtpSender.send).toHaveBeenCalledTimes(1);
  });

  it('otp-phone refusal keeps the earlier code', async () => {
    let lastCode = '';
    for (let i = 0; i < 5; i++) {
      now = new Date(at('10:00:00').getTime() + i * 65_000);
      await otpService.issue('0901112233', 'google_signup');
      lastCode = vi.mocked(fakeOtpSender.send).mock.calls[i][1];
    }
    expect(fakeOtpSender.send).toHaveBeenCalledTimes(5);

    // 6th attempt within the hour fails due to otp-phone limit (5 per hour)
    now = new Date(at('10:00:00').getTime() + 5 * 65_000);
    let err6: any;
    try {
      await otpService.issue('0901112233', 'google_signup');
    } catch (e) {
      err6 = e;
    }
    expect(err6.getStatus?.() ?? err6.status).toBe(429);
    expect(fakeOtpSender.send).toHaveBeenCalledTimes(5);

    // 5th code is still valid
    await db.$transaction((tx) => otpService.consume(tx, '0901112233', 'google_signup', lastCode));
    expect(await db.phoneOtp.count()).toBe(0);
  });

  it('daily cap 503 and the log has no phone', async () => {
    const prevCap = process.env.OTP_DAILY_CAP;
    process.env.OTP_DAILY_CAP = '2';
    try {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn');
      await otpService.issue('0901112201', 'google_signup');
      await otpService.issue('0901112202', 'google_signup');

      let err: any;
      try {
        await otpService.issue('0901112203', 'google_signup');
      } catch (e) {
        err = e;
      }
      expect(err.getStatus?.() ?? err.status).toBe(503);
      expect(err.getResponse?.() ?? err.message).toBe('Không gửi được mã. Thử lại sau');
      expect(warnSpy).toHaveBeenCalledWith('otp daily cap reached');
      for (const call of warnSpy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain('0901112203');
      }
    } finally {
      if (prevCap !== undefined) process.env.OTP_DAILY_CAP = prevCap;
      else delete process.env.OTP_DAILY_CAP;
    }
  });

  it('send failure deletes the new code and does not raise the counters', async () => {
    fakeOtpSender.send = vi.fn().mockRejectedValue(new Error('Gateway error'));

    let err: any;
    try {
      await otpService.issue('0901112233', 'google_signup');
    } catch (e) {
      err = e;
    }
    expect(err.getStatus?.() ?? err.status).toBe(503);
    expect(err.getResponse?.() ?? err.message).toBe('Không gửi được mã. Thử lại sau');

    expect(await db.phoneOtp.count()).toBe(0);
    const throttles = await db.authThrottle.findMany();
    for (const t of throttles) {
      expect(t.count).toBe(0);
    }
  });

  it('parallel issues for two phones at the first send of a day with rows older than 1 day both succeed and the old rows are gone', async () => {
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60_000);
    await db.phoneOtp.create({
      data: {
        phoneKey: keyedDigest('0909999999'),
        purpose: 'google_signup',
        codeHash: '00'.repeat(32),
        attempts: 0,
        sentAt: twoDaysAgo,
        expiresAt: twoDaysAgo,
      },
    });
    await db.authThrottle.create({
      data: {
        key: 'otp-day:2026-10-15',
        count: 10,
        windowStart: twoDaysAgo,
      },
    });

    const [r1, r2] = await Promise.all([
      otpService.issue('0901112233', 'google_signup'),
      otpService.issue('0901112244', 'google_signup'),
    ]);

    expect(r1.resendAfter).toBe(60);
    expect(r2.resendAfter).toBe(60);

    const oldPhoneOtp = await db.phoneOtp.findFirst({
      where: { expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } },
    });
    expect(oldPhoneOtp).toBeNull();

    const oldThrottle = await db.authThrottle.findFirst({
      where: { windowStart: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } },
    });
    expect(oldThrottle).toBeNull();
  });
});

describe('assertOtpConfig', () => {
  it('assertOtpConfig cases', () => {
    expect(() => assertOtpConfig({ NODE_ENV: 'production', OTP_PROVIDER: 'dev' })).toThrow(
      'OTP_PROVIDER must not be dev in production.',
    );
    expect(() => assertOtpConfig({ OTP_PROVIDER: 'esms' })).toThrow();
    expect(() => assertOtpConfig({ OTP_PROVIDER: 'esms', ESMS_API_KEY: 'k', ESMS_SECRET_KEY: 's' })).toThrow();
    expect(() =>
      assertOtpConfig({ OTP_PROVIDER: 'esms', ESMS_API_KEY: 'k', ESMS_SECRET_KEY: 's', ESMS_BRANDNAME: 'b' }),
    ).not.toThrow();
    expect(() => assertOtpConfig({ NODE_ENV: 'test', OTP_PROVIDER: 'dev' })).not.toThrow();
    expect(() => assertOtpConfig({})).not.toThrow();
  });
});

describe('senders', () => {
  it('DevOtpSender writes to DevOtpOutbox', async () => {
    const devSender = new DevOtpSender(db);
    await devSender.send('0901112233', '123456', 'sms');
    const outbox = await db.devOtpOutbox.findFirst({ where: { phone: '0901112233' } });
    expect(outbox).not.toBeNull();
    expect(outbox?.code).toBe('123456');
  });

  it('EsmsOtpSender calls fetch and handles response', async () => {
    const esmsSender = new EsmsOtpSender();
    process.env.ESMS_API_KEY = 'test-key';
    process.env.ESMS_SECRET_KEY = 'test-secret';
    process.env.ESMS_BRANDNAME = 'MONSPORT';

    const originalFetch = global.fetch;
    try {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ CodeResult: '100' }),
      } as any);

      await esmsSender.send('0901112233', '123456', 'sms');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as any);
      await expect(esmsSender.send('0901112233', '123456', 'sms')).rejects.toThrow('eSMS send failed with HTTP 500');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ CodeResult: '99' }),
      } as any);
      await expect(esmsSender.send('0901112233', '123456', 'sms')).rejects.toThrow(
        'eSMS send failed with CodeResult 99',
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
