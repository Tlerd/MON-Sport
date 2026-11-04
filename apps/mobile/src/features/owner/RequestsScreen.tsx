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
  const navigate = useNavigate();
  const { user } = useSession();
  // The screen also renders without the shell (tests, a route outside App), so the context may be missing.
  const shell = useOutletContext<ShellContextType | undefined>();
  const setPendingRequests = shell?.setPendingRequests;
  const refreshCounts = shell?.refreshCounts;

  const [list, setList] = useState<OwnerBookingView[] | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [labels, setLabels] = useState<Map<string, CourtLabel>>(() => new Map());
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());
  const [notice, setNotice] = useState<Notice | null>(null);
  const [rejectTarget, setRejectTarget] = useState<OwnerBookingView | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [sessionLoginOpen, setSessionLoginOpen] = useState(false);

  // A reply is applied only when no newer request or write started after it began.
  const reqCounter = useRef(0);
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

  const load = useCallback(() => {
    const reqId = ++reqCounter.current;
    api<OwnerBookingView[]>('/api/owner/bookings?status=PENDING').then(
      (res) => {
        if (reqId !== reqCounter.current) return;
        setFailed(false);
        setList(res);
        setPendingRef.current?.(res.length);
      },
      (err: unknown) => {
        if (reqId !== reqCounter.current) return;
        if (err instanceof ApiError && err.status === 401) setSessionLoginOpen(true);
        // A failed reload keeps the old list. Only an empty screen shows the error.
        if (!listRef.current) setFailed(true);
      },
    );
  }, []);

  const retry = () => {
    setFailed(false);
    load();
  };

  // Venues load once for each user. A failure leaves the labels empty and does not block the list.
  useEffect(() => {
    reqCounter.current++;
    setList(undefined);
    setFailed(false);
    setLabels(new Map());
    setNotice(null);
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
      () => {
        // The card shows "Sân" without a venue name.
      },
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
        if (!sessionLoginOpenRef.current) load();
      }, RELOAD_MS);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        load();
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

  const removeCard = (id: string) => setList((prev) => prev?.filter((r) => r.id !== id));

  const decide = async (request: OwnerBookingView, action: Action) => {
    if (busyRef.current.has(request.id)) return;
    busyRef.current.add(request.id);
    setBusyIds(new Set(busyRef.current));
    setNotice(null);
    reqCounter.current++;
    try {
      await api(`/api/owner/bookings/${request.id}/${action}`, { method: 'POST' });
      reqCounter.current++;
      removeCard(request.id);
      setNotice({
        kind: 'status',
        text: action === 'confirm' ? 'Đã xác nhận yêu cầu' : 'Đã từ chối yêu cầu',
      });
      refreshRef.current?.();
    } catch (err) {
      reqCounter.current++;
      if (err instanceof ApiError && err.status === 409) {
        if (FINAL_409.includes(err.message)) {
          removeCard(request.id);
          refreshRef.current?.();
        }
        setNotice({ kind: 'alert', text: err.message });
      } else if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
        removeCard(request.id);
        setNotice({ kind: 'alert', text: 'Yêu cầu này không còn trong danh sách của bạn' });
        load();
      } else if (err instanceof ApiError && err.status === 401) {
        setSessionLoginOpen(true);
      } else {
        setNotice({ kind: 'alert', text: 'Không lưu được quyết định. Thử lại.' });
      }
    } finally {
      busyRef.current.delete(request.id);
      setBusyIds(new Set(busyRef.current));
    }
  };

  if (user === undefined) {
    return <EmptyState message="Đang tải" />;
  }

  if (user === null) {
    return (
      <div style={{ minWidth: 0 }}>
        <EmptyState
          message="Đăng nhập để xem yêu cầu"
          actionLabel="Đăng nhập"
          onAction={() => setLoginOpen(true)}
        />
        <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>
    );
  }

  if (user.role === 'ADMIN') {
    return null;
  }

  if (!active) {
    return null;
  }

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
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
              }}
            >
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
