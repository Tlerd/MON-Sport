import { api, ApiError, courtLabels, type CourtLabel } from '@monsport/client';
import type { OwnerBookingView, VenueView } from '@monsport/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import type { ShellContextType } from '../../app/App.tsx';
import { useSession } from '../../app/session.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { LoginSheet } from '../auth/LoginSheet.tsx';
import { RejectSheet } from './RejectSheet.tsx';
import { RequestCard } from './RequestCard.tsx';

const RELOAD_MS = 15_000;
const FINAL_409 = ['Yêu cầu đã hết hạn', 'Yêu cầu không còn chờ xác nhận'];

type Action = 'confirm' | 'reject';
interface Notice {
  kind: 'status' | 'alert';
  text: string;
}

export function RequestsScreen() {
  const { user } = useSession();
  return <RequestsScreenBody key={user?.id ?? 'guest'} />;
}

function RequestsScreenBody() {
  const navigate = useNavigate();
  const { user } = useSession();
  const shell = useOutletContext<ShellContextType | undefined>();
  const setPendingRequests = shell?.setPendingRequests;
  const refreshCounts = shell?.refreshCounts;

  const [list, setList] = useState<OwnerBookingView[] | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [labels, setLabels] = useState<Map<string, CourtLabel>>(() => new Map());
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());
  const [notice, setNotice] = useState<Notice | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [, setNowTick] = useState(0);
  const [rejectTarget, setRejectTarget] = useState<OwnerBookingView | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [sessionLoginOpen, setSessionLoginOpen] = useState(false);

  const reqCounter = useRef(0);
  const mountedRef = useRef(true);
  const listRef = useRef(list);
  listRef.current = list;
  const sessionLoginOpenRef = useRef(false);
  sessionLoginOpenRef.current = sessionLoginOpen;
  const busyRef = useRef(new Set<string>());
  const setPendingRef = useRef(setPendingRequests);
  setPendingRef.current = setPendingRequests;
  const refreshRef = useRef(refreshCounts);
  refreshRef.current = refreshCounts;

  const active = user?.role === 'OWNER';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      reqCounter.current++;
    };
  }, []);

  const load = useCallback(() => {
    const reqId = ++reqCounter.current;
    api<OwnerBookingView[]>('/api/owner/bookings?status=PENDING').then(
      (res) => {
        if (!mountedRef.current || reqId !== reqCounter.current) return;
        setFailed(false);
        setList(res);
        setPendingRef.current?.(res.length);
      },
      (err: unknown) => {
        if (!mountedRef.current || reqId !== reqCounter.current) return;
        if (err instanceof ApiError && err.status === 401) setSessionLoginOpen(true);
        if (!listRef.current) setFailed(true);
      },
    );
  }, []);

  const retry = () => {
    setFailed(false);
    load();
  };

  useEffect(() => {
    reqCounter.current++;
    setList(undefined);
    setFailed(false);
    setLabels(new Map());
    setNotice(null);
    setCardErrors({});
    setRejectTarget(null);
    busyRef.current = new Set();
    setBusyIds(new Set());
    if (!active) return;
    let cancelled = false;
    load();
    api<VenueView[]>('/api/owner/venues').then(
      (venues) => {
        if (!cancelled) setLabels(courtLabels(venues));
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [user?.id, active, load]);

  useEffect(() => {
    if (user?.role === 'USER') navigate('/', { replace: true });
  }, [user?.role, navigate]);

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      timer = setInterval(() => {
        setNowTick((t) => t + 1);
        if (!sessionLoginOpenRef.current) load();
      }, RELOAD_MS);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setNowTick((t) => t + 1);
        if (!sessionLoginOpenRef.current) load();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user?.id, active, load]);

  const removeCard = (id: string) => {
    const next = (listRef.current ?? []).filter((r) => r.id !== id);
    listRef.current = next;
    setList(next);
    return next.length;
  };

  const reportCount = (newLength: number) => {
    if (setPendingRef.current) setPendingRef.current(newLength);
    else refreshRef.current?.();
  };

  const decide = async (request: OwnerBookingView, action: Action) => {
    if (busyRef.current.has(request.id)) return;
    busyRef.current.add(request.id);
    setBusyIds(new Set(busyRef.current));
    setNotice(null);
    setCardErrors((prev) => {
      if (!(request.id in prev)) return prev;
      const next = { ...prev };
      delete next[request.id];
      return next;
    });
    reqCounter.current++;
    try {
      await api(`/api/owner/bookings/${request.id}/${action}`, { method: 'POST' });
      reqCounter.current++;
      if (!mountedRef.current) return;
      const newLength = removeCard(request.id);
      setNotice({ kind: 'status', text: action === 'confirm' ? 'Đã xác nhận yêu cầu' : 'Đã từ chối yêu cầu' });
      reportCount(newLength);
    } catch (err) {
      reqCounter.current++;
      if (!mountedRef.current) return;
      if (err instanceof ApiError && err.status === 409) {
        if (FINAL_409.includes(err.message)) {
          reportCount(removeCard(request.id));
          setNotice({ kind: 'alert', text: err.message });
        } else {
          setCardErrors((prev) => ({ ...prev, [request.id]: err.message }));
        }
      } else if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
        reportCount(removeCard(request.id));
        setNotice({ kind: 'alert', text: 'Yêu cầu này không còn trong danh sách của bạn' });
        load();
      } else if (err instanceof ApiError && err.status === 401) {
        setSessionLoginOpen(true);
      } else {
        setCardErrors((prev) => ({ ...prev, [request.id]: 'Không lưu được quyết định. Thử lại.' }));
      }
    } finally {
      busyRef.current.delete(request.id);
      if (mountedRef.current) setBusyIds(new Set(busyRef.current));
    }
  };

  if (user === undefined) return <EmptyState message="Đang tải" />;
  if (user === null) {
    return (
      <div style={{ minWidth: 0 }}>
        <EmptyState message="Đăng nhập để xem yêu cầu" actionLabel="Đăng nhập" onAction={() => setLoginOpen(true)} />
        <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>
    );
  }
  if (user.role === 'ADMIN' || !active) return null;

  const now = new Date();

  return (
    <div style={{ minWidth: 0 }}>
      {!list ? (
        failed ? (
          <EmptyState message="Không tải được" actionLabel="Thử lại" onAction={retry} />
        ) : (
          <EmptyState message="Đang tải" />
        )
      ) : (
        <>
          {list.length > 0 && (
            <h2
              style={{
                margin: 0,
                padding: 'var(--space-md) var(--space-base)',
                font: 'var(--font-label)',
                color: 'var(--color-ink-muted)',
                minWidth: 0,
                overflowWrap: 'anywhere',
              }}
            >
              {list.length} yêu cầu đang chờ
            </h2>
          )}
          {notice && (
            <p
              role={notice.kind === 'alert' ? 'alert' : 'status'}
              style={{
                margin: 0,
                padding: 'var(--space-sm) var(--space-base)',
                minWidth: 0,
                font: 'var(--font-meta)',
                color: notice.kind === 'alert' ? 'var(--color-status-no)' : 'var(--color-ink-muted)',
                overflowWrap: 'anywhere',
              }}
            >
              {notice.text}
            </p>
          )}
          {list.length === 0 ? (
            <EmptyState message="Chưa có yêu cầu nào đang chờ" />
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {list.map((r) => {
                const label = labels.get(r.courtId);
                return (
                  <li key={r.id} style={{ minWidth: 0 }}>
                    <RequestCard
                      request={r}
                      courtName={label?.courtName ?? 'Sân'}
                      venueName={label?.venueName}
                      now={now}
                      busy={busyIds.has(r.id)}
                      error={cardErrors[r.id]}
                      onConfirm={(req) => decide(req, 'confirm')}
                      onReject={setRejectTarget}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <RejectSheet
        request={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onReject={(req) => {
          setRejectTarget(null);
          decide(req, 'reject');
        }}
      />
      <LoginSheet
        open={sessionLoginOpen}
        onClose={() => setSessionLoginOpen(false)}
        onLoggedIn={load}
        notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
      />
    </div>
  );
}
