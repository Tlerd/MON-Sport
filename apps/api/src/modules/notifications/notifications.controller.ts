import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  Messages,
  type NotificationReadAllResponse,
  type NotificationReadResponse,
  type NotificationsListResponse,
} from '@monsport/shared';
import { type AuthedRequest, Roles, SessionGuard } from '../auth/session.guard.js';
import { NotificationsService } from './notifications.service.js';

const Id = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException(Messages.invalid) });

@Controller('notifications')
@UseGuards(SessionGuard)
@Roles('USER', 'OWNER', 'ADMIN')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** UC-14: list notifications for the authenticated user, newest first. */
  @Get()
  list(@Req() req: AuthedRequest): Promise<NotificationsListResponse> {
    return this.notifications.listForUser(req.user.id);
  }

  /** Marks all unread notifications of the authenticated user as read. */
  @Post('read-all')
  @HttpCode(200)
  readAll(@Req() req: AuthedRequest): Promise<NotificationReadAllResponse> {
    return this.notifications.markAllAsRead(req.user.id);
  }

  /** Marks a single notification as read. Idempotent. */
  @Post(':id/read')
  @HttpCode(200)
  readOne(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<NotificationReadResponse> {
    return this.notifications.markAsRead(req.user.id, id);
  }
}
