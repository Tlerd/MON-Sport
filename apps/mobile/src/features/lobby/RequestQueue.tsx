import type { MatchRequestView } from '@monsport/shared';

export interface RequestQueueProps {
  matchId: string;
  queue: MatchRequestView[];
  busyIds: ReadonlySet<string>;
  onDecide: (matchId: string, requestUserId: string, action: 'approve' | 'reject') => void;
}

const sheetBtnStyle = {
  minHeight: '44px',
  minWidth: '44px',
  padding: '0 var(--space-base)',
  borderRadius: 'var(--radius-sm)',
  font: 'var(--font-body-strong)',
  cursor: 'pointer',
} as const;

export function RequestQueue({ matchId, queue, busyIds, onDecide }: RequestQueueProps) {
  return (
    <section aria-label="Hàng chờ" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', minWidth: 0 }}>
      <h3 style={{ margin: 0, font: 'var(--font-body-strong)' }}>{`Hàng chờ (${queue.length})`}</h3>
      <ul
        className="queue-list"
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-sm)',
          minWidth: 0,
        }}
      >
        {queue.map((r) => {
          const busy = busyIds.has(r.userId);
          const decideStyle = {
            ...sheetBtnStyle,
            flex: '1 1 0',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
          } as const;
          return (
            <li
              key={r.userId}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-xs)',
                padding: 'var(--space-sm) 0',
                borderTop: '1px solid var(--color-line)',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  columnGap: 'var(--space-sm)',
                  minWidth: 0,
                }}
              >
                <span className="queue-user" style={{ font: 'var(--font-body)', overflowWrap: 'anywhere', minWidth: 0 }}>
                  {r.name}
                </span>
                <a
                  href={`tel:${r.phone}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: '44px',
                    color: 'var(--color-primary)',
                    font: 'var(--font-body-strong)',
                  }}
                >
                  {r.phone}
                </a>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', minWidth: 0 }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide(matchId, r.userId, 'approve')}
                  style={{
                    ...decideStyle,
                    border: 'none',
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                  }}
                >
                  Duyệt
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide(matchId, r.userId, 'reject')}
                  style={{
                    ...decideStyle,
                    border: '1px solid var(--color-line)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-ink)',
                  }}
                >
                  Từ chối
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
