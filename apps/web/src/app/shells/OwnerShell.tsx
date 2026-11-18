import { api } from '@monsport/client';
import { Calendar, Inbox, LayoutDashboard, Store, TrendingUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Avatar } from '../../components/Avatar.tsx';
import { useSession } from '../session.tsx';
import { navClass, TopBar } from './TopBar.tsx';
import { useDrawerFocus } from './useDrawerFocus.ts';

export function OwnerShell() {
  const { user, refreshKey } = useSession();
  const { pathname } = useLocation();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  useDrawerFocus(drawerOpen, drawerRef, menuBtnRef);

  useEffect(() => {
    api<Array<{ status: string }>>('/api/owner/bookings')
      .then((list) => setPendingCount(list.filter((b) => b.status === 'PENDING').length))
      .catch(() => setPendingCount(0));
  }, [refreshKey]);

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
    <div data-role={user?.role}>
      <TopBar
        homeTo={user?.role === 'STAFF' ? '/chu-san/lich' : '/chu-san/tong-quan'}
        hasSidebar
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
        menuBtnRef={menuBtnRef}
        center={<span className="role-pill">Kênh chủ sân</span>}
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
          aria-label="Menu chủ sân"
        >
          <div className="side-who">
            <Avatar name={user?.name ?? ''} size={38} />
            <div>
              <b>{user?.name}</b>
              <small>{user?.role === 'STAFF' ? 'Nhân viên' : 'Chủ sân'}</small>
            </div>
          </div>
          <nav aria-label="Chức năng chủ sân">
            {user?.role !== 'STAFF' && (
              <NavLink to="/chu-san/tong-quan" className={navClass}>
                <LayoutDashboard size={18} className="ic" aria-hidden="true" />
                <span>Tổng quan</span>
              </NavLink>
            )}
            <NavLink to="/chu-san/yeu-cau" className={navClass}>
              <Inbox size={18} className="ic" aria-hidden="true" />
              <span>Yêu cầu</span>
              {pendingCount > 0 && <span className="count-badge">{pendingCount}</span>}
            </NavLink>
            <NavLink to="/chu-san/lich" className={navClass}>
              <Calendar size={18} className="ic" aria-hidden="true" />
              <span>Lịch sân</span>
            </NavLink>
            {user?.role !== 'STAFF' && (
              <>
                <NavLink to="/chu-san/doanh-thu" className={navClass}>
                  <TrendingUp size={18} className="ic" aria-hidden="true" />
                  <span>Doanh thu</span>
                </NavLink>
                <NavLink to="/chu-san/don-vi" className={navClass}>
                  <Store size={18} className="ic" aria-hidden="true" />
                  <span>Đơn vị và giá</span>
                </NavLink>
              </>
            )}
          </nav>
        </aside>
        <main className="dash-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
