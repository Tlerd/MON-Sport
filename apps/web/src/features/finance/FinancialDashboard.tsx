import type { FinancialDashboardView, FinancialPeriod, VenueView } from '@monsport/shared';
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
import { api, ApiError } from '../../lib/api.ts';
import { formatVnd } from '../../lib/format.ts';

const todayVN = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

const PERIOD_LABELS: Record<FinancialPeriod, string> = {
  day: 'Ngày',
  week: 'Tuần',
  month: 'Tháng',
};

/** Brief F-015 (UC-12): Venue owner financial dashboard. */
export function FinancialDashboard() {
  const [venues, setVenues] = useState<VenueView[] | null>(null);
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');
  const [period, setPeriod] = useState<FinancialPeriod>('week');
  const [date, setDate] = useState<string>(todayVN);
  const [data, setData] = useState<FinancialDashboardView | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Load owner's venues on mount
  useEffect(() => {
    api<VenueView[]>('/api/owner/venues')
      .then((list) => {
        setVenues(list);
        if (list.length > 0 && !selectedVenueId) {
          setSelectedVenueId(list[0].id);
        }
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Không tải được danh sách đơn vị');
      });
  }, []);

  // Fetch financial metrics whenever venue, period, or date changes
  useEffect(() => {
    if (!selectedVenueId) return;
    setLoading(true);
    setError('');
    api<FinancialDashboardView>(
      `/api/owner/venues/${selectedVenueId}/financials?period=${period}&date=${date}`,
    )
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Không tải được báo cáo tài chính');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedVenueId, period, date]);

  return (
    <section className="panel financial-panel">
      <h2>Báo cáo tài chính</h2>

      {venues && venues.length === 0 && (
        <p className="empty">Bạn chưa có đơn vị nào để xem báo cáo tài chính.</p>
      )}

      {venues && venues.length > 0 && (
        <>
          <div className="financial-controls">
            {venues.length > 1 && (
              <div className="control-group">
                <label htmlFor="venue-select">Đơn vị:</label>
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
              </div>
            )}

            <div className="period-buttons" role="group" aria-label="Khoảng thời gian">
              {(['day', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={period === p ? 'active' : 'secondary'}
                  onClick={() => setPeriod(p)}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>

            <div className="control-group">
              <label htmlFor="financial-date">Ngày:</label>
              <input
                id="financial-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {loading && !data && <p className="empty">Đang tải báo cáo…</p>}

          {data && (
            <>
              <div className="metric-grid">
                <div className="metric-card">
                  <span className="metric-label">Doanh thu</span>
                  <strong className="metric-value">{formatVnd(data.revenue)}</strong>
                  <span className="metric-sub">
                    {data.paidBookings}/{data.totalBookings} booking đã thu tiền
                  </span>
                </div>

                <div className="metric-card">
                  <span className="metric-label">Giờ đã đặt</span>
                  <strong className="metric-value">{data.bookedHours} giờ</strong>
                  <span className="metric-sub">Tổng mở: {data.openingHours} giờ sân</span>
                </div>

                <div className="metric-card">
                  <span className="metric-label">Tỉ lệ lấp đầy</span>
                  <strong className="metric-value">
                    {(data.occupancyRate * 100).toFixed(1)}%
                  </strong>
                  <span className="metric-sub">
                    {data.bookedHours}h / {data.openingHours}h
                  </span>
                </div>

                <div className="metric-card">
                  <span className="metric-label">Giờ cao điểm / thường</span>
                  <strong className="metric-value">
                    {data.peakHours}h / {data.normalHours}h
                  </strong>
                  <span className="metric-sub">Cao điểm: 17:00–22:00</span>
                </div>

                <div className="metric-card">
                  <span className="metric-label">Tỉ lệ hủy & từ chối</span>
                  <strong className="metric-value">
                    Hủy {(data.cancellationRate * 100).toFixed(1)}% / Từ chối{' '}
                    {(data.rejectionRate * 100).toFixed(1)}%
                  </strong>
                  <span className="metric-sub">
                    {data.cancelledBookings} hủy, {data.rejectedBookings} từ chối
                  </span>
                </div>

                <div className="metric-card">
                  <span className="metric-label">Khách quay lại</span>
                  <strong className="metric-value">
                    {data.returningCustomers}/{data.totalCustomers} khách
                  </strong>
                  <span className="metric-sub">Đặt từ 2 lượt trở lên</span>
                </div>
              </div>

              <div className="chart-wrapper">
                <h3>Biểu đồ theo {PERIOD_LABELS[period].toLowerCase()}</h3>
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
                        stroke="#2563eb"
                        tickFormatter={(v) => `${v / 1000}k`}
                      />
                      <YAxis
                        yAxisId="hours"
                        orientation="right"
                        stroke="#16a34a"
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
                      <Bar yAxisId="revenue" dataKey="revenue" name="revenue" fill="#2563eb" />
                      <Bar yAxisId="hours" dataKey="bookedHours" name="bookedHours" fill="#16a34a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
