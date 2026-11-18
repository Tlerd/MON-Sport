import {
  api,
  ApiError,
  periodHeading,
  periodRange,
  shiftPeriodDate,
  unpaidInPeriod,
} from '@monsport/client';
import {
  type FinancialDashboardView,
  type FinancialPeriod,
  type OwnerBookingView,
  type PaidAtVenueResponse,
  type SessionUser,
  type VenueView,
  vnWeekRange,
} from '@monsport/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router';

function periodContainsOrAfterToday(period: FinancialPeriod, date: string, today: string): boolean {
  if (period === 'day') return date >= today;
  if (period === 'week') return vnWeekRange(date).weekEnd >= today;
  const [y = 0, m = 0] = date.split('-').map(Number);
  const [ty = 0, tm = 0] = today.split('-').map(Number);
  return y > ty || (y === ty && m >= tm);
}

export interface UseOwnerRevenueOptions {
  user: SessionUser | null | undefined;
  today: string;
  navigate: NavigateFunction;
}

export function useOwnerRevenue({ user, today, navigate }: UseOwnerRevenueOptions) {
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
  const paidIdsRef = useRef(new Set<string>());

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
        setSelectedVenueId((prev) => (prev && sorted.some((v) => v.id === prev) ? prev : sorted[0]?.id));
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
        setBookings(list.filter((b) => !paidIdsRef.current.has(b.id)));
      },
      (err: unknown) => {
        if (!mountedRef.current || reqId !== bookingsReqRef.current) return;
        if (err instanceof ApiError && err.status === 401) setSessionLoginOpen(true);
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
      api<FinancialDashboardView>(`/api/owner/venues/${forVenueId}/financials?period=${forPeriod}&date=${forDate}`).then(
        (res) => {
          if (!mountedRef.current || reqId !== financialsReqRef.current || activeKeyRef.current !== key) return;
          setFinancialsFailed(false);
          setDataState({ key, view: res });
        },
        (err: unknown) => {
          if (!mountedRef.current || reqId !== financialsReqRef.current || activeKeyRef.current !== key) return;
          if (err instanceof ApiError && err.status === 401) setSessionLoginOpen(true);
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
    } else if (venueRef.current) {
      loadFinancials(venueRef.current.id, periodRef.current, dateRef.current);
    }
  }, [loadBookings, loadVenues, loadFinancials]);

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
      paidIdsRef.current.add(booking.id);
      setBookings((prev) => prev.filter((b) => b.id !== booking.id));
      if (venueRef.current) loadFinancials(venueRef.current.id, periodRef.current, dateRef.current);
    } catch (err) {
      if (!mountedRef.current) return;
      const isStale = activeKeyRef.current !== keyAtStart;
      if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
        if (!isStale) setUnpaidAlert(err.message);
        loadBookings();
        if (venueRef.current) loadFinancials(venueRef.current.id, periodRef.current, dateRef.current);
      } else if (err instanceof ApiError && err.status === 401) {
        setSessionLoginOpen(true);
      } else {
        const message = err instanceof ApiError ? err.message : 'Không cập nhật được. Thử lại.';
        setRowErrors((prev) => ({ ...prev, [booking.id]: message }));
      }
    } finally {
      busyRef.current.delete(booking.id);
      if (mountedRef.current) setBusyIds(new Set(busyRef.current));
    }
  };

  const range = periodRange(period, date);
  const unpaidItems = venue
    ? unpaidInPeriod(bookings, range.startDate, range.endDate, venue.courts.map((c) => c.id))
    : [];

  return {
    active,
    venues,
    venuesFailed,
    setVenuesFailed,
    venue,
    period,
    date,
    currentData,
    financialsFailed,
    bookingsFailed,
    busyIds,
    unpaidAlert,
    setUnpaidAlert,
    rowErrors,
    loginOpen,
    setLoginOpen,
    sessionLoginOpen,
    setSessionLoginOpen,
    heading,
    nextDisabled,
    unpaidItems,
    loadVenues,
    loadBookings,
    loadFinancials,
    handleSessionLoggedIn,
    pickVenue,
    pickPeriod,
    shiftDate,
    markPaid,
  };
}
