import { ApiError, errorMessage, api } from '@monsport/client';
import type { MatchDetailView, MatchView, SessionUser } from '@monsport/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { REQUEST_REJECTED_TEXT } from './LobbyMatchCard.tsx';

export interface UseMatchActionsOptions {
  user: SessionUser | null | undefined;
  setRows: Dispatch<SetStateAction<MatchView[] | undefined>>;
  setJoinedRows: Dispatch<SetStateAction<MatchView[]>>;
  reload: () => void;
  openSessionLogin: () => void;
  detailTargetIdRef: RefObject<string | null>;
  closeDetail: () => void;
  setDetail: Dispatch<SetStateAction<MatchDetailView | null>>;
  setDetailError: Dispatch<SetStateAction<string>>;
  applyRequest: (id: string, myRequest: 'PENDING' | 'REJECTED' | null | undefined) => void;
  refreshRequest: (id: string) => Promise<void>;
  openDetail: (match: MatchView) => void;
}

export function useMatchActions(opts: UseMatchActionsOptions) {
  const {
    user,
    setRows,
    setJoinedRows,
    reload,
    openSessionLogin,
    detailTargetIdRef,
    closeDetail,
    setDetail,
    setDetailError,
    applyRequest,
    refreshRequest,
    openDetail,
  } = opts;
  const [joiningIds, setJoiningIds] = useState<Record<string, boolean>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [guestLoginOpen, setGuestLoginOpen] = useState(false);
  const [guestLoginTick, setGuestLoginTick] = useState(0);
  const [playerSheetOpen, setPlayerSheetOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<MatchView | null>(null);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [cancelTarget, setCancelTarget] = useState<MatchView | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const userId = user?.id;
  const role = user?.role;
  const pendingJoinRef = useRef<string | null>(null);
  const roleRef = useRef(role);
  const userIdRef = useRef(userId);
  const leaveTargetIdRef = useRef<string | null>(null);
  const cancelTargetIdRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    roleRef.current = role;
    userIdRef.current = userId;
    leaveTargetIdRef.current = leaveTarget?.id ?? null;
    cancelTargetIdRef.current = cancelTarget?.id ?? null;
  });

  useEffect(() => {
    setCardErrors({});
    setLeaveTarget(null);
    setLeaveError('');
    setCancelTarget(null);
    setCancelError('');
  }, [userId]);

  const clearJoining = useCallback((id: string) => {
    setJoiningIds((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const joinMatch = useCallback(
    async (id: string) => {
      const startUserId = userIdRef.current;
      setJoiningIds((prev) => ({ ...prev, [id]: true }));
      setCardErrors({});
      if (detailTargetIdRef.current === id) setDetailError('');
      try {
        const res = await api<MatchDetailView>(`/api/matches/${id}/join`, { method: 'POST' });
        if (userIdRef.current !== startUserId) return;
        if (res && typeof res === 'object' && 'id' in res) {
          applyRequest(res.id, res.myRequest);
          if (res.myRequest !== 'PENDING') {
            setJoinedRows((prev) => [...prev.filter((m) => m.id !== res.id), res]);
          }
          setRows((prev) => prev?.map((m) => (m.id === res.id ? res : m)));
          setDetail((prev) => (prev && prev.id === res.id ? res : prev));
        }
        reload();
      } catch (err) {
        if (userIdRef.current !== startUserId) return;
        if (err instanceof ApiError && err.status === 401) {
          if (detailTargetIdRef.current === id) closeDetail();
          openSessionLogin();
        } else if (err instanceof ApiError) {
          setCardErrors((prev) => ({ ...prev, [id]: err.message }));
          if (detailTargetIdRef.current === id) setDetailError(err.message);
          if (err.status === 409 && err.message === REQUEST_REJECTED_TEXT) applyRequest(id, 'REJECTED');
          if (err.status === 409) reload();
        } else {
          const msg = 'Không kết nối được. Thử lại sau';
          setCardErrors((prev) => ({ ...prev, [id]: msg }));
          if (detailTargetIdRef.current === id) setDetailError(msg);
        }
      } finally {
        clearJoining(id);
      }
    },
    [reload, closeDetail, openSessionLogin, applyRequest, detailTargetIdRef, setDetailError, setJoinedRows, setRows, setDetail, clearJoining],
  );

  const cancelRequest = useCallback(
    async (id: string) => {
      const startUserId = userIdRef.current;
      setJoiningIds((prev) => ({ ...prev, [id]: true }));
      setCardErrors({});
      if (detailTargetIdRef.current === id) setDetailError('');
      try {
        await api(`/api/matches/${id}/leave`, { method: 'POST' });
        if (userIdRef.current !== startUserId) return;
        applyRequest(id, null);
        setDetail((prev) => (prev && prev.id === id ? { ...prev, myRequest: null } : prev));
        reload();
      } catch (err) {
        if (userIdRef.current !== startUserId) return;
        if (err instanceof ApiError && err.status === 401) {
          if (detailTargetIdRef.current === id) closeDetail();
          openSessionLogin();
        } else {
          const msg = errorMessage(err, 'Không kết nối được. Thử lại sau');
          setCardErrors((prev) => ({ ...prev, [id]: msg }));
          if (detailTargetIdRef.current === id) setDetailError(msg);
          if (err instanceof ApiError && err.status === 409) {
            void refreshRequest(id);
            reload();
          }
        }
      } finally {
        clearJoining(id);
      }
    },
    [reload, closeDetail, openSessionLogin, applyRequest, refreshRequest, detailTargetIdRef, setDetail, setDetailError, clearJoining],
  );

  useEffect(() => {
    if (guestLoginTick === 0) return;
    const id = pendingJoinRef.current;
    pendingJoinRef.current = null;
    if (!id) return;
    if (roleRef.current === 'OWNER' || roleRef.current === 'ADMIN') {
      setPlayerSheetOpen(true);
      return;
    }
    void joinMatch(id);
  }, [guestLoginTick, joinMatch]);

  const handleOpen = (match: MatchView) => {
    setCardErrors({});
    if (role === 'OWNER' || role === 'ADMIN') {
      setPlayerSheetOpen(true);
      return;
    }
    openDetail(match);
  };

  const handleJoin = (match: MatchView) => {
    if (user === null) {
      pendingJoinRef.current = match.id;
      setGuestLoginOpen(true);
      return;
    }
    if (role === 'OWNER' || role === 'ADMIN') {
      setPlayerSheetOpen(true);
      return;
    }
    if (!joiningIds[match.id]) void joinMatch(match.id);
  };

  const openGuestLoginFromDetail = () => {
    closeDetail();
    pendingJoinRef.current = null;
    setGuestLoginOpen(true);
  };

  const onGuestLoggedIn = () => {
    setGuestLoginOpen(false);
    setGuestLoginTick((t) => t + 1);
  };

  const openLeave = (match: MatchView) => {
    setCardErrors({});
    setLeaveError('');
    setLeaveTarget(match);
  };

  const closeLeave = () => {
    setLeaveTarget(null);
    setLeaveError('');
  };

  const confirmLeave = async () => {
    if (!leaveTarget || leaveBusy) return;
    const target = leaveTarget;
    const startUserId = userIdRef.current;
    setLeaveBusy(true);
    setLeaveError('');
    try {
      const res = await api<MatchDetailView>(`/api/matches/${target.id}/leave`, { method: 'POST' });
      if (userIdRef.current !== startUserId) return;
      const hasRes = Boolean(res && typeof res === 'object' && 'id' in res);
      const updated: MatchView = hasRes ? res : { ...target, status: 'OPEN', joinedCount: Math.max(0, target.joinedCount - 1) };
      setJoinedRows((prev) => prev.filter((m) => m.id !== target.id));
      applyRequest(target.id, hasRes ? (res.myRequest ?? null) : null);
      setRows((prev) => {
        if (!prev) return [updated];
        return prev.some((m) => m.id === target.id) ? prev.map((m) => (m.id === target.id ? updated : m)) : [...prev, updated];
      });
      if (leaveTargetIdRef.current === target.id) setLeaveTarget(null);
      if (detailTargetIdRef.current === target.id) closeDetail();
      reload();
    } catch (err) {
      if (userIdRef.current !== startUserId) return;
      const sameLeave = leaveTargetIdRef.current === target.id;
      if (err instanceof ApiError && err.status === 401) {
        if (sameLeave) setLeaveTarget(null);
        if (detailTargetIdRef.current === target.id) closeDetail();
        openSessionLogin();
      } else if (err instanceof ApiError) {
        if (sameLeave) setLeaveError(err.message);
        if (err.status === 409) reload();
      } else if (sameLeave) {
        setLeaveError('Không kết nối được. Thử lại sau');
      }
    } finally {
      setLeaveBusy(false);
    }
  };

  const openCancel = (match: MatchView) => {
    setCardErrors({});
    setCancelError('');
    setCancelTarget(match);
  };

  const closeCancel = () => {
    setCancelTarget(null);
    setCancelError('');
  };

  const confirmCancel = async () => {
    if (!cancelTarget || cancelBusy) return;
    const target = cancelTarget;
    const startUserId = userIdRef.current;
    setCancelBusy(true);
    setCancelError('');
    try {
      await api(`/api/matches/${target.id}/cancel`, { method: 'POST' });
      if (userIdRef.current !== startUserId) return;
      setRows((prev) => prev?.filter((m) => m.id !== target.id));
      setJoinedRows((prev) => prev.filter((m) => m.id !== target.id));
      if (cancelTargetIdRef.current === target.id) setCancelTarget(null);
      if (detailTargetIdRef.current === target.id) closeDetail();
      reload();
    } catch (err) {
      if (userIdRef.current !== startUserId) return;
      const sameCancel = cancelTargetIdRef.current === target.id;
      if (err instanceof ApiError && err.status === 401) {
        if (sameCancel) setCancelTarget(null);
        if (detailTargetIdRef.current === target.id) closeDetail();
        openSessionLogin();
      } else if (err instanceof ApiError) {
        if (sameCancel) setCancelError(err.message);
        if (err.status === 409) reload();
      } else if (sameCancel) {
        setCancelError('Không kết nối được. Thử lại sau');
      }
    } finally {
      setCancelBusy(false);
    }
  };

  return {
    joiningIds, cardErrors, setCardErrors, guestLoginOpen, setGuestLoginOpen,
    onGuestLoggedIn, openGuestLoginFromDetail, playerSheetOpen, setPlayerSheetOpen,
    leaveTarget, leaveBusy, leaveError, cancelTarget, cancelBusy, cancelError,
    cancelRequest, handleOpen, handleJoin, openLeave, closeLeave, confirmLeave,
    openCancel, closeCancel, confirmCancel,
  };
}
