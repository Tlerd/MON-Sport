import { formatVnd, percent } from '@monsport/client';
import type { FinancialDashboardView } from '@monsport/shared';
import type { CSSProperties } from 'react';

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
  padding: 'var(--space-base)',
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-line)',
  borderRadius: 'var(--radius-sm)',
  minWidth: 0,
  maxWidth: '100%',
  boxSizing: 'border-box',
  overflowWrap: 'anywhere',
};

const labelStyle: CSSProperties = {
  font: 'var(--font-meta)',
  color: 'var(--color-ink-muted)',
  minWidth: 0,
  overflowWrap: 'anywhere',
};

const valueStyle: CSSProperties = {
  font: 'var(--font-headline-mobile)',
  color: 'var(--color-ink)',
  minWidth: 0,
  overflowWrap: 'anywhere',
};

export interface RevenueMetricsProps {
  data: FinancialDashboardView;
}

export function RevenueMetrics({ data }: RevenueMetricsProps) {
  return (
    <div
      data-testid="metric-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 'var(--space-sm)',
        padding: 'var(--space-sm) var(--space-base)',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <article aria-label="Doanh thu" style={cardStyle}>
        <span style={labelStyle}>Doanh thu</span>{' '}
        <strong className="tnum" style={valueStyle}>
          {formatVnd(data.revenue)}
        </strong>{' '}
        <span className="tnum" style={labelStyle}>
          {`${data.paidBookings} đã thu · ${data.unpaidBookings} chưa thu`}
        </span>
      </article>

      <article aria-label="Giờ đã đặt" style={cardStyle}>
        <span style={labelStyle}>Giờ đã đặt</span>{' '}
        <strong className="tnum" style={valueStyle}>
          {`${data.bookedHours.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ`}
        </strong>
      </article>

      <article aria-label="Lấp đầy" style={cardStyle}>
        <span style={labelStyle}>Lấp đầy</span>{' '}
        <strong className="tnum" style={valueStyle}>
          {percent(data.occupancyRate)}
        </strong>
      </article>

      <article aria-label="Hủy" style={cardStyle}>
        <span style={labelStyle}>Hủy</span>{' '}
        <strong className="tnum" style={valueStyle}>
          {percent(data.cancellationRate)}
        </strong>
      </article>

      <article aria-label="Từ chối" style={cardStyle}>
        <span style={labelStyle}>Từ chối</span>{' '}
        <strong className="tnum" style={valueStyle}>
          {percent(data.rejectionRate)}
        </strong>
      </article>

      <article aria-label="Khách quay lại" style={cardStyle}>
        <span style={labelStyle}>Khách quay lại</span>{' '}
        <strong className="tnum" style={valueStyle}>
          {`${data.returningCustomers}/${data.totalCustomers}`}
        </strong>
      </article>
    </div>
  );
}
