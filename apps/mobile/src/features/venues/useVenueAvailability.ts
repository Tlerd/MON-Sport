import { api, durationsAt, startableMinutes } from '@monsport/client';
import type { Availability, CourtView, VenueView } from '@monsport/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

export const HOUR = 60;

export type CourtState =
  | { date: string; status: 'ok'; free: Availability['free'] }
  | { date: string; status: 'error' };

export interface UseVenueAvailabilityOptions {
  id: string | undefined;
  today: string;
  now: Date;
}

export function useVenueAvailability({ id, today, now }: UseVenueAvailabilityOptions) {
  const [venues, setVenues] = useState<VenueView[] | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const venue = venues?.find((v) => v.id === id);

  const [date, setDate] = useState(today);
  const [selected, setSelected] = useState<{ courtId: string; start: number; duration: number } | undefined>(undefined);
  const [courtStates, setCourtStates] = useState<Record<string, CourtState>>({});
  const dateRef = useRef(date);
  dateRef.current = date;
  const requestRef = useRef<Record<string, number>>({});

  const loadVenues = useCallback(() => {
    setFailed(false);
    api<VenueView[]>('/api/venues').then(
      (list) => setVenues(list),
      () => setFailed(true),
    );
  }, []);

  useEffect(() => {
    loadVenues();
  }, [loadVenues]);

  const loadCourt = useCallback((courtId: string, forDate: string) => {
    const n = (requestRef.current[courtId] ?? 0) + 1;
    requestRef.current[courtId] = n;
    api<Availability>(`/api/courts/${courtId}/availability?date=${forDate}`).then(
      (answer) => {
        if (dateRef.current !== forDate || requestRef.current[courtId] !== n) return;
        setCourtStates((s) => ({ ...s, [courtId]: { date: forDate, status: 'ok', free: answer.free } }));
      },
      () => {
        if (dateRef.current !== forDate || requestRef.current[courtId] !== n) return;
        setCourtStates((s) => ({ ...s, [courtId]: { date: forDate, status: 'error' } }));
      },
    );
  }, []);

  useEffect(() => {
    if (!venue) return;
    for (const court of venue.courts) loadCourt(court.id, date);
  }, [venue, date, loadCourt]);

  const stateOf = (court: CourtView): CourtState | undefined => {
    const s = courtStates[court.id];
    return s && s.date === date ? s : undefined;
  };

  const startableOf = (court: CourtView): number[] => {
    const s = stateOf(court);
    return s?.status === 'ok' ? startableMinutes(date, s.free, now) : [];
  };

  const allAnswered = Boolean(venue && venue.courts.every((c) => stateOf(c)?.status === 'ok'));
  const allEmpty = Boolean(allAnswered && venue && venue.courts.every((c) => startableOf(c).length === 0));

  const selectedCourt = selected && venue ? venue.courts.find((c) => c.id === selected.courtId) : undefined;
  const selectedCourtState = selectedCourt ? stateOf(selectedCourt) : undefined;
  const selectedFree = selectedCourtState?.status === 'ok' ? selectedCourtState.free : [];

  const clampedDuration = (() => {
    if (!selected) return HOUR;
    if (selectedCourtState?.status !== 'ok') return selected.duration;
    const durations = durationsAt(date, selected.start, selectedCourtState.free, now);
    if (durations.length > 0 && !durations.includes(selected.duration)) {
      return Math.max(...durations);
    }
    return selected.duration;
  })();

  const reloadAllCourts = () => {
    if (!venue) return;
    for (const court of venue.courts) loadCourt(court.id, date);
  };

  return {
    venues,
    failed,
    venue,
    date,
    setDate,
    selected,
    setSelected,
    loadVenues,
    loadCourt,
    reloadAllCourts,
    stateOf,
    startableOf,
    allEmpty,
    selectedCourt,
    selectedFree,
    clampedDuration,
  };
}
