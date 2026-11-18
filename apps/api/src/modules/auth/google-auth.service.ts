import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional, UnauthorizedException } from '@nestjs/common';
import { errorMessage, GoogleCompleteRequest, GoogleLinkStartRequest, GoogleOtpRequest, type GooglePendingView, GoogleVerifyRequest, type OtpResponse, type SessionUser } from '@monsport/shared';
import * as client from 'openid-client';
import type { User } from '../../generated/prisma/client.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { OtpService, OtpThrottleException } from '../otp/otp.service.js';
import { isUniqueViolation, PHONE_TAKEN } from './accounts.service.js';
import { errorRedirect, NO_USER_HASH } from './auth-helpers.js';
import { GOOGLE_CONFIG, GOOGLE_OIDC_CONFIGURATION, type GoogleConfig } from './google.config.js';
import { Passwords } from './passwords.js';
import {
  cookieValue, GOOGLE_FLOW_COOKIE, GOOGLE_FLOW_MS, GOOGLE_PENDING_COOKIE, GOOGLE_PENDING_MS,
  GOOGLE_VERIFY_COOKIE, GOOGLE_VERIFY_MS, type GoogleFlowPayload, type GooglePendingPayload,
  type GoogleVerifyPayload, issueSignedJson, readSession, readSignedJson, SESSION_COOKIE,
} from './session.js';
import { ThrottleService } from './throttle.service.js';

export interface GoogleCallbackCookie {
  name: string;
  value: string;
  maxAge: number;
}

export interface GoogleCallbackResult {
  redirect: string;
  cookie?: GoogleCallbackCookie;
  sessionUserId?: string;
}

const ACCOUNT_LOCKED = 'Tài khoản đã bị khóa. Liên hệ admin của MONSPORT';
const PHONE_EXISTS_GOOGLE = 'Số này đã có tài khoản. Hãy đăng nhập bằng mật khẩu, rồi liên kết Google';

@Injectable()
export class GoogleAuthService {
  private cachedOidcConfig: client.Configuration | null = null;
  private oidcConfigPromise: Promise<client.Configuration> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly throttle: ThrottleService,
    private readonly passwords: Passwords,
    private readonly otpService: OtpService,
    @Inject(GOOGLE_CONFIG) private readonly googleConfig: GoogleConfig,
    @Optional() @Inject(GOOGLE_OIDC_CONFIGURATION) private readonly oidcConfig: client.Configuration | null,
  ) {}

  assertEnabled(): void {
    if (!this.googleConfig.enabled) throw new NotFoundException();
  }

  async getOidcConfig(): Promise<client.Configuration | null> {
    if (this.oidcConfig) return this.oidcConfig;
    if (this.cachedOidcConfig) return this.cachedOidcConfig;
    if (!this.oidcConfigPromise) {
      this.oidcConfigPromise = client
        .discovery(new URL('https://accounts.google.com'), this.googleConfig.clientId, this.googleConfig.clientSecret)
        .then((config) => {
          this.cachedOidcConfig = config;
          return config;
        })
        .catch((err) => {
          this.oidcConfigPromise = null;
          throw err;
        });
    }
    try {
      return await this.oidcConfigPromise;
    } catch {
      return null;
    }
  }

  async buildFlow(oidcConfig: client.Configuration, mode: 'login' | 'link', userId?: string): Promise<{ cookie: string; url: string }> {
    const state = client.randomState();
    const nonce = client.randomNonce();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const now = this.clock.now();
    const flowPayload: GoogleFlowPayload = {
      typ: 'google_flow',
      state,
      nonce,
      codeVerifier,
      mode,
      ...(userId !== undefined ? { userId } : {}),
      exp: now.getTime() + GOOGLE_FLOW_MS,
    };
    const url = client.buildAuthorizationUrl(oidcConfig, {
      redirect_uri: this.googleConfig.redirectUri,
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });
    return { cookie: issueSignedJson(GOOGLE_FLOW_COOKIE, flowPayload), url: url.href };
  }

  async linkStart(
    oidcConfig: client.Configuration,
    userId: string,
    ip: string | undefined,
    body: unknown,
  ): Promise<{ retryAfter: number } | { retryAfter: null; cookie: string; url: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new UnauthorizedException();
    if (user.lockedAt) throw new ForbiddenException(ACCOUNT_LOCKED);
    const retryAfter = await this.throttle.consumeLogin(user.phone, ip);
    if (retryAfter !== null) return { retryAfter };
    const input = GoogleLinkStartRequest.safeParse(body);
    if (!input.success) throw new UnauthorizedException('Sai số điện thoại hoặc mật khẩu');
    const passwordOk = await this.passwords.verify(user.passwordHash ?? (await NO_USER_HASH), input.data.password);
    if (!passwordOk) throw new UnauthorizedException('Sai số điện thoại hoặc mật khẩu');
    await this.throttle.loginSucceeded(user.phone);
    return { retryAfter: null, ...(await this.buildFlow(oidcConfig, 'link', user.id)) };
  }

  async callback(cookieHeader: string | undefined, state: unknown, code: unknown, currentPath: string): Promise<GoogleCallbackResult> {
    const now = this.clock.now();
    const flow = readSignedJson<GoogleFlowPayload>(GOOGLE_FLOW_COOKIE, cookieValue(cookieHeader, GOOGLE_FLOW_COOKIE), now);
    if (!flow || flow.typ !== 'google_flow' || !state || state !== flow.state) return { redirect: errorRedirect('state') };
    if (!code || typeof code !== 'string') return { redirect: errorRedirect('token') };
    const oidcConfig = await this.getOidcConfig();
    if (!oidcConfig) return { redirect: errorRedirect('config') };

    let tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers;
    try {
      const currentUrl = new URL(currentPath, this.googleConfig.redirectUri);
      tokens = await client.authorizationCodeGrant(oidcConfig, currentUrl, {
        pkceCodeVerifier: flow.codeVerifier,
        expectedState: flow.state,
        expectedNonce: flow.nonce,
        idTokenExpected: true,
      });
    } catch {
      return { redirect: errorRedirect('token') };
    }

    const claims = tokens.claims();
    const sub = typeof claims?.sub === 'string' ? claims.sub : undefined;
    if (!sub) return { redirect: errorRedirect('token') };
    const email = claims?.email_verified && typeof claims.email === 'string' ? claims.email : null;
    const name = typeof claims?.name === 'string' ? claims.name : '';

    try {
      if (flow.mode === 'login') return await this.callbackLogin(sub, email, name, now);
      return await this.callbackLink(cookieHeader, flow.userId, sub, now);
    } catch {
      return { redirect: errorRedirect('unknown') };
    }
  }

  private async callbackLogin(sub: string, email: string | null, name: string, now: Date): Promise<GoogleCallbackResult> {
    const user = await this.prisma.user.findUnique({ where: { googleSub: sub } });
    if (user) {
      if (user.lockedAt || user.deletedAt) return { redirect: errorRedirect('locked') };
      if (user.phoneVerifiedAt !== null) return { redirect: '/', sessionUserId: user.id };
      const verifyPayload: GoogleVerifyPayload = { typ: 'google_verify', userId: user.id, sub, exp: now.getTime() + GOOGLE_VERIFY_MS };
      return {
        redirect: '/?google=verify',
        cookie: { name: GOOGLE_VERIFY_COOKIE, value: issueSignedJson(GOOGLE_VERIFY_COOKIE, verifyPayload), maxAge: GOOGLE_VERIFY_MS },
      };
    }
    const pendingPayload: GooglePendingPayload = { typ: 'google_pending', sub, email, name, exp: now.getTime() + GOOGLE_PENDING_MS };
    return {
      redirect: '/?google=complete',
      cookie: { name: GOOGLE_PENDING_COOKIE, value: issueSignedJson(GOOGLE_PENDING_COOKIE, pendingPayload), maxAge: GOOGLE_PENDING_MS },
    };
  }

  private async callbackLink(cookieHeader: string | undefined, flowUserId: string | undefined, sub: string, now: Date): Promise<GoogleCallbackResult> {
    const session = readSession(cookieValue(cookieHeader, SESSION_COOKIE), now);
    if (!session || !flowUserId || session.userId !== flowUserId) return { redirect: errorRedirect('session') };
    const user = await this.prisma.user.findUnique({ where: { id: flowUserId } });
    if (!user || user.deletedAt || user.lockedAt) return { redirect: errorRedirect('locked') };
    if (user.googleSub !== null) return { redirect: errorRedirect('taken') };
    const existing = await this.prisma.user.findUnique({ where: { googleSub: sub } });
    if (existing && existing.id !== flowUserId) return { redirect: errorRedirect('taken') };
    try {
      const updated = await this.prisma.user.updateMany({ where: { id: flowUserId, googleSub: null }, data: { googleSub: sub } });
      if (updated.count === 0) return { redirect: errorRedirect('taken') };
    } catch (err) {
      if (isUniqueViolation(err)) return { redirect: errorRedirect('taken') };
      return { redirect: errorRedirect('unknown') };
    }
    return { redirect: '/' };
  }

  pending(cookieHeader: string | undefined): GooglePendingView {
    const pending = readSignedJson<GooglePendingPayload>(GOOGLE_PENDING_COOKIE, cookieValue(cookieHeader, GOOGLE_PENDING_COOKIE), this.clock.now());
    if (!pending || pending.typ !== 'google_pending') throw new NotFoundException();
    return { name: pending.name, email: pending.email };
  }

  async otp(body: unknown, cookieHeader: string | undefined, ip: string | undefined): Promise<OtpResponse> {
    const input = GoogleOtpRequest.safeParse(body);
    if (!input.success) throw new BadRequestException(errorMessage(input.error));
    const now = this.clock.now();

    if (input.data.purpose === 'google_signup') {
      const pending = readSignedJson<GooglePendingPayload>(GOOGLE_PENDING_COOKIE, cookieValue(cookieHeader, GOOGLE_PENDING_COOKIE), now);
      if (!pending || pending.typ !== 'google_pending') throw new BadRequestException('Thiếu thông tin đăng ký Google');
      const retryAfter = await this.throttle.consumeOtpRequest(ip, pending.sub);
      if (retryAfter !== null) throw new OtpThrottleException(retryAfter);
      const existing = await this.prisma.user.findUnique({ where: { phone: input.data.phone } });
      if (existing) throw new ConflictException(PHONE_EXISTS_GOOGLE);
      return await this.otpService.issue(input.data.phone, 'google_signup', 'sms');
    }

    const verify = readSignedJson<GoogleVerifyPayload>(GOOGLE_VERIFY_COOKIE, cookieValue(cookieHeader, GOOGLE_VERIFY_COOKIE), now);
    if (!verify || verify.typ !== 'google_verify') throw new BadRequestException('Thiếu thông tin xác minh Google');
    const retryAfter = await this.throttle.consumeOtpRequest(ip, verify.sub);
    if (retryAfter !== null) throw new OtpThrottleException(retryAfter);
    const user = await this.prisma.user.findFirst({ where: { id: verify.userId, googleSub: verify.sub, lockedAt: null, deletedAt: null } });
    if (!user) throw new ForbiddenException(ACCOUNT_LOCKED);
    return await this.otpService.issue(user.phone, 'google_verify', 'sms');
  }

  async complete(body: unknown, cookieHeader: string | undefined, ip: string | undefined): Promise<{ user: SessionUser }> {
    const now = this.clock.now();
    const pending = readSignedJson<GooglePendingPayload>(GOOGLE_PENDING_COOKIE, cookieValue(cookieHeader, GOOGLE_PENDING_COOKIE), now);
    if (!pending || pending.typ !== 'google_pending') throw new BadRequestException('Thiếu hoặc hỏng thông tin đăng ký Google');
    const input = GoogleCompleteRequest.safeParse(body);
    if (!input.success) throw new BadRequestException(errorMessage(input.error));
    const blocked = await this.throttle.otpRequestBlocked(ip, pending.sub);
    if (blocked !== null) throw new OtpThrottleException(blocked);
    const existing = await this.prisma.user.findUnique({ where: { phone: input.data.phone } });
    if (existing) {
      const retryAfter = await this.throttle.consumeOtpRequest(ip, pending.sub);
      if (retryAfter !== null) throw new OtpThrottleException(retryAfter);
      throw new ConflictException(PHONE_EXISTS_GOOGLE);
    }
    const codeHash = await this.otpService.verifyCode(input.data.phone, 'google_signup', input.data.code);
    let user: User;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        await this.otpService.deleteCode(tx, input.data.phone, 'google_signup', codeHash);
        return await tx.user.create({
          data: {
            name: input.data.name,
            phone: input.data.phone,
            googleSub: pending.sub,
            email: pending.email,
            role: 'USER',
            consentAt: now,
            phoneVerifiedAt: now,
            createdAt: now,
          },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException(PHONE_TAKEN);
      throw error;
    }
    return { user: { id: user.id, name: user.name, role: user.role } };
  }

  async verify(body: unknown, cookieHeader: string | undefined): Promise<{ user: SessionUser }> {
    const now = this.clock.now();
    const verify = readSignedJson<GoogleVerifyPayload>(GOOGLE_VERIFY_COOKIE, cookieValue(cookieHeader, GOOGLE_VERIFY_COOKIE), now);
    if (!verify || verify.typ !== 'google_verify') throw new BadRequestException('Thiếu hoặc hỏng thông tin xác minh Google');
    const input = GoogleVerifyRequest.safeParse(body);
    if (!input.success) throw new BadRequestException(errorMessage(input.error));
    const user = await this.prisma.user.findFirst({ where: { id: verify.userId, googleSub: verify.sub, lockedAt: null, deletedAt: null } });
    if (!user) throw new ForbiddenException(ACCOUNT_LOCKED);
    const codeHash = await this.otpService.verifyCode(user.phone, 'google_verify', input.data.code);
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await this.otpService.deleteCode(tx, user.phone, 'google_verify', codeHash);
      const rows = await tx.$queryRaw<User[]>`
        UPDATE "User"
        SET "phoneVerifiedAt" = ${now}
        WHERE id = ${verify.userId} AND "googleSub" = ${verify.sub} AND "lockedAt" IS NULL AND "deletedAt" IS NULL
        RETURNING *
      `;
      if (rows.length === 0) throw new ForbiddenException(ACCOUNT_LOCKED);
      return rows[0];
    });
    return { user: { id: updatedUser.id, name: updatedUser.name, role: updatedUser.role } };
  }

  async unlink(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new UnauthorizedException();
    if (user.lockedAt) throw new ForbiddenException(ACCOUNT_LOCKED);
    if (!user.passwordHash) throw new BadRequestException('Hãy đặt mật khẩu trước khi gỡ Google');
    await this.prisma.user.update({ where: { id: user.id }, data: { googleSub: null } });
  }
}
