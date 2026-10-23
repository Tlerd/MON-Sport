import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AdminPanel } from '../features/admin/AdminPanel.tsx';
import { OwnerRequests } from '../features/bookings/OwnerRequests.tsx';
import { FinancialDashboard } from '../features/finance/FinancialDashboard.tsx';
import { MyVenues } from '../features/venues/MyVenues.tsx';
import { AuthPage, BookPage, LobbyPage, MyPage, SchedulePage } from './pages.tsx';
import { useSession } from './session.tsx';
import { AdminShell, OwnerShell, PlayerShell } from './shells.tsx';

export function RoleGuard({
  allowed,
  children,
}: {
  allowed: ('GUEST' | 'USER' | 'OWNER' | 'ADMIN')[];
  children: ReactNode;
}) {
  const { user } = useSession();
  if (user === undefined) return null;

  const currentRole = user ? user.role : 'GUEST';
  if (!allowed.includes(currentRole)) {
    const home =
      currentRole === 'OWNER'
        ? '/chu-san/yeu-cau'
        : currentRole === 'ADMIN'
          ? '/admin'
          : currentRole === 'USER'
            ? '/'
            : '/dang-nhap';
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}

function CatchAll() {
  const { user } = useSession();
  if (user === undefined) return null;
  const home =
    user?.role === 'OWNER'
      ? '/chu-san/yeu-cau'
      : user?.role === 'ADMIN'
        ? '/admin'
        : '/';
  return <Navigate to={home} replace />;
}

export const routes: RouteObject[] = [
  {
    element: <PlayerShell />,
    children: [
      {
        path: '/',
        element: (
          <RoleGuard allowed={['GUEST', 'USER']}>
            <BookPage />
          </RoleGuard>
        ),
      },
      {
        path: '/san/:id',
        element: (
          <RoleGuard allowed={['GUEST', 'USER']}>
            <BookPage />
          </RoleGuard>
        ),
      },
      {
        path: '/phong-cho',
        element: (
          <RoleGuard allowed={['GUEST', 'USER']}>
            <LobbyPage />
          </RoleGuard>
        ),
      },
      {
        path: '/lich-cua-toi',
        element: (
          <RoleGuard allowed={['USER']}>
            <MyPage />
          </RoleGuard>
        ),
      },
      {
        path: '/dang-nhap',
        element: (
          <RoleGuard allowed={['GUEST']}>
            <AuthPage />
          </RoleGuard>
        ),
      },
    ],
  },
  {
    element: (
      <RoleGuard allowed={['OWNER']}>
        <OwnerShell />
      </RoleGuard>
    ),
    children: [
      {
        path: '/chu-san/yeu-cau',
        element: <OwnerRequests />,
      },
      {
        path: '/chu-san/lich',
        element: <SchedulePage />,
      },
      {
        path: '/chu-san/doanh-thu',
        element: <FinancialDashboard />,
      },
      {
        path: '/chu-san/don-vi',
        element: <MyVenues />,
      },
    ],
  },
  {
    element: (
      <RoleGuard allowed={['ADMIN']}>
        <AdminShell />
      </RoleGuard>
    ),
    children: [
      {
        path: '/admin',
        element: <AdminPanel />,
      },
    ],
  },
  {
    path: '*',
    element: <CatchAll />,
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}

export const router = createBrowserRouter(routes);
