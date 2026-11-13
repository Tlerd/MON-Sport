import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { ComingSoonPage } from '../components/ComingSoon.tsx';
import { AdminPanel } from '../features/admin/AdminPanel.tsx';
import { FinancialDashboard } from '../features/finance/FinancialDashboard.tsx';
import {
  AuthPage,
  BookPage,
  HomePage,
  LobbyPage,
  MyPage,
  MyVenuesPage,
  OwnerOverview,
  OwnerRequestsPage,
  ProfilePage,
  SchedulePage,
  TeamsPage,
  VenuesPage,
} from './pages.tsx';
import { useSession } from './session.tsx';
import { AdminShell, OwnerShell, PlayerShell } from './shells.tsx';

export function RoleGuard({
  allowed,
  children,
}: {
  allowed: ('GUEST' | 'USER' | 'OWNER' | 'ADMIN' | 'STAFF')[];
  children: ReactNode;
}) {
  const { user } = useSession();
  if (user === undefined) return null;

  const currentRole = user ? user.role : 'GUEST';
  if (!allowed.includes(currentRole)) {
    const home =
      currentRole === 'OWNER'
        ? '/chu-san/yeu-cau'
        : currentRole === 'STAFF'
          ? '/chu-san/lich'
          : currentRole === 'ADMIN'
            ? '/admin'
            : currentRole === 'USER'
              ? '/'
              : '/dang-nhap';
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}

function RevenueRoute() {
  const { user } = useSession();
  if (user?.role === 'STAFF') {
    return <Navigate to="/chu-san/lich" replace />;
  }
  return (
    <RoleGuard allowed={['OWNER']}>
      <FinancialDashboard />
    </RoleGuard>
  );
}

function CatchAll() {
  const { user } = useSession();
  if (user === undefined) return null;
  const home =
    user?.role === 'OWNER'
      ? '/chu-san/yeu-cau'
      : user?.role === 'STAFF'
        ? '/chu-san/lich'
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
            <HomePage />
          </RoleGuard>
        ),
      },
      {
        path: '/san',
        element: (
          <RoleGuard allowed={['GUEST', 'USER']}>
            <VenuesPage />
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
        path: '/doi',
        element: (
          <RoleGuard allowed={['GUEST', 'USER']}>
            <TeamsPage />
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
        path: '/ho-so',
        element: (
          <RoleGuard allowed={['USER']}>
            <ProfilePage />
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
      <RoleGuard allowed={['OWNER', 'STAFF']}>
        <OwnerShell />
      </RoleGuard>
    ),
    children: [
      {
        path: '/chu-san/tong-quan',
        element: (
          <RoleGuard allowed={['OWNER']}>
            <OwnerOverview />
          </RoleGuard>
        ),
      },
      {
        path: '/chu-san/yeu-cau',
        element: <OwnerRequestsPage />,
      },
      {
        path: '/chu-san/lich',
        element: <SchedulePage />,
      },
      {
        path: '/chu-san/doanh-thu',
        element: <RevenueRoute />,
      },
      {
        path: '/chu-san/don-vi',
        element: (
          <RoleGuard allowed={['OWNER']}>
            <MyVenuesPage />
          </RoleGuard>
        ),
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
        element: <AdminPanel view="stats" />,
      },
      {
        path: '/admin/tai-khoan',
        element: <AdminPanel view="accounts" />,
      },
      {
        path: '/admin/bao-cao',
        element: <ComingSoonPage title="Báo cáo vi phạm" />,
      },
      {
        path: '/admin/mon',
        element: <ComingSoonPage title="Môn thể thao" />,
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
