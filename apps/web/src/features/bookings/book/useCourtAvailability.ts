import { addDaysYmd, vnDateString, type VenueView } from '@monsport/shared';
import { api, fitsAnyDuration, slotAt as at } from '@monsport/client';
import { useEffect, useMemo, useState } from 'react';
import type { SlotCellInfo } from '../../../components/SlotGrid.tsx';
import { formatDayChip } from '../../../lib/dates.ts';

export function useCourtAvailability(routeVenueId?: string) {
  const [venues, setVenues] = useState<VenueView[]>([]);
  const [venuesLoaded, setVenuesLoaded] = useState(false);
  const todayStr = useMemo(() => vnDateString(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [cells, setCells] = useState<Record<string, SlotCellInfo[]>>({});
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let active = true;
    api<VenueView[]>('/api/venues').then(
      (data) => {
        if (!active) return;
        setVenues(data);
        setVenuesLoaded(true);
      },
      () => {
        if (!active) return;
        setError('Không tải được danh sách đơn vị');
        setVenuesLoaded(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const selectedVenue = routeVenueId
    ? venues.find((v) => v.id === routeVenueId)
    : venues[0];

  useEffect(() => {
    if (!selectedVenue || !selectedDate) return;
    let active = true;

    Promise.all(
      selectedVenue.courts.map((court) =>
        api<{ courtId: string; free: Array<{ startAt: string; endAt: string }> }>(
          `/api/courts/${court.id}/availability?date=${selectedDate}`,
        )
          .then((res) => ({ courtId: court.id, free: res?.free ?? [] }))
          .catch(() => ({ courtId: court.id, free: [] })),
      ),
    ).then((results) => {
      if (!active) return;
      const nextCells: Record<string, SlotCellInfo[]> = {};
      for (const res of results) {
        const courtCells: SlotCellInfo[] = [];
        for (let m = selectedVenue.opensAt; m < selectedVenue.closesAt; m += 30) {
          const slotStart = new Date(at(selectedDate, m)).toISOString();
          const slotEnd = new Date(at(selectedDate, m + 30)).toISOString();
          const isFree =
            fitsAnyDuration(m, selectedVenue.closesAt) &&
            res.free.some((r) => slotStart >= r.startAt && slotEnd <= r.endAt);
          courtCells.push({
            startMinute: m,
            status: isFree ? 'free' : 'taken',
          });
        }
        nextCells[res.courtId] = courtCells;
      }
      setCells(nextCells);
    });

    return () => {
      active = false;
    };
  }, [selectedVenue?.id, selectedDate]);

  const gridCells = useMemo(() => {
    if (!selectedVenue) return cells;
    const mapped: Record<string, SlotCellInfo[]> = {};
    for (const court of selectedVenue.courts) {
      const courtCells = cells[court.id];
      if (courtCells) {
        mapped[court.id] = courtCells.map((c) =>
          fitsAnyDuration(c.startMinute, selectedVenue.closesAt) ? c : { ...c, status: 'taken' as const },
        );
      } else {
        mapped[court.id] = [];
        for (let m = selectedVenue.opensAt; m < selectedVenue.closesAt; m += 30) {
          mapped[court.id].push({
            startMinute: m,
            status: fitsAnyDuration(m, selectedVenue.closesAt) ? 'free' : 'taken',
          });
        }
      }
    }
    return mapped;
  }, [cells, selectedVenue]);

  const dateOptions = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const ymd = addDaysYmd(todayStr, i);
      return {
        ymd,
        label: i === 0 ? 'Hôm nay' : formatDayChip(ymd),
      };
    });
  }, [todayStr]);

  const isOtherDate = !dateOptions.some((d) => d.ymd === selectedDate);

  return {
    venuesLoaded,
    selectedVenue,
    selectedDate,
    setSelectedDate,
    gridCells,
    dateOptions,
    isOtherDate,
    error,
    setError,
  };
}
