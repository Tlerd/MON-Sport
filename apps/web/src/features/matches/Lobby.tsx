import {
  addDaysYmd,
  vnDateString,
  type MatchDetailView,
  type MatchView,
  type SessionUser,
  type Sport,
} from '@monsport/shared';
import { CalendarDays } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Chip } from '../../components/Chip.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { SportIcon } from '../../components/icons.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';
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

function formatDayChip(ymd: string) {
  // Noon UTC falls on the same calendar day in every time zone, so the weekday never depends on the machine (BR-27).
  const d = new Date(`${ymd}T12:00:00Z`);
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const dayOfWeek = days[d.getUTCDay()];
  const parts = ymd.split('-');
  return `${dayOfWeek} ${parts[2]}/${parts[1]}`;
}

const formatK = (price: number) => `${Math.round(price / 1000)}k`;

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

  const dateInputRef = useRef<HTMLInputElement>(null);
  const todayStr = useMemo(() => vnDateString(new Date()), []);
  const dateOptions = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const ymd = addDaysYmd(todayStr, i);
      return {
        ymd,
        label: i === 0 ? 'Hôm nay' : formatDayChip(ymd),
      };
    });
  }, [todayStr]);

  const isOtherDate = date !== '' && !dateOptions.some((d) => d.ymd === date);

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

  const selectedMatch = matches?.find((m) => m.id === expandedId) ?? null;
  const remaining = selectedMatch ? selectedMatch.capacity - selectedMatch.joinedCount : 0;

  return (
    <section className="panel lobby-panel" aria-labelledby={heading}>
      <h2 id={heading}>Phòng chờ</h2>
      <div className="filter-chips-row">
        <div role="group" aria-label="Môn thể thao" className="chips sport-chips">
          <Chip selected={sport === ''} onClick={() => setSport('')}>
            Tất cả
          </Chip>
          <Chip
            selected={sport === 'BADMINTON'}
            icon={<SportIcon sport="BADMINTON" size={16} />}
            onClick={() => setSport('BADMINTON')}
          >
            Cầu lông
          </Chip>
          <Chip
            selected={sport === 'FOOTBALL'}
            icon={<SportIcon sport="FOOTBALL" size={16} />}
            onClick={() => setSport('FOOTBALL')}
          >
            Bóng đá
          </Chip>
        </div>

        <div role="group" aria-label="Ngày chơi" className="chips date-chips">
          <Chip selected={date === ''} onClick={() => setDate('')}>
            Tất cả ngày
          </Chip>
          {dateOptions.map((opt) => (
            <Chip
              key={opt.ymd}
              selected={date === opt.ymd}
              onClick={() => setDate(opt.ymd)}
            >
              {opt.label}
            </Chip>
          ))}
          <label className={`chip ${isOtherDate ? 'on selected' : ''}`}>
            <CalendarDays size={14} aria-hidden="true" />
            <span>Ngày khác</span>
            <input
              ref={dateInputRef}
              type="date"
              aria-label="Ngày khác"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
            />
          </label>
        </div>
      </div>
      <div className="lobby-split">
        <div className="lobby-list-pane">
          {error && <p className="error" role="alert">{error}</p>}
          <div role="status" className="live">
            {matches?.length === 0 && !error && (
              <EmptyState message="Chưa có trận nào đang mở" />
            )}
          </div>
          {matches && matches.length > 0 && (
            <ul className="tickets lobby-list">
              {matches.map((m) => {
                const isExpanded = expandedId === m.id;
                return (
                  <li
                    key={m.id}
                    className={`ticket match-ticket card-web ${isExpanded ? 'active' : ''}`}
                    data-status={m.bookingStatus}
                    onClick={() => toggleDetail(m)}
                  >
                    <span className="match-icon">
                      <SportIcon sport={m.sport} size={20} />
                    </span>
                    <span className="match-body body">
                      <div className="match-line-1">
                        <span className="where">{`${formatTime(m.startAt)}–${formatTime(m.endAt)} · ${m.venueName} · ${m.courtName}`}</span>
                      </div>
                      <div className="match-line-2">
                        <span className="match-slots">{`${m.joinedCount}/${m.capacity} · ${formatK(m.pricePerSlot)}/suất`}</span>
                        <StatusBadge className="status" status={m.bookingStatus} label={BOOKING_BADGE[m.bookingStatus]} />
                        {(m.status === 'FULL' || m.joinedCount >= m.capacity) && (
                          <StatusBadge className="status" status="FULL" />
                        )}
                        <button
                          type="button"
                          className="link detail-toggle"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDetail(m);
                          }}
                        >
                          {isExpanded ? 'Đóng chi tiết' : 'Xem chi tiết'}
                        </button>
                      </div>
                      <span className="visually-hidden">
                        <span>{`${m.venueName} · ${m.courtName}`}</span>
                        <span>{`${SPORT_LABEL[m.sport]} · Ngày ${formatDay(m.startAt)}`}</span>
                        <span>{`${m.joinedCount}/${m.capacity} suất · ${formatVnd(m.pricePerSlot)}/suất`}</span>
                        <span>Host: {m.hostName}</span>
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="lobby-detail-pane">
          {selectedMatch ? (
            <div className="match-detail card-web">
              <h3>{`${selectedMatch.venueName} · ${selectedMatch.courtName}`}</h3>
              <p className="detail-meta-row">
                <span>{`${SPORT_LABEL[selectedMatch.sport]} · Ngày ${formatDay(selectedMatch.startAt)}`}</span>
                <span>{`${formatTime(selectedMatch.startAt)}–${formatTime(selectedMatch.endAt)}`}</span>
              </p>
              <div className="detail-meta">
                <span>Còn {remaining} suất trống</span>
                <span>{formatVnd(selectedMatch.pricePerSlot)}/suất</span>
              </div>

              {!user && (
                <p className="hint">Đăng nhập để vào trận</p>
              )}

              {user && detail && detail.id === selectedMatch.id && (
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
                        onClick={() => handleLeave(selectedMatch.id)}
                      >
                        Rời trận
                      </button>
                    )}
                    {detail.viewerRole === 'NONE' && (
                      <button
                        type="button"
                        disabled={loadingAction}
                        onClick={() => handleJoin(selectedMatch.id)}
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
          ) : (
            <div className="card-web empty-detail-card">
              <EmptyState message="Chọn một trận bên danh sách để xem người tham gia và vào trận." />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
