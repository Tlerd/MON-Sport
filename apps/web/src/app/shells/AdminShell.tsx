import { Flag, LayoutDashboard, Trophy, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Avatar } from '../../components/Avatar.tsx';
import { useSession } from '../session.tsx';
import { navClass, TopBar } from './TopBar.tsx';
import { useDrawerFocus } from './useDrawerFocus.ts';

export function AdminShell() {
  const { user } = useSession();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  useDrawerFocus(drawerOpen, drawerRef, menuBtnRef);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  return (
    <div>
      <TopBar
        homeTo="/admin"
        hasSidebar
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
        menuBtnRef={menuBtnRef}
        center={<span className="role-pill">Trang quản trị</span>}
      />
      <div className="dash">
        {drawerOpen && (
          <div
            className="scrim drawer-scrim"
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
          />
        )}
        <aside
          ref={drawerRef}
          className={drawerOpen ? 'side open' : 'side'}
          aria-label="Menu quản trị"
        >
          <div className="side-who">
            <Avatar name={user?.name ?? ''} size={38} />
            <div>
              <b>{user?.name}</b>
              <small>Quản trị viên</small>
            </div>
          </div>
          <nav aria-label="Chức năng quản trị">
            <NavLink to="/admin" end className={navClass}>
              <LayoutDashboard size={18} className="ic" aria-hidden="true" />
              <span>Tổng quan</span>
            </NavLink>
            <NavLink to="/admin/tai-khoan" className={navClass}>
              <Users size={18} className="ic" aria-hidden="true" />
              <span>Tài khoản và đơn vị</span>
            </NavLink>
            <NavLink to="/admin/bao-cao" className={navClass}>
              <Flag size={18} className="ic" aria-hidden="true" />
              <span>Báo cáo vi phạm</span>
            </NavLink>
            <NavLink to="/admin/mon" className={navClass}>
              <Trophy size={18} className="ic" aria-hidden="true" />
              <span>Môn thể thao</span>
            </NavLink>
          </nav>
        </aside>
        <main className="dash-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
