import { api, ApiError } from '@monsport/client';
import {
  MATCH_CAPACITY_MESSAGE,
  MATCH_PRICE_MESSAGE,
  PRICE_MAX,
  type JoinMode,
  type MatchView,
  type MyBookingView,
  type SessionUser,
} from '@monsport/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router';

export type MyTab = 'UPCOMING' | 'JOINED' | 'HISTORY';

export interface UseMyScheduleOptions {
  user: SessionUser | null | undefined;
  navigate: NavigateFunction;
}

export function useMySchedule({ user, navigate }: UseMyScheduleOptions) {
  const [tab, setTab] = useState<MyTab>('UPCOMING');
  const [bookings, setBookings] = useState<MyBookingView[] | undefined>(undefined);
  const [matches, setMatches] = useState<MatchView[] | undefined>(undefined);
  const [bookingsFailed, setBookingsFailed] = useState(false);
  const [joinedFailed, setJoinedFailed] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<MyBookingView | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [openTarget, setOpenTarget] = useState<MyBookingView | null>(null);
  const [openCapacity, setOpenCapacity] = useState('10');
  const [openPrice, setOpenPrice] = useState('0');
  const [openJoinMode, setOpenJoinMode] = useState<JoinMode>('INSTANT');
  const [openBusy, setOpenBusy] = useState(false);
  const [openError, setOpenError] = useState('');
  const [sessionLoginOpen, setSessionLoginOpen] = useState(false);

  const reqCounter = useRef(0);
  const openTargetId = useRef<string | null>(null);

  const load = useCallback(() => {
    setBookingsFailed(false);
    setJoinedFailed(false);
    const reqId = ++reqCounter.current;
    Promise.allSettled([
      api<MyBookingView[]>('/api/bookings/mine'),
      api<MatchView[]>('/api/matches/joined'),
    ]).then(([bRes, mRes]) => {
      if (reqId !== reqCounter.current) return;
      if (bRes.status === 'fulfilled') {
        setBookings(bRes.value);
      } else {
        setBookingsFailed(true);
      }
      if (mRes.status === 'fulfilled') {
        setMatches(mRes.value);
      } else {
        setJoinedFailed(true);
      }
    });
  }, []);

  useEffect(() => {
    if (user?.role === 'OWNER') {
      navigate('/chu-san/yeu-cau', { replace: true });
    }
  }, [user?.role, navigate]);

  useEffect(() => {
    reqCounter.current++;
    setBookings(undefined);
    setMatches(undefined);
    if (user && user.role !== 'OWNER') {
      load();
    }
  }, [user?.id, load]);

  useEffect(() => {
    if (!user || user.role === 'OWNER') return;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        load();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user?.id, load]);

  const openCancel = (booking: MyBookingView) => {
    setCancelError('');
    setCancelTarget(booking);
  };

  const closeCancel = () => {
    setCancelTarget(null);
    setCancelError('');
  };

  const confirmCancel = async () => {
    if (!cancelTarget || cancelBusy) return;
    setCancelBusy(true);
    setCancelError('');
    try {
      await api(`/api/bookings/${cancelTarget.id}/cancel`, { method: 'POST' });
      setCancelTarget(null);
      load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setCancelTarget(null);
        setSessionLoginOpen(true);
      } else if (err instanceof ApiError) {
        setCancelError(err.message);
        if (err.status === 409) load();
      } else {
        setCancelError('Không kết nối được. Thử lại sau');
      }
    } finally {
      setCancelBusy(false);
    }
  };

  const capacityNum = openCapacity.trim() === '' ? Number.NaN : Number(openCapacity);
  const priceNum = openPrice.trim() === '' ? Number.NaN : Number(openPrice);
  const capacityValid = Number.isInteger(capacityNum) && capacityNum >= 2 && capacityNum <= 30;
  const priceValid = Number.isInteger(priceNum) && priceNum >= 0 && priceNum <= PRICE_MAX;
  const openValidationMessage = !capacityValid
    ? MATCH_CAPACITY_MESSAGE
    : !priceValid
      ? MATCH_PRICE_MESSAGE
      : '';
  const openAlert = openValidationMessage || openError;

  const openMatch = (booking: MyBookingView) => {
    openTargetId.current = booking.id;
    setOpenError('');
    setOpenCapacity('10');
    setOpenPrice('0');
    setOpenJoinMode('INSTANT');
    setOpenTarget(booking);
  };

  const closeOpenMatch = () => {
    openTargetId.current = null;
    setOpenTarget(null);
    setOpenError('');
  };

  const confirmOpenMatch = async () => {
    if (!openTarget || openBusy || openValidationMessage) return;
    const targetId = openTarget.id;
    setOpenBusy(true);
    setOpenError('');
    try {
      await api<MatchView>('/api/matches', {
        method: 'POST',
        json: {
          bookingId: targetId,
          capacity: capacityNum,
          pricePerSlot: priceNum,
          joinMode: openJoinMode,
        },
      });
      if (openTargetId.current === targetId) {
        openTargetId.current = null;
        setOpenTarget(null);
      }
      load();
    } catch (err) {
      const same = openTargetId.current === targetId;
      if (err instanceof ApiError && err.status === 401) {
        if (same) {
          openTargetId.current = null;
          setOpenTarget(null);
        }
        setSessionLoginOpen(true);
      } else if (err instanceof ApiError) {
        if (same) setOpenError(err.message);
        if (err.status === 409) load();
      } else if (same) {
        setOpenError('Không kết nối được. Thử lại sau');
      }
    } finally {
      setOpenBusy(false);
    }
  };

  return {
    tab,
    setTab,
    bookings,
    matches,
    bookingsFailed,
    joinedFailed,
    loginOpen,
    setLoginOpen,
    sessionLoginOpen,
    setSessionLoginOpen,
    cancelTarget,
    cancelBusy,
    cancelError,
    openTarget,
    openCapacity,
    setOpenCapacity,
    openPrice,
    setOpenPrice,
    openJoinMode,
    setOpenJoinMode,
    openBusy,
    setOpenError,
    openValidationMessage,
    openAlert,
    load,
    openCancel,
    closeCancel,
    confirmCancel,
    openMatch,
    closeOpenMatch,
    confirmOpenMatch,
  };
}
