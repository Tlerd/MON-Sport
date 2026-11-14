import { addDaysYmd, AdminStatsView } from '@monsport/shared';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@monsport/client';

const NO_DATA = 'Chưa có dữ liệu';

/** "2026-11-16" and "2026-11-22" make "16/11 – 22/11/2026". The year of the end day shows once. */
const weekLabel = (start: string, end: string) => {
  const [, sm, sd] = start.split('-');
  const [ey, em, ed] = end.split('-');
  return `${sd}/${sm} – ${ed}/${em}/${ey}`;
};

/** 0.2 makes "20%", and 0.0833 makes "8,3%". */
const percent = (rate: number) => `${(Math.round(rate * 1000) / 10).toLocaleString('vi-VN')}%`;

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="tile">
      <small className="k">{label}</small>
      <b className="tnum">{value}</b>
      {hint && <small>{hint}</small>}
    </div>
  );
}

/** Brief F-016 (UC-13): the admin reads the numbers of the whole site for one week. Read only. */
export function AdminStats() {
  // `null` asks for the week of today, which the server finds on its own clock (BR-27).
  const [date, setDate] = useState<string | null>(null);
  const [data, setData] = useState<AdminStatsView | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0); // "Thử lại" bumps it to run the request again

  useEffect(() => {
    let active = true; // a slow answer for an older week must not replace a newer one
    setLoading(true);
    setError('');
    api<unknown>(date ? `/api/admin/stats?date=${date}` : '/api/admin/stats')
      .then((res) => {
        if (!active) return;
        const parsed = AdminStatsView.safeParse(res);
        if (parsed.success) {
          setData(parsed.data);
        } else {
          setData(null);
          setError('Số liệu nhận về không đúng dạng. Hãy thử lại sau.');
        }
      })
      .catch((err) => {
        if (!active) return;
        setData(null);
        setError(err instanceof ApiError ? err.message : 'Không tải được số liệu');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date, reload]);

  // Before the first answer there is no day to move from.
  const move = (days: number) =>
    setDate((d) => {
      const from = d ?? data?.date;
      return from ? addDaysYmd(from, days) : d;
    });
  const canMove = date !== null || data !== null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Tổng quan</h1>
          <p>Số liệu vận hành toàn trang theo tuần.</p>
        </div>
      </div>

      <section className="panel clean stats-panel" aria-busy={loading}>
        <h2>Số liệu toàn trang</h2>

        <div className="fbar week-nav">
          <button type="button" className="btn sm ghost" disabled={!canMove} onClick={() => move(-7)}>
            Tuần trước
          </button>
          <strong className="week-label tnum" aria-live="polite">
            {data ? weekLabel(data.weekStart, data.weekEnd) : ''}
          </strong>
          <button type="button" className="btn sm ghost" disabled={!canMove} onClick={() => move(7)}>
            Tuần sau
          </button>
        </div>

        {error && (
          <>
            <p className="error" role="alert">{error}</p>
            <button type="button" className="btn sm ghost" onClick={() => setReload((n) => n + 1)}>Thử lại</button>
          </>
        )}
        {loading && !data && !error && <p className="empty">Đang tải số liệu…</p>}

        {data && (
          <div className={loading ? 'stats-body stack loading' : 'stats-body stack'}>
            <h3>Tài khoản theo vai trò</h3>
            <div className="tiles">
              <Metric label="Admin" value={data.accounts.ADMIN} />
              <Metric label="Chủ sân" value={data.accounts.OWNER} />
              <Metric label="Nhân viên" value={data.accounts.STAFF} />
              <Metric label="Người dùng" value={data.accounts.USER} hint="Gồm cả tài khoản bị khóa" />
            </div>

            <h3>Trong tuần</h3>
            <div className="tiles">
              <Metric label="Người dùng mới" value={data.newUsers} hint="Đăng ký trong tuần" />
              <Metric label="Người dùng hoạt động" value={data.activeUsers} hint="Đặt sân, vào trận hoặc mở trận" />
              <Metric
                label="Thời gian xác nhận trung bình"
                value={data.avgConfirmMinutes === null ? NO_DATA : `${data.avgConfirmMinutes} phút`}
                hint="Từ lúc gửi yêu cầu đến lúc chủ sân xác nhận"
              />
              <Metric label="Tỉ lệ hết hạn" value={percent(data.expiryRate)} hint="Yêu cầu hết hạn vì chủ sân không xác nhận" />
            </div>

            <h3>Theo đơn vị</h3>
            {data.venues.length === 0 ? (
              <p className="empty">Chưa có đơn vị nào.</p>
            ) : (
              <div className="card">
                <div className="table-scroll">
                  <table className="tbl stats-table">
                    <caption>Booking và trận theo đơn vị</caption>
                    <thead>
                      <tr>
                        <th scope="col">Đơn vị</th>
                        <th scope="col" className="r">Booking</th>
                        <th scope="col" className="r">Trận</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.venues.map((v) => (
                        <tr key={v.venueId}>
                          <th scope="row" data-label="Đơn vị">{v.venueName}</th>
                          <td data-label="Booking" className="r tnum">{v.bookingCount}</td>
                          <td data-label="Trận" className="r tnum">{v.matchCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
