import { Sport, type MatchView, type MyBookingView, type SessionUser, type VenueView } from '@monsport/shared';
import { api } from '@monsport/client';
import { useEffect, useMemo, useState } from 'react';

export function useHomeData(user: SessionUser | null | undefined) {
  const [matches, setMatches] = useState<MatchView[] | null>(null);
  const [matchesError, setMatchesError] = useState('');
  const [venues, setVenues] = useState<VenueView[]>([]);
  const [bookings, setBookings] = useState<MyBookingView[]>([]);
  const [sportFilter, setSportFilter] = useState<'ALL' | Sport>('ALL');
  const [typeTab, setTypeTab] = useState<'ALL' | 'SINGLE'>('ALL');

  useEffect(() => {
    let active = true;
    api<MatchView[]>('/api/matches')
      .then((list) => {
        if (active) setMatches(list);
      })
      .catch(() => {
        if (active) setMatchesError('Không tải được danh sách trận đang mở');
      });
    api<VenueView[]>('/api/venues')
      .then((list) => {
        if (active) setVenues(list);
      })
      .catch(() => {
        if (active) setVenues([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (user?.role !== 'USER') {
      setBookings([]);
      return;
    }
    let active = true;
    api<MyBookingView[]>('/api/bookings/mine')
      .then((list) => {
        if (active) setBookings(list);
      })
      .catch(() => {
        if (active) setBookings([]);
      });
    return () => {
      active = false;
    };
  }, [user?.id, user?.role]);

  const filteredMatches = useMemo(() => {
    if (!matches) return null;
    if (sportFilter === 'ALL') return matches;
    return matches.filter((m) => m.sport === sportFilter);
  }, [matches, sportFilter]);

  const upcomingBookings = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter((b) => (b.status === 'PENDING' || b.status === 'CONFIRMED') && Date.parse(b.endAt) > now)
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
      .slice(0, 2);
  }, [bookings]);

  return {
    matchesError,
    venues,
    sportFilter,
    setSportFilter,
    typeTab,
    setTypeTab,
    filteredMatches,
    upcomingBookings,
  };
}
