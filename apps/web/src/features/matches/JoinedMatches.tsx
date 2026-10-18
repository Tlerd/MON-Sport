import type { MatchStatus, MatchView } from '@monsport/shared';
import { useEffect, useId, useState } from 'react';
import { api } from '../../lib/api.ts';
import { formatDay, formatTime } from '../../lib/format.ts';

const STATUS_LABEL: Record<MatchStatus, string> = {
  OPEN: 'Trận đang mở',
  FULL: 'Trận đã đủ người',
  CANCELLED: 'Trận đã hủy',
  FINISHED: 'Trận đã đá xong',
};

/**
 * Brief F-012 (UC-8 flow 8.2, AC-13): lists matches where the logged-in user is an active player.
 */
export function JoinedMatches({ refresh = 0 }: { refresh?: number }) {
  const heading = useId();
  const [matches, setMatches] = useState<MatchView[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setError('');
    api<MatchView[]>('/api/matches/joined').then(
      (rows) => {
        if (current) setMatches(rows);
      },
      () => {
        if (!current) return;
        setMatches([]);
        setError('Không tải được danh sách trận đã vào');
      },
    );
    return () => {
      current = false;
    };
  }, [refresh]);

  return (
    <section className="panel" aria-labelledby={heading}>
      <h2 id={heading}>Trận đã vào</h2>
      {error && <p className="error" role="alert">{error}</p>}
      <div role="status" className="live">
        {matches?.length === 0 && !error && <p className="empty">Bạn chưa vào trận nào</p>}
      </div>
      {matches && matches.length > 0 && (
        <ul className="tickets joined-matches-list">
          {matches.map((m) => (
            <li key={m.id} className="ticket" data-status={m.status}>
              <span className="stub">
                <strong>{formatTime(m.startAt)}</strong>
                <span>đến {formatTime(m.endAt)}</span>
              </span>
              <span className="body">
                <span className="where">{`${m.venueName} · ${m.courtName}`}</span>
                <span>{`Ngày ${formatDay(m.startAt)} · ${formatTime(m.startAt)}–${formatTime(m.endAt)}`}</span>
                <span>{`${m.joinedCount}/${m.capacity} suất`}</span>
                <span className="status">{STATUS_LABEL[m.status]}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
