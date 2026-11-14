import {
  SKILL_LEVEL_LABELS,
  type MatchView,
  type Sport,
} from '@monsport/shared';
import { formatDay, formatTime, formatVnd } from '@monsport/client';
import type { ReactNode } from 'react';
import { CourtArt } from './CourtArt.tsx';
import { SportIcon } from './SportIcon.tsx';
import { StatusBadge } from './StatusBadge.tsx';

export const SPORT_LABEL: Record<Sport, string> = {
  FOOTBALL: 'Bóng đá',
  BADMINTON: 'Cầu lông',
};

export const BOOKING_BADGE: Record<MatchView['bookingStatus'], string> = {
  PENDING: 'Chưa xác nhận',
  CONFIRMED: 'Đã xác nhận',
  REJECTED: 'Bị từ chối',
  EXPIRED: 'Hết hạn',
  CANCELLED: 'Đã hủy',
};

export function MatchCardContent({
  match: m,
  footerAction,
}: {
  match: MatchView;
  footerAction?: ReactNode;
}) {
  return (
    <>
      <div className="stub">
        <CourtArt sport={m.sport} />
        <span className="stub-sport">
          <SportIcon sport={m.sport} size={14} />
          <span>{SPORT_LABEL[m.sport]}</span>
        </span>
        <div className="stub-when">
          <b>{formatTime(m.startAt)}</b>
          <span>{formatDay(m.startAt)}</span>
        </div>
      </div>
      <div className="mc-b">
        <div className="tags">
          <span className="tag solo">Trận đơn</span>
          <StatusBadge className="status" status={m.bookingStatus} label={BOOKING_BADGE[m.bookingStatus]} />
          {(m.status === 'FULL' || m.joinedCount >= m.capacity) && (
            <StatusBadge className="status" status="FULL" />
          )}
          {(m.joinMode ?? 'INSTANT') === 'APPROVAL' && (
            <StatusBadge className="status" status="APPROVAL" label="Host duyệt" />
          )}
          {m.hostSkillLevel && (
            <span className="tag level-badge">{`Trình độ: ${SKILL_LEVEL_LABELS[m.hostSkillLevel]}`}</span>
          )}
        </div>
        <h3>
          <span className="where">{`${m.venueName} · ${m.courtName}`}</span>
        </h3>
        <p className="meta">
          <span>{`${SPORT_LABEL[m.sport]} · Ngày ${formatDay(m.startAt)}`}</span>
          <span aria-hidden="true"> · </span>
          <span>{`${formatTime(m.startAt)}–${formatTime(m.endAt)}`}</span>
          <span aria-hidden="true"> · </span>
          <span data-field="customer">Host: {m.hostName}</span>
        </p>
        <div className="mc-f">
          <span className="match-slots fee">{`${m.joinedCount}/${m.capacity} suất · ${formatVnd(m.pricePerSlot)}/suất`}</span>
          {footerAction}
        </div>
      </div>
    </>
  );
}
