import { formatVnd } from '@monsport/client';
import type { FinancialChartPoint } from '@monsport/shared';

export const BAR_MAX_HEIGHT_PX = 120;
export const BAR_MIN_HEIGHT_PX = 2;

export interface RevenueChartProps {
  points: FinancialChartPoint[];
}

/** A label with a space ("T2 02/11") shows the day name above the date, so 7 labels fit at 360px. */
function LabelLines({ label }: { label: string }) {
  const space = label.indexOf(' ');
  if (space < 0) return <>{label}</>;
  const lineStyle = { display: 'block', whiteSpace: 'nowrap' } as const;
  return (
    <>
      <span style={lineStyle}>{label.slice(0, space)}</span>
      <span style={lineStyle}>{label.slice(space + 1)}</span>
    </>
  );
}

export function RevenueChart({ points }: RevenueChartProps) {
  const maxRevenue = points.reduce((max, p) => (p.revenue > max ? p.revenue : max), 0);
  const labelStep = points.length > 7 ? Math.ceil(points.length / 7) : 1;

  return (
    <section
      aria-label="Biểu đồ doanh thu"
      style={{
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        padding: 'var(--space-base)',
        backgroundColor: 'var(--color-surface)',
        borderTop: '1px solid var(--color-line)',
        borderBottom: '1px solid var(--color-line)',
      }}
    >
      <div
        role="list"
        aria-label="Cột doanh thu"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 'var(--space-xs)',
          minWidth: 0,
          maxWidth: '100%',
        }}
      >
        {points.map((point, index) => {
          const ratio = maxRevenue > 0 ? point.revenue / maxRevenue : 0;
          const heightPx = Math.max(BAR_MIN_HEIGHT_PX, Math.round(ratio * BAR_MAX_HEIGHT_PX));
          const showLabel = index % labelStep === 0;
          return (
            <div
              key={point.label}
              role="listitem"
              style={{
                flex: '1 1 0',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-xs)',
              }}
            >
              <div
                role="img"
                aria-label={`${point.label}: ${formatVnd(point.revenue)}`}
                data-ratio={String(ratio)}
                style={{
                  width: '100%',
                  height: `${heightPx}px`,
                  minHeight: `${BAR_MIN_HEIGHT_PX}px`,
                  backgroundColor:
                    point.revenue > 0 ? 'var(--color-primary)' : 'var(--color-line)',
                  borderRadius: 'var(--radius-sm)',
                }}
              />
              <span
                className="tnum"
                style={{
                  font: 'var(--font-meta)',
                  color: 'var(--color-ink-muted)',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                }}
              >
                {showLabel ? <LabelLines label={point.label} /> : '\u00A0'}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
