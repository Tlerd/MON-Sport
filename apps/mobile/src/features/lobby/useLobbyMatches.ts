import { api, ApiError } from '@monsport/client';
import type { MatchView, SessionUser, Sport } from '@monsport/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLatest } from '../../hooks/useLatest.ts';

export function useLobbyMatches(user: SessionUser | null | undefined) {
  const [sport, setSport] = useState<Sport | undefined>(undefined);
  const [date, setDate] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<MatchView[] | undefined>(undefined);
  const [joinedRows, setJoinedRows] = useState<MatchView[]>([]);
  const [failed, setFailed] = useState(false);
  const [joinedFailed, setJoinedFailed] = useState(false);
  const [sessionLoginOpen, setSessionLoginOpen] = useState(false);
  const [loginTick, setLoginTick] = useState(0);

  const userId = user?.id;
  const role = user?.role;
  const isPlayer = role === 'USER';
  const sessionKnown = user !== undefined;

  const reqCounter = useRef(0);
  const inFlight = useRef(false);
  const pending = useRef(false);
  const expiredShown = useRef(false);
  const fetchedSinceExpiry = useRef(false);
  const roleRef = useLatest(role);

  const openSessionLogin = useCallback(() => {
    if (!expiredShown.current) {
      expiredShown.current = true;
      fetchedSinceExpiry.current = false;
      setSessionLoginOpen(true);
    }
  }, []);

  const closeSessionLogin = useCallback(() => {
    expiredShown.current = false;
    setSessionLoginOpen(false);
  }, []);

  const onSessionLoggedIn = useCallback(() => {
    setSessionLoginOpen(false);
    setLoginTick((t) => t + 1);
  }, []);

  const fetchAll = useCallback(() => {
    const reqId = ++reqCounter.current;
    inFlight.current = true;
    pending.current = false;
    setFailed(false);
    const params = new URLSearchParams();
    if (sport) params.set('sport', sport);
    if (date) params.set('date', date);
    const qs = params.toString();
    const feed = api<MatchView[]>('/api/matches' + (qs ? `?${qs}` : ''));
    const joined = isPlayer
      ? api<MatchView[]>('/api/matches/joined').then(
          (list) => ({ list }),
          (error: unknown) => ({ error }),
        )
      : Promise.resolve({ list: [] as MatchView[] });
    const finish = () => {
      inFlight.current = false;
      if (pending.current) {
        pending.current = false;
        fetchRef.current();
      }
    };
    Promise.all([feed.then((list) => ({ list }), () => null), joined]).then(([f, j]) => {
      if (reqId !== reqCounter.current) return;
      if (!f) {
        setFailed(true);
        finish();
        return;
      }
      setRows(f.list);
      if ('list' in j) {
        setJoinedRows(j.list);
        setJoinedFailed(false);
      } else {
        setJoinedRows([]);
        if (j.error instanceof ApiError && j.error.status === 401) {
          setJoinedFailed(false);
          openSessionLogin();
        } else {
          setJoinedFailed(true);
        }
      }
      finish();
    });
  }, [sport, date, isPlayer, openSessionLogin]);

  const fetchRef = useRef(fetchAll);
  useLayoutEffect(() => {
    fetchRef.current = fetchAll;
  });

  const reload = useCallback(() => {
    if (inFlight.current) {
      pending.current = true;
      return;
    }
    fetchRef.current();
  }, []);

  const retryJoined = useCallback(() => {
    if (roleRef.current !== 'USER') return;
    const reqId = reqCounter.current;
    setJoinedFailed(false);
    api<MatchView[]>('/api/matches/joined').then(
      (list) => {
        if (reqId !== reqCounter.current) return;
        setJoinedRows(list);
      },
      (error: unknown) => {
        if (reqId !== reqCounter.current) return;
        if (error instanceof ApiError && error.status === 401) {
          openSessionLogin();
        } else setJoinedFailed(true);
      },
    );
  }, [openSessionLogin]);

  useEffect(() => {
    reqCounter.current++;
    inFlight.current = false;
    pending.current = false;
    expiredShown.current = false;
    setRows(undefined);
    setJoinedRows([]);
    setJoinedFailed(false);
  }, [userId]);

  useEffect(() => {
    if (!sessionKnown) return;
    fetchedSinceExpiry.current = true;
    fetchAll();
  }, [userId, sessionKnown, fetchAll]);

  useEffect(() => {
    if (loginTick === 0) return;
    expiredShown.current = false;
    if (fetchedSinceExpiry.current) {
      fetchedSinceExpiry.current = false;
      return;
    }
    fetchRef.current();
  }, [loginTick]);

  return {
    sport,
    setSport,
    date,
    setDate,
    rows,
    setRows,
    joinedRows,
    setJoinedRows,
    failed,
    joinedFailed,
    sessionLoginOpen,
    openSessionLogin,
    closeSessionLogin,
    onSessionLoggedIn,
    fetchAll,
    reload,
    retryJoined,
  };
}
