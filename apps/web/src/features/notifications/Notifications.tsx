import type {
  NotificationItemView,
  NotificationReadAllResponse,
  NotificationReadResponse,
  NotificationsListResponse,
} from '@monsport/shared';
import { Bell } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, formatDay, formatTime } from '@monsport/client';
import { PushToggle } from './PushToggle.tsx';

/** How often a visible page asks the server for new notifications. A Web Push or a return to the tab reloads at once. */
const RELOAD_MS = 15_000;
/** A reload that has run longer than this is treated as lost, so it cannot block the next one for good. */
const STALE_MS = 2 * RELOAD_MS;

/**
 * Brief F-013 (UC-14): in-app notification bell, dropdown drawer, and read actions.
 * Brief F-014: the drawer holds the button for Web Push on this device. `userId` is the signed-in user.
 */
export function Notifications({ userId, refresh = 0 }: { userId: string; refresh?: number }) {
  const [data, setData] = useState<NotificationsListResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // `latest` numbers each request. A list that arrives after a newer request, or after a read action, is dropped, so a slow
  // reload cannot bring back a badge that the user just cleared.
  const latest = useRef(0);
  const pending = useRef(0);
  const startedAt = useRef(0);
  const again = useRef(false);

  const load = useCallback((keepOnError = false) => {
    const number = ++latest.current;
    pending.current++;
    startedAt.current = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STALE_MS);
    return api<NotificationsListResponse | NotificationItemView[]>('/api/notifications', {
      signal: controller.signal,
    })
      .then((res) => {
        if (number !== latest.current) return;
        const normalized: NotificationsListResponse = Array.isArray(res)
          ? { unreadCount: 0, items: res }
          : res;
        setData(normalized);
      })
      .catch(() => {
        // A reload that hung and was aborted keeps the list it replaces.
        if (controller.signal.aborted) return;
        if (!keepOnError && number === latest.current) setData(null);
      })
      .finally(() => {
        clearTimeout(timer);
        pending.current--;
        // A trigger came while this reload ran, so the list may be old again.
        if (pending.current === 0 && again.current) {
          again.current = false;
          if (document.visibilityState === 'visible') void load(true);
        }
      });
  }, []);

  useEffect(() => {
    void load();
  }, [load, refresh]);

  // AC-23: the other side acts, not this user, so the list follows the server. A failed background reload keeps the list.
  useEffect(() => {
    // `afterRunning` is true for a push: it proves that the server changed, so a reload that is already running may be too old.
    const reload = (afterRunning = false) => {
      if (document.visibilityState !== 'visible') return;
      if (pending.current > 0 && Date.now() - startedAt.current < STALE_MS) {
        if (afterRunning) again.current = true;
        return;
      }
      void load(true);
    };
    const onWorkerMessage = (event: Event) => {
      if ((event as MessageEvent).data?.type === 'push-received') reload(true);
    };
    const candidate = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
    const worker = typeof candidate?.addEventListener === 'function' ? candidate : null;
    const timer = setInterval(() => reload(), RELOAD_MS);
    const onReturn = () => reload();
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    worker?.addEventListener('message', onWorkerMessage);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
      worker?.removeEventListener('message', onWorkerMessage);
    };
  }, [load]);

  async function markOneRead(item: NotificationItemView) {
    if (item.readAt || busy) return;
    latest.current++;
    try {
      const res = await api<NotificationReadResponse>(`/api/notifications/${item.id}/read`, {
        method: 'POST',
      });
      latest.current++; // A list that was asked for during the POST is older than this change.
      if (pending.current > 0) again.current = true;
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
    latest.current++;
    setBusy(true);
    try {
      await api<NotificationReadAllResponse>('/api/notifications/read-all', { method: 'POST' });
      latest.current++;
      if (pending.current > 0) again.current = true;
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

  const unreadCount = data?.unreadCount ?? 0;
  const label = unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo';

  return (
    <div className="notif-box">
      <button
        type="button"
        className="icon-button notif-bell"
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Bell size={20} strokeWidth={1.75} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="count-badge notif-badge">{unreadCount}</span>
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

          <PushToggle userId={userId} />

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
