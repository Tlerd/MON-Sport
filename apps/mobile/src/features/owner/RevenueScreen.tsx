import {
  api,
  ApiError,
  formatVnd,
  percent,
  periodHeading,
  shiftPeriodDate,
  unpaidInPeriod,
} from '@monsport/client';
import {
  type FinancialDashboardView,
  type FinancialPeriod,
  type OwnerBookingView,
  type PaidAtVenueResponse,
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
import { UnpaidList } from './UnpaidList.tsx';

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
  const [bookings, setBookings] = useState<OwnerBookingView[]>([]);
  const [bookingsFailed, setBookingsFailed] = useState(false);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());
  const [unpaidAlert, setUnpaidAlert] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [loginOpen, setLoginOpen] = useState(false);
  const [sessionLoginOpen, setSessionLoginOpen] = useState(false);

  const mountedRef = useRef(true);
  const venuesRef = useRef(venues);
  venuesRef.current = venues;
  const venuesReqRef = useRef(0);
  const financialsReqRef = useRef(0);
  const bookingsReqRef = useRef(0);
  const busyRef = useRef(new Set<string>());

  const active = user?.role === 'OWNER';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      venuesReqRef.current++;
      financialsReqRef.current++;
      bookingsReqRef.current++;
      busyRef.current.clear();
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
        if (err instanceof ApiError && err.status === 401) setSessionLoginOpen(true);
        if (!venuesRef.current) setVenuesFailed(true);
      },
    );
  }, []);

  const loadBookings = useCallback(() => {
    const reqId = ++bookingsReqRef.current;
    setBookingsFailed(false);
    api<OwnerBookingView[]>('/api/owner/bookings?status=CONFIRMED').then(
      (list) => {
        if (!mountedRef.current || reqId !== bookingsReqRef.current) return;
        setBookingsFailed(false);
        setBookings(list);
      },
      (err: unknown) => {
        if (!mountedRef.current || reqId !== bookingsReqRef.current) return;
        if (err instanceof ApiError && err.status === 401) {
          setSessionLoginOpen(true);
        }
        setBookingsFailed(true);
      },
    );
  }, []);

  useEffect(() => {
    if (!active) return;
    loadVenues();
    loadBookings();
  }, [user?.id, active, loadVenues, loadBookings]);

  const venue = venues?.find((v) => v.id === selectedVenueId) ?? venues?.[0];
  const activeKey = venue ? `${venue.id}|${period}|${date}` : '';
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;
  const venueRef = useRef(venue);
  venueRef.current = venue;
  const periodRef = useRef(period);
  periodRef.current = period;
  const dateRef = useRef(date);
  dateRef.current = date;

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
          }
          setFinancialsFailed(true);
        },
      );
    },
    [],
  );

  useEffect(() => {
    if (!active || !venue) return;
    loadFinancials(venue.id, period, date);
  }, [active, venue, period, date, loadFinancials]);

  const handleSessionLoggedIn = useCallback(() => {
    setVenuesFailed(false);
    setBookingsFailed(false);
    setFinancialsFailed(false);
    loadBookings();
    if (!venuesRef.current || venuesRef.current.length === 0) {
      loadVenues();
    } else {
      const curVenue = venueRef.current;
      if (curVenue) {
        loadFinancials(curVenue.id, periodRef.current, dateRef.current);
      }
    }
  }, [loadBookings, loadVenues, loadFinancials]);

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
          onLoggedIn={handleSessionLoggedIn}
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
          onLoggedIn={handleSessionLoggedIn}
          notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
        />
      </div>
    );
  }

  const currentData = dataState?.key === activeKey ? dataState.view : undefined;
  const heading = periodHeading(currentData ?? { period, date });
  const nextDisabled = periodContainsOrAfterToday(period, date, today);

  const resetPatchState = () => {
    setUnpaidAlert(null);
    setRowErrors({});
  };

  const pickVenue = (id: string) => {
    financialsReqRef.current++;
    setFinancialsFailed(false);
    resetPatchState();
    setSelectedVenueId(id);
  };

  const pickPeriod = (nextPeriod: FinancialPeriod) => {
    financialsReqRef.current++;
    setFinancialsFailed(false);
    resetPatchState();
    setPeriod(nextPeriod);
    setDate((prev) => (prev > today ? today : prev));
  };

  const shiftDate = (steps: number) => {
    if (steps > 0 && nextDisabled) return;
    financialsReqRef.current++;
    setFinancialsFailed(false);
    resetPatchState();
    setDate((prev) => {
      const shifted = shiftPeriodDate(prev, period, steps);
      return steps > 0 && shifted > today ? today : shifted;
    });
  };

  const markPaid = async (booking: OwnerBookingView) => {
    if (busyRef.current.has(booking.id)) return;
    const keyAtStart = activeKeyRef.current;

    busyRef.current.add(booking.id);
    setBusyIds(new Set(busyRef.current));
    setUnpaidAlert(null);
    setRowErrors((prev) => {
      if (!(booking.id in prev)) return prev;
      const next = { ...prev };
      delete next[booking.id];
      return next;
    });

    try {
      await api<PaidAtVenueResponse>(`/api/owner/bookings/${booking.id}/paid`, {
        method: 'PATCH',
        json: { paidAtVenue: true },
      });
      if (!mountedRef.current) return;
      setBookings((prev) => prev.filter((b) => b.id !== booking.id));
      const curVenue = venueRef.current;
      if (curVenue) {
        loadFinancials(curVenue.id, periodRef.current, dateRef.current);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const isStale = activeKeyRef.current !== keyAtStart;
      if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
        if (!isStale) {
          setUnpaidAlert(err.message);
        }
        loadBookings();
        const curVenue = venueRef.current;
        if (curVenue) {
          loadFinancials(curVenue.id, periodRef.current, dateRef.current);
        }
      } else if (err instanceof ApiError && err.status === 401) {
        setSessionLoginOpen(true);
      } else {
        const message =
          err instanceof ApiError ? err.message : 'Không cập nhật được. Thử lại.';
        setRowErrors((prev) => ({ ...prev, [booking.id]: message }));
      }
    } finally {
      busyRef.current.delete(booking.id);
      if (mountedRef.current) {
        setBusyIds(new Set(busyRef.current));
      }
    }
  };

  const unpaidItems = currentData
    ? unpaidInPeriod(
        bookings,
        currentData.startDate,
        currentData.endDate,
        venue.courts.map((c) => c.id),
      )
    : [];

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

          <UnpaidList
            items={unpaidItems}
            courts={venue.courts}
            failed={bookingsFailed}
            onRetry={() => {
              setUnpaidAlert(null);
              loadBookings();
            }}
            busyIds={busyIds}
            alertMessage={unpaidAlert}
            rowErrors={rowErrors}
            onMarkPaid={markPaid}
          />
        </>
      )}

      <LoginSheet
        open={sessionLoginOpen}
        onClose={() => setSessionLoginOpen(false)}
        onLoggedIn={handleSessionLoggedIn}
        notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
      />
    </div>
  );
}
