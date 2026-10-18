import { Injectable, NotFoundException } from '@nestjs/common';
import {
  formatNotificationContent,
  type NotificationItemView,
  type NotificationReadAllResponse,
  type NotificationReadResponse,
  type NotificationsListResponse,
  type NotificationType,
} from '@monsport/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  /**
   * Brief F-013 (UC-14): creates a notification within the caller's database transaction.
   * Lock hierarchy: Venue (FOR SHARE) -> Court (FOR UPDATE) -> Booking -> Match -> MatchPlayer -> Notification.
   */
  async createNotification(
    tx: Prisma.TransactionClient,
    data: {
      userId: string;
      type: NotificationType;
      bookingId: string;
      matchId?: string | null;
    },
  ): Promise<void> {
    const now = this.clock.now();
    await tx.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        bookingId: data.bookingId,
        matchId: data.matchId ?? null,
        readAt: null,
        createdAt: now,
      },
    });
  }

  /** UC-14: lists notifications for the authenticated user, newest first. */
  async listForUser(userId: string): Promise<NotificationsListResponse> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      include: {
        booking: {
          include: {
            court: {
              include: { venue: true },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const unreadCount = rows.filter((r) => r.readAt === null).length;
    const items: NotificationItemView[] = rows.map((r) => {
      const venueName = r.booking.court.venue.name;
      const courtName = r.booking.court.name;
      const startAt = r.booking.startAt.toISOString();
      const endAt = r.booking.endAt.toISOString();
      const { title, message } = formatNotificationContent({
        type: r.type,
        venueName,
        courtName,
        startAt: r.booking.startAt,
        endAt: r.booking.endAt,
      });

      return {
        id: r.id,
        type: r.type,
        bookingId: r.bookingId,
        matchId: r.matchId,
        readAt: r.readAt ? r.readAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        title,
        message,
        venueName,
        courtName,
        startAt,
        endAt,
      };
    });

    return { unreadCount, items };
  }

  /** Marks a single notification as read if owned by the user. Idempotent. */
  async markAsRead(userId: string, notificationId: string): Promise<NotificationReadResponse> {
    const found = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!found || found.userId !== userId) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    if (found.readAt !== null) {
      return { id: found.id, readAt: found.readAt.toISOString() };
    }
    const now = this.clock.now();
    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: now },
    });
    return { id: updated.id, readAt: updated.readAt!.toISOString() };
  }

  /** Marks all unread notifications of the user as read. */
  async markAllAsRead(userId: string): Promise<NotificationReadAllResponse> {
    const now = this.clock.now();
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: now },
    });
    return { count: result.count };
  }
}
