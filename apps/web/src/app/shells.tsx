import { api } from '@monsport/client';
import type { Role } from '@monsport/shared';
import {
  Calendar,
  ChevronDown,
  Flag,
  Home,
  Inbox,
  LayoutDashboard,
  MapPin,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Shield,
  Store,
  TrendingUp,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import { type CSSProperties, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useToast } from '../components/Toast.tsx';
import { GoogleAccountActions } from '../features/auth/GoogleAccountActions.tsx';
import { Notifications } from '../features/notifications/Notifications.tsx';
import { useSession } from './session.tsx';

/** Vietnamese names put the given name last: "Nguyễn Văn An" shows "A". */
export const initial = (name: string) =>
  [...(name.normalize('NFC').trim().split(/\s+/).at(-1) ?? '')][0] ?? '';

export function MobileBanner() {
  return null;
}

const ROLE_LABEL: Record<Role, string> = {
  USER: 'Người chơi',
  OWNER: 'Chủ sân',
  STAFF: 'Nhân viên',
  ADMIN: 'Quản trị viên',
};

const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'on active' : '');

function useDrawerFocus(
  drawerOpen: boolean,
  drawerRef: RefObject<HTMLElement | null>,
  menuBtnRef: RefObject<HTMLButtonElement | null>,
) {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (drawerOpen) {
      wasOpen.current = true;
      const first = drawerRef.current?.querySelector<HTMLElement>(
        'input, a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      menuBtnRef.current?.focus();
    }
  }, [drawerOpen, drawerRef, menuBtnRef]);
}

function TopBar({
  homeTo,
  hasSidebar = false,
  drawerOpen = false,
  onToggleDrawer,
  menuBtnRef,
  leftExtra,
  center,
  rightExtra,
}: {
  homeTo: string;
  hasSidebar?: boolean;
  drawerOpen?: boolean;
  onToggleDrawer?: () => void;
  menuBtnRef?: RefObject<HTMLButtonElement | null>;
  leftExtra?: ReactNode;
  center: ReactNode;
  rightExtra?: ReactNode;
}) {
  const { user, logout, refreshKey } = useSession();
  const navigate = useNavigate();
  const [popOpen, setPopOpen] = useState(false);
  const whoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      if (whoRef.current && !whoRef.current.contains(e.target as Node)) {
        setPopOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [popOpen]);

  return (
    <header className="top" role="banner">
      <div className="top-l">
        {hasSidebar && (
          <button
            ref={menuBtnRef}
            type="button"
            className="ib menu-btn"
            aria-label={drawerOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={drawerOpen}
            onClick={onToggleDrawer}
          >
            <Menu size={20} className="ic" aria-hidden="true" />
          </button>
        )}
        <NavLink to={homeTo} className="logo">
          <i aria-hidden="true" />
          <span>MONSPORT</span>
        </NavLink>
        {leftExtra}
      </div>

      {center}

      <div className="top-r">
        {rightExtra}
        {user ? (
          <>
            {user.role !== 'STAFF' && <Notifications userId={user.id} refresh={refreshKey} />}
            <div className="who" ref={whoRef}>
              <button
                type="button"
                className={popOpen ? 'me-btn on' : 'me-btn'}
                aria-expanded={popOpen}
                aria-haspopup="menu"
                onClick={() => setPopOpen((open) => !open)}
              >
                <span
                  className="av"
                  style={{ '--s': '34px', '--c': 'var(--ok)' } as CSSProperties}
                  aria-hidden="true"
                >
                  {initial(user.name)}
                </span>
                <span className="who">
                  <span className="name">{user.name}</span>
                </span>
                <ChevronDown size={15} className="ic" aria-hidden="true" />
              </button>
              {popOpen && (
                <div className="pop" role="menu" aria-label="Tài khoản">
                  <div className="pop-head">
                    <b>{user.name}</b>
                    <small>{ROLE_LABEL[user.role]}</small>
                  </div>
                  <div className="pop-actions">
                    {user.role === 'USER' && (
                      <NavLink
                        to="/ho-so"
                        className="pop-item"
                        onClick={() => setPopOpen(false)}
                      >
                        <User size={16} className="ic" aria-hidden="true" />
                        <span>Hồ sơ</span>
                      </NavLink>
                    )}
                    {user.role === 'USER' && (
                      <div className="pop-item">
                        <GoogleAccountActions />
                      </div>
                    )}
                    <button
                      type="button"
                      className="pop-item bad"
                      onClick={async () => {
                        setPopOpen(false);
                        await logout();
                        navigate('/dang-nhap');
                      }}
                    >
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <NavLink to="/dang-nhap" className="btn lime sm">
            Đăng nhập
          </NavLink>
        )}
      </div>
    </header>
  );
}

export function PlayerShell() {
  const { user } = useSession();
  const { comingSoon } = useToast();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  useDrawerFocus(drawerOpen, drawerRef, menuBtnRef);

  const handleSearch = () => {
    const q = searchText.trim();
    setDrawerOpen(false);
    navigate(q ? `/san?q=${encodeURIComponent(q)}` : '/san');
  };

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
        homeTo="/"
        hasSidebar
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
        menuBtnRef={menuBtnRef}
        leftExtra={
          <div className="search" role="search">
            <Search size={16} className="ic" aria-hidden="true" />
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Tìm sân, trận..."
              aria-label="Tìm kiếm"
            />
          </div>
        }
        center={
          <nav className="top-c" aria-label="Điều hướng chính">
            <NavLink to="/" end className={navClass} title="Trang chủ" aria-label="Trang chủ">
              <Home size={18} className="ic" aria-hidden="true" />
              <span>Trang chủ</span>
            </NavLink>
            <NavLink to="/phong-cho" className={navClass} title="Ghép trận" aria-label="Ghép trận">
              <Users size={18} className="ic" aria-hidden="true" />
              <span>Ghép trận</span>
            </NavLink>
            <NavLink to="/san" className={navClass} title="Sân" aria-label="Sân">
              <MapPin size={18} className="ic" aria-hidden="true" />
              <span>Sân</span>
            </NavLink>
            <NavLink to="/doi" className={navClass} title="Đội" aria-label="Đội">
              <Shield size={18} className="ic" aria-hidden="true" />
              <span>Đội</span>
            </NavLink>
            <NavLink to="/lich-cua-toi" className={navClass} title="Lịch" aria-label="Lịch">
              <Calendar size={18} className="ic" aria-hidden="true" />
              <span>Lịch</span>
            </NavLink>
          </nav>
        }
        rightExtra={
          <>
            <button
              type="button"
              className="btn lime sm create-match-btn"
              aria-label="Tạo trận"
              title="Tạo trận"
              onClick={() => navigate(user ? '/lich-cua-toi' : '/dang-nhap')}
            >
              <Plus size={16} className="ic" aria-hidden="true" />
              <span>Tạo trận</span>
            </button>
            <button
              type="button"
              className="ib"
              aria-label="Tin nhắn"
              onClick={comingSoon}
            >
              <MessageSquare size={19} className="ic" aria-hidden="true" />
            </button>
          </>
        }
      />
      {drawerOpen && (
        <>
          <div
            className="scrim drawer-scrim"
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
          />
          <aside ref={drawerRef} className="lcol float open" aria-label="Menu điều hướng">
            <div className="search drawer-search" role="search">
              <Search size={16} className="ic" aria-hidden="true" />
              <input
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder="Tìm sân, trận..."
                aria-label="Tìm sân từ menu"
              />
            </div>
            <div className="card me-card">
              {user ? (
                <NavLink to="/ho-so" className="me-link" onClick={() => setDrawerOpen(false)}>
                  <span className="av" style={{ '--s': '44px', '--c': 'var(--ok)' } as CSSProperties} aria-hidden="true">
                    {initial(user.name)}
                  </span>
                  <span className="me-meta">
                    <b>{user.name}</b>
                    <small>{ROLE_LABEL[user.role]}</small>
                  </span>
                </NavLink>
              ) : (
                <NavLink to="/dang-nhap" className="btn lime wide" onClick={() => setDrawerOpen(false)}>
                  Đăng nhập
                </NavLink>
              )}
            </div>
            <nav className="card lnav" aria-label="Lối tắt">
              {user && (
                <NavLink to="/lich-cua-toi" className={navClass} onClick={() => setDrawerOpen(false)}>
                  <Calendar size={18} className="ic" aria-hidden="true" />
                  <span>Lịch của tôi</span>
                </NavLink>
              )}
              <NavLink to="/phong-cho" className={navClass} onClick={() => setDrawerOpen(false)}>
                <Users size={18} className="ic" aria-hidden="true" />
                <span>Ghép trận</span>
              </NavLink>
              <NavLink to="/san" className={navClass} onClick={() => setDrawerOpen(false)}>
                <MapPin size={18} className="ic" aria-hidden="true" />
                <span>Tìm sân</span>
              </NavLink>
              <hr className="lnav-sep" />
              <button
                type="button"
                className="lnav-btn"
                onClick={() => {
                  setDrawerOpen(false);
                  comingSoon();
                }}
              >
                <Shield size={18} className="ic" aria-hidden="true" />
                <span>Đội của tôi</span>
              </button>
              <button
                type="button"
                className="lnav-btn"
                onClick={() => {
                  setDrawerOpen(false);
                  comingSoon();
                }}
              >
                <Trophy size={18} className="ic" aria-hidden="true" />
                <span>Thành tích</span>
              </button>
            </nav>
          </aside>
        </>
      )}
      <main className="player-main">
        <Outlet />
      </main>
    </div>
  );
}

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
            <span
              className="av"
              style={{ '--s': '38px', '--c': 'var(--ok)' } as CSSProperties}
              aria-hidden="true"
            >
              {initial(user?.name ?? '')}
            </span>
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
            <span
              className="av"
              style={{ '--s': '38px', '--c': 'var(--ok)' } as CSSProperties}
              aria-hidden="true"
            >
              {initial(user?.name ?? '')}
            </span>
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
