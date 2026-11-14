import type { MatchStatus, MatchView } from '@monsport/shared';
import { useEffect, useId, useState } from 'react';
import { api, formatDay, formatTime } from '@monsport/client';
import { EmptyState } from '../../components/EmptyState.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';

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
        {matches?.length === 0 && !error && <EmptyState message="Bạn chưa vào trận nào" />}
      </div>
      {matches && matches.length > 0 && (
        <ul className="tickets joined-matches-list schedule-list">
          {matches.map((m) => {
            const isMuted =
              new Date(m.endAt).getTime() <= Date.now() ||
              m.status === 'CANCELLED' ||
              m.status === 'FINISHED';
            return (
              <li key={m.id} className={`card ticket si-item ${isMuted ? 'is-muted' : ''}`.trim()} data-status={m.status}>
                <div className="si">
                  <div className="stub si-t">
                    <strong>{formatTime(m.startAt)}</strong>
                    <span>đến {formatTime(m.endAt)}</span>
                  </div>
                  <div className="body si-b">
                    <b className="where">{`${m.venueName} · ${m.courtName}`}</b>
                    <div className="si-meta">
                      <span>{`Ngày ${formatDay(m.startAt)} · ${formatTime(m.startAt)}–${formatTime(m.endAt)}`}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{`${m.joinedCount}/${m.capacity} suất`}</span>
                    </div>
                  </div>
                  <div className="si-r">
                    <StatusBadge className="status" status={m.status} label={STATUS_LABEL[m.status]} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
