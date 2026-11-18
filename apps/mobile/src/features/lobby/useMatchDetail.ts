import { ApiError, errorMessage, api } from '@monsport/client';
import type { MatchDetailView, MatchRequestView, MatchView, SessionUser } from '@monsport/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface UseMatchDetailOptions {
  user: SessionUser | null | undefined;
  joinedRows: MatchView[];
  reload: () => void;
  openSessionLogin: () => void;
}

export function useMatchDetail({ user, joinedRows, reload, openSessionLogin }: UseMatchDetailOptions) {
  const [requests, setRequests] = useState<Record<string, 'PENDING' | 'REJECTED'>>({});
  const [detailTarget, setDetailTarget] = useState<MatchView | null>(null);
  const [detail, setDetail] = useState<MatchDetailView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [queue, setQueue] = useState<MatchRequestView[] | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const busyRef = useRef<Set<string>>(new Set());

  const userId = user?.id;
  const role = user?.role;

  const detailReqCounter = useRef(0);
  const requestReqCounters = useRef<Record<string, number>>({});
  const roleRef = useRef(role);
  const userIdRef = useRef(userId);
  const detailTargetIdRef = useRef<string | null>(null);
  const detailRef = useRef<MatchDetailView | null>(null);
  const requestsRef = useRef<Record<string, 'PENDING' | 'REJECTED'>>({});

  useLayoutEffect(() => {
    detailRef.current = detail;
    requestsRef.current = requests;
    roleRef.current = role;
    userIdRef.current = userId;
    detailTargetIdRef.current = detailTarget?.id ?? null;
  });

  const closeDetail = useCallback(() => {
    detailReqCounter.current++;
    setQueue(null);
    setDetailTarget(null);
    setDetail(null);
    setDetailError('');
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    detailReqCounter.current++;
    setRequests({});
    setDetailTarget(null);
    setDetail(null);
    setQueue(null);
    busyRef.current = new Set();
    setBusyIds(new Set());
    setDetailError('');
    setDetailLoading(false);
  }, [userId]);

  const applyRequest = useCallback((id: string, myRequest: 'PENDING' | 'REJECTED' | null | undefined) => {
    requestReqCounters.current[id] = (requestReqCounters.current[id] ?? 0) + 1;
    setRequests((prev) => {
      const next = { ...prev };
      if (myRequest === 'PENDING' || myRequest === 'REJECTED') next[id] = myRequest;
      else delete next[id];
      return next;
    });
  }, []);

  const refreshRequest = useCallback(
    async (id: string) => {
      const startUserId = userIdRef.current;
      const reqNo = (requestReqCounters.current[id] = (requestReqCounters.current[id] ?? 0) + 1);
      try {
        const d = await api<MatchDetailView>(`/api/matches/${id}`);
        if (userIdRef.current !== startUserId) return;
        if (requestReqCounters.current[id] !== reqNo) return;
        applyRequest(d.id, d.myRequest);
      } catch {
        return;
      }
    },
    [applyRequest],
  );

  useEffect(() => {
    const ids = new Set(joinedRows.map((m) => m.id));
    setRequests((prev) => {
      const stale = Object.keys(prev).filter((id) => ids.has(id));
      if (stale.length === 0) return prev;
      const next = { ...prev };
      for (const id of stale) delete next[id];
      return next;
    });
  }, [joinedRows]);

  const loadDetail = useCallback(
    async (id: string, approvalHint: boolean, initial: boolean) => {
      const reqId = ++detailReqCounter.current;
      const live = () => reqId === detailReqCounter.current;
      const startReqNo = requestReqCounters.current[id] ?? 0;
      try {
        const d = await api<MatchDetailView>(`/api/matches/${id}`);
        if (!live()) return;
        if ((requestReqCounters.current[id] ?? 0) !== startReqNo) {
          void loadDetail(id, approvalHint, initial);
          return;
        }
        setDetail(d);
        applyRequest(d.id, d.myRequest);
        if (d.viewerRole === 'HOST' && (d.joinMode === 'APPROVAL' || approvalHint)) {
          const list = await api<MatchRequestView[]>(`/api/matches/${id}/requests`);
          if (!live()) return;
          setQueue(list);
        } else {
          setQueue(null);
        }
        setDetailLoading(false);
      } catch (err) {
        if (!live()) return;
        setDetailLoading(false);
        if (err instanceof ApiError && err.status === 401) {
          closeDetail();
          openSessionLogin();
        } else if (initial) {
          setDetailError(errorMessage(err, 'Không tải được'));
        }
      }
    },
    [applyRequest, closeDetail, openSessionLogin],
  );

  const decide = useCallback(
    async (matchId: string, requestUserId: string, action: 'approve' | 'reject') => {
      if (busyRef.current.has(requestUserId)) return;
      const startUserId = userIdRef.current;
      busyRef.current.add(requestUserId);
      setBusyIds(new Set(busyRef.current));
      setDetailError('');
      detailReqCounter.current++;
      try {
        await api(`/api/matches/${matchId}/requests/${requestUserId}/${action}`, { method: 'POST' });
        if (userIdRef.current !== startUserId) return;
        if (detailTargetIdRef.current === matchId) {
          setQueue((prev) => prev?.filter((r) => r.userId !== requestUserId) ?? prev);
          void loadDetail(matchId, true, false);
        }
        reload();
      } catch (err) {
        if (userIdRef.current !== startUserId) return;
        if (err instanceof ApiError && err.status === 401) {
          if (detailTargetIdRef.current === matchId) closeDetail();
          openSessionLogin();
        } else if (detailTargetIdRef.current === matchId) {
          setDetailError(errorMessage(err, 'Không kết nối được. Thử lại sau'));
          if (err instanceof ApiError && err.status === 409) {
            void loadDetail(matchId, true, false);
            reload();
          }
        }
      } finally {
        busyRef.current.delete(requestUserId);
        setBusyIds(new Set(busyRef.current));
      }
    },
    [loadDetail, reload, closeDetail, openSessionLogin],
  );

  const onStreamChange = useCallback(() => {
    reload();
    const id = detailTargetIdRef.current;
    const signedIn = roleRef.current !== undefined && Boolean(userIdRef.current);
    if (id && signedIn) void loadDetail(id, true, detailRef.current === null);
    if (signedIn) {
      for (const [pendingId, state] of Object.entries(requestsRef.current)) {
        if (state === 'PENDING' && pendingId !== id) void refreshRequest(pendingId);
      }
    }
  }, [reload, loadDetail, refreshRequest]);

  const openDetail = useCallback(
    (match: MatchView) => {
      if (user === null) {
        detailReqCounter.current++;
        setDetailTarget(match);
        setDetail(null);
        setDetailError('');
        setDetailLoading(false);
        return;
      }
      setDetailTarget(match);
      setDetail(null);
      setQueue(null);
      setBusyIds(new Set());
      busyRef.current = new Set();
      setDetailError('');
      setDetailLoading(true);
      void loadDetail(match.id, match.joinMode === 'APPROVAL', true);
    },
    [user, loadDetail],
  );

  return {
    requests,
    detailTarget,
    detailTargetIdRef,
    detail,
    setDetail,
    detailLoading,
    detailError,
    setDetailError,
    queue,
    busyIds,
    closeDetail,
    openDetail,
    applyRequest,
    refreshRequest,
    decide,
    onStreamChange,
  };
}
