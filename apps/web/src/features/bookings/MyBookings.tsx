import type { BookingView } from '@monsport/shared';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import { formatSlot, formatVnd } from '../../lib/format.ts';
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
        <ul className="list">
          {rows.map((b) => (
            <li key={b.id} data-status={b.status}>
              <span>{formatSlot(b.startAt, b.endAt)}</span>
              <span>{formatVnd(b.priceTotal)}</span>
              <strong>{STATUS_LABEL[b.status]}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
