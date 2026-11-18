import type { MatchDetailView, MatchRequestView, MatchView } from '@monsport/shared';
import { errorMessage, api } from '@monsport/client';
import { type Dispatch, type MutableRefObject, type SetStateAction, useState } from 'react';
import type { LiveMatchDetailState } from './useMatchDetail.ts';

interface UseMatchActionsOptions {
  setMatches: Dispatch<SetStateAction<MatchView[] | null>>;
  setDetail: Dispatch<SetStateAction<MatchDetailView | null>>;
  setDetailError: Dispatch<SetStateAction<string>>;
  setRequestsState: Dispatch<SetStateAction<{ matchId: string | null; items: MatchRequestView[] }>>;
  setActionError: Dispatch<SetStateAction<string>>;
  setBusyRequestUserIds: Dispatch<SetStateAction<Set<string>>>;
  loadSeqRef: MutableRefObject<number>;
  liveStateRef: MutableRefObject<LiveMatchDetailState>;
  onMatchChanged?: () => void;
}

export function useMatchActions({
  setMatches,
  setDetail,
  setDetailError,
  setRequestsState,
  setActionError,
  setBusyRequestUserIds,
  loadSeqRef,
  liveStateRef,
  onMatchChanged,
}: UseMatchActionsOptions) {
  const [loadingAction, setLoadingAction] = useState(false);

  async function handleJoin(id: string) {
    setActionError('');
    setLoadingAction(true);
    try {
      const updated = await api<MatchDetailView>(`/api/matches/${id}/join`, { method: 'POST' });
      if (liveStateRef.current.expandedId === id) {
        setDetail(updated);
      }
      setMatches(
        (prev) =>
          prev?.map((m) =>
            m.id === id ? { ...m, joinedCount: updated.joinedCount, status: updated.status } : m,
          ) ?? null,
      );
      onMatchChanged?.();
    } catch (e) {
      setActionError(errorMessage(e, 'Không thể vào trận'));
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleLeave(id: string) {
    setActionError('');
    setLoadingAction(true);
    try {
      const updated = await api<MatchDetailView>(`/api/matches/${id}/leave`, { method: 'POST' });
      if (liveStateRef.current.expandedId === id) {
        setDetail(updated);
      }
      setMatches(
        (prev) =>
          prev?.map((m) =>
            m.id === id ? { ...m, joinedCount: updated.joinedCount, status: updated.status } : m,
          ) ?? null,
      );
      onMatchChanged?.();
    } catch (e) {
      setActionError(errorMessage(e, 'Không thể rời trận'));
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleRequestDecision(matchId: string, requestUserId: string, action: 'approve' | 'reject') {
    setActionError('');
    setBusyRequestUserIds((prev) => new Set(prev).add(requestUserId));
    loadSeqRef.current += 1;
    try {
      const updated = await api<MatchDetailView>(
        `/api/matches/${matchId}/requests/${requestUserId}/${action}`,
        { method: 'POST' },
      );
      setMatches(
        (prev) =>
          prev?.map((m) =>
            m.id === matchId ? { ...m, joinedCount: updated.joinedCount, status: updated.status } : m,
          ) ?? null,
      );
      if (liveStateRef.current.expandedId === matchId) {
        setDetail(updated);
        setDetailError('');
        const reloadSeq = ++loadSeqRef.current;
        try {
          const reqs = await api<MatchRequestView[]>(`/api/matches/${matchId}/requests`);
          if (reloadSeq === loadSeqRef.current && liveStateRef.current.expandedId === matchId) {
            setRequestsState({ matchId, items: reqs });
          }
        } catch {
          if (liveStateRef.current.expandedId === matchId) {
            setRequestsState((prev) => ({
              matchId,
              items: prev.matchId === matchId ? prev.items.filter((r) => r.userId !== requestUserId) : [],
            }));
          }
        }
      }
      onMatchChanged?.();
    } catch (e) {
      if (liveStateRef.current.expandedId === matchId) {
        setActionError(errorMessage(e, 'Không thể xử lý yêu cầu'));
      }
    } finally {
      setBusyRequestUserIds((prev) => {
        const next = new Set(prev);
        next.delete(requestUserId);
        return next;
      });
    }
  }

  return {
    loadingAction,
    handleJoin,
    handleLeave,
    handleRequestDecision,
  };
}
