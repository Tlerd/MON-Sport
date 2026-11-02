import { describe, expect, it } from 'vitest';
import type { NotificationItemView, NotificationType } from '@monsport/shared';
import { notificationTarget, unreadBadge } from './notifications.ts';

const item = (type: NotificationType): NotificationItemView => ({
  id: '00000000-0000-4000-8000-000000000001',
  type,
  bookingId: '00000000-0000-4000-8000-0000000000b1',
  matchId: null,
  readAt: null,
  createdAt: '2026-11-02T10:00:00+07:00',
  title: 't',
  message: 'm',
  venueName: 'v',
  courtName: 'c',
  startAt: '2026-11-03T20:00:00+07:00',
  endAt: '2026-11-03T21:00:00+07:00',
});

const TYPES: NotificationType[] = ['BOOKING_REQUESTED', 'BOOKING_CONFIRMED', 'BOOKING_REJECTED', 'MATCH_CANCELLED'];

describe('notificationTarget', () => {
  it('AC-14: USER goes to /lich-cua-toi for every type', () => {
    for (const type of TYPES) expect(notificationTarget('USER', item(type))).toBe('/lich-cua-toi');
  });

  it('AC-14: OWNER goes to /chu-san/yeu-cau for every type', () => {
    for (const type of TYPES) expect(notificationTarget('OWNER', item(type))).toBe('/chu-san/yeu-cau');
  });

  it('AC-14: ADMIN and no role have no target, and no path starts with the /app basename', () => {
    for (const type of TYPES) {
      expect(notificationTarget('ADMIN', item(type))).toBeNull();
      expect(notificationTarget(null, item(type))).toBeNull();
      expect(notificationTarget(undefined, item(type))).toBeNull();
      expect(notificationTarget('USER', item(type))?.startsWith('/app')).toBe(false);
      expect(notificationTarget('OWNER', item(type))?.startsWith('/app')).toBe(false);
    }
  });
});

describe('unreadBadge', () => {
  it('AC-15: returns "", "1", "99" and "99+" for 0, 1, 99 and 100', () => {
    expect(unreadBadge(0)).toBe('');
    expect(unreadBadge(1)).toBe('1');
    expect(unreadBadge(99)).toBe('99');
    expect(unreadBadge(100)).toBe('99+');
  });

  it('AC-15: treats a negative or non-integer count as no badge', () => {
    expect(unreadBadge(-3)).toBe('');
    expect(unreadBadge(Number.NaN)).toBe('');
  });
});
