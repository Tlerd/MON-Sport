import {
  Calendar,
  Home,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Shield,
  Trophy,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Avatar } from '../../components/Avatar.tsx';
import { useToast } from '../../components/Toast.tsx';
import { useSession } from '../session.tsx';
import { navClass, ROLE_LABEL, TopBar } from './TopBar.tsx';
import { useDrawerFocus } from './useDrawerFocus.ts';

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
                  <Avatar name={user.name} size={44} />
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
