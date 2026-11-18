import {
  addDaysYmd,
  confirmDeadline,
  minuteOfDayVN,
  vnDateString,
  type BookingView,
  type OwnerBookingView,
  type VenueView,
} from '@monsport/shared';
import { api, ApiError } from '@monsport/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SelectedSlot, SlotCellInfo, WindowId } from '../../components/SlotGrid.tsx';

interface UseOwnerBookingsOptions {
  refreshKey?: number;
  onRefresh?: () => void;
}

export function useOwnerBookings({ refreshKey = 0, onRefresh }: UseOwnerBookingsOptions = {}) {
  const [venues, setVenues] = useState<VenueView[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');

  const todayStr = useMemo(() => vnDateString(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [bookings, setBookings] = useState<OwnerBookingView[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedWindowId, setSelectedWindowId] = useState<WindowId | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    api<VenueView[]>('/api/owner/venues')
      .then((data) => {
        setVenues(data);
        if (data.length > 0 && !selectedVenueId) {
          setSelectedVenueId(data[0].id);
        }
      })
      .catch(() => setError('Không tải được danh sách đơn vị'));
  }, []);

  const loadBookings = useCallback(() => {
    api<OwnerBookingView[]>('/api/owner/bookings')
      .then(setBookings)
      .catch(() => setError('Không tải được danh sách booking'));
  }, []);

  useEffect(() => {
    loadBookings();
  }, [refreshKey, loadBookings]);

  const selectedVenue = venues.find((v) => v.id === selectedVenueId) ?? venues[0];

  const dateOptions = useMemo(() => {
    return [
      { ymd: addDaysYmd(todayStr, -1), label: 'Hôm qua' },
      { ymd: todayStr, label: 'Hôm nay' },
      { ymd: addDaysYmd(todayStr, 1), label: 'Ngày mai' },
    ];
  }, [todayStr]);

  const isOtherDate = !dateOptions.some((d) => d.ymd === selectedDate);

  const cells = useMemo(() => {
    if (!selectedVenue) return {};
    const map: Record<string, SlotCellInfo[]> = {};

    for (const court of selectedVenue.courts) {
      const courtCells: SlotCellInfo[] = [];
      const courtBookings = bookings.filter(
        (b) =>
          b.courtId === court.id &&
          vnDateString(new Date(b.startAt)) === selectedDate &&
          (b.status === 'CONFIRMED' || b.status === 'PENDING'),
      );

      for (let m = selectedVenue.opensAt; m < selectedVenue.closesAt; m += 30) {
        const matchingBooking = courtBookings.find((b) => {
          const startM = minuteOfDayVN(new Date(b.startAt));
          const endM = minuteOfDayVN(new Date(b.endAt));
          return m >= startM && m < endM;
        });

        if (matchingBooking) {
          const isPending = matchingBooking.status === 'PENDING';
          const name = matchingBooking.customer?.name ?? (isPending ? 'Khách' : 'Đã xác nhận');
          courtCells.push({
            startMinute: m,
            status: isPending ? 'pending' : 'confirmed',
            label: isPending ? `${name} · chờ` : name,
            bookingId: matchingBooking.id,
            customerName: name,
          });
        } else {
          courtCells.push({
            startMinute: m,
            status: 'free',
          });
        }
      }
      map[court.id] = courtCells;
    }
    return map;
  }, [selectedVenue, selectedDate, bookings]);

  const pendingRequests = useMemo(() => {
    return bookings
      .filter((b) => b.status === 'PENDING')
      .sort((a, b) => {
        const dlA = confirmDeadline(new Date(a.createdAt), new Date(a.startAt)).getTime();
        const dlB = confirmDeadline(new Date(b.createdAt), new Date(b.startAt)).getTime();
        return dlA - dlB;
      });
  }, [bookings]);

  const selectedSlots = useMemo(() => {
    if (!selectedBookingId) return null;
    const req = bookings.find((b) => b.id === selectedBookingId);
    if (!req) return null;
    const startM = minuteOfDayVN(new Date(req.startAt));
    const endM = minuteOfDayVN(new Date(req.endAt));
    const slots: SelectedSlot[] = [];
    for (let m = startM; m < endM; m += 30) {
      slots.push({ courtId: req.courtId, startMinute: m });
    }
    return slots;
  }, [selectedBookingId, bookings]);

  function handleRequestCardClick(req: OwnerBookingView) {
    setSelectedBookingId(req.id);

    const targetVenue = venues.find((v) => v.courts.some((c) => c.id === req.courtId));
    if (targetVenue && targetVenue.id !== selectedVenueId) {
      setSelectedVenueId(targetVenue.id);
    }

    const reqDate = vnDateString(new Date(req.startAt));
    if (reqDate !== selectedDate) {
      setSelectedDate(reqDate);
    }

    const startM = minuteOfDayVN(new Date(req.startAt));
    const wId: WindowId = startM < 12 * 60 ? 'sang' : startM < 17 * 60 ? 'chieu' : 'toi';
    setSelectedWindowId(wId);
  }

  async function decide(id: string, action: 'confirm' | 'reject') {
    setError('');
    try {
      await api<BookingView>(`/api/owner/bookings/${id}/${action}`, { method: 'POST' });
      onRefresh?.();
      loadBookings();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được quyết định');
    }
  }

  return {
    venues,
    selectedVenue,
    selectedVenueId,
    setSelectedVenueId,
    selectedDate,
    setSelectedDate,
    selectedBookingId,
    setSelectedBookingId,
    selectedWindowId,
    setSelectedWindowId,
    error,
    dateOptions,
    isOtherDate,
    cells,
    pendingRequests,
    selectedSlots,
    loadBookings,
    handleRequestCardClick,
    decide,
  };
}
