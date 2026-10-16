import type { BookingView, OwnerBookingView } from '@monsport/shared';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api.ts';
import { formatDay, formatTime, formatVnd } from '../../lib/format.ts';
import { STATUS_LABEL } from './status.ts';

/** UC-4: the owner confirms or rejects each pending request. */
export function OwnerRequests() {
  const [rows, setRows] = useState<OwnerBookingView[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<OwnerBookingView[]>('/api/owner/bookings').then(setRows, () => setError('Không tải được danh sách yêu cầu'));
  }, []);

  async function decide(id: string, action: 'confirm' | 'reject') {
    setError('');
    try {
      const updated = await api<BookingView>(`/api/owner/bookings/${id}/${action}`, { method: 'POST' });
      setRows((list) => list?.map((r) => (r.id === id ? { ...r, ...updated, customer: r.customer } : r)) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được quyết định');
    }
  }

  const waiting = rows?.filter((r) => r.status === 'PENDING').length ?? 0;
  return (
    <section className="panel">
      <h2>Yêu cầu đặt sân</h2>
      {rows && rows.length > 0 && <p className="count">{waiting} yêu cầu đang chờ bạn xác nhận</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {rows?.length === 0 && <p className="empty">Chưa có yêu cầu nào đang chờ. Tải lại trang để xem yêu cầu mới.</p>}
      <ul className="tickets">
        {rows?.map((r) => (
          <li key={r.id} className="ticket" data-status={r.status}>
            <span className="stub">
              <strong>{formatTime(r.startAt)}</strong>
              <span>đến {formatTime(r.endAt)}</span>
            </span>
            <span className="body">
              <span className="customer">
                {r.customer.name}
                <a className="phone" href={`tel:${r.customer.phone}`}>{r.customer.phone}</a>
              </span>
              <span className="meta">
                <span>Ngày {formatDay(r.startAt)}</span>
                <span className="money">{formatVnd(r.priceTotal)}</span>
              </span>
              {r.status === 'PENDING' ? (
                <span className="actions">
                  <button type="button" onClick={() => decide(r.id, 'confirm')}>Xác nhận</button>
                  <button type="button" className="secondary" onClick={() => decide(r.id, 'reject')}>Từ chối</button>
                </span>
              ) : (
                <span className="status">{STATUS_LABEL[r.status]}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
