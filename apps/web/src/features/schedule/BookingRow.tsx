import { confirmDeadline, type OwnerBookingView } from '@monsport/shared';
import { formatTime, formatVnd } from '@monsport/client';
import { Check, Clock } from 'lucide-react';
import { Avatar } from '../../components/Avatar.tsx';

export function formatDeadlineRemaining(createdAt: string, startAt: string) {
  const dl = confirmDeadline(new Date(createdAt), new Date(startAt));
  const diffMs = dl.getTime() - Date.now();
  if (diffMs <= 0) return 'Hết hạn';
  const diffMins = Math.floor(diffMs / 60000);
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  if (h > 0) return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
  return `${m} phút`;
}

interface BookingRowProps {
  req: OwnerBookingView;
  isSelected: boolean;
  courtDisplayName: string;
  onSelect: (req: OwnerBookingView) => void;
  onDecide: (id: string, action: 'confirm' | 'reject') => void;
}

export function BookingRow({
  req,
  isSelected,
  courtDisplayName,
  onSelect,
  onDecide,
}: BookingRowProps) {
  const customerName = req.customer?.name ?? 'Khách';
  const deadlineText = formatDeadlineRemaining(req.createdAt, req.startAt);

  return (
    <div
      className={`pending-req ${isSelected ? 'on active' : ''}`}
      onClick={() => onSelect(req)}
    >
      <div className="req-row-1">
        <Avatar name={customerName} size={28} />
        <b className="req-name">{customerName}</b>
        <span className="tag warn">
          <Clock size={12} aria-hidden="true" />
          <span>{deadlineText}</span>
        </span>
      </div>

      <div className="req-court-time">
        {courtDisplayName} · {formatTime(req.startAt)}–{formatTime(req.endAt)}
      </div>

      <div className="req-meta">
        <span className="req-price money tnum">{formatVnd(req.priceTotal)}</span> · gửi lúc {formatTime(req.createdAt)}
      </div>

      <div className="req-act">
        <button
          type="button"
          className="btn sm ghost"
          onClick={(e) => {
            e.stopPropagation();
            onDecide(req.id, 'reject');
          }}
        >
          Từ chối
        </button>
        <button
          type="button"
          className="btn sm lime"
          onClick={(e) => {
            e.stopPropagation();
            onDecide(req.id, 'confirm');
          }}
        >
          <Check size={14} aria-hidden="true" />
          <span>Xác nhận</span>
        </button>
      </div>
    </div>
  );
}
