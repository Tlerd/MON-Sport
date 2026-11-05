import { bookingsOfDay, formatTime } from '@monsport/client';
import type { CourtView, OwnerBookingView } from '@monsport/shared';
import type { CSSProperties } from 'react';
import { EmptyState } from '../../components/EmptyState.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';

export interface DayBookingsProps {
  bookings: OwnerBookingView[];
  date: string;
  courts: CourtView[];
  failed?: boolean;
  onRetry?: () => void;
}

const wrap: CSSProperties = { margin: 0, minWidth: 0, overflowWrap: 'anywhere' };

export function DayBookings({ bookings, date, courts, failed, onRetry }: DayBookingsProps) {
  const courtIds = courts.map((c) => c.id);
  const courtNames = new Map(courts.map((c) => [c.id, c.name]));
  const items = bookingsOfDay(bookings, date, courtIds);

  return (
    <section
      aria-label="Booking trong ngày"
      style={{ minWidth: 0, maxWidth: '100%', padding: 'var(--space-md) 0' }}
    >
      <h2
        style={{
          ...wrap,
          padding: 'var(--space-sm) var(--space-base)',
          font: 'var(--font-headline-mobile)',
          color: 'var(--color-ink)',
        }}
      >
        Booking trong ngày
      </h2>
      {failed ? (
        <EmptyState message="Không tải được" actionLabel="Thử lại" onAction={onRetry} />
      ) : items.length === 0 ? (
        <EmptyState message="Chưa có booking trong ngày này" />
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          {items.map((b) => (
            <li key={b.id} style={{ minWidth: 0, maxWidth: '100%' }}>
              <article
                data-booking-id={b.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-xs)',
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  padding: 'var(--space-md) var(--space-base)',
                  borderBottom: '1px solid var(--color-line)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-ink)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-sm)',
                    minWidth: 0,
                    flexWrap: 'wrap',
                  }}
                >
                  <p data-field="court" style={{ ...wrap, font: 'var(--font-body-strong)' }}>
                    {courtNames.get(b.courtId) ?? 'Sân'}
                  </p>
                  <StatusBadge status={b.status} />
                </div>
                <p data-field="slot" className="tnum" style={{ ...wrap, font: 'var(--font-numeric)' }}>
                  {`${formatTime(b.startAt)}–${formatTime(b.endAt)}`}
                </p>
                {b.customer.name.trim() !== '' && (
                  <p data-field="customer" style={{ ...wrap, font: 'var(--font-body)' }}>
                    {b.customer.name}
                  </p>
                )}
                {b.customer.phone !== null && (
                  <a
                    data-field="phone"
                    href={`tel:${b.customer.phone}`}
                    style={{
                      ...wrap,
                      display: 'inline-flex',
                      alignItems: 'center',
                      alignSelf: 'flex-start',
                      minHeight: '44px',
                      font: 'var(--font-body)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    {b.customer.phone}
                  </a>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
