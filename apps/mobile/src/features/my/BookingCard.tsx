import { dayHeading, formatVnd, hhmm } from '@monsport/client';
import { minuteOfDayVN, userCancelDecision, vnDateString, type MyBookingView } from '@monsport/shared';
import { StatusBadge } from '../../components/StatusBadge.tsx';

export interface BookingCardProps {
  booking: MyBookingView;
  now: Date;
  onCancel: (booking: MyBookingView) => void;
}

export function BookingCard({ booking, now, onCancel }: BookingCardProps) {
  const startDate = new Date(booking.startAt);
  const endDate = new Date(booking.endAt);
  const dateHeading = dayHeading(vnDateString(startDate));
  const timeRange = `${hhmm(minuteOfDayVN(startDate))}–${hhmm(minuteOfDayVN(endDate))}`;
  const price = formatVnd(booking.priceTotal);

  const hasOpenMatch =
    booking.match !== null &&
    (booking.match.status === 'OPEN' || booking.match.status === 'FULL');

  const decision = userCancelDecision({ status: booking.status, startAt: startDate }, now);

  const deadline =
    booking.status === 'PENDING' && booking.confirmDeadline !== null
      ? `Chủ sân xác nhận trước ${hhmm(minuteOfDayVN(new Date(booking.confirmDeadline)))}`
      : null;

  return (
    <article
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-xs)',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        padding: 'var(--space-md) var(--space-base)',
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-line)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-sm)',
        }}
      >
        <span style={{ font: 'var(--font-headline-mobile)', overflowWrap: 'anywhere' }}>
          {booking.venueName}
        </span>
        <StatusBadge status={booking.status} />
      </div>

      <div style={{ font: 'var(--font-body)', color: 'var(--color-ink)' }}>
        <span>{booking.courtName}</span> · <span>{dateHeading}</span>
      </div>

      <div
        className="tnum"
        style={{
          font: 'var(--font-numeric)',
          color: 'var(--color-ink-muted)',
          display: 'flex',
          gap: 'var(--space-xs)',
        }}
      >
        <span>{timeRange}</span> · <span>{price}</span>
      </div>

      {hasOpenMatch && (
        <div style={{ font: 'var(--font-meta)', color: 'var(--color-ink-muted)' }}>
          {`Trận mở: ${booking.match!.joinedCount}/${booking.match!.capacity} suất`}
        </div>
      )}

      {decision === 'ALLOW' && hasOpenMatch && (
        <div style={{ font: 'var(--font-meta)', color: 'var(--color-ink-muted)' }}>
          Booking có trận. Hủy trận trên web hoặc ở tab Phòng chờ khi có.
        </div>
      )}

      {decision === 'ALLOW' && !hasOpenMatch && (
        <button
          type="button"
          onClick={() => onCancel(booking)}
          style={{
            alignSelf: 'flex-start',
            minHeight: '44px',
            padding: '0 var(--space-base)',
            border: '1px solid var(--color-line)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'transparent',
            color: 'var(--color-status-no)',
            font: 'var(--font-body-strong)',
            cursor: 'pointer',
          }}
        >
          Hủy
        </button>
      )}

      {decision === 'CALL_OWNER' && (
        <a
          href={`tel:${booking.venuePhone}`}
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: '44px',
            color: 'var(--color-primary)',
            font: 'var(--font-body-strong)',
          }}
        >
          Gọi chủ sân để hủy
        </a>
      )}

      {deadline && (
        <div style={{ font: 'var(--font-meta)', color: 'var(--color-status-wait)' }}>
          {deadline}
        </div>
      )}
    </article>
  );
}
