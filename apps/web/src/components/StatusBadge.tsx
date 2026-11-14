import type { HTMLAttributes } from 'react';
import type { BookingStatus, MatchStatus } from '@monsport/shared';
import { Check, Clock, Lock, Minus, Users, X } from 'lucide-react';

export type StatusValue = BookingStatus | MatchStatus | string;

interface StatusConfig {
  tone: 'warn' | 'ok' | 'bad' | 'ghost';
  icon: typeof Check;
  defaultLabel: string;
}

const CONFIG: Record<string, StatusConfig> = {
  PENDING: { tone: 'warn', icon: Clock, defaultLabel: 'Chờ xác nhận' },
  CONFIRMED: { tone: 'ok', icon: Check, defaultLabel: 'Đã xác nhận' },
  REJECTED: { tone: 'bad', icon: X, defaultLabel: 'Bị từ chối' },
  EXPIRED: { tone: 'ghost', icon: Minus, defaultLabel: 'Hết hạn' },
  CANCELLED: { tone: 'ghost', icon: Minus, defaultLabel: 'Đã hủy' },
  OPEN: { tone: 'ok', icon: Users, defaultLabel: 'Mở' },
  FULL: { tone: 'ghost', icon: Lock, defaultLabel: 'Đầy' },
  FINISHED: { tone: 'ghost', icon: Minus, defaultLabel: 'Đã xong' },
};

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: StatusValue;
  label?: string;
}

export function StatusBadge({ status, label, className = '', ...rest }: StatusBadgeProps) {
  const conf = CONFIG[status] ?? {
    tone: 'ghost',
    icon: Minus,
    defaultLabel: status,
  };

  const Icon = conf.icon;
  const text = label ?? conf.defaultLabel;
  const classes = ['tag', conf.tone, className].filter(Boolean).join(' ');

  return (
    <span className={classes} {...rest}>
      <Icon size={14} aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}
