import { formatSlotTime, type NotificationItemView } from '@monsport/shared';

export interface NotificationCardProps {
  item: NotificationItemView;
  onOpen: (item: NotificationItemView) => void;
}

export function NotificationCard({ item, onOpen }: NotificationCardProps) {
  const unread = item.readAt === null;

  return (
    <button
      type="button"
      data-notification-id={item.id}
      data-unread={unread}
      onClick={() => onOpen(item)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-md)',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        minHeight: '44px',
        boxSizing: 'border-box',
        padding: 'var(--space-md) var(--space-base)',
        border: 'none',
        borderBottom: '1px solid var(--color-line)',
        backgroundColor: unread ? 'var(--color-surface)' : 'var(--color-canvas)',
        color: 'var(--color-ink)',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          flex: '0 0 auto',
          width: '10px',
          height: '10px',
          marginTop: '6px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: unread ? 'var(--color-primary)' : 'transparent',
        }}
        {...(unread ? { role: 'img', 'aria-label': 'Chưa đọc' } : { 'aria-hidden': true })}
      />
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-xs)',
          flex: '1 1 0',
          minWidth: 0,
        }}
      >
        <span
          style={{
            font: unread ? 'var(--font-headline-mobile)' : 'var(--font-body-strong)',
            overflowWrap: 'anywhere',
          }}
        >
          {item.title}
        </span>
        <span data-field="message" style={{ font: 'var(--font-body)', overflowWrap: 'anywhere' }}>
          {item.message}
        </span>
        <span
          data-field="venue"
          style={{ font: 'var(--font-meta)', color: 'var(--color-ink-muted)', overflowWrap: 'anywhere' }}
        >
          {item.venueName}
        </span>
        <span
          data-field="court"
          style={{ font: 'var(--font-meta)', color: 'var(--color-ink-muted)', overflowWrap: 'anywhere' }}
        >
          {item.courtName}
        </span>
        <span
          data-field="time"
          className="tnum"
          style={{ font: 'var(--font-numeric)', color: 'var(--color-ink-muted)', overflowWrap: 'anywhere' }}
        >
          {formatSlotTime(item.startAt, item.endAt)}
        </span>
      </span>
    </button>
  );
}
