import type { BookingView, OwnerBookingView, PaidAtVenueResponse } from '@monsport/shared';
import { useEffect, useState } from 'react';
import { api, ApiError, formatDay, formatTime, formatVnd } from '@monsport/client';
import { EmptyState } from '../../components/EmptyState.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';
import { Customer } from './customer.tsx';
import { STATUS_LABEL } from './status.ts';

/** UC-4: the owner confirms or rejects each pending request. */
export function OwnerRequests() {
  const [rows, setRows] = useState<OwnerBookingView[] | null>(null);
  const [error, setError] = useState('');
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

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

  async function togglePaid(id: string, paidAtVenue: boolean) {
    if (togglingIds.has(id)) return;
    setTogglingIds((prev) => new Set(prev).add(id));
    setError('');
    try {
      const updated = await api<PaidAtVenueResponse>(`/api/owner/bookings/${id}/paid`, {
        method: 'PATCH',
        // `json` makes the shared client set content-type: application/json. A plain `body` went out as text/plain, and the API answered 400.
        json: { paidAtVenue },
      });
      setRows((list) => list?.map((r) => (r.id === id ? { ...r, paidAtVenue: updated.paidAtVenue } : r)) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không cập nhật được trạng thái thu tiền');
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const waiting = rows?.filter((r) => r.status === 'PENDING').length ?? 0;
  return (
    <section className="panel">
      <h2>Yêu cầu đặt sân</h2>
      {rows && rows.length > 0 && <p className="count">{waiting > 0 ? `${waiting} yêu cầu đang chờ bạn xác nhận.` : 'Không còn yêu cầu nào đang chờ.'}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {rows?.length === 0 && (
        <EmptyState message="Chưa có yêu cầu nào đang chờ. Tải lại trang để xem yêu cầu mới." />
      )}
      <ul className="tickets">
        {rows?.map((r) => (
          <li key={r.id} className="ticket card-web" data-status={r.status}>
            <span className="stub">
              <strong>{formatTime(r.startAt)}</strong>
              <span>đến {formatTime(r.endAt)}</span>
            </span>
            <span className="body">
              <Customer customer={r.customer} />
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
                <span className="status-wrap">
                  <StatusBadge className="status" status={r.status} label={STATUS_LABEL[r.status]} />
                  {r.status === 'CONFIRMED' && (
                    <span className="payment-action">
                      <span className={`paid-tag ${r.paidAtVenue ? 'paid' : 'unpaid'}`}>
                        {r.paidAtVenue ? 'Đã thu tiền' : 'Chưa thu tiền'}
                      </span>
                      <button
                        type="button"
                        className={`btn-toggle-paid ${r.paidAtVenue ? 'secondary' : ''}`}
                        disabled={togglingIds.has(r.id)}
                        onClick={() => togglePaid(r.id, !r.paidAtVenue)}
                      >
                        {r.paidAtVenue ? 'Đánh dấu chưa thu' : 'Đã thu tiền'}
                      </button>
                    </span>
                  )}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
