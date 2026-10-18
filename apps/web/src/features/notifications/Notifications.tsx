import type {
  NotificationItemView,
  NotificationReadAllResponse,
  NotificationReadResponse,
  NotificationsListResponse,
} from '@monsport/shared';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import { formatDay, formatTime } from '../../lib/format.ts';

/**
 * Brief F-013 (UC-14): in-app notification bell, dropdown drawer, and read actions.
 */
export function Notifications({ refresh = 0 }: { refresh?: number }) {
  const [data, setData] = useState<NotificationsListResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    return api<NotificationsListResponse | NotificationItemView[]>('/api/notifications')
      .then((res) => {
        const normalized: NotificationsListResponse = Array.isArray(res)
          ? { unreadCount: 0, items: res }
          : res;
        setData(normalized);
      })
      .catch(() => setData(null));
  }, []);

  useEffect(() => {
    void load();
  }, [load, refresh]);

  async function markOneRead(item: NotificationItemView) {
    if (item.readAt || busy) return;
    try {
      const res = await api<NotificationReadResponse>(`/api/notifications/${item.id}/read`, {
        method: 'POST',
      });
      setData((prev) => {
        if (!prev) return prev;
        return {
          unreadCount: Math.max(0, prev.unreadCount - 1),
          items: prev.items.map((i) => (i.id === item.id ? { ...i, readAt: res.readAt } : i)),
        };
      });
    } catch {
      // Keep state on failure
    }
  }

  async function markAllRead() {
    if (!data || data.unreadCount === 0 || busy) return;
    setBusy(true);
    try {
      await api<NotificationReadAllResponse>('/api/notifications/read-all', { method: 'POST' });
      const nowIso = new Date().toISOString();
      setData((prev) => {
        if (!prev) return prev;
        return {
          unreadCount: 0,
          items: prev.items.map((i) => ({ ...i, readAt: i.readAt ?? nowIso })),
        };
      });
    } catch {
      // Keep state on failure
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="notif-box">
      <button
        type="button"
        className="notif-bell"
        aria-label="Thông báo"
        aria-expanded={open}
        title="Thông báo"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span aria-hidden="true">🔔</span>
        {data && data.unreadCount > 0 ? (
          <span className="notif-badge">{data.unreadCount}</span>
        ) : null}
      </button>

      {open && (
        <div className="notif-drawer" role="region" aria-label="Bảng thông báo">
          <div className="notif-header">
            <h2>Thông báo</h2>
            <div className="notif-actions">
              <button
                type="button"
                className="link notif-read-all"
                disabled={!data || data.unreadCount === 0 || busy}
                onClick={markAllRead}
              >
                Đánh dấu tất cả đã đọc
              </button>
              <button
                type="button"
                className="link notif-close"
                aria-label="Đóng"
                onClick={() => setOpen(false)}
              >
                Đóng
              </button>
            </div>
          </div>

          {!data || data.items.length === 0 ? (
            <p className="notif-empty">Chưa có thông báo nào</p>
          ) : (
            <ul className="notif-list">
              {data?.items.map((item) => (
                <li
                  key={item.id}
                  className={`notif-item ${item.readAt ? 'read' : 'unread'}`}
                  onClick={() => markOneRead(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void markOneRead(item);
                    }
                  }}
                >
                  <div className="notif-item-header">
                    <span className="notif-item-title">{item.title}</span>
                    {!item.readAt && <span className="notif-dot" aria-label="Chưa đọc">Mới</span>}
                  </div>
                  <p className="notif-item-msg">{item.message}</p>
                  <div className="notif-item-time">
                    {formatTime(item.createdAt)} {formatDay(item.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
