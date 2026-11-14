import { type OwnerBookingView, vnDateString } from '@monsport/shared';
import { api, formatDay, formatTime } from '@monsport/client';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { Customer } from '../features/bookings/customer.tsx';

/** Owner overview screen (/chu-san/tong-quan): pending counts, today's confirmed count, and latest requests. */
export function OwnerOverview({ now }: { now?: Date } = {}) {
  const [pending, setPending] = useState<OwnerBookingView[]>([]);
  const [confirmed, setConfirmed] = useState<OwnerBookingView[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      api<OwnerBookingView[]>('/api/owner/bookings?status=PENDING'),
      api<OwnerBookingView[]>('/api/owner/bookings?status=CONFIRMED'),
    ]).then(
      ([pendingRows, confirmedRows]) => {
        if (!active) return;
        setPending(pendingRows);
        setConfirmed(confirmedRows);
      },
      () => {
        if (!active) return;
        setError('Không tải được tổng quan.');
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const todayYmd = vnDateString(now ?? new Date());
  const todayConfirmedCount = confirmed.filter(
    (b) => vnDateString(new Date(b.startAt)) === todayYmd,
  ).length;
  const latestPending = pending.slice(0, 3);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Tổng quan</h1>
          <p>Theo dõi yêu cầu chờ duyệt và lượt đặt trong ngày.</p>
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="tiles">
        <div className={pending.length > 0 ? 'tile warn' : 'tile'}>
          <small>Yêu cầu chờ duyệt</small>
          <b>{pending.length}</b>
        </div>
        <div className="tile">
          <small>Lượt đặt hôm nay</small>
          <b>{todayConfirmedCount}</b>
        </div>
      </div>

      <div className="split even">
        <section className="card pad">
          <div className="sec-row">
            <h2>Yêu cầu mới nhất</h2>
            <NavLink to="/chu-san/yeu-cau" className="link">
              Xử lý yêu cầu
            </NavLink>
          </div>
          {latestPending.length === 0 ? (
            <div className="empty">
              <p>Chưa có yêu cầu nào đang chờ.</p>
            </div>
          ) : (
            <ul className="tickets">
              {latestPending.map((r) => (
                <li key={r.id} className="ticket card" data-status={r.status}>
                  <span className="stub">
                    <strong>{formatTime(r.startAt)}</strong>
                    <span>đến {formatTime(r.endAt)}</span>
                  </span>
                  <span className="body">
                    <Customer customer={r.customer} />
                    <span className="meta">
                      <span>Ngày {formatDay(r.startAt)}</span>
                      <span>
                        {formatTime(r.startAt)}–{formatTime(r.endAt)}
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card pad">
          <div className="sec-row">
            <h2>Doanh thu 7 ngày</h2>
          </div>
          <div className="empty">
            <div className="empty-ball" aria-hidden="true">
              <svg
                className="ic"
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M5.2 6.2c3.6 2.6 3.6 9 0 11.6M18.8 6.2c-3.6 2.6-3.6 9 0 11.6" />
              </svg>
            </div>
            <h3>Sắp ra mắt</h3>
            <p>Biểu đồ doanh thu 7 ngày sẽ hiển thị tại đây.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
