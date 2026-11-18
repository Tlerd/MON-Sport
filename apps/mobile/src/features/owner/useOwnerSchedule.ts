import { api, ApiError, ownerStartableMinutes } from '@monsport/client';
import type { Availability, CourtView, OwnerBookingView, SessionUser, VenueView } from '@monsport/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router';

export type CourtState =
  | { key: string; status: 'ok'; free: Availability['free'] }
  | { key: string; status: 'error' };

export interface ScheduleNotice {
  kind: 'status' | 'alert';
  text: string;
}

export interface UseOwnerScheduleOptions {
  user: SessionUser | null | undefined;
  today: string;
  now: Date;
  navigate: NavigateFunction;
}

export function useOwnerSchedule({ user, today, now, navigate }: UseOwnerScheduleOptions) {
  const [venues, setVenues] = useState<VenueView[] | undefined>(undefined);
  const [venuesFailed, setVenuesFailed] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState<string | undefined>(undefined);
  const [date, setDate] = useState(today);
  const [courtStates, setCourtStates] = useState<Record<string, CourtState>>({});
  const [bookings, setBookings] = useState<OwnerBookingView[]>([]);
  const [bookingsFailed, setBookingsFailed] = useState(false);
  const [notice, setNotice] = useState<ScheduleNotice | null>(null);
  const [sheetTarget, setSheetTarget] = useState<{ court: CourtView; start: number } | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [sessionLoginOpen, setSessionLoginOpen] = useState(false);

  const mountedRef = useRef(true);
  const venuesRef = useRef(venues);
  venuesRef.current = venues;
  const venuesReqRef = useRef(0);
  const bookingsReqRef = useRef(0);
  const availGenRef = useRef(0);
  const courtReqRef = useRef<Record<string, number>>({});

  const active = user?.role === 'OWNER';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      venuesReqRef.current++;
      bookingsReqRef.current++;
      availGenRef.current++;
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
    Promise.all([
      api<OwnerBookingView[]>('/api/owner/bookings?status=CONFIRMED'),
      api<OwnerBookingView[]>('/api/owner/bookings?status=PENDING'),
    ]).then(
      ([confirmed, pending]) => {
        if (!mountedRef.current || reqId !== bookingsReqRef.current) return;
        setBookingsFailed(false);
        setBookings([...confirmed, ...pending]);
      },
      (err: unknown) => {
        if (!mountedRef.current || reqId !== bookingsReqRef.current) return;
        if (err instanceof ApiError && err.status === 401) {
          setSessionLoginOpen(true);
        } else {
          setBookingsFailed(true);
        }
      },
    );
  }, []);

  useEffect(() => {
    if (!active) return;
    loadVenues();
    loadBookings();
  }, [user?.id, active, loadVenues, loadBookings]);

  const venue = venues?.find((v) => v.id === selectedVenueId) ?? venues?.[0];
  const activeKey = venue ? `${venue.id}|${date}` : '';
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;

  const loadCourt = useCallback((courtId: string, forDate: string, forVenueId: string, gen: number) => {
    const key = `${forVenueId}|${forDate}`;
    const n = (courtReqRef.current[courtId] ?? 0) + 1;
    courtReqRef.current[courtId] = n;
    api<Availability>(`/api/courts/${courtId}/availability?date=${forDate}`).then(
      (answer) => {
        if (
          !mountedRef.current ||
          availGenRef.current !== gen ||
          activeKeyRef.current !== key ||
          courtReqRef.current[courtId] !== n
        ) {
          return;
        }
        setCourtStates((s) => ({ ...s, [courtId]: { key, status: 'ok', free: answer.free } }));
      },
      () => {
        if (
          !mountedRef.current ||
          availGenRef.current !== gen ||
          activeKeyRef.current !== key ||
          courtReqRef.current[courtId] !== n
        ) {
          return;
        }
        setCourtStates((s) => ({ ...s, [courtId]: { key, status: 'error' } }));
      },
    );
  }, []);

  useEffect(() => {
    if (!active || !venue) return;
    const gen = ++availGenRef.current;
    for (const court of venue.courts) {
      loadCourt(court.id, date, venue.id, gen);
    }
  }, [active, venue, date, loadCourt]);

  const stateOf = (court: CourtView): CourtState | undefined => {
    const s = courtStates[court.id];
    return s && s.key === activeKey ? s : undefined;
  };

  const startableOf = (court: CourtView): number[] => {
    const s = stateOf(court);
    return s?.status === 'ok' ? ownerStartableMinutes(date, s.free, now) : [];
  };

  const pickDate = (ymd: string) => {
    availGenRef.current++;
    setDate(ymd);
    setSheetTarget(null);
    setNotice(null);
  };

  const pickVenue = (id: string) => {
    availGenRef.current++;
    setSelectedVenueId(id);
    setSheetTarget(null);
    setNotice(null);
  };

  const retryCourt = (courtId: string, venueId: string) => {
    loadCourt(courtId, date, venueId, availGenRef.current);
  };

  const reloadAllCourts = (currentVenue: VenueView) => {
    for (const c of currentVenue.courts) {
      loadCourt(c.id, date, currentVenue.id, availGenRef.current);
    }
  };

  const targetCourt = sheetTarget && venue ? venue.courts.find((c) => c.id === sheetTarget.court.id) : undefined;
  const targetFree = targetCourt
    ? (() => {
        const s = stateOf(targetCourt);
        return s?.status === 'ok' ? s.free : [];
      })()
    : [];

  return {
    active,
    venues,
    venuesFailed,
    setVenuesFailed,
    venue,
    date,
    bookings,
    bookingsFailed,
    notice,
    setNotice,
    sheetTarget,
    setSheetTarget,
    loginOpen,
    setLoginOpen,
    sessionLoginOpen,
    setSessionLoginOpen,
    targetCourt,
    targetFree,
    loadVenues,
    loadBookings,
    retryCourt,
    reloadAllCourts,
    stateOf,
    startableOf,
    pickDate,
    pickVenue,
  };
}
