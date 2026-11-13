import { describe, expect, it } from 'vitest';
import {
  formatNotificationContent,
  formatSlotTime,
  NotificationItemView,
  NotificationReadAllResponse,
  NotificationReadResponse,
  NotificationsListResponse,
  NotificationType,
} from './notification.ts';

describe('notification schemas and helpers', () => {
  const startAt = '2026-11-20T13:00:00.000Z'; // 20:00 UTC+7
  const endAt = '2026-11-20T14:00:00.000Z'; // 21:00 UTC+7

  it('formats slot time in Asia/Ho_Chi_Minh', () => {
    expect(formatSlotTime(startAt, endAt)).toBe('20:00 - 21:00 ngày 20/11/2026');
  });

  it('formats notification content for each notification type', () => {
    const base = {
      venueName: 'Cầu lông A',
      courtName: 'Sân 1',
      startAt,
      endAt,
    };

    expect(formatNotificationContent({ ...base, type: 'BOOKING_REQUESTED' })).toEqual({
      title: 'Yêu cầu đặt sân mới',
      message: 'Có yêu cầu đặt sân tại Cầu lông A - Sân 1 khung 20:00 - 21:00 ngày 20/11/2026.',
    });

    expect(formatNotificationContent({ ...base, type: 'BOOKING_CONFIRMED' })).toEqual({
      title: 'Yêu cầu đặt sân đã được xác nhận',
      message: 'Chủ sân đã xác nhận yêu cầu đặt sân tại Cầu lông A - Sân 1 khung 20:00 - 21:00 ngày 20/11/2026.',
    });

    expect(formatNotificationContent({ ...base, type: 'BOOKING_REJECTED' })).toEqual({
      title: 'Yêu cầu đặt sân bị từ chối',
      message: 'Chủ sân đã từ chối yêu cầu đặt sân tại Cầu lông A - Sân 1 khung 20:00 - 21:00 ngày 20/11/2026.',
    });

    expect(formatNotificationContent({ ...base, type: 'MATCH_CANCELLED' })).toEqual({
      title: 'Trận đấu đã bị hủy',
      message: 'Trận đấu tại Cầu lông A - Sân 1 khung 20:00 - 21:00 ngày 20/11/2026 đã bị hủy.',
    });
  });

  it('validates NotificationType enum', () => {
    expect(NotificationType.safeParse('BOOKING_REQUESTED').success).toBe(true);
    expect(NotificationType.safeParse('BOOKING_CONFIRMED').success).toBe(true);
    expect(NotificationType.safeParse('BOOKING_REJECTED').success).toBe(true);
    expect(NotificationType.safeParse('MATCH_CANCELLED').success).toBe(true);
    expect(NotificationType.safeParse('OTHER').success).toBe(false);
  });

  it('validates NotificationItemView schema', () => {
    const item = {
      id: '01925b42-d6d8-7b96-9372-23c34a9ef111',
      type: 'BOOKING_REQUESTED',
      bookingId: '01925b42-d6d8-7b96-9372-23c34a9ef222',
      matchId: null,
      readAt: null,
      createdAt: '2026-11-20T03:00:00.000Z',
      title: 'Yêu cầu đặt sân mới',
      message: 'Có yêu cầu đặt sân tại Cầu lông A - Sân 1 khung 20:00 - 21:00 ngày 20/11/2026.',
      venueName: 'Cầu lông A',
      courtName: 'Sân 1',
      startAt,
      endAt,
    };
    expect(NotificationItemView.safeParse(item).success).toBe(true);
  });

  it('validates NotificationsListResponse schema', () => {
    const res = {
      unreadCount: 1,
      items: [
        {
          id: '01925b42-d6d8-7b96-9372-23c34a9ef111',
          type: 'BOOKING_REQUESTED',
          bookingId: '01925b42-d6d8-7b96-9372-23c34a9ef222',
          matchId: null,
          readAt: null,
          createdAt: '2026-11-20T03:00:00.000Z',
          title: 'Yêu cầu đặt sân mới',
          message: 'Có yêu cầu đặt sân tại Cầu lông A - Sân 1 khung 20:00 - 21:00 ngày 20/11/2026.',
          venueName: 'Cầu lông A',
          courtName: 'Sân 1',
          startAt,
          endAt,
        },
      ],
    };
    expect(NotificationsListResponse.safeParse(res).success).toBe(true);
  });

  it('validates NotificationReadResponse and NotificationReadAllResponse schemas', () => {
    expect(
      NotificationReadResponse.safeParse({
        id: '01925b42-d6d8-7b96-9372-23c34a9ef111',
        readAt: '2026-11-20T04:00:00.000Z',
      }).success,
    ).toBe(true);

    expect(NotificationReadAllResponse.safeParse({ count: 5 }).success).toBe(true);
  });
});

describe('join request notifications, brief F-028', () => {
  const base = {
    venueName: 'Cầu lông A',
    courtName: 'Sân 1',
    startAt: '2026-11-20T13:00:00.000Z',
    endAt: '2026-11-20T14:00:00.000Z',
  };

  it('AC-11: NotificationType has the three join request types', () => {
    for (const type of ['MATCH_JOIN_REQUESTED', 'MATCH_JOIN_APPROVED', 'MATCH_JOIN_REJECTED']) {
      expect(NotificationType.safeParse(type).success).toBe(true);
    }
  });

  it('AC-11: formatNotificationContent returns the title and message for MATCH_JOIN_REQUESTED, MATCH_JOIN_APPROVED, MATCH_JOIN_REJECTED', () => {
    expect(formatNotificationContent({ ...base, type: 'MATCH_JOIN_REQUESTED' })).toEqual({
      title: 'Có người xin vào trận',
      message: 'Có người xin vào trận của bạn tại Cầu lông A - Sân 1 khung 20:00 - 21:00 ngày 20/11/2026.',
    });
    expect(formatNotificationContent({ ...base, type: 'MATCH_JOIN_APPROVED' })).toEqual({
      title: 'Bạn đã được vào trận',
      message: 'Host đã duyệt yêu cầu vào trận tại Cầu lông A - Sân 1 khung 20:00 - 21:00 ngày 20/11/2026.',
    });
    expect(formatNotificationContent({ ...base, type: 'MATCH_JOIN_REJECTED' })).toEqual({
      title: 'Yêu cầu vào trận bị từ chối',
      message: 'Host đã từ chối yêu cầu vào trận tại Cầu lông A - Sân 1 khung 20:00 - 21:00 ngày 20/11/2026.',
    });
  });
});
