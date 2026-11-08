import { deadlineLeft, formatSlot, formatVnd } from '@monsport/client';
import type { OwnerBookingView } from '@monsport/shared';
import type { CSSProperties } from 'react';

export interface RequestCardProps {
  request: OwnerBookingView;
  courtName: string;
  venueName: string | undefined;
  now: Date;
  busy: boolean;
  error?: string;
  onConfirm: (request: OwnerBookingView) => void;
  onReject: (request: OwnerBookingView) => void;
}

const wrap: CSSProperties = { margin: 0, minWidth: 0, overflowWrap: 'anywhere' };

function buttonStyle(primary: boolean, busy: boolean): CSSProperties {
  return {
    flex: '1 1 0',
    minWidth: '44px',
    minHeight: '44px',
    padding: '0 var(--space-md)',
    borderRadius: 'var(--radius-sm)',
    border: primary ? 'none' : '1px solid var(--color-line)',
    backgroundColor: primary ? 'var(--color-primary)' : 'var(--color-surface)',
    color: primary ? 'var(--color-on-primary)' : 'var(--color-primary)',
    font: 'var(--font-body-strong)',
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.6 : 1,
  };
}

export function RequestCard({ request, courtName, venueName, now, busy, error, onConfirm, onReject }: RequestCardProps) {
  const { customer } = request;
  const left = deadlineLeft(request.confirmDeadline, now);

  return (
    <article
      data-booking-id={request.id}
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
        {courtName}
      </p>
      {venueName && (
        <p data-field="venue" style={{ ...wrap, font: 'var(--font-meta)', color: 'var(--color-ink-muted)' }}>
          {venueName}
        </p>
      )}
      <p data-field="slot" style={{ ...wrap, font: 'var(--font-body)' }}>
        {formatSlot(request.startAt, request.endAt)}
      </p>
      <p data-field="price" style={{ ...wrap, font: 'var(--font-body)' }}>
        {formatVnd(request.priceTotal)}
      </p>
      <p data-field="customer" style={{ ...wrap, font: 'var(--font-body)' }}>
        {customer.name}
      </p>
      {customer.phone !== null && (
        <a
          data-field="phone"
          href={`tel:${customer.phone}`}
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
          {customer.phone}
        </a>
      )}
      {left && (
        <p data-field="deadline" style={{ ...wrap, font: 'var(--font-meta)', color: 'var(--color-ink-muted)' }}>
          {left}
        </p>
      )}
      {error && (
        <p role="alert" style={{ ...wrap, font: 'var(--font-meta)', color: 'var(--color-status-no)' }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-md)', minWidth: 0, marginTop: 'var(--space-xs)' }}>
        <button type="button" disabled={busy} onClick={() => onConfirm(request)} style={buttonStyle(true, busy)}>
          Xác nhận
        </button>
        <button type="button" disabled={busy} onClick={() => onReject(request)} style={buttonStyle(false, busy)}>
          Từ chối
        </button>
      </div>
    </article>
  );
}
