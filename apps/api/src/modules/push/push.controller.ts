import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Logger, NotFoundException, Post, Req, Res, UseGuards } from '@nestjs/common';
import { errorMessage, isAllowedPushEndpoint, type PushPublicKeyResponse, PushSubscribeRequest, PushUnsubscribeRequest } from '@monsport/shared';
import type { Response } from 'express';
import { type AuthedRequest, Roles, SessionGuard } from '../auth/session.guard.js';
import { SubscriptionsService } from './subscriptions.service.js';

const OFF = 'Thông báo đẩy chưa bật';

/**
 * Brief F-014, Assumption 10: the feature is off unless the public key, the private key, and the subject are all set.
 * The API reads the variables on each request. Returns the public key.
 */
function vapidPublicKey(): string {
  const [publicKey, privateKey, subject] = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'].map((name) => process.env[name]?.trim());
  if (!publicKey || !privateKey || !subject) throw new NotFoundException(OFF);
  return publicKey;
}

/** The host of a refused endpoint, for the log. The endpoint itself is personal data and stays out of the log. */
function hostOf(endpoint: unknown): string | undefined {
  if (typeof endpoint !== 'string') return undefined;
  try {
    return new URL(endpoint).hostname.slice(0, 255) || 'unparseable';
  } catch {
    return 'unparseable';
  }
}

// UC-14: every signed-in role can register a device. The routes never log or return the endpoint or the keys.
@Controller('push')
@UseGuards(SessionGuard)
@Roles('USER', 'OWNER', 'ADMIN')
export class PushController {
  private readonly logger = new Logger(PushController.name);

  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('public-key')
  publicKey(): PushPublicKeyResponse {
    return { publicKey: vapidPublicKey() };
  }

  /** 201 for a new device, 200 when the endpoint already exists. */
  @Post('subscriptions')
  async subscribe(@Req() req: AuthedRequest, @Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<void> {
    vapidPublicKey();
    const input = PushSubscribeRequest.safeParse(body);
    if (!input.success) {
      const endpoint = (body as { endpoint?: unknown } | null)?.endpoint;
      const host = hostOf(endpoint);
      if (host && !isAllowedPushEndpoint(endpoint)) this.logger.warn(`Push endpoint refused (host ${host})`);
      throw new BadRequestException(errorMessage(input.error));
    }
    const created = await this.subscriptions.subscribe(req.user.id, input.data);
    res.status(created ? 201 : 200);
  }

  /** 204 also when the endpoint does not exist or belongs to another user, so a caller learns nothing about other rows. */
  @Delete('subscriptions')
  @HttpCode(204)
  async unsubscribe(@Req() req: AuthedRequest, @Body() body: unknown): Promise<void> {
    const input = PushUnsubscribeRequest.safeParse(body);
    if (!input.success) throw new BadRequestException(errorMessage(input.error));
    await this.subscriptions.unsubscribe(req.user.id, input.data.endpoint);
  }
}
