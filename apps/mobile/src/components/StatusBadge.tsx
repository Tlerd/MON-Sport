import type { BookingStatus } from '@monsport/shared';
import { Ban, CheckCircle2, Clock, TimerOff, XCircle } from 'lucide-react';
import type { HTMLAttributes } from 'react';

interface BadgeSpec {
  label: string;
  token: 'badge-wait' | 'badge-ok' | 'badge-no' | 'badge-off';
  color: string;
  backgroundColor: string;
  Icon: typeof Clock;
}

const SPECS: Record<BookingStatus, BadgeSpec> = {
  PENDING: {
    label: 'Chờ xác nhận',
    token: 'badge-wait',
    color: 'var(--color-status-wait)',
    backgroundColor: 'var(--color-status-wait-bg)',
    Icon: Clock,
  },
  CONFIRMED: {
    label: 'Đã xác nhận',
    token: 'badge-ok',
    color: 'var(--color-status-ok)',
    backgroundColor: 'var(--color-status-ok-bg)',
    Icon: CheckCircle2,
  },
  REJECTED: {
    label: 'Bị từ chối',
    token: 'badge-no',
    color: 'var(--color-status-no)',
    backgroundColor: 'var(--color-status-no-bg)',
    Icon: XCircle,
  },
  EXPIRED: {
    label: 'Hết hạn',
    token: 'badge-off',
    color: 'var(--color-status-off)',
    backgroundColor: 'var(--color-status-off-bg)',
    Icon: TimerOff,
  },
  CANCELLED: {
    label: 'Đã hủy',
    token: 'badge-off',
    color: 'var(--color-status-off)',
    backgroundColor: 'var(--color-status-off-bg)',
    Icon: Ban,
  },
};

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: BookingStatus;
}

export function StatusBadge({ status, className, style, ...rest }: StatusBadgeProps) {
  const { label, token, color, backgroundColor, Icon } = SPECS[status];
  const classes = ['badge', token, className].filter(Boolean).join(' ');

  return (
    <span
      className={classes}
      data-status={status}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-xs)',
        height: '24px',
        padding: '0 var(--space-sm)',
        borderRadius: 'var(--radius-full)',
        font: 'var(--font-label)',
        color,
        backgroundColor,
        ...style,
      }}
      {...rest}
    >
      <Icon size={14} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
