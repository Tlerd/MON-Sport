import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Logger, NotFoundException, Post, Req, Res, UseGuards } from '@nestjs/common';
import { errorMessage, isAllowedPushEndpoint, type PushPublicKeyResponse, PushSubscribeRequest, PushUnsubscribeRequest } from '@monsport/shared';
import type { Response } from 'express';
import { type AuthedRequest, Roles, SessionGuard } from '../auth/session.guard.js';
import { SubscriptionsService } from './subscriptions.service.js';

const OFF = 'Thông báo đẩy chưa bật';

function vapidPublicKey(): string {
  const [publicKey, privateKey, subject] = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'].map((name) => process.env[name]?.trim());
  if (!publicKey || !privateKey || !subject) throw new NotFoundException(OFF);
  return publicKey;
}

function hostOf(endpoint: unknown): string | undefined {
  if (typeof endpoint !== 'string') return undefined;
  try {
    return new URL(endpoint).hostname.slice(0, 255) || 'unparseable';
  } catch {
    return 'unparseable';
  }
}

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

  @Delete('subscriptions')
  @HttpCode(204)
  async unsubscribe(@Req() req: AuthedRequest, @Body() body: unknown): Promise<void> {
    const input = PushUnsubscribeRequest.safeParse(body);
    if (!input.success) throw new BadRequestException(errorMessage(input.error));
    await this.subscriptions.unsubscribe(req.user.id, input.data.endpoint);
  }
}
