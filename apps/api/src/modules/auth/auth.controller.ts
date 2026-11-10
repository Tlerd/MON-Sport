import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Optional,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  errorMessage,
  GoogleCompleteRequest,
  GoogleLinkStartRequest,
  type GoogleLinkStartResponse,
  GoogleOtpRequest,
  type GooglePendingView,
  GoogleVerifyRequest,
  LoginRequest,
  Messages,
  type OtpResponse,
  type ProvidersResponse,
  RegisterRequest,
  type SessionUser,
} from '@monsport/shared';
import { hash } from '@node-rs/argon2';
import type { Request, Response } from 'express';
import * as client from 'openid-client';
import type { User } from '../../generated/prisma/client.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { OtpService, OtpThrottleException } from '../otp/otp.service.js';
import { AccountsService, isUniqueViolation, PHONE_TAKEN } from './accounts.service.js';
import { GOOGLE_CONFIG, GOOGLE_OIDC_CONFIGURATION, GoogleEnabledGuard, type GoogleConfig } from './google.config.js';
import { Passwords } from './passwords.js';
import {
  cookieValue,
  GOOGLE_COOKIE_PATH,
  GOOGLE_FLOW_COOKIE,
  GOOGLE_FLOW_MS,
  GOOGLE_PENDING_COOKIE,
  GOOGLE_PENDING_MS,
  GOOGLE_VERIFY_COOKIE,
  GOOGLE_VERIFY_MS,
  googleCookieOptions,
  type GoogleFlowPayload,
  type GooglePendingPayload,
  type GoogleVerifyPayload,
  issueSession,
  issueSignedJson,
  readSession,
  readSignedJson,
  SESSION_COOKIE,
  SESSION_MS,
} from './session.js';
import { type AuthedRequest, SessionGuard } from './session.guard.js';
import { ThrottleService } from './throttle.service.js';

// Verified when no user has the phone, so both wrong answers take the same time (UC-1, 1.1.E1).
const NO_USER_HASH = hash('no-user-has-this-phone');

const KNOWN_GOOGLE_ERRORS = new Set(['access_denied', 'state', 'token', 'taken', 'session', 'locked', 'config']);

function errorRedirect(code: string): string {
  return `/?google_error=${KNOWN_GOOGLE_ERRORS.has(code) ? code : 'unknown'}`;
}

@Controller('auth')
export class AuthController {
  private cachedOidcConfig: client.Configuration | null = null;
  private oidcConfigPromise: Promise<client.Configuration> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly accounts: AccountsService,
    private readonly throttle: ThrottleService,
    private readonly passwords: Passwords,
    private readonly otpService: OtpService,
    @Inject(GOOGLE_CONFIG) private readonly googleConfig: GoogleConfig,
    @Optional() @Inject(GOOGLE_OIDC_CONFIGURATION) private readonly oidcConfig: client.Configuration | null,
  ) {}

  private async getOidcConfig(): Promise<client.Configuration> {
    if (this.oidcConfig) return this.oidcConfig;
    if (this.cachedOidcConfig) return this.cachedOidcConfig;
    if (!this.oidcConfigPromise) {
      this.oidcConfigPromise = client
        .discovery(
          new URL('https://accounts.google.com'),
          this.googleConfig.clientId,
          this.googleConfig.clientSecret,
        )
        .then((config) => {
          this.cachedOidcConfig = config;
          return config;
        })
        .catch((err) => {
          this.oidcConfigPromise = null;
          throw err;
        });
    }
    return this.oidcConfigPromise;
  }

  /** UC-1, flow 1.0: a guest signs up as a USER and is signed in (brief F-003). */
  @Post('register')
  @HttpCode(201)
  async register(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SessionUser> {
    const input = RegisterRequest.safeParse(body);
    if (!input.success) throw new BadRequestException(errorMessage(input.error));
    refuseWhenThrottled(res, await this.throttle.consumeRegister(req.ip)); // Before the argon2 hash (brief F-006).
    const now = this.clock.now();
    const { consent: _consent, ...account } = input.data;
    // The role is fixed here. A role field in the body is ignored, because Zod strips unknown keys.
    const user = await this.accounts.create({ ...account, role: 'USER', consentAt: now, createdAt: now });
    this.startSession(res, user.id);
    return { id: user.id, name: user.name, role: user.role };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SessionUser> {
    const input = LoginRequest.safeParse(body);
    if (!input.success) throw new BadRequestException('Số điện thoại hoặc mật khẩu không hợp lệ');
    refuseWhenThrottled(res, await this.throttle.consumeLogin(input.data.phone, req.ip)); // Before the argon2 check (brief F-006).
    const user = await this.prisma.user.findUnique({ where: { phone: input.data.phone } });
    // One message for a wrong phone and a wrong password (UC-1, 1.1.E1).
    const passwordOk = await this.passwords.verify(user?.passwordHash ?? (await NO_USER_HASH), input.data.password);
    if (!user || user.deletedAt || !passwordOk)
      throw new UnauthorizedException('Sai số điện thoại hoặc mật khẩu');
    await this.throttle.loginSucceeded(input.data.phone);
    if (user.lockedAt) throw new ForbiddenException('Tài khoản đã bị khóa. Liên hệ admin của MONSPORT'); // BR-28
    this.startSession(res, user.id);
    return { id: user.id, name: user.name, role: user.role };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() req: AuthedRequest): SessionUser {
    return req.user;
  }

  @Get('providers')
  providers(): ProvidersResponse {
    return { google: this.googleConfig.enabled };
  }

  @Get('google/start')
  async googleStart(@Res() res: Response): Promise<void> {
    if (!this.googleConfig.enabled) throw new NotFoundException();
    let oidcConfig: client.Configuration;
    try {
      oidcConfig = await this.getOidcConfig();
    } catch {
      return res.redirect(302, '/?google_error=config');
    }
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
      mode: 'login',
      exp: now.getTime() + GOOGLE_FLOW_MS,
    };
    res.cookie(
      GOOGLE_FLOW_COOKIE,
      issueSignedJson(GOOGLE_FLOW_COOKIE, flowPayload),
      googleCookieOptions(GOOGLE_FLOW_MS),
    );
    const url = client.buildAuthorizationUrl(oidcConfig, {
      redirect_uri: this.googleConfig.redirectUri,
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });
    res.redirect(302, url.href);
  }

  @Post('google/link-start')
  @HttpCode(200)
  @UseGuards(GoogleEnabledGuard, SessionGuard)
  async googleLinkStart(
    @Body() body: unknown,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<GoogleLinkStartResponse> {
    if (!this.googleConfig.enabled) throw new NotFoundException();
    let oidcConfig: client.Configuration;
    try {
      oidcConfig = await this.getOidcConfig();
    } catch {
      throw new ServiceUnavailableException();
    }
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.deletedAt) throw new UnauthorizedException();
    if (user.lockedAt) throw new ForbiddenException('Tài khoản đã bị khóa. Liên hệ admin của MONSPORT');

    refuseWhenThrottled(res, await this.throttle.consumeLogin(user.phone, req.ip));

    const input = GoogleLinkStartRequest.safeParse(body);
    if (!input.success) throw new UnauthorizedException('Sai số điện thoại hoặc mật khẩu');

    const passwordOk = await this.passwords.verify(user.passwordHash ?? (await NO_USER_HASH), input.data.password);
    if (!passwordOk) throw new UnauthorizedException('Sai số điện thoại hoặc mật khẩu');

    await this.throttle.loginSucceeded(user.phone);

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
      mode: 'link',
      userId: user.id,
      exp: now.getTime() + GOOGLE_FLOW_MS,
    };
    res.cookie(
      GOOGLE_FLOW_COOKIE,
      issueSignedJson(GOOGLE_FLOW_COOKIE, flowPayload),
      googleCookieOptions(GOOGLE_FLOW_MS),
    );
    const url = client.buildAuthorizationUrl(oidcConfig, {
      redirect_uri: this.googleConfig.redirectUri,
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });
    return { url: url.href };
  }

  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!this.googleConfig.enabled) throw new NotFoundException();
    const now = this.clock.now();

    res.clearCookie(GOOGLE_FLOW_COOKIE, { path: GOOGLE_COOKIE_PATH });

    if (req.query.error) {
      return res.redirect(302, errorRedirect(String(req.query.error)));
    }

    const flow = readSignedJson<GoogleFlowPayload>(
      GOOGLE_FLOW_COOKIE,
      cookieValue(req.headers.cookie, GOOGLE_FLOW_COOKIE),
      now,
    );
    if (!flow || flow.typ !== 'google_flow' || !req.query.state || req.query.state !== flow.state) {
      return res.redirect(302, '/?google_error=state');
    }

    if (!req.query.code || typeof req.query.code !== 'string') {
      return res.redirect(302, '/?google_error=token');
    }

    let oidcConfig: client.Configuration;
    try {
      oidcConfig = await this.getOidcConfig();
    } catch {
      return res.redirect(302, '/?google_error=config');
    }

    let tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers;
    try {
      const currentUrl = new URL(req.originalUrl || req.url, this.googleConfig.redirectUri);
      tokens = await client.authorizationCodeGrant(oidcConfig, currentUrl, {
        pkceCodeVerifier: flow.codeVerifier,
        expectedState: flow.state,
        expectedNonce: flow.nonce,
        idTokenExpected: true,
      });
    } catch {
      return res.redirect(302, '/?google_error=token');
    }

    const claims = tokens.claims();
    const sub = typeof claims?.sub === 'string' ? claims.sub : undefined;
    if (!sub) {
      return res.redirect(302, '/?google_error=token');
    }
    const email = claims?.email_verified && typeof claims.email === 'string' ? claims.email : null;
    const name = typeof claims?.name === 'string' ? claims.name : '';

    try {
      if (flow.mode === 'login') {
        const user = await this.prisma.user.findUnique({ where: { googleSub: sub } });
        if (user) {
          if (user.lockedAt || user.deletedAt) {
            return res.redirect(302, '/?google_error=locked');
          }
          if (user.phoneVerifiedAt !== null) {
            this.startSession(res, user.id);
            return res.redirect(302, '/');
          } else {
            const verifyPayload: GoogleVerifyPayload = {
              typ: 'google_verify',
              userId: user.id,
              sub,
              exp: now.getTime() + GOOGLE_VERIFY_MS,
            };
            res.cookie(
              GOOGLE_VERIFY_COOKIE,
              issueSignedJson(GOOGLE_VERIFY_COOKIE, verifyPayload),
              googleCookieOptions(GOOGLE_VERIFY_MS),
            );
            return res.redirect(302, '/?google=verify');
          }
        } else {
          const pendingPayload: GooglePendingPayload = {
            typ: 'google_pending',
            sub,
            email,
            name,
            exp: now.getTime() + GOOGLE_PENDING_MS,
          };
          res.cookie(
            GOOGLE_PENDING_COOKIE,
            issueSignedJson(GOOGLE_PENDING_COOKIE, pendingPayload),
            googleCookieOptions(GOOGLE_PENDING_MS),
          );
          return res.redirect(302, '/?google=complete');
        }
      } else {
        // mode === 'link'
        const session = readSession(cookieValue(req.headers.cookie, SESSION_COOKIE), now);
        if (!session || !flow.userId || session.userId !== flow.userId) {
          return res.redirect(302, '/?google_error=session');
        }
        const user = await this.prisma.user.findUnique({ where: { id: flow.userId } });
        if (!user || user.deletedAt || user.lockedAt) {
          return res.redirect(302, '/?google_error=locked');
        }
        if (user.googleSub !== null) {
          return res.redirect(302, '/?google_error=taken');
        }
        const existing = await this.prisma.user.findUnique({ where: { googleSub: sub } });
        if (existing && existing.id !== flow.userId) {
          return res.redirect(302, '/?google_error=taken');
        }
        try {
          const updated = await this.prisma.user.updateMany({
            where: { id: flow.userId, googleSub: null },
            data: { googleSub: sub },
          });
          if (updated.count === 0) {
            return res.redirect(302, '/?google_error=taken');
          }
        } catch (err) {
          if (isUniqueViolation(err)) {
            return res.redirect(302, '/?google_error=taken');
          }
          return res.redirect(302, '/?google_error=unknown');
        }
        return res.redirect(302, '/');
      }
    } catch {
      return res.redirect(302, '/?google_error=unknown');
    }
  }

  @Get('google/pending')
  googlePending(@Req() req: Request): GooglePendingView {
    if (!this.googleConfig.enabled) throw new NotFoundException();
    const now = this.clock.now();
    const pending = readSignedJson<GooglePendingPayload>(
      GOOGLE_PENDING_COOKIE,
      cookieValue(req.headers.cookie, GOOGLE_PENDING_COOKIE),
      now,
    );
    if (!pending || pending.typ !== 'google_pending') {
      throw new NotFoundException();
    }
    return { name: pending.name, email: pending.email };
  }

  @Post('google/otp')
  @HttpCode(200)
  async googleOtp(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OtpResponse> {
    if (!this.googleConfig.enabled) throw new NotFoundException();
    const input = GoogleOtpRequest.safeParse(body);
    if (!input.success) {
      throw new BadRequestException(errorMessage(input.error));
    }
    const now = this.clock.now();

    if (input.data.purpose === 'google_signup') {
      const pending = readSignedJson<GooglePendingPayload>(
        GOOGLE_PENDING_COOKIE,
        cookieValue(req.headers.cookie, GOOGLE_PENDING_COOKIE),
        now,
      );
      if (!pending || pending.typ !== 'google_pending') {
        throw new BadRequestException('Thiếu thông tin đăng ký Google');
      }

      // (1) consumeOtpRequest(ip, sub) FIRST (O5 order)
      const retryAfter = await this.throttle.consumeOtpRequest(req.ip, pending.sub);
      if (retryAfter !== null) {
        res.setHeader('Retry-After', String(retryAfter));
        throw new OtpThrottleException(retryAfter);
      }

      // (2) 409 existence check
      const existing = await this.prisma.user.findUnique({ where: { phone: input.data.phone } });
      if (existing) {
        throw new ConflictException('Số này đã có tài khoản. Hãy đăng nhập bằng mật khẩu, rồi liên kết Google');
      }

      // (3) OtpService.issue
      try {
        return await this.otpService.issue(input.data.phone, 'google_signup', 'sms');
      } catch (err) {
        if (err instanceof OtpThrottleException) {
          res.setHeader('Retry-After', String(err.retryAfter));
        }
        throw err;
      }
    } else {
      // purpose === 'google_verify'
      const verify = readSignedJson<GoogleVerifyPayload>(
        GOOGLE_VERIFY_COOKIE,
        cookieValue(req.headers.cookie, GOOGLE_VERIFY_COOKIE),
        now,
      );
      if (!verify || verify.typ !== 'google_verify') {
        throw new BadRequestException('Thiếu thông tin xác minh Google');
      }

      // (1) consumeOtpRequest(ip, sub) FIRST
      const retryAfter = await this.throttle.consumeOtpRequest(req.ip, verify.sub);
      if (retryAfter !== null) {
        res.setHeader('Retry-After', String(retryAfter));
        throw new OtpThrottleException(retryAfter);
      }

      // (2) O11 check: account must exist, match sub, not locked, not deleted
      const user = await this.prisma.user.findFirst({
        where: {
          id: verify.userId,
          googleSub: verify.sub,
          lockedAt: null,
          deletedAt: null,
        },
      });
      if (!user) {
        throw new ForbiddenException('Tài khoản đã bị khóa. Liên hệ admin của MONSPORT');
      }

      // (3) Issue OTP
      try {
        return await this.otpService.issue(user.phone, 'google_verify', 'sms');
      } catch (err) {
        if (err instanceof OtpThrottleException) {
          res.setHeader('Retry-After', String(err.retryAfter));
        }
        throw err;
      }
    }
  }

  @Post('google/complete')
  @HttpCode(201)
  async googleComplete(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    if (!this.googleConfig.enabled) throw new NotFoundException();
    const now = this.clock.now();
    const pending = readSignedJson<GooglePendingPayload>(
      GOOGLE_PENDING_COOKIE,
      cookieValue(req.headers.cookie, GOOGLE_PENDING_COOKIE),
      now,
    );
    if (!pending || pending.typ !== 'google_pending') {
      throw new BadRequestException('Thiếu hoặc hỏng thông tin đăng ký Google');
    }

    const input = GoogleCompleteRequest.safeParse(body);
    if (!input.success) {
      throw new BadRequestException(errorMessage(input.error));
    }

    // R4 before the code check. Each 409 counts on otp-ip and otp-sub, as on /google/otp (AC-40),
    // and a caller at the limit gets 429 for every phone, so the answer tells nothing about the account.
    const blocked = await this.throttle.otpRequestBlocked(req.ip, pending.sub);
    if (blocked !== null) {
      res.setHeader('Retry-After', String(blocked));
      throw new OtpThrottleException(blocked);
    }
    const existing = await this.prisma.user.findUnique({ where: { phone: input.data.phone } });
    if (existing) {
      const retryAfter = await this.throttle.consumeOtpRequest(req.ip, pending.sub);
      if (retryAfter !== null) {
        res.setHeader('Retry-After', String(retryAfter));
        throw new OtpThrottleException(retryAfter);
      }
      throw new ConflictException('Số này đã có tài khoản. Hãy đăng nhập bằng mật khẩu, rồi liên kết Google');
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
      if (isUniqueViolation(error)) {
        throw new ConflictException(PHONE_TAKEN);
      }
      throw error;
    }

    res.clearCookie(GOOGLE_PENDING_COOKIE, { path: GOOGLE_COOKIE_PATH });
    this.startSession(res, user.id);
    return { id: user.id, name: user.name, role: user.role };
  }

  @Post('google/verify')
  @HttpCode(200)
  async googleVerify(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    if (!this.googleConfig.enabled) throw new NotFoundException();
    const now = this.clock.now();
    const verify = readSignedJson<GoogleVerifyPayload>(
      GOOGLE_VERIFY_COOKIE,
      cookieValue(req.headers.cookie, GOOGLE_VERIFY_COOKIE),
      now,
    );
    if (!verify || verify.typ !== 'google_verify') {
      throw new BadRequestException('Thiếu hoặc hỏng thông tin xác minh Google');
    }

    const input = GoogleVerifyRequest.safeParse(body);
    if (!input.success) {
      throw new BadRequestException(errorMessage(input.error));
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: verify.userId,
        googleSub: verify.sub,
        lockedAt: null,
        deletedAt: null,
      },
    });
    if (!user) {
      throw new ForbiddenException('Tài khoản đã bị khóa. Liên hệ admin của MONSPORT');
    }

    const codeHash = await this.otpService.verifyCode(user.phone, 'google_verify', input.data.code);

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await this.otpService.deleteCode(tx, user.phone, 'google_verify', codeHash);
      const rows = await tx.$queryRaw<User[]>`
        UPDATE "User"
        SET "phoneVerifiedAt" = ${now}
        WHERE id = ${verify.userId}
          AND "googleSub" = ${verify.sub}
          AND "lockedAt" IS NULL
          AND "deletedAt" IS NULL
        RETURNING *
      `;
      if (rows.length === 0) {
        throw new ForbiddenException('Tài khoản đã bị khóa. Liên hệ admin của MONSPORT');
      }
      return rows[0];
    });

    res.clearCookie(GOOGLE_VERIFY_COOKIE, { path: GOOGLE_COOKIE_PATH });
    this.startSession(res, updatedUser.id);
    return { id: updatedUser.id, name: updatedUser.name, role: updatedUser.role };
  }

  @Post('google/unlink')
  @HttpCode(200)
  @UseGuards(GoogleEnabledGuard, SessionGuard)
  async googleUnlink(@Req() req: AuthedRequest): Promise<{ ok: true }> {
    if (!this.googleConfig.enabled) throw new NotFoundException();
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.deletedAt) throw new UnauthorizedException();
    if (user.lockedAt) throw new ForbiddenException('Tài khoản đã bị khóa. Liên hệ admin của MONSPORT');
    if (!user.passwordHash) {
      throw new BadRequestException('Hãy đặt mật khẩu trước khi gỡ Google');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { googleSub: null },
    });
    return { ok: true };
  }

  private startSession(res: Response, userId: string): void {
    res.cookie(SESSION_COOKIE, issueSession(userId, this.clock.now()), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MS,
      path: '/',
    });
  }
}

/** Brief F-006, BR-30: 429 with the seconds to wait, when a counter passed its limit. */
function refuseWhenThrottled(res: Response, retryAfter: number | null): void {
  if (retryAfter === null) return;
  res.setHeader('Retry-After', String(retryAfter));
  throw new HttpException(Messages.tooManyAttempts, HttpStatus.TOO_MANY_REQUESTS);
}
