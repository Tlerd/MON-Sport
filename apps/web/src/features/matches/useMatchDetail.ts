import type { JoinMode, MatchDetailView, MatchRequestView, MatchView, SessionUser } from '@monsport/shared';
import { errorMessage, api } from '@monsport/client';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface LiveMatchDetailState {
  expandedId: string | null;
  user: SessionUser | null | undefined;
  joinMode: JoinMode | undefined;
}

interface UseMatchDetailOptions {
  matches: MatchView[] | null;
  user?: SessionUser | null;
  tranParam?: string | null;
  onSelectTran?: (id: string | null) => void;
}

export function useMatchDetail({ matches, user, tranParam = null, onSelectTran }: UseMatchDetailOptions) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MatchDetailView | null>(null);
  const [requestsState, setRequestsState] = useState<{ matchId: string | null; items: MatchRequestView[] }>({
    matchId: null,
    items: [],
  });
  const [busyRequestUserIds, setBusyRequestUserIds] = useState<Set<string>>(() => new Set());
  const [detailError, setDetailError] = useState<string>('');
  const [actionError, setActionError] = useState<string>('');

  const loadSeqRef = useRef(0);
  const autoOpenedTranRef = useRef<string | null>(null);
  const prevTranParamRef = useRef<string | null>(tranParam);
  const userClosedRef = useRef(false);

  const selectedMatch = matches?.find((m) => m.id === expandedId) ?? null;
  const requests = selectedMatch && requestsState.matchId === selectedMatch.id ? requestsState.items : [];

  const liveStateRef = useRef<LiveMatchDetailState>({
    expandedId: null,
    user: null,
    joinMode: undefined,
  });
  liveStateRef.current = {
    expandedId,
    user,
    joinMode: detail?.joinMode ?? selectedMatch?.joinMode,
  };

  const loadDetail = useCallback(async (matchId: string, matchJoinMode?: JoinMode) => {
    const seq = ++loadSeqRef.current;
    try {
      const data = await api<MatchDetailView>(`/api/matches/${matchId}`);
      if (seq !== loadSeqRef.current || liveStateRef.current.expandedId !== matchId) return;
      setDetail(data);
      setDetailError('');
      if (data.viewerRole === 'HOST' && (data.joinMode === 'APPROVAL' || matchJoinMode === 'APPROVAL')) {
        const reqs = await api<MatchRequestView[]>(`/api/matches/${matchId}/requests`);
        if (seq !== loadSeqRef.current || liveStateRef.current.expandedId !== matchId) return;
        setRequestsState({ matchId, items: reqs });
      } else {
        setRequestsState({ matchId, items: [] });
      }
    } catch (e) {
      if (seq !== loadSeqRef.current || liveStateRef.current.expandedId !== matchId) return;
      setDetailError(errorMessage(e, 'Không tải được chi tiết trận'));
    }
  }, []);

  const reloadCurrentDetail = useCallback(() => {
    const { expandedId: currentId, user: currentUser, joinMode } = liveStateRef.current;
    if (currentId && currentUser) {
      void loadDetail(currentId, joinMode);
    }
  }, [loadDetail]);

  const openMatch = useCallback(
    async (m: MatchView) => {
      loadSeqRef.current += 1;
      liveStateRef.current.expandedId = m.id;
      setExpandedId(m.id);
      setDetail(null);
      setRequestsState({ matchId: null, items: [] });
      setBusyRequestUserIds(new Set());
      setDetailError('');
      setActionError('');

      if (!user) return;
      await loadDetail(m.id, m.joinMode);
    },
    [user, loadDetail],
  );

  const clearDetailState = useCallback(() => {
    loadSeqRef.current += 1;
    liveStateRef.current.expandedId = null;
    autoOpenedTranRef.current = null;
    setExpandedId(null);
    setDetail(null);
    setRequestsState({ matchId: null, items: [] });
    setBusyRequestUserIds(new Set());
    setDetailError('');
    setActionError('');
  }, []);

  const closeDetail = useCallback(() => {
    userClosedRef.current = true;
    clearDetailState();
    onSelectTran?.(null);
  }, [clearDetailState, onSelectTran]);

  useEffect(() => {
    const prevTran = prevTranParamRef.current;
    prevTranParamRef.current = tranParam;
    if (!tranParam) {
      if (prevTran !== null) {
        clearDetailState();
      }
      return;
    }
    if (!matches) return;
    if (autoOpenedTranRef.current === tranParam) return;
    const target = matches.find((m) => m.id === tranParam);
    if (target) {
      autoOpenedTranRef.current = tranParam;
      void openMatch(target);
    }
  }, [tranParam, matches, openMatch, clearDetailState]);

  useEffect(() => {
    if (tranParam || userClosedRef.current || !matches || matches.length === 0) return;
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(min-width: 720px)').matches) return;
    if (expandedId && matches.some((m) => m.id === expandedId)) return;
    void openMatch(matches[0]);
  }, [tranParam, matches, expandedId, openMatch]);

  async function toggleDetail(m: MatchView) {
    if (expandedId === m.id) {
      closeDetail();
      return;
    }
    userClosedRef.current = false;
    autoOpenedTranRef.current = m.id;
    onSelectTran?.(m.id);
    await openMatch(m);
  }

  return {
    expandedId,
    selectedMatch,
    detail,
    setDetail,
    requests,
    setRequestsState,
    busyRequestUserIds,
    setBusyRequestUserIds,
    detailError,
    setDetailError,
    actionError,
    setActionError,
    loadSeqRef,
    liveStateRef,
    reloadCurrentDetail,
    closeDetail,
    toggleDetail,
  };
}
