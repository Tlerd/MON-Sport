import type { NotificationItemView, Role } from '@monsport/shared';

export function notificationTarget(role: Role | null | undefined, _item: NotificationItemView): string | null {
  if (role === 'USER') return '/lich-cua-toi';
  if (role === 'OWNER') return '/chu-san/yeu-cau';
  return null;
}

export function unreadBadge(count: number): string {
  const n = Math.floor(count);
  if (!Number.isFinite(n) || n < 1) return '';
  return n > 99 ? '99+' : String(n);
}
