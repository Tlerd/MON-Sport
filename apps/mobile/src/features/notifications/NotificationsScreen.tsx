import { api, ApiError, notificationTarget } from '@monsport/client';
import type {
  NotificationItemView,
  NotificationReadAllResponse,
  NotificationReadResponse,
  NotificationsListResponse,
} from '@monsport/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import type { ShellContextType } from '../../app/App.tsx';
import { useSession } from '../../app/session.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { LoginSheet } from '../auth/LoginSheet.tsx';
import { NotificationCard } from './NotificationCard.tsx';

const RELOAD_MS = 15_000;

export function NotificationsScreen() {
  const navigate = useNavigate();
  const { user } = useSession();
  // The screen also renders without the shell (tests, a route outside App), so the context may be missing.
  const shell = useOutletContext<ShellContextType | undefined>();
  const setUnreadNotifications = shell?.setUnreadNotifications;

  const [data, setData] = useState<NotificationsListResponse | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [sessionLoginOpen, setSessionLoginOpen] = useState(false);
  const [readAllBusy, setReadAllBusy] = useState(false);
  const [readAllError, setReadAllError] = useState('');

  // A reply is applied only when no newer request or write started after it began.
  const reqCounter = useRef(0);
  const dataRef = useRef(data);
  dataRef.current = data;
  const sessionLoginOpenRef = useRef(false);
  sessionLoginOpenRef.current = sessionLoginOpen;
  const pendingReads = useRef(new Set<string>());
  const readAllPending = useRef(false);

  const active = Boolean(user) && user?.role !== 'ADMIN';

  const load = useCallback(() => {
    const reqId = ++reqCounter.current;
    api<NotificationsListResponse>('/api/notifications').then(
      (res) => {
        if (reqId !== reqCounter.current) return;
        setFailed(false);
        setData(res);
      },
      (err: unknown) => {
        if (reqId !== reqCounter.current) return;
        if (err instanceof ApiError && err.status === 401) setSessionLoginOpen(true);
        // A failed reload keeps the old list. Only an empty screen shows the error.
        if (!dataRef.current) setFailed(true);
      },
    );
  }, []);

  const retry = () => {
    setFailed(false);
    load();
  };

  useEffect(() => {
    reqCounter.current++;
    setData(undefined);
    setFailed(false);
    setReadAllError('');
    if (active) load();
  }, [user?.id, active, load]);

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

  const unreadCount = data?.unreadCount;
  useEffect(() => {
    if (unreadCount !== undefined) setUnreadNotifications?.(unreadCount);
  }, [unreadCount, setUnreadNotifications]);

  const openItem = async (item: NotificationItemView) => {
    const target = notificationTarget(user?.role, item);
    if (target === null) return;

    const current = dataRef.current?.items.find((i) => i.id === item.id) ?? item;
    if (current.readAt === null) {
      if (pendingReads.current.has(item.id)) return;
      pendingReads.current.add(item.id);
      reqCounter.current++;
      try {
        const res = await api<NotificationReadResponse>(`/api/notifications/${item.id}/read`, { method: 'POST' });
        reqCounter.current++;
        setData((prev) => {
          if (!prev) return prev;
          const wasUnread = prev.items.some((i) => i.id === item.id && i.readAt === null);
          return {
            unreadCount: wasUnread ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
            items: prev.items.map((i) => (i.id === item.id && i.readAt === null ? { ...i, readAt: res.readAt } : i)),
          };
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setSessionLoginOpen(true);
          return;
        }
        // Any other error keeps the card unread. The target still opens.
      } finally {
        pendingReads.current.delete(item.id);
      }
    }
    navigate(target);
  };

  const readAll = async () => {
    if (readAllPending.current || !data || data.unreadCount === 0) return;
    readAllPending.current = true;
    setReadAllBusy(true);
    setReadAllError('');
    reqCounter.current++;
    try {
      await api<NotificationReadAllResponse>('/api/notifications/read-all', { method: 'POST' });
      reqCounter.current++;
      const readAt = new Date().toISOString();
      setData((prev) =>
        prev
          ? { unreadCount: 0, items: prev.items.map((i) => (i.readAt === null ? { ...i, readAt } : i)) }
          : prev,
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setSessionLoginOpen(true);
      } else {
        setReadAllError('Không đánh dấu được. Thử lại.');
      }
    } finally {
      readAllPending.current = false;
      setReadAllBusy(false);
    }
  };

  if (user === undefined) {
    return <EmptyState message="Đang tải" />;
  }

  if (user === null) {
    return (
      <div style={{ minWidth: 0 }}>
        <EmptyState
          message="Đăng nhập để xem thông báo"
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

  const readAllDisabled = readAllBusy || !data || data.unreadCount === 0;

  return (
    <div style={{ minWidth: 0 }}>
      {!data ? (
        failed ? (
          <EmptyState message="Không tải được" actionLabel="Thử lại" onAction={retry} />
        ) : (
          <EmptyState message="Đang tải" />
        )
      ) : data.items.length === 0 ? (
        <EmptyState message="Chưa có thông báo" />
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 'var(--space-md)',
              flexWrap: 'wrap',
              minWidth: 0,
              padding: 'var(--space-sm) var(--space-base)',
            }}
          >
            {readAllError && (
              <p
                role="alert"
                style={{
                  margin: 0,
                  flex: '1 1 0',
                  minWidth: 0,
                  font: 'var(--font-meta)',
                  color: 'var(--color-status-no)',
                  overflowWrap: 'anywhere',
                }}
              >
                {readAllError}
              </p>
            )}
            <button
              type="button"
              onClick={readAll}
              disabled={readAllDisabled}
              style={{
                minHeight: '44px',
                minWidth: '44px',
                padding: '0 var(--space-md)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-line)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-primary)',
                font: 'var(--font-label)',
                cursor: readAllDisabled ? 'not-allowed' : 'pointer',
                opacity: readAllDisabled ? 0.6 : 1,
              }}
            >
              Đọc hết
            </button>
          </div>
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
            {data.items.map((item) => (
              <li key={item.id} style={{ minWidth: 0 }}>
                <NotificationCard item={item} onOpen={openItem} />
              </li>
            ))}
          </ul>
        </>
      )}

      <LoginSheet
        open={sessionLoginOpen}
        onClose={() => setSessionLoginOpen(false)}
        onLoggedIn={load}
        notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
      />
    </div>
  );
}
