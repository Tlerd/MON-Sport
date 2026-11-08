import { api } from '@monsport/client';
import type { NotificationsListResponse } from '@monsport/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { TabBar } from '../components/TabBar.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { BarsProvider } from './bars.tsx';
import { useSession } from './session.tsx';

const NOTIFICATIONS_RELOAD_MS = 15_000;

export interface ShellContextType {
  setTitle: (title: string | undefined) => void;
  setOnBack: (onBack: (() => void) | undefined) => void;
  setTopBarActions: (actions: ReactNode) => void;
  unreadNotifications: number;
  // Optional: a test outside this feature builds a shell context without it.
  setUnreadNotifications?: (count: number) => void;
  pendingRequests: number;
  // Optional: the Yêu cầu screen reports its list length after each load.
  setPendingRequests?: (count: number) => void;
  refreshCounts: () => void;
}

export function App() {
  const { user, logout } = useSession();
  const [logoutError, setLogoutError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const [title, setTitle] = useState<string | undefined>(undefined);
  const [onBack, setOnBack] = useState<(() => void) | undefined>(undefined);
  const [topBarActions, setTopBarActions] = useState<ReactNode>(undefined);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingRequests, setPendingRequestsState] = useState(0);

  // A reply is applied only when no newer fetch or report started after it began.
  const pendingReq = useRef(0);

  // The Yêu cầu screen reports its exact list length. That report also drops older replies in flight.
  const setPendingRequests = (count: number) => {
    pendingReq.current++;
    setPendingRequestsState(count);
  };

  const fetchPending = async () => {
    const reqId = ++pendingReq.current;
    try {
      const reqs = await api<Array<{ id: string }>>('/api/owner/bookings?status=PENDING');
      if (reqId !== pendingReq.current) return;
      if (Array.isArray(reqs)) setPendingRequestsState(reqs.length);
    } catch {
      // A failed fetch (network or 401) keeps the old count.
    }
  };

  const refreshCounts = async () => {
    if (!user) {
      pendingReq.current++;
      setPendingRequestsState(0);
      setUnreadNotifications(0);
      return;
    }
    if (user.role === 'OWNER') {
      await fetchPending();
    } else {
      pendingReq.current++;
      setPendingRequestsState(0);
    }
  };
  const fetchPendingRef = useRef(fetchPending);
  fetchPendingRef.current = fetchPending;

  // The shell owns the pending request count for an OWNER while the Yêu cầu screen is closed.
  // On the Yêu cầu screen (or at '/', which redirects there), the screen reports the count, so the shell skips its own fetch.
  const countsPending = user?.role === 'OWNER';
  const onRequestsScreen = location.pathname === '/chu-san/yeu-cau';
  const onOwnerRedirect = countsPending && location.pathname === '/';
  const onRequestsOrRedirectRef = useRef(false);
  onRequestsOrRedirectRef.current = onRequestsScreen || onOwnerRedirect;

  useEffect(() => {
    if (user?.role === 'OWNER' && onRequestsOrRedirectRef.current) return;
    refreshCounts();
  }, [user]);

  const wasOnRequestsRef = useRef(false);
  useEffect(() => {
    if (!countsPending || onRequestsScreen || onOwnerRedirect) {
      if (onRequestsScreen) wasOnRequestsRef.current = true;
      return;
    }
    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      timer = setInterval(() => void fetchPendingRef.current(), NOTIFICATIONS_RELOAD_MS);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchPendingRef.current();
        start();
      } else {
        stop();
      }
    };

    const leftRequests = wasOnRequestsRef.current;
    wasOnRequestsRef.current = false;
    if (document.visibilityState === 'visible') {
      if (leftRequests) void fetchPendingRef.current();
      start();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // Drops a reply still in flight: the screen or a new user owns the count now.
      pendingReq.current++;
    };
  }, [user?.id, countsPending, onRequestsScreen, onOwnerRedirect]);

  // The shell owns the unread count while the Thông báo screen is closed. The screen owns it while open.
  const countsNotifications = user?.role === 'USER' || user?.role === 'OWNER';
  const onNotificationsScreen = location.pathname === '/thong-bao';
  const notificationsReq = useRef(0);

  useEffect(() => {
    if (!countsNotifications || onNotificationsScreen) return;
    let timer: ReturnType<typeof setInterval> | undefined;

    const fetchUnread = () => {
      const reqId = ++notificationsReq.current;
      api<NotificationsListResponse>('/api/notifications').then(
        (res) => {
          if (reqId !== notificationsReq.current) return;
          if (typeof res?.unreadCount === 'number') setUnreadNotifications(res.unreadCount);
        },
        (err: unknown) => {
          if (reqId !== notificationsReq.current) return;
          if (err && typeof err === 'object' && 'status' in err && (err as { status?: unknown }).status === 401) {
            stop();
          }
          // A failed fetch keeps the old count.
        },
      );
    };
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      timer = setInterval(fetchUnread, NOTIFICATIONS_RELOAD_MS);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUnread();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') {
      fetchUnread();
      start();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // Drops a reply still in flight: the screen or a new user owns the count now.
      notificationsReq.current++;
    };
  }, [user?.id, countsNotifications, onNotificationsScreen]);

  useEffect(() => {
    if (user?.role === 'OWNER' && location.pathname === '/') {
      navigate('/chu-san/yeu-cau', { replace: true });
    }
  }, [user?.role, location.pathname, navigate]);

  if (user?.role === 'ADMIN') {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-xl)',
          textAlign: 'center',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <h1 style={{ font: 'var(--font-title-mobile)', margin: '0 0 var(--space-md)' }}>
          Dùng web để quản trị
        </h1>
        <p style={{ font: 'var(--font-body)', color: 'var(--color-ink-muted)', margin: '0 0 var(--space-lg)' }}>
          Giao diện quản trị viên chỉ hỗ trợ trên trình duyệt máy tính.
        </p>
        <a
          href="/admin"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            font: 'var(--font-body-strong)',
            padding: '12px var(--space-base)',
            borderRadius: 'var(--radius-sm)',
            textDecoration: 'none',
            height: '44px',
          }}
        >
          Đến trang quản trị web
        </a>
        {logoutError && (
          <p style={{ margin: 'var(--space-md) 0 0', font: 'var(--font-meta)', color: 'var(--color-status-no)' }} role="alert">
            {logoutError}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setLogoutError('');
            Promise.resolve(logout()).catch(() => setLogoutError('Không đăng xuất được. Thử lại sau'));
          }}
          style={{
            marginTop: 'var(--space-md)',
            minHeight: '44px',
            padding: '12px var(--space-base)',
            backgroundColor: 'var(--color-canvas)',
            color: 'var(--color-ink)',
            border: '1px solid var(--color-line)',
            font: 'var(--font-body-strong)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}
        >
          Đăng xuất
        </button>
      </main>
    );
  }

  const initial = user?.name ? user.name.trim().charAt(0).toUpperCase() : undefined;
  const isDetailScreen = Boolean(onBack);

  return (
    <BarsProvider>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--color-canvas)',
          position: 'relative',
          paddingTop: '52px',
          paddingBottom: isDetailScreen
            ? 'env(safe-area-inset-bottom, 0px)'
            : 'calc(80px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <TopBar
          title={title}
          onBack={onBack}
          actions={topBarActions}
        />

        <main style={{ minHeight: 'calc(100vh - 52px)' }}>
          <Outlet
            context={{
              setTitle,
              setOnBack,
              setTopBarActions,
              unreadNotifications,
              setUnreadNotifications,
              pendingRequests,
              setPendingRequests,
              refreshCounts,
            }}
          />
        </main>

        {!isDetailScreen && (
          <TabBar
            role={user?.role ?? null}
            activePath={location.pathname}
            onSelect={(path) => navigate(path)}
            unreadNotifications={unreadNotifications}
            pendingRequests={pendingRequests}
            userInitial={initial}
          />
        )}
      </div>
    </BarsProvider>
  );
}
