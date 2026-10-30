import { dayHeading, formatVnd, hhmm } from '@monsport/client';
import { minuteOfDayVN, vnDateString, type MyBookingView } from '@monsport/shared';
import { StatusBadge } from '../../components/StatusBadge.tsx';

export interface BookingCardProps {
  booking: MyBookingView;
}

export function BookingCard({ booking }: BookingCardProps) {
  const startDate = new Date(booking.startAt);
  const endDate = new Date(booking.endAt);
  const dateHeading = dayHeading(vnDateString(startDate));
  const timeRange = `${hhmm(minuteOfDayVN(startDate))}–${hhmm(minuteOfDayVN(endDate))}`;
  const price = formatVnd(booking.priceTotal);

  const hasOpenMatch =
    booking.match !== null &&
    (booking.match.status === 'OPEN' || booking.match.status === 'FULL');

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

      {deadline && (
        <div style={{ font: 'var(--font-meta)', color: 'var(--color-status-wait)' }}>
          {deadline}
        </div>
      )}
    </article>
  );
}
