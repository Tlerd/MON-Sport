import { formatSlot, formatVnd } from '@monsport/client';
import type { CourtView, OwnerBookingView } from '@monsport/shared';
import type { CSSProperties } from 'react';
import { EmptyState } from '../../components/EmptyState.tsx';

export interface UnpaidListProps {
  items: OwnerBookingView[];
  courts: CourtView[];
  failed?: boolean;
  onRetry?: () => void;
  busyIds: ReadonlySet<string>;
  alertMessage?: string | null;
  rowErrors: Readonly<Record<string, string>>;
  onMarkPaid: (booking: OwnerBookingView) => void;
}

const wrap: CSSProperties = { margin: 0, minWidth: 0, overflowWrap: 'anywhere' };

export function UnpaidList({
  items,
  courts,
  failed,
  onRetry,
  busyIds,
  alertMessage,
  rowErrors,
  onMarkPaid,
}: UnpaidListProps) {
  const courtNames = new Map(courts.map((c) => [c.id, c.name]));

  return (
    <section
      aria-label="Chưa thu tiền"
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
        Chưa thu tiền
      </h2>
      {alertMessage && (
        <p
          role="alert"
          style={{
            ...wrap,
            padding: 'var(--space-xs) var(--space-base)',
            font: 'var(--font-meta)',
            color: 'var(--color-status-no)',
          }}
        >
          {alertMessage}
        </p>
      )}
      {failed ? (
        <EmptyState message="Không tải được" actionLabel="Thử lại" onAction={onRetry} />
      ) : items.length === 0 ? (
        <EmptyState message="Không có booking cần thu tiền" />
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
          {items.map((b) => {
            const busy = busyIds.has(b.id);
            const rowError = rowErrors[b.id];
            return (
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
                  <p data-field="court" style={{ ...wrap, font: 'var(--font-body-strong)' }}>
                    {courtNames.get(b.courtId) ?? 'Sân'}
                  </p>
                  <p data-field="slot" className="tnum" style={{ ...wrap, font: 'var(--font-body)' }}>
                    {formatSlot(b.startAt, b.endAt)}
                  </p>
                  <p data-field="price" className="tnum" style={{ ...wrap, font: 'var(--font-body)' }}>
                    {formatVnd(b.priceTotal)}
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
                  {rowError && (
                    <p
                      role="alert"
                      style={{
                        ...wrap,
                        font: 'var(--font-meta)',
                        color: 'var(--color-status-no)',
                      }}
                    >
                      {rowError}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onMarkPaid(b)}
                    style={{
                      minHeight: '44px',
                      minWidth: '44px',
                      maxWidth: '100%',
                      padding: '0 var(--space-md)',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-on-primary)',
                      font: 'var(--font-body-strong)',
                      cursor: busy ? 'not-allowed' : 'pointer',
                      opacity: busy ? 0.6 : 1,
                      alignSelf: 'flex-start',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    Đã thu tiền
                  </button>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
