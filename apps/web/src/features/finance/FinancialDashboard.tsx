import type { FinancialDashboardView, FinancialPeriod, VenueView } from '@monsport/shared';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { errorMessage, api, formatVnd } from '@monsport/client';

const todayVN = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

const PERIOD_LABELS: Record<FinancialPeriod, string> = {
  day: 'Ngày',
  week: 'Tuần',
  month: 'Tháng',
};

export function FinancialDashboard() {
  const [venues, setVenues] = useState<VenueView[] | null>(null);
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');
  const [period, setPeriod] = useState<FinancialPeriod>('week');
  const [date, setDate] = useState<string>(todayVN);
  const [data, setData] = useState<FinancialDashboardView | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    api<VenueView[]>('/api/owner/venues')
      .then((list) => {
        setVenues(list);
        if (list.length > 0 && !selectedVenueId) {
          setSelectedVenueId(list[0].id);
        }
      })
      .catch((err) => {
        setError(errorMessage(err, 'Không tải được danh sách đơn vị'));
      });
  }, []);

  useEffect(() => {
    if (!selectedVenueId || !date) return;
    let active = true;
    setLoading(true);
    setError('');
    api<FinancialDashboardView>(
      `/api/owner/venues/${selectedVenueId}/financials?period=${period}&date=${date}`,
    )
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err, 'Không tải được báo cáo tài chính'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedVenueId, period, date]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Doanh thu</h1>
          <p>Theo dõi doanh thu, giờ đặt và tỉ lệ lấp đầy. Khách trả tiền tại sân.</p>
        </div>
      </div>

      <section className="panel clean financial-panel">
        <h2>Báo cáo tài chính</h2>

        {venues && venues.length === 0 && (
          <p className="empty">Bạn chưa có đơn vị nào để xem báo cáo tài chính.</p>
        )}

        {venues && venues.length > 0 && (
          <>
            <div className="fbar">
              {venues.length > 1 && (
                <div className="fld inline-fld">
                  <label htmlFor="venue-select">Đơn vị</label>
                  <div className="sel">
                    <select
                      id="venue-select"
                      value={selectedVenueId}
                      onChange={(e) => setSelectedVenueId(e.target.value)}
                    >
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="ic" aria-hidden="true" />
                  </div>
                </div>
              )}

              <div className="seg" role="group" aria-label="Khoảng thời gian">
                {(['day', 'week', 'month'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={period === p ? 'on' : ''}
                    onClick={() => setPeriod(p)}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>

              <label className="fld inline-fld" htmlFor="financial-date">
                <span>Ngày</span>
                <input
                  id="financial-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value || todayVN())}
                />
              </label>
            </div>

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            {loading && !data && <p className="empty">Đang tải báo cáo…</p>}

            {data && (
              <div className="stack">
                <div className="tiles">
                  <div className="tile lime">
                    <small>Doanh thu</small>
                    <b className="money tnum">{formatVnd(data.revenue)}</b>
                    <small>
                      {data.paidBookings}/{data.totalBookings} booking đã thu tiền
                    </small>
                  </div>

                  <div className="tile">
                    <small>Giờ đã đặt</small>
                    <b className="tnum">{data.bookedHours} giờ</b>
                    <small>Tổng mở: {data.openingHours} giờ sân</small>
                  </div>

                  <div className="tile">
                    <small>Tỉ lệ lấp đầy</small>
                    <b className="tnum">
                      {(data.occupancyRate * 100).toFixed(1)}%
                    </b>
                    <small>
                      {data.bookedHours}h / {data.openingHours}h
                    </small>
                  </div>

                  <div className="tile">
                    <small>Giờ cao điểm / thường</small>
                    <b className="tnum">
                      {data.peakHours}h / {data.normalHours}h
                    </b>
                    <small>Cao điểm: 17:00–22:00</small>
                  </div>

                  <div className="tile">
                    <small>Tỉ lệ hủy & từ chối</small>
                    <b className="sm-val tnum">
                      Hủy {(data.cancellationRate * 100).toFixed(1)}% / Từ chối{' '}
                      {(data.rejectionRate * 100).toFixed(1)}%
                    </b>
                    <small>
                      {data.cancelledBookings} hủy, {data.rejectedBookings} từ chối
                    </small>
                  </div>

                  <div className="tile">
                    <small>Khách quay lại</small>
                    <b className="tnum">
                      {data.returningCustomers}/{data.totalCustomers} khách
                    </b>
                    <small>Đặt từ 2 lượt trở lên</small>
                  </div>
                </div>

                <div className="card pad chart-wrapper">
                  <div className="sec-row">
                    <h3>Biểu đồ theo {PERIOD_LABELS[period].toLowerCase()}</h3>
                  </div>
                  <div
                    className="chart-container"
                    style={{ width: '100%', height: 300, minHeight: 300 }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.chartData}
                        margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis
                          yAxisId="revenue"
                          orientation="left"
                          stroke="var(--ok)"
                          tickFormatter={(v) => `${v / 1000}k`}
                        />
                        <YAxis
                          yAxisId="hours"
                          orientation="right"
                          stroke="var(--amber)"
                          tickFormatter={(v) => `${v}h`}
                        />
                        <Tooltip
                          formatter={(val: unknown, name: unknown) => [
                            name === 'revenue' ? formatVnd(Number(val)) : `${val} giờ`,
                            name === 'revenue' ? 'Doanh thu' : 'Số giờ đặt',
                          ]}
                        />
                        <Legend
                          formatter={(value) =>
                            value === 'revenue' ? 'Doanh thu (VND)' : 'Số giờ đặt'
                          }
                        />
                        <Bar yAxisId="revenue" dataKey="revenue" name="revenue" fill="var(--ok)" />
                        <Bar yAxisId="hours" dataKey="bookedHours" name="bookedHours" fill="var(--amber)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
