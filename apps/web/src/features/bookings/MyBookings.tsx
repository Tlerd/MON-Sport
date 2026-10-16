import type { BookingView } from '@monsport/shared';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import { formatDay, formatTime, formatVnd } from '../../lib/format.ts';
import { STATUS_LABEL } from './status.ts';

/** UC-6 (view only): the bookings of the signed-in user, newest first. */
export function MyBookings({ refresh = 0 }: { refresh?: number }) {
  const [rows, setRows] = useState<BookingView[] | null>(null);
  useEffect(() => {
    api<BookingView[]>('/api/bookings/mine').then(setRows, () => setRows([]));
  }, [refresh]);

  if (!rows) return null;
  return (
    <section className="panel">
      <h2>Booking của tôi</h2>
      {rows.length === 0 ? (
        <p className="empty">Bạn chưa có booking nào. Chọn đơn vị ở trên để đặt sân.</p>
      ) : (
        <ul className="tickets">
          {rows.map((b) => (
            <li key={b.id} className="ticket" data-status={b.status}>
              <span className="stub">
                <strong>{formatTime(b.startAt)}</strong>
                <span>đến {formatTime(b.endAt)}</span>
              </span>
              <span className="body">
                <span>Ngày {formatDay(b.startAt)}</span>
                <span className="money">{formatVnd(b.priceTotal)}</span>
                <span className="status">{STATUS_LABEL[b.status]}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
