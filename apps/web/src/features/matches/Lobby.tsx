import type { SessionUser } from '@monsport/shared';
import { Plus } from 'lucide-react';
import { useCallback, useId } from 'react';
import { useInRouterContext, useNavigate, useSearchParams } from 'react-router';
import { EmptyState } from '../../components/EmptyState.tsx';
import { MatchCardContent } from '../../components/MatchCard.tsx';
import { useToast } from '../../components/Toast.tsx';
import { LobbyFilters } from './LobbyFilters.tsx';
import { formatReputation, MatchDetailPanel } from './MatchDetailPanel.tsx';
import { useLobbyMatches } from './useLobbyMatches.ts';
import { useMatchActions } from './useMatchActions.ts';
import { useMatchDetail } from './useMatchDetail.ts';

export { formatReputation };

export interface LobbyProps {
  refresh?: number;
  user?: SessionUser | null;
  onMatchChanged?: () => void;
}

interface LobbyInnerProps extends LobbyProps {
  tranParam?: string | null;
  onSelectTran?: (id: string | null) => void;
  onNavigate?: (to: string) => void;
}

function LobbyInner({
  refresh = 0,
  user,
  onMatchChanged,
  tranParam = null,
  onSelectTran,
  onNavigate,
}: LobbyInnerProps) {
  const heading = useId();
  const { comingSoon } = useToast();

  const {
    sport,
    setSport,
    level,
    setLevel,
    date,
    setDate,
    typeTab,
    setTypeTab,
    matches,
    setMatches,
    error,
    dateOptions,
    isOtherDate,
  } = useLobbyMatches({
    refresh,
    onStreamMatch: () => detailState.reloadCurrentDetail(),
  });

  const detailState = useMatchDetail({
    matches,
    user,
    tranParam,
    onSelectTran,
  });

  const { loadingAction, handleJoin, handleLeave, handleRequestDecision } = useMatchActions({
    setMatches,
    setDetail: detailState.setDetail,
    setDetailError: detailState.setDetailError,
    setRequestsState: detailState.setRequestsState,
    setActionError: detailState.setActionError,
    setBusyRequestUserIds: detailState.setBusyRequestUserIds,
    loadSeqRef: detailState.loadSeqRef,
    liveStateRef: detailState.liveStateRef,
    onMatchChanged,
  });

  function handleCreateMatch() {
    const dest = user ? '/lich-cua-toi' : '/dang-nhap';
    if (onNavigate) {
      onNavigate(dest);
    } else if (typeof window !== 'undefined') {
      window.location.assign(dest);
    }
  }

  return (
    <section className="panel lobby-panel" aria-labelledby={heading}>
      <div className="page-head">
        <div>
          <h1>Ghép trận</h1>
          <p>Chọn một trận đang mở, xem người chơi rồi vào trận.</p>
        </div>
        <button type="button" className="btn lime" onClick={handleCreateMatch}>
          <Plus size={18} className="ic" aria-hidden="true" />
          <span>Tạo trận</span>
        </button>
      </div>

      <LobbyFilters
        typeTab={typeTab}
        onTypeTabChange={setTypeTab}
        level={level}
        onLevelChange={setLevel}
        date={date}
        onDateChange={setDate}
        dateOptions={dateOptions}
        isOtherDate={isOtherDate}
        sport={sport}
        onSportChange={setSport}
        matchCount={matches ? matches.length : null}
        onComingSoon={comingSoon}
      />

      <h2 id={heading} className="sr">Phòng chờ</h2>
      <div className="lobby-split md">
        <div className="lobby-list-pane md-list">
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div role="status" className="live">
            {matches?.length === 0 && !error && <EmptyState message="Chưa có trận nào đang mở" />}
          </div>
          {matches && matches.length > 0 && (
            <ul className="tickets lobby-list">
              {matches.map((m) => {
                const isExpanded = detailState.expandedId === m.id;
                return (
                  <li
                    key={m.id}
                    className={`ticket match-ticket card mc compact ${isExpanded ? 'on active' : ''}`}
                    data-status={m.bookingStatus}
                    onClick={() => void detailState.toggleDetail(m)}
                  >
                    <MatchCardContent
                      match={m}
                      footerAction={
                        <button
                          type="button"
                          className="btn sm lime detail-toggle"
                          onClick={(e) => {
                            e.stopPropagation();
                            void detailState.toggleDetail(m);
                          }}
                        >
                          {isExpanded ? 'Đóng chi tiết' : 'Xem chi tiết'}
                        </button>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <MatchDetailPanel
          selectedMatch={detailState.selectedMatch}
          detail={detailState.detail}
          requests={detailState.requests}
          busyRequestUserIds={detailState.busyRequestUserIds}
          user={user}
          detailError={detailState.detailError}
          actionError={detailState.actionError}
          loadingAction={loadingAction}
          onClose={detailState.closeDetail}
          onJoin={(id) => void handleJoin(id)}
          onLeave={(id) => void handleLeave(id)}
          onRequestDecision={(matchId, userId, action) => void handleRequestDecision(matchId, userId, action)}
          onComingSoon={comingSoon}
        />
      </div>
    </section>
  );
}

function LobbyRouterBridge(props: LobbyProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const handleSelectTran = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (id) next.set('tran', id);
      else next.delete('tran');
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );
  return (
    <LobbyInner
      {...props}
      tranParam={searchParams.get('tran')}
      onSelectTran={handleSelectTran}
      onNavigate={(to) => navigate(to)}
    />
  );
}

export function Lobby(props: LobbyProps) {
  const inRouter = useInRouterContext();
  return inRouter ? <LobbyRouterBridge {...props} /> : <LobbyInner {...props} />;
}
