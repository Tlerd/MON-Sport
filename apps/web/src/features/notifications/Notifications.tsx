import type {
  NotificationItemView,
  NotificationReadAllResponse,
  NotificationReadResponse,
  NotificationsListResponse,
} from '@monsport/shared';
import { Bell } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, formatDay, formatTime } from '@monsport/client';
import { useAction } from '../../hooks/useAction.ts';
import { PushToggle } from './PushToggle.tsx';

const RELOAD_MS = 15_000;
const STALE_MS = 2 * RELOAD_MS;
const FAILED_UPDATE = 'Không cập nhật được thông báo';

export function Notifications({ userId, refresh = 0 }: { userId: string; refresh?: number }) {
  const [data, setData] = useState<NotificationsListResponse | null>(null);
  const [open, setOpen] = useState(false);
  const readOne = useAction();
  const readAll = useAction();
  const busy = readAll.busy;
  const error = readAll.error ?? readOne.error;

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
        if (controller.signal.aborted) return;
        if (!keepOnError && number === latest.current) setData(null);
      })
      .finally(() => {
        clearTimeout(timer);
        pending.current--;
        if (pending.current === 0 && again.current) {
          again.current = false;
          if (document.visibilityState === 'visible') void load(true);
        }
      });
  }, []);

  useEffect(() => {
    void load();
  }, [load, refresh]);

  useEffect(() => {
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
    readAll.setError(null);
    const res = await readOne.run(
      () => api<NotificationReadResponse>(`/api/notifications/${item.id}/read`, { method: 'POST' }),
      FAILED_UPDATE,
    );
    if (!res) return;
    latest.current++;
    if (pending.current > 0) again.current = true;
    setData((prev) => {
      if (!prev) return prev;
      return {
        unreadCount: Math.max(0, prev.unreadCount - 1),
        items: prev.items.map((i) => (i.id === item.id ? { ...i, readAt: res.readAt } : i)),
      };
    });
  }

  async function markAllRead() {
    if (!data || data.unreadCount === 0 || busy) return;
    latest.current++;
    readOne.setError(null);
    const res = await readAll.run(
      () => api<NotificationReadAllResponse>('/api/notifications/read-all', { method: 'POST' }),
      FAILED_UPDATE,
    );
    if (!res) return;
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
  }

  const unreadCount = data?.unreadCount ?? 0;
  const label = unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo';

  const iconTone = (type: NotificationItemView['type']) => {
    if (type === 'BOOKING_CONFIRMED' || type === 'MATCH_JOIN_APPROVED') return 'ok';
    if (type === 'BOOKING_REJECTED' || type === 'MATCH_CANCELLED' || type === 'MATCH_JOIN_REJECTED') return 'bad';
    return 'warn';
  };

  return (
    <div className="notif-box">
      <button
        type="button"
        className={`ib icon-button notif-bell ${open ? 'on' : ''}`}
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
        <div className="pop wide notif-popover notif-drawer" role="region" aria-label="Bảng thông báo">
          <header className="notif-header">
            <h3>Thông báo</h3>
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
          </header>

          {error && <p className="error" role="alert">{error}</p>}

          <PushToggle userId={userId} />

          {!data || data.items.length === 0 ? (
            <p className="notif-empty dim small">Chưa có thông báo nào</p>
          ) : (
            <ul className="notif-list">
              {data?.items.map((item) => (
                <li
                  key={item.id}
                  className={`nt notif-item ${item.readAt ? 'read' : 'unread'}`}
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
                  <span className={`nt-ic ${iconTone(item.type)}`} aria-hidden="true">
                    <Bell size={16} />
                  </span>
                  <div className="nt-body">
                    <div className="notif-item-header">
                      <span className="notif-item-title">{item.title}</span>
                      {!item.readAt && <span className="notif-dot tag solo" aria-label="Chưa đọc">Mới</span>}
                    </div>
                    <p className="notif-item-msg">{item.message}</p>
                    <small className="notif-item-time">
                      {formatTime(item.createdAt)} {formatDay(item.createdAt)}
                    </small>
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
