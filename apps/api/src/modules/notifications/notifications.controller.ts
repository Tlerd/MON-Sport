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

  @Get()
  list(@Req() req: AuthedRequest): Promise<NotificationsListResponse> {
    return this.notifications.listForUser(req.user.id);
  }

  @Post('read-all')
  @HttpCode(200)
  readAll(@Req() req: AuthedRequest): Promise<NotificationReadAllResponse> {
    return this.notifications.markAllAsRead(req.user.id);
  }

  @Post(':id/read')
  @HttpCode(200)
  readOne(@Req() req: AuthedRequest, @Param('id', Id) id: string): Promise<NotificationReadResponse> {
    return this.notifications.markAsRead(req.user.id, id);
  }
}
