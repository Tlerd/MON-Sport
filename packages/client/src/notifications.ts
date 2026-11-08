import type { NotificationItemView, Role } from '@monsport/shared';

/**
 * The router path (no /app basename) that a notification opens, or null when the role has no screen for it.
 * The owner target is a placeholder screen until the owner brief ships.
 */
export function notificationTarget(role: Role | null | undefined, _item: NotificationItemView): string | null {
  if (role === 'USER') return '/lich-cua-toi';
  if (role === 'OWNER') return '/chu-san/yeu-cau';
  return null;
}

/** Text of the tab badge: empty for no unread, the count up to 99, then "99+". */
export function unreadBadge(count: number): string {
  const n = Math.floor(count);
  if (!Number.isFinite(n) || n < 1) return '';
  return n > 99 ? '99+' : String(n);
}
