import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Post, Req, Res, UseGuards } from '@nestjs/common';
import { errorMessage, type PushPublicKeyResponse, PushSubscribeRequest, PushUnsubscribeRequest } from '@monsport/shared';
import type { Response } from 'express';
import { type AuthedRequest, Roles, SessionGuard } from '../auth/session.guard.js';
import { SubscriptionsService } from './subscriptions.service.js';

const OFF = 'Thông báo đẩy chưa bật';

/** Brief F-014, Assumption 10: the feature is off without a public key. The API reads the variable on each request. */
function vapidPublicKey(): string {
  const key = process.env.VAPID_PUBLIC_KEY?.trim();
  if (!key) throw new NotFoundException(OFF);
  return key;
}

// UC-14: every signed-in role can register a device. The routes never log or return the endpoint or the keys.
@Controller('push')
@UseGuards(SessionGuard)
@Roles('USER', 'OWNER', 'ADMIN')
export class PushController {
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
    if (!input.success) throw new BadRequestException(errorMessage(input.error));
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
