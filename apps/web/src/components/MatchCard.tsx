import {
  addDaysYmd,
  SKILL_LEVEL_LABELS,
  vnDateString,
  type MatchView,
  type Sport,
} from '@monsport/shared';
import { formatDay, formatTime, formatVnd } from '@monsport/client';
import { MapPin } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { initial } from './Avatar.tsx';
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

/** Stub label of the reference: "Hôm nay", "Ngày mai", or "T4, 18/11". */
export function stubDay(iso: string, now: Date = new Date()): string {
  const ymd = vnDateString(new Date(iso));
  const today = vnDateString(now);
  if (ymd === today) return 'Hôm nay';
  if (ymd === addDaysYmd(today, 1)) return 'Ngày mai';
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay();
  const [, month, dom] = ymd.split('-');
  return `${dow === 0 ? 'CN' : `T${dow + 1}`}, ${dom}/${month}`;
}

/** "60k" for round amounts, otherwise the full amount. */
export const formatPriceK = (amount: number) =>
  amount > 0 && amount % 1000 === 0 ? `${amount / 1000}k` : formatVnd(amount);

const AVATAR_COLORS = ['var(--ok)', 'var(--blue)', 'var(--clay)', 'var(--amber)', 'var(--ink2)'];
const MAX_AVATARS = 6;
const MAX_HOLES = 4;

/** Seats of one match: filled seats, then dashed empty seats. The list view has no player names, so only the host shows an initial. */
function SeatStack({ match: m }: { match: MatchView }) {
  const shown = Math.min(m.joinedCount, MAX_AVATARS);
  const extra = m.joinedCount - shown;
  const holes = Math.max(0, Math.min(m.capacity - m.joinedCount, MAX_HOLES));
  const style = (c: string): CSSProperties => ({ '--s': '28px', '--c': c }) as CSSProperties;
  return (
    <div className="stack" role="img" aria-label={`${m.joinedCount}/${m.capacity} suất`}>
      {Array.from({ length: shown }, (_, i) => (
        <span key={`p${i}`} className="av" style={style(i === 0 ? 'var(--ink)' : AVATAR_COLORS[i % AVATAR_COLORS.length])}>
          {i === 0 ? initial(m.hostName) : ''}
        </span>
      ))}
      {extra > 0 && <span className="av more" style={style('transparent')}>{`+${extra}`}</span>}
      {Array.from({ length: holes }, (_, i) => (
        <span key={`h${i}`} className="av hole" style={style('transparent')} />
      ))}
    </div>
  );
}

export function MatchCardContent({
  match: m,
  footerAction,
}: {
  match: MatchView;
  footerAction?: ReactNode;
}) {
  const left = m.capacity - m.joinedCount;
  const isFull = m.status === 'FULL' || left <= 0;
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
          <span>{stubDay(m.startAt)}</span>
        </div>
      </div>
      <div className="mc-b">
        <div className="tags">
          <span className="tag solo">Trận đơn</span>
          {isFull ? (
            <StatusBadge className="status" status="FULL" />
          ) : (
            <span className={`tag slots-left ${left <= 2 ? 'warn' : 'open'}`}>
              {left <= 2 ? `Thiếu ${left}` : `Còn ${left} chỗ`}
            </span>
          )}
          {(m.joinMode ?? 'INSTANT') === 'APPROVAL' && (
            <StatusBadge className="status" status="APPROVAL" label="Host duyệt" />
          )}
          {m.hostSkillLevel && (
            <span className="tag ghost level-badge">{`Trình độ: ${SKILL_LEVEL_LABELS[m.hostSkillLevel]}`}</span>
          )}
          <StatusBadge className="status" status={m.bookingStatus} label={BOOKING_BADGE[m.bookingStatus]} />
        </div>
        <h3>
          <span className="where">{`${m.venueName} · ${m.courtName}`}</span>
        </h3>
        <p className="meta" title={`${SPORT_LABEL[m.sport]} · Ngày ${formatDay(m.startAt)} · ${formatTime(m.startAt)}–${formatTime(m.endAt)} · Host: ${m.hostName}`}>
          <MapPin size={15} className="ic" aria-hidden="true" />
          <span>{`${SPORT_LABEL[m.sport]} · Ngày ${formatDay(m.startAt)}`}</span>
          <span aria-hidden="true"> · </span>
          <span>{`${formatTime(m.startAt)}–${formatTime(m.endAt)}`}</span>
          <span aria-hidden="true"> · </span>
          <span data-field="customer">Host: {m.hostName}</span>
        </p>
        <div className="mc-f">
          <SeatStack match={m} />
          <span className="match-slots fee">
            <b>{formatPriceK(m.pricePerSlot)}</b>/suất
          </span>
          {footerAction}
        </div>
      </div>
    </>
  );
}
