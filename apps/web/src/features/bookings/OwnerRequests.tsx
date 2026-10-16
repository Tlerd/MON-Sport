import type { BookingView, OwnerBookingView } from '@monsport/shared';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api.ts';
import { formatSlot, formatVnd } from '../../lib/format.ts';
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

  return (
    <section className="panel">
      <h2>Yêu cầu đặt sân</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {rows?.length === 0 && <p className="empty">Chưa có yêu cầu nào đang chờ. Tải lại trang để xem yêu cầu mới.</p>}
      <ul className="list">
        {rows?.map((r) => (
          <li key={r.id} data-status={r.status}>
            <span>{r.customer.name} · <a href={`tel:${r.customer.phone}`}>{r.customer.phone}</a></span>
            <span>{formatSlot(r.startAt, r.endAt)} · {formatVnd(r.priceTotal)}</span>
            {r.status === 'PENDING' ? (
              <span className="actions">
                <button type="button" onClick={() => decide(r.id, 'confirm')}>Xác nhận</button>
                <button type="button" className="secondary" onClick={() => decide(r.id, 'reject')}>Từ chối</button>
              </span>
            ) : (
              <strong>{STATUS_LABEL[r.status]}</strong>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
