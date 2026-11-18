import type { BookingView, CourtView, VenueView } from '@monsport/shared';
import {
  DURATIONS,
  durationLabel,
  formatDay,
  formatSlot,
  formatTime,
  formatVnd,
  hhmm,
} from '@monsport/client';
import { Clock, Phone } from 'lucide-react';
import { type RefObject, useState } from 'react';
import { StatusBadge } from '../../../components/StatusBadge.tsx';

interface BookingSummaryProps {
  selectedVenue: VenueView;
  selectedCourt: CourtView | null;
  selectedDate: string;
  selectedStart: number | null;
  duration: number;
  onDurationChange: (duration: number) => void;
  price: number | null;
  deadlineHint: string | null;
  error: string;
  busy: boolean;
  result: BookingView | null;
  resultRef: RefObject<HTMLDivElement | null>;
  onSubmit: () => void;
}

export function BookingSummary({
  selectedVenue,
  selectedCourt,
  selectedDate,
  selectedStart,
  duration,
  onDurationChange,
  price,
  deadlineHint,
  error,
  busy,
  result,
  resultRef,
  onSubmit,
}: BookingSummaryProps) {
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  return (
    <aside className="book-side">
      <section className={`card sum summary-section ${summaryExpanded ? 'expanded' : ''}`}>
        <button
          type="button"
          className="book-sum-toggle"
          aria-expanded={summaryExpanded}
          onClick={() => setSummaryExpanded((v) => !v)}
        >
          <span>Tạm tính</span>
          <b className="money tnum">{price !== null ? formatVnd(price) : '—'}</b>
          <span className="link">{summaryExpanded ? 'Thu gọn' : 'Chi tiết'}</span>
        </button>
        <h2>Đặt sân</h2>

        <dl className="sum-list tnum">
          <div className="sum-row">
            <dt>Sân</dt>
            <dd>{selectedCourt ? selectedCourt.name : 'Chưa chọn'}</dd>
          </div>
          <div className="sum-row">
            <dt>Ngày</dt>
            <dd>{selectedDate ? formatDay(selectedDate) : '—'}</dd>
          </div>
          <div className="sum-row">
            <dt>Giờ</dt>
            <dd>
              {selectedStart !== null
                ? `${hhmm(selectedStart)}–${hhmm(selectedStart + duration)}`
                : 'Chưa chọn'}
            </dd>
          </div>
          <div className="sum-row">
            <dt>Thời lượng</dt>
            <dd>
              <select
                value={duration}
                onChange={(e) => onDurationChange(Number(e.target.value))}
                className="duration-select"
                aria-label="Thời lượng"
              >
                {DURATIONS.filter(
                  (d) => (selectedStart ?? selectedVenue.opensAt) + d <= selectedVenue.closesAt,
                ).map((d) => (
                  <option key={d} value={d}>
                    {durationLabel(d)}
                  </option>
                ))}
              </select>
            </dd>
          </div>
        </dl>

        <div className="sum-total total">
          <span>Tạm tính</span>
          <strong className="money tnum">{price !== null ? formatVnd(price) : '—'}</strong>
        </div>

        {error && (
          <p className="error bad" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className="btn lime wide"
          disabled={!selectedCourt || selectedStart === null || busy}
          onClick={onSubmit}
        >
          Gửi yêu cầu
        </button>

        {selectedStart !== null && selectedVenue.phone && (
          <a
            className="call link call-owner-link"
            href={`tel:${selectedVenue.phone}`}
          >
            <Phone size={14} className="ic" aria-hidden="true" />
            <span>Gọi chủ sân</span>
          </a>
        )}

        {deadlineHint && (
          <div className="hint">
            <Clock size={16} className="ic" aria-hidden="true" />
            <span>{deadlineHint}</span>
          </div>
        )}

        <div role="status" className="live">
          {result && (
            <div ref={resultRef} className="ticket result" data-status={result.status}>
              <span className="stub">
                <strong>{formatTime(result.startAt)}</strong>
                <span>đến {formatTime(result.endAt)}</span>
              </span>
              <span className="body">
                <StatusBadge status={result.status} />
                <span>{formatSlot(result.startAt, result.endAt)}</span>
                <strong className="money">{formatVnd(result.priceTotal)}</strong>
              </span>
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
