import { api, ApiError, dayHeading, formatVnd, hhmm, lobbyChips, lobbyMatches } from '@monsport/client';
import {
  minuteOfDayVN,
  userCancelDecision,
  vnDateString,
  type MatchDetailView,
  type MatchView,
  type Sport,
} from '@monsport/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '../../app/session.tsx';
import { Chip } from '../../components/Chip.tsx';
import { ContextBar } from '../../components/ContextBar.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { IconBadminton, IconFootball, SPORT_LABEL } from '../../components/SportIcon.tsx';
import { LoginSheet } from '../auth/LoginSheet.tsx';
import {
  CALL_OWNER_TO_CANCEL_HINT,
  LobbyMatchCard,
  REQUEST_PENDING_TEXT,
  REQUEST_REJECTED_TEXT,
} from './LobbyMatchCard.tsx';
import { useLobbyStream } from './useLobbyStream.ts';

export interface LobbyScreenProps {
  now?: Date;
}

const sheetBtnStyle = {
  minHeight: '44px',
  minWidth: '44px',
  padding: '0 var(--space-base)',
  borderRadius: 'var(--radius-sm)',
  font: 'var(--font-body-strong)',
  cursor: 'pointer',
} as const;

export function LobbyScreen({ now: nowProp }: LobbyScreenProps) {
  const navigate = useNavigate();
  const { user } = useSession();
  const now = nowProp ?? new Date();

  const [sport, setSport] = useState<Sport | undefined>(undefined);
  const [date, setDate] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<MatchView[] | undefined>(undefined);
  const [joinedRows, setJoinedRows] = useState<MatchView[]>([]);
  const [failed, setFailed] = useState(false);
  const [joinedFailed, setJoinedFailed] = useState(false);
  const [sessionLoginOpen, setSessionLoginOpen] = useState(false);
  const [guestLoginOpen, setGuestLoginOpen] = useState(false);
  const [playerSheetOpen, setPlayerSheetOpen] = useState(false);

  const [joiningIds, setJoiningIds] = useState<Record<string, boolean>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  // The request of the viewer on a "Host duyệt" match. A PENDING request holds no slot (BR-50).
  const [requests, setRequests] = useState<Record<string, 'PENDING' | 'REJECTED'>>({});

  const [detailTarget, setDetailTarget] = useState<MatchView | null>(null);
  const [detail, setDetail] = useState<MatchDetailView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [leaveTarget, setLeaveTarget] = useState<MatchView | null>(null);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  const [cancelTarget, setCancelTarget] = useState<MatchView | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const userId = user?.id;
  const role = user?.role;
  const isPlayer = role === 'USER';

  const reqCounter = useRef(0);
  const detailReqCounter = useRef(0);
  const inFlight = useRef(false);
  const pending = useRef(false);
  // The login sheet opens once for each expiry, not on every SSE reload that gets a 401.
  const expiredShown = useRef(false);
  const fetchedSinceExpiry = useRef(false);
  const pendingJoinRef = useRef<string | null>(null);
  const [loginTick, setLoginTick] = useState(0);
  const [guestLoginTick, setGuestLoginTick] = useState(0);
  const roleRef = useRef(role);
  const userIdRef = useRef(userId);
  const detailTargetIdRef = useRef<string | null>(null);
  const leaveTargetIdRef = useRef<string | null>(null);
  const cancelTargetIdRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    roleRef.current = role;
    userIdRef.current = userId;
    detailTargetIdRef.current = detailTarget?.id ?? null;
    leaveTargetIdRef.current = leaveTarget?.id ?? null;
    cancelTargetIdRef.current = cancelTarget?.id ?? null;
  });

  const openSessionLogin = useCallback(() => {
    if (!expiredShown.current) {
      expiredShown.current = true;
      fetchedSinceExpiry.current = false;
      setSessionLoginOpen(true);
    }
  }, []);

  const closeDetail = useCallback(() => {
    detailReqCounter.current++;
    setDetailTarget(null);
    setDetail(null);
    setDetailError('');
    setDetailLoading(false);
  }, []);

  const fetchAll = useCallback(() => {
    const reqId = ++reqCounter.current;
    inFlight.current = true;
    pending.current = false;
    setFailed(false);
    const params = new URLSearchParams();
    if (sport) params.set('sport', sport);
    if (date) params.set('date', date);
    const qs = params.toString();
    const feed = api<MatchView[]>('/api/matches' + (qs ? `?${qs}` : ''));
    const joined = isPlayer
      ? api<MatchView[]>('/api/matches/joined').then(
          (list) => ({ list }),
          (error: unknown) => ({ error }),
        )
      : Promise.resolve({ list: [] as MatchView[] });
    const finish = () => {
      inFlight.current = false;
      if (pending.current) {
        pending.current = false;
        fetchRef.current();
      }
    };
    Promise.all([feed.then((list) => ({ list }), () => null), joined]).then(([f, j]) => {
      if (reqId !== reqCounter.current) return;
      if (!f) {
        setFailed(true);
        finish();
        return;
      }
      setRows(f.list);
      if ('list' in j) {
        setJoinedRows(j.list);
        setJoinedFailed(false);
      } else {
        setJoinedRows([]);
        if (j.error instanceof ApiError && j.error.status === 401) {
          setJoinedFailed(false);
          openSessionLogin();
        } else {
          setJoinedFailed(true);
        }
      }
      finish();
    });
  }, [sport, date, isPlayer, openSessionLogin]);

  const fetchRef = useRef(fetchAll);
  useLayoutEffect(() => {
    fetchRef.current = fetchAll;
  });

  /** Dedupe: a call during a flight asks for exactly one follow-up reload after it ends. */
  const reload = useCallback(() => {
    if (inFlight.current) {
      pending.current = true;
      return;
    }
    fetchRef.current();
  }, []);

  const retryJoined = useCallback(() => {
    if (roleRef.current !== 'USER') return;
    const reqId = reqCounter.current;
    setJoinedFailed(false);
    api<MatchView[]>('/api/matches/joined').then(
      (list) => {
        if (reqId !== reqCounter.current) return;
        setJoinedRows(list);
      },
      (error: unknown) => {
        if (reqId !== reqCounter.current) return;
        if (error instanceof ApiError && error.status === 401) {
          openSessionLogin();
        } else setJoinedFailed(true);
      },
    );
  }, [openSessionLogin]);

  useEffect(() => {
    reqCounter.current++;
    detailReqCounter.current++;
    inFlight.current = false;
    pending.current = false;
    expiredShown.current = false;
    setRows(undefined);
    setJoinedRows([]);
    setJoinedFailed(false);
    setCardErrors({});
    setRequests({});
    setDetailTarget(null);
    setDetail(null);
    setDetailError('');
    setDetailLoading(false);
    setLeaveTarget(null);
    setLeaveError('');
    setCancelTarget(null);
    setCancelError('');
  }, [userId]);

  useEffect(() => {
    if (user === undefined) return;
    fetchedSinceExpiry.current = true;
    fetchAll();
  }, [userId, user === undefined, fetchAll]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a login from the expiry sheet: reload in an effect, so the request sees the role of the new session.
  useEffect(() => {
    if (loginTick === 0) return;
    expiredShown.current = false;
    if (fetchedSinceExpiry.current) {
      fetchedSinceExpiry.current = false;
      return;
    }
    fetchRef.current();
  }, [loginTick]);

  const applyRequest = useCallback((id: string, myRequest: 'PENDING' | 'REJECTED' | null | undefined) => {
    setRequests((prev) => {
      const next = { ...prev };
      if (myRequest === 'PENDING' || myRequest === 'REJECTED') next[id] = myRequest;
      else delete next[id];
      return next;
    });
  }, []);

  const joinMatch = useCallback(
    async (id: string) => {
      const startUserId = userIdRef.current;
      setJoiningIds((prev) => ({ ...prev, [id]: true }));
      setCardErrors({});
      if (detailTargetIdRef.current === id) setDetailError('');
      try {
        const res = await api<MatchDetailView>(`/api/matches/${id}/join`, { method: 'POST' });
        if (userIdRef.current !== startUserId) return;
        if (res && typeof res === 'object' && 'id' in res) {
          applyRequest(res.id, res.myRequest);
          // A PENDING request is not a slot: the match does not join the joined list (BR-50).
          if (res.myRequest !== 'PENDING') {
            setJoinedRows((prev) => [...prev.filter((m) => m.id !== res.id), res]);
          }
          setRows((prev) => prev?.map((m) => (m.id === res.id ? res : m)));
          setDetail((prev) => (prev && prev.id === res.id ? res : prev));
        }
        reload();
      } catch (err) {
        if (userIdRef.current !== startUserId) return;
        if (err instanceof ApiError && err.status === 401) {
          if (detailTargetIdRef.current === id) closeDetail();
          openSessionLogin();
        } else if (err instanceof ApiError) {
          setCardErrors((prev) => ({ ...prev, [id]: err.message }));
          if (detailTargetIdRef.current === id) setDetailError(err.message);
          if (err.status === 409 && err.message === REQUEST_REJECTED_TEXT) applyRequest(id, 'REJECTED');
          if (err.status === 409) reload();
        } else {
          const msg = 'Không kết nối được. Thử lại sau';
          setCardErrors((prev) => ({ ...prev, [id]: msg }));
          if (detailTargetIdRef.current === id) setDetailError(msg);
        }
      } finally {
        setJoiningIds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [reload, closeDetail, openSessionLogin, applyRequest],
  );

  const cancelRequest = useCallback(
    async (id: string) => {
      const startUserId = userIdRef.current;
      setJoiningIds((prev) => ({ ...prev, [id]: true }));
      setCardErrors({});
      if (detailTargetIdRef.current === id) setDetailError('');
      try {
        // The leave call also cancels a pending request.
        await api(`/api/matches/${id}/leave`, { method: 'POST' });
        if (userIdRef.current !== startUserId) return;
        applyRequest(id, null);
        setDetail((prev) => (prev && prev.id === id ? { ...prev, myRequest: null } : prev));
        reload();
      } catch (err) {
        if (userIdRef.current !== startUserId) return;
        if (err instanceof ApiError && err.status === 401) {
          if (detailTargetIdRef.current === id) closeDetail();
          openSessionLogin();
        } else {
          const msg = err instanceof ApiError ? err.message : 'Không kết nối được. Thử lại sau';
          setCardErrors((prev) => ({ ...prev, [id]: msg }));
          if (detailTargetIdRef.current === id) setDetailError(msg);
          if (err instanceof ApiError && err.status === 409) reload();
        }
      } finally {
        setJoiningIds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [reload, closeDetail, openSessionLogin, applyRequest],
  );

  useEffect(() => {
    if (guestLoginTick === 0) return;
    const id = pendingJoinRef.current;
    pendingJoinRef.current = null;
    if (!id) return;
    if (roleRef.current === 'OWNER' || roleRef.current === 'ADMIN') {
      setPlayerSheetOpen(true);
      return;
    }
    void joinMatch(id);
  }, [guestLoginTick, joinMatch]);

  useLobbyStream(reload, user !== undefined);

  const handleOpen = (match: MatchView) => {
    setCardErrors({});
    if (role === 'OWNER' || role === 'ADMIN') {
      setPlayerSheetOpen(true);
      return;
    }
    if (user === null) {
      detailReqCounter.current++;
      setDetailTarget(match);
      setDetail(null);
      setDetailError('');
      setDetailLoading(false);
      return;
    }
    const reqId = ++detailReqCounter.current;
    setDetailTarget(match);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    api<MatchDetailView>(`/api/matches/${match.id}`).then(
      (d) => {
        if (reqId !== detailReqCounter.current) return;
        setDetail(d);
        applyRequest(d.id, d.myRequest);
        setDetailLoading(false);
      },
      (err: unknown) => {
        if (reqId !== detailReqCounter.current) return;
        setDetailLoading(false);
        if (err instanceof ApiError && err.status === 401) {
          closeDetail();
          openSessionLogin();
        } else {
          setDetailError(err instanceof ApiError ? err.message : 'Không tải được');
        }
      },
    );
  };

  const handleJoin = (match: MatchView) => {
    if (user === null) {
      pendingJoinRef.current = match.id;
      setGuestLoginOpen(true);
      return;
    }
    if (role === 'OWNER' || role === 'ADMIN') {
      setPlayerSheetOpen(true);
      return;
    }
    if (joiningIds[match.id]) return;
    void joinMatch(match.id);
  };

  const openLeave = (match: MatchView) => {
    setCardErrors({});
    setLeaveError('');
    setLeaveTarget(match);
  };

  const closeLeave = () => {
    setLeaveTarget(null);
    setLeaveError('');
  };

  const confirmLeave = async () => {
    if (!leaveTarget || leaveBusy) return;
    const target = leaveTarget;
    const startUserId = userIdRef.current;
    setLeaveBusy(true);
    setLeaveError('');
    try {
      const res = await api<MatchDetailView>(`/api/matches/${target.id}/leave`, { method: 'POST' });
      if (userIdRef.current !== startUserId) return;
      const updated: MatchView =
        res && typeof res === 'object' && 'id' in res
          ? res
          : { ...target, status: 'OPEN', joinedCount: Math.max(0, target.joinedCount - 1) };
      setJoinedRows((prev) => prev.filter((m) => m.id !== target.id));
      setRows((prev) => {
        if (!prev) return [updated];
        return prev.some((m) => m.id === target.id)
          ? prev.map((m) => (m.id === target.id ? updated : m))
          : [...prev, updated];
      });
      if (leaveTargetIdRef.current === target.id) setLeaveTarget(null);
      if (detailTargetIdRef.current === target.id) closeDetail();
      reload();
    } catch (err) {
      if (userIdRef.current !== startUserId) return;
      const sameLeave = leaveTargetIdRef.current === target.id;
      if (err instanceof ApiError && err.status === 401) {
        if (sameLeave) setLeaveTarget(null);
        if (detailTargetIdRef.current === target.id) closeDetail();
        openSessionLogin();
      } else if (err instanceof ApiError) {
        if (sameLeave) setLeaveError(err.message);
        if (err.status === 409) reload();
      } else if (sameLeave) {
        setLeaveError('Không kết nối được. Thử lại sau');
      }
    } finally {
      setLeaveBusy(false);
    }
  };

  const openCancel = (match: MatchView) => {
    setCardErrors({});
    setCancelError('');
    setCancelTarget(match);
  };

  const closeCancel = () => {
    setCancelTarget(null);
    setCancelError('');
  };

  const confirmCancel = async () => {
    if (!cancelTarget || cancelBusy) return;
    const target = cancelTarget;
    const startUserId = userIdRef.current;
    setCancelBusy(true);
    setCancelError('');
    try {
      await api(`/api/matches/${target.id}/cancel`, { method: 'POST' });
      if (userIdRef.current !== startUserId) return;
      setRows((prev) => prev?.filter((m) => m.id !== target.id));
      setJoinedRows((prev) => prev.filter((m) => m.id !== target.id));
      if (cancelTargetIdRef.current === target.id) setCancelTarget(null);
      if (detailTargetIdRef.current === target.id) closeDetail();
      reload();
    } catch (err) {
      if (userIdRef.current !== startUserId) return;
      const sameCancel = cancelTargetIdRef.current === target.id;
      if (err instanceof ApiError && err.status === 401) {
        if (sameCancel) setCancelTarget(null);
        if (detailTargetIdRef.current === target.id) closeDetail();
        openSessionLogin();
      } else if (err instanceof ApiError) {
        if (sameCancel) setCancelError(err.message);
        if (err.status === 409) reload();
      } else if (sameCancel) {
        setCancelError('Không kết nối được. Thử lại sau');
      }
    } finally {
      setCancelBusy(false);
    }
  };

  if (user === undefined) {
    return <EmptyState message="Đang tải" />;
  }

  const chips = lobbyChips(now);
  const joinedById = new Map(joinedRows.map((m) => [m.id, m]));
  const mergedFeed = rows?.map((m) => joinedById.get(m.id) ?? m);
  const cards = mergedFeed ? lobbyMatches(mergedFeed, joinedRows, now, { sport, date }, userId) : undefined;
  const detailOpen = detailTarget !== null && leaveTarget === null && cancelTarget === null;
  const shownMatch = detail ?? detailTarget;
  const detailApproval = (detail?.joinMode ?? detailTarget?.joinMode) === 'APPROVAL';
  const orphanError =
    !detailOpen && cards
      ? Object.entries(cardErrors).find(([id]) => !cards.some((c) => c.match.id === id))?.[1]
      : undefined;

  return (
    <div style={{ minWidth: 0 }}>
      <ContextBar aria-label="Bộ lọc phòng chờ">
        <Chip
          selected={sport === undefined}
          onClick={() => {
            setCardErrors({});
            setSport(undefined);
          }}
        >
          Tất cả
        </Chip>
        <Chip
          selected={sport === 'BADMINTON'}
          icon={<IconBadminton size={18} />}
          onClick={() => {
            setCardErrors({});
            setSport(sport === 'BADMINTON' ? undefined : 'BADMINTON');
          }}
        >
          {SPORT_LABEL.BADMINTON}
        </Chip>
        <Chip
          selected={sport === 'FOOTBALL'}
          icon={<IconFootball size={18} />}
          onClick={() => {
            setCardErrors({});
            setSport(sport === 'FOOTBALL' ? undefined : 'FOOTBALL');
          }}
        >
          {SPORT_LABEL.FOOTBALL}
        </Chip>
        <Chip
          selected={date === undefined}
          onClick={() => {
            setCardErrors({});
            setDate(undefined);
          }}
        >
          Tất cả ngày
        </Chip>
        {chips.map((chip) => (
          <Chip
            key={chip.ymd}
            selected={date === chip.ymd}
            onClick={() => {
              setCardErrors({});
              setDate(date === chip.ymd ? undefined : chip.ymd);
            }}
          >
            {chip.label}
          </Chip>
        ))}
      </ContextBar>

      <div style={{ paddingTop: '61px', minWidth: 0 }}>
        {failed ? (
          <EmptyState message="Không tải được" actionLabel="Thử lại" onAction={fetchAll} />
        ) : !cards ? (
          <EmptyState message="Đang tải" />
        ) : (
          <>
            {joinedFailed && isPlayer && (
              <div
                role="status"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-sm)',
                  padding: 'var(--space-sm) var(--space-base)',
                  font: 'var(--font-meta)',
                  color: 'var(--color-ink-muted)',
                  minWidth: 0,
                }}
              >
                <span style={{ overflowWrap: 'anywhere' }}>Không tải được trận bạn đã vào</span>
                <button
                  type="button"
                  onClick={retryJoined}
                  style={{
                    minHeight: '44px',
                    minWidth: '44px',
                    padding: '0 var(--space-md)',
                    border: '1px solid var(--color-line)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-ink)',
                    font: 'var(--font-label)',
                    cursor: 'pointer',
                  }}
                >
                  Thử lại
                </button>
              </div>
            )}
            {orphanError && (
              <p
                role="alert"
                style={{
                  margin: 0,
                  padding: 'var(--space-sm) var(--space-base)',
                  font: 'var(--font-meta)',
                  color: 'var(--color-status-no)',
                }}
              >
                {orphanError}
              </p>
            )}
            {cards.length === 0 ? (
              <EmptyState message="Chưa có trận nào" actionLabel="Đặt sân" onAction={() => navigate('/')} />
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1px',
                  minWidth: 0,
                }}
              >
                {cards.map((card) => (
                  <li key={card.match.id} style={{ minWidth: 0 }}>
                    <LobbyMatchCard
                      card={card}
                      busy={Boolean(joiningIds[card.match.id])}
                      error={
                        detailOpen && detailTarget?.id === card.match.id
                          ? undefined
                          : cardErrors[card.match.id]
                      }
                      now={now}
                      onJoin={handleJoin}
                      request={requests[card.match.id]}
                      onCancelRequest={(m) => void cancelRequest(m.id)}
                      onLeave={openLeave}
                      onCancel={openCancel}
                      onOpen={handleOpen}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <Sheet open={detailOpen} onClose={closeDetail} title="Chi tiết trận">
        {shownMatch && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', minWidth: 0 }}>
            <div style={{ font: 'var(--font-body-strong)', overflowWrap: 'anywhere', minWidth: 0 }}>
              {`${shownMatch.venueName} · ${shownMatch.courtName}`}
            </div>
            <div style={{ font: 'var(--font-body)', minWidth: 0 }}>
              {dayHeading(vnDateString(new Date(shownMatch.startAt)))}
            </div>
            <div className="tnum" style={{ font: 'var(--font-numeric)', color: 'var(--color-ink-muted)', minWidth: 0 }}>
              {`${hhmm(minuteOfDayVN(new Date(shownMatch.startAt)))}–${hhmm(minuteOfDayVN(new Date(shownMatch.endAt)))} · ${shownMatch.joinedCount}/${shownMatch.capacity} suất · ${formatVnd(shownMatch.pricePerSlot)}/suất`}
            </div>
            {user === null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', minWidth: 0 }}>
                <p style={{ margin: 0, font: 'var(--font-body)' }}>Đăng nhập để xem người chơi</p>
                <button
                  type="button"
                  onClick={() => {
                    closeDetail();
                    pendingJoinRef.current = null;
                    setGuestLoginOpen(true);
                  }}
                  style={{
                    ...sheetBtnStyle,
                    border: 'none',
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                    alignSelf: 'flex-start',
                  }}
                >
                  Đăng nhập
                </button>
              </div>
            ) : detailLoading ? (
              <p style={{ margin: 0, font: 'var(--font-body)', color: 'var(--color-ink-muted)' }}>Đang tải</p>
            ) : (
              detail && (
                <>
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: 0,
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-xs)',
                      minWidth: 0,
                    }}
                  >
                    {(detail.players ?? [])
                      .filter((p) => !('status' in p) || (p as { status?: string }).status === 'ACTIVE')
                      .map((p) => (
                        <li
                          key={p.userId}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 'var(--space-sm)',
                            minWidth: 0,
                          }}
                        >
                          <span style={{ font: 'var(--font-body)', overflowWrap: 'anywhere', minWidth: 0 }}>
                            {p.name}
                          </span>
                          {detail.viewerRole === 'HOST' && p.phone && (
                            <a
                              href={`tel:${p.phone}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                minHeight: '44px',
                                color: 'var(--color-primary)',
                                font: 'var(--font-body-strong)',
                              }}
                            >
                              {p.phone}
                            </a>
                          )}
                        </li>
                      ))}
                  </ul>
                  {detailApproval && detail.viewerRole === 'NONE' && requests[detail.id] === 'PENDING' && (
                    <>
                      <p role="status" style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-ink-muted)' }}>
                        {REQUEST_PENDING_TEXT}
                      </p>
                      <button
                        type="button"
                        disabled={Boolean(joiningIds[detail.id])}
                        onClick={() => void cancelRequest(detail.id)}
                        style={{
                          ...sheetBtnStyle,
                          border: '1px solid var(--color-line)',
                          backgroundColor: 'var(--color-surface)',
                          color: 'var(--color-ink)',
                          alignSelf: 'flex-start',
                          cursor: joiningIds[detail.id] ? 'not-allowed' : 'pointer',
                          opacity: joiningIds[detail.id] ? 0.6 : 1,
                        }}
                      >
                        Hủy yêu cầu
                      </button>
                    </>
                  )}
                  {detailApproval &&
                    detail.viewerRole === 'NONE' &&
                    requests[detail.id] === 'REJECTED' &&
                    detailError !== REQUEST_REJECTED_TEXT && (
                      <p role="status" style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }}>
                        {REQUEST_REJECTED_TEXT}
                      </p>
                    )}
                  {detail.viewerRole === 'NONE' &&
                    (detailApproval ? detail.status !== 'CANCELLED' : detail.status === 'OPEN') &&
                    !(detailApproval && requests[detail.id]) && (
                    <button
                      type="button"
                      disabled={Boolean(joiningIds[detail.id])}
                      onClick={() => handleJoin(detail)}
                      style={{
                        ...sheetBtnStyle,
                        border: 'none',
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-on-primary)',
                        alignSelf: 'flex-start',
                        cursor: joiningIds[detail.id] ? 'not-allowed' : 'pointer',
                        opacity: joiningIds[detail.id] ? 0.6 : 1,
                      }}
                    >
                      {detailApproval ? 'Xin vào' : 'Vào trận'}
                    </button>
                  )}
                  {detail.viewerRole === 'PLAYER' && Date.parse(detail.startAt) > now.getTime() && (
                    <button
                      type="button"
                      onClick={() => openLeave(detail)}
                      style={{
                        ...sheetBtnStyle,
                        border: '1px solid var(--color-line)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-ink)',
                        alignSelf: 'flex-start',
                      }}
                    >
                      Rời trận
                    </button>
                  )}
                  {detail.viewerRole === 'HOST' &&
                    userCancelDecision(
                      { status: detail.bookingStatus, startAt: new Date(detail.startAt) },
                      now,
                    ) === 'CALL_OWNER' && (
                      <p style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-ink-muted)' }}>
                        {CALL_OWNER_TO_CANCEL_HINT}
                      </p>
                    )}
                  {detail.viewerRole === 'HOST' &&
                    userCancelDecision(
                      { status: detail.bookingStatus, startAt: new Date(detail.startAt) },
                      now,
                    ) === 'ALLOW' && (
                    <button
                      type="button"
                      onClick={() => openCancel(detail)}
                      style={{
                        ...sheetBtnStyle,
                        border: '1px solid var(--color-line)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-ink)',
                        alignSelf: 'flex-start',
                      }}
                    >
                      Hủy trận
                    </button>
                  )}
                </>
              )
            )}
            {detailError && (
              <p
                role="alert"
                style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }}
              >
                {detailError}
              </p>
            )}
          </div>
        )}
      </Sheet>

      <Sheet
        open={leaveTarget !== null}
        onClose={closeLeave}
        title="Rời trận này?"
        primaryAction={{ label: 'Rời trận', onClick: confirmLeave, disabled: leaveBusy }}
      >
        {leaveTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', minWidth: 0 }}>
            <div style={{ font: 'var(--font-body-strong)', overflowWrap: 'anywhere', minWidth: 0 }}>
              {`${leaveTarget.venueName} · ${leaveTarget.courtName}`}
            </div>
            <div style={{ font: 'var(--font-body)', minWidth: 0 }}>
              {dayHeading(vnDateString(new Date(leaveTarget.startAt)))}
            </div>
            <div className="tnum" style={{ font: 'var(--font-numeric)', color: 'var(--color-ink-muted)', minWidth: 0 }}>
              {`${hhmm(minuteOfDayVN(new Date(leaveTarget.startAt)))}–${hhmm(minuteOfDayVN(new Date(leaveTarget.endAt)))}`}
            </div>
            {leaveError && (
              <p
                role="alert"
                style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }}
              >
                {leaveError}
              </p>
            )}
          </div>
        )}
      </Sheet>

      <Sheet
        open={cancelTarget !== null}
        onClose={closeCancel}
        title="Hủy trận này?"
        primaryAction={{ label: 'Hủy trận', onClick: confirmCancel, disabled: cancelBusy }}
      >
        {cancelTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', minWidth: 0 }}>
            <div style={{ font: 'var(--font-body-strong)', overflowWrap: 'anywhere', minWidth: 0 }}>
              {`${cancelTarget.venueName} · ${cancelTarget.courtName}`}
            </div>
            <div style={{ font: 'var(--font-body)', minWidth: 0 }}>
              {dayHeading(vnDateString(new Date(cancelTarget.startAt)))}
            </div>
            <div className="tnum" style={{ font: 'var(--font-numeric)', color: 'var(--color-ink-muted)', minWidth: 0 }}>
              {`${hhmm(minuteOfDayVN(new Date(cancelTarget.startAt)))}–${hhmm(minuteOfDayVN(new Date(cancelTarget.endAt)))}`}
            </div>
            <p style={{ margin: 0, font: 'var(--font-body)', color: 'var(--color-ink)' }}>
              Trận và booking của trận sẽ bị hủy. Người trong trận sẽ nhận thông báo.
            </p>
            {cancelError && (
              <p
                role="alert"
                style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }}
              >
                {cancelError}
              </p>
            )}
          </div>
        )}
      </Sheet>

      <LoginSheet
        open={guestLoginOpen}
        onClose={() => setGuestLoginOpen(false)}
        onLoggedIn={() => {
          setGuestLoginOpen(false);
          setGuestLoginTick((t) => t + 1);
        }}
      />
      <LoginSheet
        open={sessionLoginOpen}
        onClose={() => {
          expiredShown.current = false;
          setSessionLoginOpen(false);
        }}
        onLoggedIn={() => {
          setSessionLoginOpen(false);
          setLoginTick((t) => t + 1);
        }}
        notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
      />
      <Sheet
        open={playerSheetOpen}
        onClose={() => setPlayerSheetOpen(false)}
        title="Dùng tài khoản người chơi để vào trận"
      >
        <p style={{ margin: 0, font: 'var(--font-body)' }}>
          Tài khoản chủ sân và quản trị viên chỉ xem được danh sách trận. Hãy đăng nhập bằng tài khoản người
          chơi để vào trận.
        </p>
      </Sheet>
    </div>
  );
}
