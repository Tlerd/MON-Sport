import { unreadBadge } from '@monsport/client';
import {
  Bell,
  CalendarDays,
  ChartColumn,
  Inbox,
  LayoutGrid,
  Ticket,
  User,
  Users,
} from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { useBars } from '../app/bars.tsx';

export type UserRole = 'ADMIN' | 'OWNER' | 'USER' | 'STAFF' | null;

export interface TabItem {
  id: string;
  name: string;
  path: string;
  icon: ReactNode;
  badgeCount?: number;
}

export interface TabBarProps extends Omit<HTMLAttributes<HTMLElement>, 'role' | 'onSelect'> {
  role?: UserRole;
  activePath: string;
  onSelect: (path: string) => void;
  unreadNotifications?: number;
  pendingRequests?: number;
  userInitial?: string;
  hidden?: boolean;
}

export function TabBar({
  role = null,
  activePath,
  onSelect,
  unreadNotifications = 0,
  pendingRequests = 0,
  userInitial,
  hidden: hiddenProp,
  style,
  ...rest
}: TabBarProps) {
  const { tabHidden: barsTabHidden } = useBars();
  const hidden = hiddenProp !== undefined ? hiddenProp : barsTabHidden;
  if (role === 'ADMIN') {
    return null;
  }

  const isOwner = role === 'OWNER';

  const tabs: TabItem[] = isOwner
    ? [
        {
          id: 'yeu-cau',
          name: 'Yêu cầu',
          path: '/chu-san/yeu-cau',
          icon: <Inbox size={22} aria-hidden="true" />,
          badgeCount: pendingRequests,
        },
        {
          id: 'lich-san',
          name: 'Lịch sân',
          path: '/chu-san/lich',
          icon: <CalendarDays size={22} aria-hidden="true" />,
        },
        {
          id: 'doanh-thu',
          name: 'Doanh thu',
          path: '/chu-san/doanh-thu',
          icon: <ChartColumn size={22} aria-hidden="true" />,
        },
        {
          id: 'thong-bao',
          name: 'Thông báo',
          path: '/thong-bao',
          icon: <Bell size={22} aria-hidden="true" />,
          badgeCount: unreadNotifications,
        },
        {
          id: 'toi',
          name: 'Tôi',
          path: '/toi',
          icon: userInitial ? (
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-status-ok-bg)',
                color: 'var(--color-primary)',
                display: 'grid',
                placeItems: 'center',
                font: 'var(--font-label)',
                lineHeight: 1,
              }}
            >
              {userInitial}
            </span>
          ) : (
            <User size={22} aria-hidden="true" />
          ),
        },
      ]
    : [
        {
          id: 'dat-san',
          name: 'Đặt sân',
          path: '/',
          icon: <LayoutGrid size={22} aria-hidden="true" />,
        },
        {
          id: 'phong-cho',
          name: 'Phòng chờ',
          path: '/phong-cho',
          icon: <Users size={22} aria-hidden="true" />,
        },
        {
          id: 'lich-cua-toi',
          name: 'Lịch của tôi',
          path: '/lich-cua-toi',
          icon: <Ticket size={22} aria-hidden="true" />,
        },
        {
          id: 'thong-bao',
          name: 'Thông báo',
          path: '/thong-bao',
          icon: <Bell size={22} aria-hidden="true" />,
          badgeCount: unreadNotifications,
        },
        {
          id: 'toi',
          name: 'Tôi',
          path: '/toi',
          icon: userInitial ? (
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-status-ok-bg)',
                color: 'var(--color-primary)',
                display: 'grid',
                placeItems: 'center',
                font: 'var(--font-label)',
                lineHeight: 1,
              }}
            >
              {userInitial}
            </span>
          ) : (
            <User size={22} aria-hidden="true" />
          ),
        },
      ];

  const normalize = (p: string) => p.replace(/^\/app/, '') || '/';
  const currentNorm = normalize(activePath);

  return (
    <nav
      aria-label="Điều hướng"
      style={{
        position: 'fixed',
        left: 'var(--space-md)',
        right: 'var(--space-md)',
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        height: '60px',
        borderRadius: 'var(--radius-full)',
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: 'var(--shadow-float)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 6px',
        transform: hidden ? 'translateY(calc(100% + 24px))' : 'translateY(0)',
        transition: 'transform 200ms cubic-bezier(.2,.8,.2,1)',
        willChange: 'transform',
        ...style,
      }}
      {...rest}
    >
      {tabs.map((tab) => {
        const isActive = currentNorm === tab.path || (tab.path !== '/' && currentNorm.startsWith(tab.path));
        const badge = unreadBadge(tab.badgeCount ?? 0);
        const badgeId = `tab-badge-${tab.id}`;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.path)}
            aria-label={tab.name}
            aria-describedby={badge !== '' ? badgeId : undefined}
            style={{
              flex: 1,
              height: '48px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              backgroundColor: isActive ? 'var(--color-status-ok-bg)' : 'transparent',
              color: isActive ? 'var(--color-primary)' : 'var(--color-ink-muted)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              position: 'relative',
              padding: 0,
            }}
          >
            {tab.icon}
            {badge !== '' && (
              <span
                id={badgeId}
                data-badge
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: 'calc(50% - 16px)',
                  minWidth: '16px',
                  height: '16px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-status-no)',
                  color: 'var(--color-on-primary)',
                  font: 'var(--font-label)',
                  display: 'grid',
                  placeItems: 'center',
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
