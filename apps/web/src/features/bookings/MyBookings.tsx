import { CALL_OWNER_MESSAGE, type MyBookingView, userCancelDecision } from '@monsport/shared';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import { formatDay, formatSlot, formatTime, formatVnd } from '../../lib/format.ts';
import { CancelAsk, useCancelFlow } from './cancel.tsx';
import { STATUS_LABEL } from './status.ts';

/** UC-6 (brief F-009): the bookings of the signed-in user, newest first. The user cancels while the rule allows it, or calls the owner. */
export function MyBookings({ refresh = 0 }: { refresh?: number }) {
  const [rows, setRows] = useState<MyBookingView[] | null>(null);
  const load = useCallback(() => api<MyBookingView[]>('/api/bookings/mine').then(setRows, () => setRows((list) => list ?? [])), []);
  useEffect(() => {
    void load();
  }, [load, refresh]);

  // A refused cancel means the server sees another state, so the list is read again.
  const { list, failure, ask } = useCancelFlow(async (id) => {
    const done = await api<MyBookingView>(`/api/bookings/${id}/cancel`, { method: 'POST' });
    setRows((all) => all?.map((r) => (r.id === done.id ? done : r)) ?? null);
  }, load);

  if (!rows) return null;
  const now = new Date();
  return (
    <section className="panel">
      <h2>Booking của tôi</h2>
      {failure && <p className="error" role="alert">{failure}</p>}
      {rows.length === 0 ? (
        <p className="empty">Bạn chưa có booking nào. Chọn đơn vị ở trên để đặt sân.</p>
      ) : (
        <ul className="tickets" ref={list}>
          {rows.map((b) => {
            const decision = userCancelDecision({ status: b.status, startAt: new Date(b.startAt) }, now);
            return (
              <li key={b.id} className="ticket" data-status={b.status}>
                <span className="stub">
                  <strong>{formatTime(b.startAt)}</strong>
                  <span>đến {formatTime(b.endAt)}</span>
                </span>
                <span className="body">
                  <span className="where">{`${b.venueName} · ${b.courtName}`}</span>
                  <span>Ngày {formatDay(b.startAt)}</span>
                  <span className="money">{formatVnd(b.priceTotal)}</span>
                  <span className="status" {...(decision !== 'ALLOW' && { tabIndex: -1, 'data-focus': b.id })}>{STATUS_LABEL[b.status]}</span>
                  {decision === 'ALLOW' && <CancelAsk id={b.id} label={`${b.venueName} · ${b.courtName}, ${formatSlot(b.startAt, b.endAt)}`} ask={ask} />}
                  {decision === 'CALL_OWNER' && (
                    <span className="call-owner">
                      <span>{CALL_OWNER_MESSAGE}</span>
                      <a className="phone" href={`tel:${b.venuePhone}`}>Gọi chủ sân</a>
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
