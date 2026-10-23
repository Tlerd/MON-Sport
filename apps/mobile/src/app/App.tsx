import { api } from '@monsport/client';
import { useEffect, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { TabBar } from '../components/TabBar.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { BarsProvider } from './bars.tsx';
import { useSession } from './session.tsx';

export interface ShellContextType {
  setTitle: (title: string | undefined) => void;
  setOnBack: (onBack: (() => void) | undefined) => void;
  setTopBarActions: (actions: ReactNode) => void;
  unreadNotifications: number;
  pendingRequests: number;
  refreshCounts: () => void;
}

export function App() {
  const { user } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  const [title, setTitle] = useState<string | undefined>(undefined);
  const [onBack, setOnBack] = useState<(() => void) | undefined>(undefined);
  const [topBarActions, setTopBarActions] = useState<ReactNode>(undefined);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);

  const refreshCounts = async () => {
    if (!user) {
      setPendingRequests(0);
      setUnreadNotifications(0);
      return;
    }
    try {
      if (user.role === 'OWNER') {
        const reqs = await api<Array<{ id: string }>>('/api/owner/bookings?status=PENDING').catch(() => []);
        setPendingRequests(Array.isArray(reqs) ? reqs.length : 0);
      } else {
        setPendingRequests(0);
      }
    } catch {
      // Ignore count fetch errors
    }
  };

  useEffect(() => {
    refreshCounts();
  }, [user]);

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
              pendingRequests,
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
