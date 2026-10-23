import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import {
  Calendar,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Store,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Notifications } from '../features/notifications/Notifications.tsx';
import { GoogleAccountActions } from '../features/auth/GoogleAccountActions.tsx';
import { api } from '@monsport/client';
import { useSession } from './session.tsx';

/** Vietnamese names put the given name last: "Nguyễn Văn An" shows "A". */
export const initial = (name: string) => [...(name.normalize('NFC').trim().split(/\s+/).at(-1) ?? '')][0] ?? '';

export function MobileBanner() {
  return null;
}

export function PlayerShell() {
  const { user, logout, refreshKey } = useSession();
  const navigate = useNavigate();

  return (
    <div className="shell player-shell">
      <header className="topnav" role="banner">
        <NavLink to="/" className="brand">
          MONSPORT
        </NavLink>
        <nav className="nav-links" aria-label="Điều hướng chính">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <LayoutGrid size={20} aria-hidden="true" />
            <span>Đặt sân</span>
          </NavLink>
          <NavLink
            to="/phong-cho"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Users size={20} aria-hidden="true" />
            <span>Phòng chờ</span>
          </NavLink>
          {user?.role === 'USER' && (
            <NavLink
              to="/lich-cua-toi"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Ticket size={20} aria-hidden="true" />
              <span>Lịch của tôi</span>
            </NavLink>
          )}
        </nav>
        <div className="who">
          {user ? (
            <>
              <Notifications userId={user.id} refresh={refreshKey} />
              <span className="avatar" aria-hidden="true">
                {initial(user.name)}
              </span>
              <span className="name">{user.name}</span>
              {user.role === 'USER' && <GoogleAccountActions />}
              <button
                type="button"
                className="link"
                onClick={async () => {
                  await logout();
                  navigate('/dang-nhap');
                }}
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <NavLink to="/dang-nhap" className="nav-item login-btn">
              Đăng nhập
            </NavLink>
          )}
        </div>
      </header>
      <main className="player-main">
        <Outlet />
      </main>
    </div>
  );
}

export function OwnerShell() {
  const { user, logout, refreshKey } = useSession();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    api<Array<{ status: string }>>('/api/owner/bookings')
      .then((list) => setPendingCount(list.filter((b) => b.status === 'PENDING').length))
      .catch(() => setPendingCount(0));
  }, [refreshKey]);

  return (
    <div className="shell owner-shell">
      <div className="owner-layout">
        <aside className="sidebar" aria-label="Menu chủ sân">
          <div className="sidebar-brand">
            <NavLink to="/chu-san/yeu-cau" className="brand">
              MONSPORT
            </NavLink>
          </div>
          <nav className="sidebar-nav" aria-label="Chức năng chủ sân">
            <NavLink
              to="/chu-san/yeu-cau"
              title="Yêu cầu"
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <Inbox size={20} aria-hidden="true" />
              <span className="nav-text">Yêu cầu</span>
              {pendingCount > 0 && <span className="count-badge">{pendingCount}</span>}
            </NavLink>
            <NavLink
              to="/chu-san/lich"
              title="Lịch sân"
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <Calendar size={20} aria-hidden="true" />
              <span className="nav-text">Lịch sân</span>
            </NavLink>
            <NavLink
              to="/chu-san/doanh-thu"
              title="Doanh thu"
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <TrendingUp size={20} aria-hidden="true" />
              <span className="nav-text">Doanh thu</span>
            </NavLink>
            <NavLink
              to="/chu-san/don-vi"
              title="Đơn vị và giá"
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <Store size={20} aria-hidden="true" />
              <span className="nav-text">Đơn vị và giá</span>
            </NavLink>
          </nav>
        </aside>
        <div className="owner-body">
          <header className="owner-topbar" role="banner">
            <div className="grow" />
            <div className="who">
              {user && (
                <>
                  <Notifications userId={user.id} refresh={refreshKey} />
                  <span className="avatar" aria-hidden="true">
                    {initial(user.name)}
                  </span>
                  <span className="name">{user.name}</span>
                  <button
                    type="button"
                    className="link"
                    onClick={async () => {
                      await logout();
                      navigate('/dang-nhap');
                    }}
                  >
                    Đăng xuất
                  </button>
                </>
              )}
            </div>
          </header>
          <main className="owner-main">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export function AdminShell() {
  const { user, logout, refreshKey } = useSession();
  const navigate = useNavigate();

  return (
    <div className="shell admin-shell">
      <div className="admin-layout">
        <aside className="sidebar" aria-label="Menu quản trị">
          <div className="sidebar-brand">
            <NavLink to="/admin" className="brand">
              MONSPORT
            </NavLink>
          </div>
          <nav className="sidebar-nav" aria-label="Chức năng quản trị">
            <NavLink
              to="/admin"
              title="Tổng quan"
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <LayoutDashboard size={20} aria-hidden="true" />
              <span className="nav-text">Tổng quan</span>
            </NavLink>
          </nav>
        </aside>
        <div className="admin-body">
          <header className="admin-topbar" role="banner">
            <div className="grow" />
            <div className="who">
              {user && (
                <>
                  <Notifications userId={user.id} refresh={refreshKey} />
                  <span className="avatar" aria-hidden="true">
                    {initial(user.name)}
                  </span>
                  <span className="name">{user.name}</span>
                  <button
                    type="button"
                    className="link"
                    onClick={async () => {
                      await logout();
                      navigate('/dang-nhap');
                    }}
                  >
                    Đăng xuất
                  </button>
                </>
              )}
            </div>
          </header>
          <main className="admin-main">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
