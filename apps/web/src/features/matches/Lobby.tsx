import {
  addDaysYmd,
  SKILL_LEVEL_LABELS,
  vnDateString,
  type JoinMode,
  type MatchDetailView,
  type MatchRequestView,
  type MatchView,
  type PlayerReputation,
  type SessionUser,
  type SkillLevel,
} from '@monsport/shared';
import { ArrowLeft, CalendarDays, ChevronDown, Plus } from 'lucide-react';
import { type CSSProperties, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useInRouterContext, useNavigate, useSearchParams } from 'react-router';
import { Chip } from '../../components/Chip.tsx';
import { CourtArt } from '../../components/CourtArt.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { BOOKING_BADGE, MatchCardContent, SPORT_LABEL } from '../../components/MatchCard.tsx';
import { SportIcon } from '../../components/SportIcon.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';
import { useToast } from '../../components/Toast.tsx';
import { api, formatDay, formatTime, formatVnd } from '@monsport/client';

function formatDayChip(ymd: string) {
  // Noon UTC falls on the same calendar day in every time zone, so the weekday never depends on the machine (BR-27).
  const d = new Date(`${ymd}T12:00:00Z`);
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const dayOfWeek = days[d.getUTCDay()];
  const parts = ymd.split('-');
  return `${dayOfWeek} ${parts[2]}/${parts[1]}`;
}

const initialChar = (name: string) =>
  [...(name.normalize('NFC').trim().split(/\s+/).at(-1) ?? '')][0] ?? '';

/** Brief F-032 (AC-9): format player reputation for the host queue. */
export function formatReputation(rep?: PlayerReputation | null): string {
  if (!rep) return 'Chưa có đánh giá';
  const { ratingAvg, ratingCount, noShowCount } = rep;
  if (ratingAvg !== null && ratingCount > 0) {
    const avgStr = ratingAvg.toLocaleString('vi-VN');
    const starPart = `${avgStr} ★ (${ratingCount})`;
    return noShowCount > 0 ? `${starPart} · ${noShowCount} lần vắng` : starPart;
  }
  if (noShowCount > 0) {
    return `Chưa có sao · ${noShowCount} lần vắng`;
  }
  return 'Chưa có đánh giá';
}

interface LobbyProps {
  refresh?: number;
  user?: SessionUser | null;
  onMatchChanged?: () => void;
}

interface LobbyInnerProps extends LobbyProps {
  tranParam?: string | null;
  onSelectTran?: (id: string | null) => void;
  onNavigate?: (to: string) => void;
}

function LobbyInner({ refresh = 0, user, onMatchChanged, tranParam = null, onSelectTran, onNavigate }: LobbyInnerProps) {
  const heading = useId();
  const { comingSoon } = useToast();
  const [sport, setSport] = useState('');
  const [level, setLevel] = useState<SkillLevel | ''>('');
  const [date, setDate] = useState('');
  const [typeTab, setTypeTab] = useState<'ALL' | 'SINGLE'>('ALL');
  const [matches, setMatches] = useState<MatchView[] | null>(null);
  const [error, setError] = useState('');
  const [streamTick, setStreamTick] = useState(0);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MatchDetailView | null>(null);
  const [requestsState, setRequestsState] = useState<{ matchId: string | null; items: MatchRequestView[] }>({
    matchId: null,
    items: [],
  });
  const [busyRequestUserIds, setBusyRequestUserIds] = useState<Set<string>>(() => new Set());
  const [detailError, setDetailError] = useState<string>('');
  const [actionError, setActionError] = useState<string>('');
  const [loadingAction, setLoadingAction] = useState(false);

  const loadSeqRef = useRef(0);
  const autoOpenedTranRef = useRef<string | null>(null);
  const prevTranParamRef = useRef<string | null>(tranParam);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const userClosedRef = useRef(false);
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

  const selectedMatch = matches?.find((m) => m.id === expandedId) ?? null;
  const requests = selectedMatch && requestsState.matchId === selectedMatch.id ? requestsState.items : [];

  const liveStateRef = useRef<{
    expandedId: string | null;
    user: SessionUser | null | undefined;
    joinMode: JoinMode | undefined;
  }>({
    expandedId: null,
    user: null,
    joinMode: undefined,
  });
  liveStateRef.current = {
    expandedId,
    user,
    joinMode: detail?.joinMode ?? selectedMatch?.joinMode,
  };

  const loadDetail = useCallback(async (matchId: string, matchJoinMode?: JoinMode) => {
    const seq = ++loadSeqRef.current;
    try {
      const data = await api<MatchDetailView>(`/api/matches/${matchId}`);
      if (seq !== loadSeqRef.current || liveStateRef.current.expandedId !== matchId) return;
      setDetail(data);
      setDetailError('');
      if (data.viewerRole === 'HOST' && (data.joinMode === 'APPROVAL' || matchJoinMode === 'APPROVAL')) {
        const reqs = await api<MatchRequestView[]>(`/api/matches/${matchId}/requests`);
        if (seq !== loadSeqRef.current || liveStateRef.current.expandedId !== matchId) return;
        setRequestsState({ matchId, items: reqs });
      } else {
        setRequestsState({ matchId, items: [] });
      }
    } catch (e) {
      if (seq !== loadSeqRef.current || liveStateRef.current.expandedId !== matchId) return;
      setDetailError((e as { message?: string })?.message ?? 'Không tải được chi tiết trận');
    }
  }, []);

  const openMatch = useCallback(
    async (m: MatchView) => {
      loadSeqRef.current += 1;
      liveStateRef.current.expandedId = m.id;
      setExpandedId(m.id);
      setDetail(null);
      setRequestsState({ matchId: null, items: [] });
      setBusyRequestUserIds(new Set());
      setDetailError('');
      setActionError('');

      // AC-11: unauthenticated guests see login prompt and web does not call GET /api/matches/<id>.
      if (!user) return;
      await loadDetail(m.id, m.joinMode);
    },
    [user, loadDetail],
  );

  // AC-12 & AC-13: listen to SSE /api/matches/stream and reload list, open detail, and host requests when a match event arrives.
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const es = new EventSource('/api/matches/stream');
    es.addEventListener('match', () => {
      setStreamTick((t) => t + 1);
      const { expandedId: currentId, user: currentUser, joinMode } = liveStateRef.current;
      if (currentId && currentUser) {
        void loadDetail(currentId, joinMode);
      }
    });
    return () => {
      es.close();
    };
  }, [loadDetail]);

  useEffect(() => {
    let current = true;
    setError('');
    const params = new URLSearchParams();
    if (sport) params.set('sport', sport);
    if (level) params.set('level', level);
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
  }, [sport, level, date, refresh, streamTick]);

  const clearDetailState = useCallback(() => {
    loadSeqRef.current += 1;
    liveStateRef.current.expandedId = null;
    autoOpenedTranRef.current = null;
    setExpandedId(null);
    setDetail(null);
    setRequestsState({ matchId: null, items: [] });
    setBusyRequestUserIds(new Set());
    setDetailError('');
    setActionError('');
  }, []);

  const closeDetail = useCallback(() => {
    userClosedRef.current = true;
    clearDetailState();
    onSelectTran?.(null);
  }, [clearDetailState, onSelectTran]);

  // AC-6 & mobile detail sheet: open when ?tran=<id> is set, close when browser Back clears it.
  useEffect(() => {
    const prevTran = prevTranParamRef.current;
    prevTranParamRef.current = tranParam;
    if (!tranParam) {
      if (prevTran !== null) {
        clearDetailState();
      }
      return;
    }
    if (!matches) return;
    if (autoOpenedTranRef.current === tranParam) return;
    const target = matches.find((m) => m.id === tranParam);
    if (target) {
      autoOpenedTranRef.current = tranParam;
      void openMatch(target);
    }
  }, [tranParam, matches, openMatch, clearDetailState]);

  // Wide screens show the list and the detail side by side, so the detail panel is never empty while matches exist.
  useEffect(() => {
    if (tranParam || userClosedRef.current || !matches || matches.length === 0) return;
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(min-width: 720px)').matches) return;
    if (expandedId && matches.some((m) => m.id === expandedId)) return;
    void openMatch(matches[0]);
  }, [tranParam, matches, expandedId, openMatch]);

  async function toggleDetail(m: MatchView) {
    if (expandedId === m.id) {
      closeDetail();
      return;
    }
    userClosedRef.current = false;
    autoOpenedTranRef.current = m.id;
    onSelectTran?.(m.id);
    await openMatch(m);
  }

  async function handleJoin(id: string) {
    setActionError('');
    setLoadingAction(true);
    try {
      const updated = await api<MatchDetailView>(`/api/matches/${id}/join`, { method: 'POST' });
      if (liveStateRef.current.expandedId === id) {
        setDetail(updated);
      }
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
      if (liveStateRef.current.expandedId === id) {
        setDetail(updated);
      }
      setMatches((prev) => prev?.map((m) => (m.id === id ? { ...m, joinedCount: updated.joinedCount, status: updated.status } : m)) ?? null);
      onMatchChanged?.();
    } catch (e) {
      setActionError((e as { message?: string })?.message ?? 'Không thể rời trận');
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleRequestDecision(matchId: string, requestUserId: string, action: 'approve' | 'reject') {
    setActionError('');
    setBusyRequestUserIds((prev) => new Set(prev).add(requestUserId));
    loadSeqRef.current += 1;
    try {
      const updated = await api<MatchDetailView>(
        `/api/matches/${matchId}/requests/${requestUserId}/${action}`,
        { method: 'POST' },
      );
      setMatches(
        (prev) =>
          prev?.map((m) =>
            m.id === matchId ? { ...m, joinedCount: updated.joinedCount, status: updated.status } : m,
          ) ?? null,
      );
      if (liveStateRef.current.expandedId === matchId) {
        setDetail(updated);
        setDetailError('');
        const reloadSeq = ++loadSeqRef.current;
        try {
          const reqs = await api<MatchRequestView[]>(`/api/matches/${matchId}/requests`);
          if (reloadSeq === loadSeqRef.current && liveStateRef.current.expandedId === matchId) {
            setRequestsState({ matchId, items: reqs });
          }
        } catch {
          if (liveStateRef.current.expandedId === matchId) {
            setRequestsState((prev) => ({
              matchId,
              items: prev.matchId === matchId ? prev.items.filter((r) => r.userId !== requestUserId) : [],
            }));
          }
        }
      }
      onMatchChanged?.();
    } catch (e) {
      if (liveStateRef.current.expandedId === matchId) {
        setActionError((e as { message?: string })?.message ?? 'Không thể xử lý yêu cầu');
      }
    } finally {
      setBusyRequestUserIds((prev) => {
        const next = new Set(prev);
        next.delete(requestUserId);
        return next;
      });
    }
  }

  function handleCreateMatch() {
    const dest = user ? '/lich-cua-toi' : '/dang-nhap';
    if (onNavigate) {
      onNavigate(dest);
    } else if (typeof window !== 'undefined') {
      window.location.assign(dest);
    }
  }

  const remaining = selectedMatch ? selectedMatch.capacity - selectedMatch.joinedCount : 0;
  const selectedIsApproval = ((detail?.joinMode ?? selectedMatch?.joinMode) ?? 'INSTANT') === 'APPROVAL';

  return (
    <section className="panel lobby-panel" aria-labelledby={heading}>
      <div className="page-head">
        <div>
          <h1>Ghép trận</h1>
          <p>Chọn một trận đang mở, xem người chơi rồi vào trận.</p>
        </div>
        <button type="button" className="btn lime" onClick={handleCreateMatch}>
          <Plus size={18} className="ic" aria-hidden="true" />
          <span>Tạo trận</span>
        </button>
      </div>

      <div className="filter-chips-row">
        <div className="fbar">
          <div className="seg" role="group" aria-label="Loại trận">
            <button
              type="button"
              className={typeTab === 'ALL' ? 'on' : ''}
              onClick={() => setTypeTab('ALL')}
            >
              Tất cả
            </button>
            <button
              type="button"
              className={typeTab === 'SINGLE' ? 'on' : ''}
              onClick={() => setTypeTab('SINGLE')}
            >
              Trận đơn
            </button>
            <button type="button" onClick={comingSoon}>
              Trận đội
            </button>
          </div>
          <label className="sel">
            <span className="sr">Trình độ</span>
            <select value={level} onChange={(e) => setLevel(e.target.value as SkillLevel | '')}>
              <option value="">Mọi trình độ</option>
              {(Object.entries(SKILL_LEVEL_LABELS) as [SkillLevel, string][]).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="ic" aria-hidden="true" />
          </label>
          <label className="sel">
            <span className="sr">Ngày</span>
            <select value={date} onChange={(e) => setDate(e.target.value)}>
              <option value="">Mọi ngày</option>
              {dateOptions.map((opt) => (
                <option key={opt.ymd} value={opt.ymd}>
                  {opt.label}
                </option>
              ))}
              {isOtherDate && <option value={date}>{formatDayChip(date)}</option>}
            </select>
            <ChevronDown size={16} className="ic" aria-hidden="true" />
          </label>
          <label className={`btn ghost other-day ${isOtherDate ? 'on' : ''}`}>
            <CalendarDays size={16} className="ic" aria-hidden="true" />
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
          {matches && <span className="count">{`${matches.length} trận đang mở`}</span>}
        </div>

        <div role="group" aria-label="Môn thể thao" className="chips sport-chips">
          <Chip selected={sport === ''} onClick={() => setSport('')}>
            Tất cả môn
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
      </div>

      <h2 id={heading} className="sr">Phòng chờ</h2>
      <div className="lobby-split md">
        <div className="lobby-list-pane md-list">
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
                    className={`ticket match-ticket card mc compact ${isExpanded ? 'on active' : ''}`}
                    data-status={m.bookingStatus}
                    onClick={() => toggleDetail(m)}
                  >
                    <MatchCardContent
                      match={m}
                      footerAction={
                        <button
                          type="button"
                          className="btn sm lime detail-toggle"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDetail(m);
                          }}
                        >
                          {isExpanded ? 'Đóng chi tiết' : 'Xem chi tiết'}
                        </button>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={`lobby-detail-pane md-detail ${selectedMatch ? 'open' : ''}`}>
          {selectedMatch ? (
            <div className="match-detail card detail">
              <div className="md-back-bar">
                <button type="button" className="back md-back" onClick={closeDetail}>
                  <ArrowLeft size={16} className="ic" aria-hidden="true" />
                  <span>Quay lại</span>
                </button>
              </div>
              <header className="hero">
                <CourtArt sport={selectedMatch.sport} />
                <div className="hero-in">
                  <div>
                    <span className="stub-sport">
                      <SportIcon sport={selectedMatch.sport} size={14} />
                      <span>{SPORT_LABEL[selectedMatch.sport]}</span>
                    </span>
                    <h3>{`${selectedMatch.venueName} · ${selectedMatch.courtName}`}</h3>
                  </div>
                  <div className="hero-when">
                    <b>{formatTime(selectedMatch.startAt)}</b>
                    <span>
                      {`Ngày ${formatDay(selectedMatch.startAt)}`}
                      <br />
                      {`đến ${formatTime(selectedMatch.endAt)}`}
                    </span>
                  </div>
                </div>
              </header>

              <div className="detail-b">
                <div className="tags">
                  <span className="tag solo">Trận đơn</span>
                  <StatusBadge
                    className="status"
                    status={selectedMatch.bookingStatus}
                    label={BOOKING_BADGE[selectedMatch.bookingStatus]}
                  />
                  {selectedIsApproval && <span className="tag warn">Host duyệt</span>}
                </div>

                <dl className="facts">
                  <div>
                    <dt>Đơn vị và sân</dt>
                    <dd>
                      {selectedMatch.venueName}
                      <small>{`${selectedMatch.courtName} · ${selectedMatch.venueAddress}`}</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Trình độ</dt>
                    <dd>
                      {selectedMatch.hostSkillLevel
                        ? SKILL_LEVEL_LABELS[selectedMatch.hostSkillLevel]
                        : 'Mọi trình độ'}
                      <small>{`${SPORT_LABEL[selectedMatch.sport]} · Ngày ${formatDay(selectedMatch.startAt)}`}</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Giá mỗi suất</dt>
                    <dd>
                      <span>{`${formatVnd(selectedMatch.pricePerSlot)}/suất`}</span>
                      <small>{`Còn ${remaining} suất trống`}</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Host</dt>
                    <dd data-field="customer">{selectedMatch.hostName}</dd>
                  </div>
                </dl>

                {!user && (
                  <p className="hint">Đăng nhập để vào trận</p>
                )}

                {user && detail && detail.id === selectedMatch.id && (
                  <>
                    <div className="players-section">
                      <h4>
                        <strong>Người tham gia:</strong>{' '}
                        <span>{`${detail.players.length}/${selectedMatch.capacity}`}</span>
                      </h4>
                      <div className="meter">
                        <i
                          style={{
                            width: `${Math.min(100, Math.round((detail.players.length / selectedMatch.capacity) * 100))}%`,
                          }}
                        />
                      </div>
                      <ul className="roster players-list">
                        {detail.players.map((p) => (
                          <li key={p.userId} className="rp">
                            <span
                              className="av"
                              style={{
                                '--s': '36px',
                                '--c': p.userId === selectedMatch.hostId ? 'var(--ink)' : 'var(--ok)',
                              } as CSSProperties}
                              aria-hidden="true"
                            >
                              {initialChar(p.name)}
                            </span>
                            <div>
                              {detail.viewerRole === 'HOST' && p.phone ? (
                                <a href={`tel:${p.phone}`}>{p.name} ({p.phone})</a>
                              ) : (
                                <b>{p.name}</b>
                              )}
                            </div>
                            {p.userId === selectedMatch.hostId && (
                              <span className="tag ghost">Host</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {detail.viewerRole === 'HOST' && selectedIsApproval && (
                      <div className="queue-section reqs">
                        <h4 className="queue-heading">{`Hàng chờ (${requests.length})`}</h4>
                        {requests.length === 0 ? (
                          <p className="hint">Chưa có yêu cầu</p>
                        ) : (
                          <ul className="queue-list">
                            {requests.map((r) => {
                              const rowBusy = busyRequestUserIds.has(r.userId);
                              return (
                                <li key={r.userId} className="queue-row rp">
                                  <div className="queue-user">
                                    <a href={`tel:${r.phone}`}>
                                      <span>{r.name}</span> <span>({r.phone})</span>
                                    </a>
                                    <span className="queue-reputation">{formatReputation(r.reputation)}</span>
                                  </div>
                                  <div className="queue-actions">
                                    <button
                                      type="button"
                                      className="btn sm lime"
                                      disabled={rowBusy}
                                      onClick={() => void handleRequestDecision(selectedMatch.id, r.userId, 'approve')}
                                    >
                                      Duyệt
                                    </button>
                                    <button
                                      type="button"
                                      className="btn sm ghost"
                                      disabled={rowBusy}
                                      onClick={() => void handleRequestDecision(selectedMatch.id, r.userId, 'reject')}
                                    >
                                      Từ chối
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </>
                )}

                <section className="detail-chat">
                  <h4>Trò chuyện trong trận</h4>
                  <p className="dim small">Sắp ra mắt</p>
                </section>

                {detailError && <p className="error bad" role="alert">{detailError}</p>}
                {actionError && <p className="error bad" role="alert">{actionError}</p>}
              </div>

              <footer className="detail-f actions match-actions">
                <button type="button" className="btn ghost" onClick={comingSoon}>
                  Chia sẻ trận
                </button>
                {user && detail && detail.id === selectedMatch.id && (
                  <>
                    {detail.viewerRole === 'PLAYER' && (
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={loadingAction}
                        onClick={() => handleLeave(selectedMatch.id)}
                      >
                        Rời trận
                      </button>
                    )}
                    {detail.viewerRole === 'NONE' && (
                      detail.myRequest === 'REJECTED' ? (
                        <p className="hint">Host đã từ chối yêu cầu của bạn</p>
                      ) : selectedIsApproval && detail.myRequest === 'PENDING' ? (
                        <>
                          <p className="hint" role="status">Đã gửi yêu cầu. Chờ host duyệt</p>
                          <button
                            type="button"
                            className="btn ghost"
                            disabled={loadingAction}
                            onClick={() => handleLeave(selectedMatch.id)}
                          >
                            Hủy yêu cầu
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn lime"
                          disabled={loadingAction}
                          onClick={() => handleJoin(selectedMatch.id)}
                        >
                          {selectedIsApproval ? 'Xin vào' : 'Vào trận'}
                        </button>
                      )
                    )}
                  </>
                )}
              </footer>
            </div>
          ) : (
            <div className="card empty empty-detail-card">
              <EmptyState message="Chọn một trận bên danh sách để xem người tham gia và vào trận." />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function LobbyRouterBridge(props: LobbyProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const handleSelectTran = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (id) next.set('tran', id);
      else next.delete('tran');
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );
  return (
    <LobbyInner
      {...props}
      tranParam={searchParams.get('tran')}
      onSelectTran={handleSelectTran}
      onNavigate={(to) => navigate(to)}
    />
  );
}

/**
 * Brief F-011 and F-012 (UC-8): public lobby of OPEN matches with real-time SSE stream,
 * match detail view with active player list, and join/leave match actions.
 */
export function Lobby(props: LobbyProps) {
  const inRouter = useInRouterContext();
  return inRouter ? <LobbyRouterBridge {...props} /> : <LobbyInner {...props} />;
}
