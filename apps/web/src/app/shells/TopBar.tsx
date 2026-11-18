import type { Role } from '@monsport/shared';
import { ChevronDown, Menu, User } from 'lucide-react';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { Avatar } from '../../components/Avatar.tsx';
import { GoogleAccountActions } from '../../features/auth/GoogleAccountActions.tsx';
import { Notifications } from '../../features/notifications/Notifications.tsx';
import { useSession } from '../session.tsx';

export const ROLE_LABEL: Record<Role, string> = {
  USER: 'Người chơi',
  OWNER: 'Chủ sân',
  STAFF: 'Nhân viên',
  ADMIN: 'Quản trị viên',
};

export const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'on active' : '');

export function TopBar({
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
                <Avatar name={user.name} size={34} />
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
