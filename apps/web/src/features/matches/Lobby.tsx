import type { MatchDetailView, MatchView, SessionUser, Sport } from '@monsport/shared';
import { useEffect, useId, useState } from 'react';
import { api } from '../../lib/api.ts';
import { formatDay, formatTime, formatVnd } from '../../lib/format.ts';

const SPORT_LABEL: Record<Sport, string> = {
  BADMINTON: 'Cầu lông',
  FOOTBALL: 'Bóng đá',
};

const BOOKING_BADGE: Record<MatchView['bookingStatus'], string> = {
  PENDING: 'Chưa xác nhận',
  CONFIRMED: 'Đã xác nhận',
  REJECTED: 'Bị từ chối',
  EXPIRED: 'Hết hạn',
  CANCELLED: 'Đã hủy',
};

interface LobbyProps {
  refresh?: number;
  user?: SessionUser | null;
  onMatchChanged?: () => void;
}

/**
 * Brief F-011 and F-012 (UC-8): public lobby of OPEN matches with real-time SSE stream,
 * match detail view with active player list, and join/leave match actions.
 */
export function Lobby({ refresh = 0, user, onMatchChanged }: LobbyProps) {
  const heading = useId();
  const [sport, setSport] = useState('');
  const [date, setDate] = useState('');
  const [matches, setMatches] = useState<MatchView[] | null>(null);
  const [error, setError] = useState('');
  const [streamTick, setStreamTick] = useState(0);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MatchDetailView | null>(null);
  const [detailError, setDetailError] = useState<string>('');
  const [actionError, setActionError] = useState<string>('');
  const [loadingAction, setLoadingAction] = useState(false);

  // AC-12: listen to SSE /api/matches/stream and reload when a match event arrives.
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const es = new EventSource('/api/matches/stream');
    es.addEventListener('match', () => {
      setStreamTick((t) => t + 1);
    });
    return () => {
      es.close();
    };
  }, []);

  useEffect(() => {
    let current = true;
    setError('');
    const params = new URLSearchParams();
    if (sport) params.set('sport', sport);
    if (date) params.set('date', date);
    const qs = params.toString();
    const url = qs ? `/api/matches?${qs}` : '/api/matches';
    api<MatchView[]>(url).then(
      (rows) => {
        if (current) setMatches(rows);
      },
      () => {
        if (!current) return;
        setMatches([]);
        setError('Không tải được danh sách phòng chờ');
      },
    );
    return () => {
      current = false;
    };
  }, [sport, date, refresh, streamTick]);

  async function toggleDetail(m: MatchView) {
    if (expandedId === m.id) {
      setExpandedId(null);
      setDetail(null);
      setDetailError('');
      setActionError('');
      return;
    }
    setExpandedId(m.id);
    setDetail(null);
    setDetailError('');
    setActionError('');

    // AC-11: unauthenticated guests see login prompt and web does not call GET /api/matches/<id>.
    if (!user) return;

    try {
      const data = await api<MatchDetailView>(`/api/matches/${m.id}`);
      setDetail(data);
    } catch (e) {
      setDetailError((e as { message?: string })?.message ?? 'Không tải được chi tiết trận');
    }
  }

  async function handleJoin(id: string) {
    setActionError('');
    setLoadingAction(true);
    try {
      const updated = await api<MatchDetailView>(`/api/matches/${id}/join`, { method: 'POST' });
      setDetail(updated);
      setMatches((prev) => prev?.map((m) => (m.id === id ? { ...m, joinedCount: updated.joinedCount, status: updated.status } : m)) ?? null);
      onMatchChanged?.();
    } catch (e) {
      setActionError((e as { message?: string })?.message ?? 'Không thể vào trận');
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleLeave(id: string) {
    setActionError('');
    setLoadingAction(true);
    try {
      const updated = await api<MatchDetailView>(`/api/matches/${id}/leave`, { method: 'POST' });
      setDetail(updated);
      setMatches((prev) => prev?.map((m) => (m.id === id ? { ...m, joinedCount: updated.joinedCount, status: updated.status } : m)) ?? null);
      onMatchChanged?.();
    } catch (e) {
      setActionError((e as { message?: string })?.message ?? 'Không thể rời trận');
    } finally {
      setLoadingAction(false);
    }
  }

  return (
    <section className="panel" aria-labelledby={heading}>
      <h2 id={heading}>Phòng chờ</h2>
      <div className="row two">
        <label>
          Môn thể thao
          <select value={sport} onChange={(e) => setSport(e.target.value)}>
            <option value="">Tất cả môn</option>
            <option value="BADMINTON">Cầu lông</option>
            <option value="FOOTBALL">Bóng đá</option>
          </select>
        </label>
        <label>
          Ngày chơi
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div role="status" className="live">
        {matches?.length === 0 && !error && <p className="empty">Chưa có trận nào đang mở</p>}
      </div>
      {matches && matches.length > 0 && (
        <ul className="tickets lobby-list">
          {matches.map((m) => {
            const isExpanded = expandedId === m.id;
            const remaining = m.capacity - m.joinedCount;
            return (
              <li key={m.id} className="ticket match-ticket" data-status={m.bookingStatus}>
                <span className="stub">
                  <strong>{formatTime(m.startAt)}</strong>
                  <span>đến {formatTime(m.endAt)}</span>
                </span>
                <span className="body">
                  <span className="where">{`${m.venueName} · ${m.courtName}`}</span>
                  <span>{`${SPORT_LABEL[m.sport]} · Ngày ${formatDay(m.startAt)}`}</span>
                  <span>{`${m.joinedCount}/${m.capacity} suất · ${formatVnd(m.pricePerSlot)}/suất`}</span>
                  <span>Host: {m.hostName}</span>
                  <span className="status">{BOOKING_BADGE[m.bookingStatus]}</span>
                  <button
                    type="button"
                    className="link detail-toggle"
                    onClick={() => toggleDetail(m)}
                  >
                    {isExpanded ? 'Đóng chi tiết' : 'Xem chi tiết'}
                  </button>

                  {isExpanded && (
                    <div className="match-detail">
                      <div className="detail-meta">
                        <span>Còn {remaining} suất trống</span>
                        <span>{formatVnd(m.pricePerSlot)}/suất</span>
                      </div>

                      {!user && (
                        <p className="hint">Đăng nhập để vào trận</p>
                      )}

                      {user && detail && detail.id === m.id && (
                        <>
                          <div className="players-section">
                            <strong>Người tham gia:</strong>
                            <ul className="players-list">
                              {detail.players.map((p) => (
                                <li key={p.userId}>
                                  {detail.viewerRole === 'HOST' && p.phone ? (
                                    <a href={`tel:${p.phone}`}>{p.name} ({p.phone})</a>
                                  ) : (
                                    <span>{p.name}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="actions match-actions">
                            {detail.viewerRole === 'PLAYER' && (
                              <button
                                type="button"
                                className="secondary"
                                disabled={loadingAction}
                                onClick={() => handleLeave(m.id)}
                              >
                                Rời trận
                              </button>
                            )}
                            {detail.viewerRole === 'NONE' && (
                              <button
                                type="button"
                                disabled={loadingAction}
                                onClick={() => handleJoin(m.id)}
                              >
                                Vào trận
                              </button>
                            )}
                          </div>
                        </>
                      )}

                      {detailError && <p className="error" role="alert">{detailError}</p>}
                      {actionError && <p className="error" role="alert">{actionError}</p>}
                    </div>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
