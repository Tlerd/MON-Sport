import { api, ApiError, formatVnd, percent, periodHeading, shiftPeriodDate } from '@monsport/client';
import {
  type FinancialDashboardView,
  type FinancialPeriod,
  type VenueView,
  vnDateString,
  vnWeekRange,
} from '@monsport/shared';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '../../app/session.tsx';
import { Chip } from '../../components/Chip.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { LoginSheet } from '../auth/LoginSheet.tsx';
import { RevenueChart } from './RevenueChart.tsx';

const PERIODS: ReadonlyArray<{ id: FinancialPeriod; label: string }> = [
  { id: 'day', label: 'Ngày' },
  { id: 'week', label: 'Tuần' },
  { id: 'month', label: 'Tháng' },
];

function periodContainsOrAfterToday(period: FinancialPeriod, date: string, today: string): boolean {
  if (period === 'day') return date >= today;
  if (period === 'week') return vnWeekRange(date).weekEnd >= today;
  const [y, m] = date.split('-').map(Number);
  const [ty, tm] = today.split('-').map(Number);
  return y! > ty! || (y === ty && m! >= tm!);
}

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

const navBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px',
  minWidth: '44px',
  padding: '0 var(--space-md)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-line)',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-ink)',
  font: 'var(--font-label)',
  cursor: 'pointer',
  flex: '0 0 auto',
};

export interface RevenueScreenProps {
  now?: Date;
}

export function RevenueScreen({ now }: RevenueScreenProps) {
  const { user } = useSession();
  return <RevenueScreenBody key={user?.id ?? 'guest'} now={now} />;
}

function RevenueScreenBody({ now: nowProp }: RevenueScreenProps) {
  const navigate = useNavigate();
  const { user } = useSession();
  const now = nowProp ?? new Date();
  const today = vnDateString(now);

  const [venues, setVenues] = useState<VenueView[] | undefined>(undefined);
  const [venuesFailed, setVenuesFailed] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState<string | undefined>(undefined);
  const [period, setPeriod] = useState<FinancialPeriod>('week');
  const [date, setDate] = useState<string>(today);
  const [dataState, setDataState] = useState<{ key: string; view: FinancialDashboardView } | null>(null);
  const [financialsFailed, setFinancialsFailed] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [sessionLoginOpen, setSessionLoginOpen] = useState(false);

  const mountedRef = useRef(true);
  const venuesRef = useRef(venues);
  venuesRef.current = venues;
  const venuesReqRef = useRef(0);
  const financialsReqRef = useRef(0);

  const active = user?.role === 'OWNER';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      venuesReqRef.current++;
      financialsReqRef.current++;
    };
  }, []);

  useEffect(() => {
    if (user?.role === 'USER') navigate('/', { replace: true });
  }, [user?.role, navigate]);

  const loadVenues = useCallback(() => {
    const reqId = ++venuesReqRef.current;
    api<VenueView[]>('/api/owner/venues').then(
      (list) => {
        if (!mountedRef.current || reqId !== venuesReqRef.current) return;
        const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        setVenuesFailed(false);
        setVenues(sorted);
        setSelectedVenueId((prev) =>
          prev && sorted.some((v) => v.id === prev) ? prev : sorted[0]?.id,
        );
      },
      (err: unknown) => {
        if (!mountedRef.current || reqId !== venuesReqRef.current) return;
        if (err instanceof ApiError && err.status === 401) {
          setSessionLoginOpen(true);
        } else if (!venuesRef.current) {
          setVenuesFailed(true);
        }
      },
    );
  }, []);

  useEffect(() => {
    if (!active) return;
    loadVenues();
  }, [user?.id, active, loadVenues]);

  const venue = venues?.find((v) => v.id === selectedVenueId) ?? venues?.[0];
  const activeKey = venue ? `${venue.id}|${period}|${date}` : '';
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;

  const loadFinancials = useCallback(
    (forVenueId: string, forPeriod: FinancialPeriod, forDate: string) => {
      const reqId = ++financialsReqRef.current;
      const key = `${forVenueId}|${forPeriod}|${forDate}`;
      setFinancialsFailed(false);
      api<FinancialDashboardView>(
        `/api/owner/venues/${forVenueId}/financials?period=${forPeriod}&date=${forDate}`,
      ).then(
        (res) => {
          if (
            !mountedRef.current ||
            reqId !== financialsReqRef.current ||
            activeKeyRef.current !== key
          ) {
            return;
          }
          setFinancialsFailed(false);
          setDataState({ key, view: res });
        },
        (err: unknown) => {
          if (
            !mountedRef.current ||
            reqId !== financialsReqRef.current ||
            activeKeyRef.current !== key
          ) {
            return;
          }
          if (err instanceof ApiError && err.status === 401) {
            setSessionLoginOpen(true);
          } else {
            setFinancialsFailed(true);
          }
        },
      );
    },
    [],
  );

  useEffect(() => {
    if (!active || !venue) return;
    loadFinancials(venue.id, period, date);
  }, [active, venue, period, date, loadFinancials]);

  if (user === undefined) {
    return <EmptyState message="Đang tải" />;
  }

  if (user === null) {
    return (
      <div style={{ minWidth: 0 }}>
        <EmptyState
          message="Đăng nhập để xem doanh thu"
          actionLabel="Đăng nhập"
          onAction={() => setLoginOpen(true)}
        />
        <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>
    );
  }

  if (user.role === 'ADMIN' || !active) {
    return null;
  }

  if (!venues) {
    return (
      <div style={{ minWidth: 0 }}>
        {venuesFailed ? (
          <EmptyState
            message="Không tải được"
            actionLabel="Thử lại"
            onAction={() => {
              setVenuesFailed(false);
              loadVenues();
            }}
          />
        ) : (
          <EmptyState message="Đang tải" />
        )}
        <LoginSheet
          open={sessionLoginOpen}
          onClose={() => setSessionLoginOpen(false)}
          onLoggedIn={() => {
            setVenuesFailed(false);
            loadVenues();
          }}
          notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
        />
      </div>
    );
  }

  if (venues.length === 0 || !venue) {
    return (
      <div style={{ minWidth: 0 }}>
        <EmptyState message="Bạn chưa có đơn vị nào" />
        <LoginSheet
          open={sessionLoginOpen}
          onClose={() => setSessionLoginOpen(false)}
          onLoggedIn={() => {
            setVenuesFailed(false);
            loadVenues();
          }}
          notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
        />
      </div>
    );
  }

  const currentData = dataState?.key === activeKey ? dataState.view : undefined;
  const heading = periodHeading(currentData ?? { period, date });
  const nextDisabled = periodContainsOrAfterToday(period, date, today);

  const pickVenue = (id: string) => {
    financialsReqRef.current++;
    setFinancialsFailed(false);
    setSelectedVenueId(id);
  };

  const pickPeriod = (nextPeriod: FinancialPeriod) => {
    financialsReqRef.current++;
    setFinancialsFailed(false);
    setPeriod(nextPeriod);
  };

  const shiftDate = (steps: number) => {
    if (steps > 0 && nextDisabled) return;
    financialsReqRef.current++;
    setFinancialsFailed(false);
    setDate((prev) => shiftPeriodDate(prev, period, steps));
  };

  return (
    <div style={{ minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
      {venues.length >= 2 && (
        <div
          role="group"
          aria-label="Đơn vị"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-sm)',
            padding: 'var(--space-sm) var(--space-base)',
            minWidth: 0,
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
        >
          {venues.map((v) => (
            <Chip
              key={v.id}
              selected={v.id === venue.id}
              onClick={() => pickVenue(v.id)}
              style={{
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
                minWidth: '44px',
                maxWidth: '100%',
                textAlign: 'left',
              }}
            >
              {v.name}
            </Chip>
          ))}
        </div>
      )}

      <div
        role="group"
        aria-label="Kỳ"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
          padding: 'var(--space-sm) var(--space-base)',
          minWidth: 0,
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        {PERIODS.map((p) => (
          <Chip key={p.id} selected={p.id === period} onClick={() => pickPeriod(p.id)}>
            {p.label}
          </Chip>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-sm)',
          padding: 'var(--space-sm) var(--space-base)',
          minWidth: 0,
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        <button type="button" onClick={() => shiftDate(-1)} style={navBtnStyle}>
          Kỳ trước
        </button>
        <h2
          style={{
            margin: 0,
            font: 'var(--font-headline-mobile)',
            color: 'var(--color-ink)',
            minWidth: 0,
            overflowWrap: 'anywhere',
            textAlign: 'center',
            flex: '1 1 0',
          }}
        >
          {heading}
        </h2>
        <button
          type="button"
          disabled={nextDisabled}
          onClick={() => shiftDate(1)}
          style={{
            ...navBtnStyle,
            color: nextDisabled ? 'var(--color-ink-muted)' : 'var(--color-ink)',
            cursor: nextDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          Kỳ sau
        </button>
      </div>

      {financialsFailed ? (
        <EmptyState
          message="Không tải được"
          actionLabel="Thử lại"
          onAction={() => loadFinancials(venue.id, period, date)}
        />
      ) : !currentData ? (
        <EmptyState message="Đang tải" />
      ) : (
        <>
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
                {formatVnd(currentData.revenue)}
              </strong>{' '}
              <span className="tnum" style={labelStyle}>
                {`${currentData.paidBookings} đã thu · ${currentData.unpaidBookings} chưa thu`}
              </span>
            </article>

            <article aria-label="Giờ đã đặt" style={cardStyle}>
              <span style={labelStyle}>Giờ đã đặt</span>{' '}
              <strong className="tnum" style={valueStyle}>
                {`${currentData.bookedHours} giờ`}
              </strong>
            </article>

            <article aria-label="Lấp đầy" style={cardStyle}>
              <span style={labelStyle}>Lấp đầy</span>{' '}
              <strong className="tnum" style={valueStyle}>
                {percent(currentData.occupancyRate)}
              </strong>
            </article>

            <article aria-label="Hủy" style={cardStyle}>
              <span style={labelStyle}>Hủy</span>{' '}
              <strong className="tnum" style={valueStyle}>
                {percent(currentData.cancellationRate)}
              </strong>
            </article>

            <article aria-label="Từ chối" style={cardStyle}>
              <span style={labelStyle}>Từ chối</span>{' '}
              <strong className="tnum" style={valueStyle}>
                {percent(currentData.rejectionRate)}
              </strong>
            </article>

            <article aria-label="Khách quay lại" style={cardStyle}>
              <span style={labelStyle}>Khách quay lại</span>{' '}
              <strong className="tnum" style={valueStyle}>
                {`${currentData.returningCustomers}/${currentData.totalCustomers}`}
              </strong>
            </article>
          </div>

          <RevenueChart points={currentData.chartData} />
        </>
      )}

      <LoginSheet
        open={sessionLoginOpen}
        onClose={() => setSessionLoginOpen(false)}
        onLoggedIn={() => {
          setVenuesFailed(false);
          setFinancialsFailed(false);
          if (!venuesRef.current) {
            loadVenues();
          } else {
            loadFinancials(venue.id, period, date);
          }
        }}
        notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
      />
    </div>
  );
}
