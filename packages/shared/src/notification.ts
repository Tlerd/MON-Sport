import { z } from 'zod';

// Brief F-013 (UC-14): In-app notifications. Names follow docs/requirements/data-dictionary.md.

export const NotificationType = z.enum([
  'BOOKING_REQUESTED',
  'BOOKING_CONFIRMED',
  'BOOKING_REJECTED',
  'MATCH_CANCELLED',
]);
export type NotificationType = z.infer<typeof NotificationType>;

const Instant = z.iso.datetime({ offset: true });

export const NotificationItemView = z.object({
  id: z.uuid(),
  type: NotificationType,
  bookingId: z.uuid(),
  matchId: z.uuid().nullable(),
  readAt: Instant.nullable(),
  createdAt: Instant,
  title: z.string(),
  message: z.string(),
  venueName: z.string(),
  courtName: z.string(),
  startAt: Instant,
  endAt: Instant,
});
export type NotificationItemView = z.infer<typeof NotificationItemView>;

export const NotificationsListResponse = z.object({
  unreadCount: z.int().min(0),
  items: z.array(NotificationItemView),
});
export type NotificationsListResponse = z.infer<typeof NotificationsListResponse>;

export const NotificationReadResponse = z.object({
  id: z.uuid(),
  readAt: Instant,
});
export type NotificationReadResponse = z.infer<typeof NotificationReadResponse>;

export const NotificationReadAllResponse = z.object({
  count: z.int().min(0),
});
export type NotificationReadAllResponse = z.infer<typeof NotificationReadAllResponse>;

// Display in Asia/Ho_Chi_Minh (BR-27).
const timeFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** Formats a start and end instant to "HH:mm - HH:mm ngày DD/MM/YYYY" in Asia/Ho_Chi_Minh. */
export function formatSlotTime(start: Date | string, end: Date | string): string {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  return `${timeFormat.format(startDate)} - ${timeFormat.format(endDate)} ngày ${dateFormat.format(startDate)}`;
}

export interface NotificationContentParams {
  type: NotificationType;
  venueName: string;
  courtName: string;
  startAt: Date | string;
  endAt: Date | string;
}

/** Returns the standard Vietnamese title and message for a notification (brief F-013). */
export function formatNotificationContent(params: NotificationContentParams): { title: string; message: string } {
  const slotTime = formatSlotTime(params.startAt, params.endAt);
  switch (params.type) {
    case 'BOOKING_REQUESTED':
      return {
        title: 'Yêu cầu đặt sân mới',
        message: `Có yêu cầu đặt sân tại ${params.venueName} - ${params.courtName} khung ${slotTime}.`,
      };
    case 'BOOKING_CONFIRMED':
      return {
        title: 'Yêu cầu đặt sân đã được xác nhận',
        message: `Chủ sân đã xác nhận yêu cầu đặt sân tại ${params.venueName} - ${params.courtName} khung ${slotTime}.`,
      };
    case 'BOOKING_REJECTED':
      return {
        title: 'Yêu cầu đặt sân bị từ chối',
        message: `Chủ sân đã từ chối yêu cầu đặt sân tại ${params.venueName} - ${params.courtName} khung ${slotTime}.`,
      };
    case 'MATCH_CANCELLED':
      return {
        title: 'Trận đấu đã bị hủy',
        message: `Trận đấu tại ${params.venueName} - ${params.courtName} khung ${slotTime} đã bị hủy.`,
      };
  }
}
