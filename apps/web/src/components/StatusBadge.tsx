import type { HTMLAttributes } from 'react';
import type { BookingStatus, MatchStatus } from '@monsport/shared';
import { Check, Clock, Lock, Minus, Users, X } from 'lucide-react';

export type StatusValue = BookingStatus | MatchStatus | string;

interface StatusConfig {
  variant: 'wait' | 'ok' | 'no' | 'off';
  icon: typeof Check;
  defaultLabel: string;
}

const CONFIG: Record<string, StatusConfig> = {
  PENDING: { variant: 'wait', icon: Clock, defaultLabel: 'Chờ xác nhận' },
  CONFIRMED: { variant: 'ok', icon: Check, defaultLabel: 'Đã xác nhận' },
  REJECTED: { variant: 'no', icon: X, defaultLabel: 'Bị từ chối' },
  EXPIRED: { variant: 'off', icon: Minus, defaultLabel: 'Hết hạn' },
  CANCELLED: { variant: 'off', icon: Minus, defaultLabel: 'Đã hủy' },
  OPEN: { variant: 'ok', icon: Users, defaultLabel: 'Mở' },
  FULL: { variant: 'off', icon: Lock, defaultLabel: 'Đầy' },
  FINISHED: { variant: 'off', icon: Minus, defaultLabel: 'Đã xong' },
};

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: StatusValue;
  label?: string;
}

export function StatusBadge({ status, label, className = '', ...rest }: StatusBadgeProps) {
  const conf = CONFIG[status] ?? {
    variant: 'off',
    icon: Minus,
    defaultLabel: status,
  };

  const Icon = conf.icon;
  const text = label ?? conf.defaultLabel;
  const classes = ['badge', conf.variant, className].filter(Boolean).join(' ');

  return (
    <span className={classes} {...rest}>
      <Icon size={14} aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}
