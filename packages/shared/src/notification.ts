import { z } from 'zod';

export const NotificationType = z.enum([
  'BOOKING_REQUESTED',
  'BOOKING_CONFIRMED',
  'BOOKING_REJECTED',
  'MATCH_CANCELLED',
  'MATCH_JOIN_REQUESTED',
  'MATCH_JOIN_APPROVED',
  'MATCH_JOIN_REJECTED',
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
    case 'MATCH_JOIN_REQUESTED':
      return {
        title: 'Có người xin vào trận',
        message: `Có người xin vào trận của bạn tại ${params.venueName} - ${params.courtName} khung ${slotTime}.`,
      };
    case 'MATCH_JOIN_APPROVED':
      return {
        title: 'Bạn đã được vào trận',
        message: `Host đã duyệt yêu cầu vào trận tại ${params.venueName} - ${params.courtName} khung ${slotTime}.`,
      };
    case 'MATCH_JOIN_REJECTED':
      return {
        title: 'Yêu cầu vào trận bị từ chối',
        message: `Host đã từ chối yêu cầu vào trận tại ${params.venueName} - ${params.courtName} khung ${slotTime}.`,
      };
  }
}
