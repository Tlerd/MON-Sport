import type { BookingView, OwnerBookingView, PaidAtVenueResponse } from '@monsport/shared';
import { useEffect, useState } from 'react';
import { errorMessage, api, formatDay, formatTime, formatVnd } from '@monsport/client';
import { Avatar } from '../../components/Avatar.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';
import { Customer } from '../../components/Customer.tsx';
import { STATUS_LABEL } from './status.ts';

export function OwnerRequests({ canManagePayment = true }: { canManagePayment?: boolean } = {}) {
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
      setError(errorMessage(err, 'Không lưu được quyết định'));
    }
  }

  async function togglePaid(id: string, paidAtVenue: boolean) {
    if (togglingIds.has(id)) return;
    setTogglingIds((prev) => new Set(prev).add(id));
    setError('');
    try {
      const updated = await api<PaidAtVenueResponse>(`/api/owner/bookings/${id}/paid`, {
        method: 'PATCH',
        json: { paidAtVenue },
      });
      setRows((list) => list?.map((r) => (r.id === id ? { ...r, paidAtVenue: updated.paidAtVenue } : r)) ?? null);
    } catch (err) {
      setError(errorMessage(err, 'Không cập nhật được trạng thái thu tiền'));
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
    <section className="panel clean">
      <div className="page-head">
        <div>
          <h2>Yêu cầu đặt sân</h2>
          <p>Xác nhận hoặc từ chối yêu cầu đặt sân từ khách hàng.</p>
        </div>
        {rows && rows.length > 0 && (
          <p className="count">
            {waiting > 0 ? `${waiting} yêu cầu đang chờ bạn xác nhận.` : 'Không còn yêu cầu nào đang chờ.'}
          </p>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {rows?.length === 0 && (
        <div className="card">
          <EmptyState message="Chưa có yêu cầu nào đang chờ. Tải lại trang để xem yêu cầu mới." />
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="card reqs-table">
          <div className="req head" aria-hidden="true">
            <span>Khách</span>
            <span>Ngày</span>
            <span>Thời gian</span>
            <span className="r">Giá</span>
            <span className="r">Thao tác</span>
          </div>
          <ul className="tickets">
            {rows.map((r) => (
              <li key={r.id} className="ticket req" data-status={r.status}>
                <div className="req-who">
                  <Avatar name={r.customer.name || 'Khách'} size={34} />
                  <div>
                    <Customer customer={r.customer} />
                    <small>{r.source === 'PHONE' ? 'Qua điện thoại' : 'Đặt trong app'}</small>
                  </div>
                </div>
                <div className="req-day">
                  <b>Ngày {formatDay(r.startAt)}</b>
                  <small className="req-price-sm money tnum">{formatVnd(r.priceTotal)}</small>
                </div>
                <div className="stub">
                  <strong>{formatTime(r.startAt)}</strong>
                  <span>đến {formatTime(r.endAt)}</span>
                </div>
                <div className="req-price r">
                  <b className="money tnum">{formatVnd(r.priceTotal)}</b>
                </div>
                <div className="req-act">
                  {r.status === 'PENDING' ? (
                    <>
                      <button type="button" className="btn sm lime" onClick={() => decide(r.id, 'confirm')}>
                        Xác nhận
                      </button>
                      <button type="button" className="btn sm ghost" onClick={() => decide(r.id, 'reject')}>
                        Từ chối
                      </button>
                    </>
                  ) : (
                    <div className="status-wrap">
                      <StatusBadge className="status" status={r.status} label={STATUS_LABEL[r.status]} />
                      {canManagePayment && r.status === 'CONFIRMED' && (
                        <span className="payment-action">
                          <span className={`tag ${r.paidAtVenue ? 'ok' : 'warn'}`}>
                            {r.paidAtVenue ? 'Đã thu tiền' : 'Chưa thu tiền'}
                          </span>
                          <button
                            type="button"
                            className={`btn sm ${r.paidAtVenue ? 'ghost' : 'lime'}`}
                            disabled={togglingIds.has(r.id)}
                            onClick={() => togglePaid(r.id, !r.paidAtVenue)}
                          >
                            {r.paidAtVenue ? 'Đánh dấu chưa thu' : 'Đã thu tiền'}
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
