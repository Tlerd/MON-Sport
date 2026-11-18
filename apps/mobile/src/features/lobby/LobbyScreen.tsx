import { lobbyChips, lobbyMatches } from '@monsport/client';
import { useNavigate } from 'react-router';
import { useSession } from '../../app/session.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { LobbyFilters } from './LobbyFilters.tsx';
import { LobbyMatchCard } from './LobbyMatchCard.tsx';
import { MatchActionSheets } from './MatchActionSheets.tsx';
import { MatchDetailSheet } from './MatchDetailSheet.tsx';
import { useLobbyMatches } from './useLobbyMatches.ts';
import { useLobbyStream } from './useLobbyStream.ts';
import { useMatchActions } from './useMatchActions.ts';
import { useMatchDetail } from './useMatchDetail.ts';

export interface LobbyScreenProps {
  now?: Date;
}

export function LobbyScreen({ now: nowProp }: LobbyScreenProps) {
  const navigate = useNavigate();
  const { user } = useSession();
  const now = nowProp ?? new Date();

  const userId = user?.id;
  const isPlayer = user?.role === 'USER';

  const {
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
  } = useLobbyMatches(user);

  const {
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
  } = useMatchDetail({
    user,
    joinedRows,
    reload,
    openSessionLogin,
  });

  const {
    joiningIds,
    cardErrors,
    setCardErrors,
    guestLoginOpen,
    setGuestLoginOpen,
    onGuestLoggedIn,
    openGuestLoginFromDetail,
    playerSheetOpen,
    setPlayerSheetOpen,
    leaveTarget,
    leaveBusy,
    leaveError,
    cancelTarget,
    cancelBusy,
    cancelError,
    cancelRequest,
    handleOpen,
    handleJoin,
    openLeave,
    closeLeave,
    confirmLeave,
    openCancel,
    closeCancel,
    confirmCancel,
  } = useMatchActions({
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
  });

  useLobbyStream(onStreamChange, user !== undefined);

  if (user === undefined) {
    return <EmptyState message="Đang tải" />;
  }

  const chips = lobbyChips(now);
  const joinedById = new Map(joinedRows.map((m) => [m.id, m]));
  const mergedFeed = rows?.map((m) => joinedById.get(m.id) ?? m);
  const cards = mergedFeed ? lobbyMatches(mergedFeed, joinedRows, now, { sport, date }, userId) : undefined;
  const detailOpen = detailTarget !== null && leaveTarget === null && cancelTarget === null;
  const shownMatch = detail ?? detailTarget;
  const detailApproval = (detail?.joinMode ?? detailTarget?.joinMode) === 'APPROVAL';
  const orphanError =
    !detailOpen && cards
      ? Object.entries(cardErrors).find(([id]) => !cards.some((c) => c.match.id === id))?.[1]
      : undefined;

  return (
    <div style={{ minWidth: 0 }}>
      <LobbyFilters
        sport={sport}
        date={date}
        chips={chips}
        onSportChange={(next) => {
          setCardErrors({});
          setSport(next);
        }}
        onDateChange={(next) => {
          setCardErrors({});
          setDate(next);
        }}
      />

      <div style={{ paddingTop: '61px', minWidth: 0 }}>
        {failed ? (
          <EmptyState message="Không tải được" actionLabel="Thử lại" onAction={fetchAll} />
        ) : !cards ? (
          <EmptyState message="Đang tải" />
        ) : (
          <>
            {joinedFailed && isPlayer && (
              <div
                role="status"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-sm)',
                  padding: 'var(--space-sm) var(--space-base)',
                  font: 'var(--font-meta)',
                  color: 'var(--color-ink-muted)',
                  minWidth: 0,
                }}
              >
                <span style={{ overflowWrap: 'anywhere' }}>Không tải được trận bạn đã vào</span>
                <button
                  type="button"
                  onClick={retryJoined}
                  style={{
                    minHeight: '44px',
                    minWidth: '44px',
                    padding: '0 var(--space-md)',
                    border: '1px solid var(--color-line)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-ink)',
                    font: 'var(--font-label)',
                    cursor: 'pointer',
                  }}
                >
                  Thử lại
                </button>
              </div>
            )}
            {orphanError && (
              <p
                role="alert"
                style={{
                  margin: 0,
                  padding: 'var(--space-sm) var(--space-base)',
                  font: 'var(--font-meta)',
                  color: 'var(--color-status-no)',
                }}
              >
                {orphanError}
              </p>
            )}
            {cards.length === 0 ? (
              <EmptyState message="Chưa có trận nào" actionLabel="Đặt sân" onAction={() => navigate('/')} />
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1px',
                  minWidth: 0,
                }}
              >
                {cards.map((card) => (
                  <li key={card.match.id} style={{ minWidth: 0 }}>
                    <LobbyMatchCard
                      card={card}
                      busy={Boolean(joiningIds[card.match.id])}
                      error={
                        detailOpen && detailTarget?.id === card.match.id
                          ? undefined
                          : cardErrors[card.match.id]
                      }
                      now={now}
                      onJoin={handleJoin}
                      request={requests[card.match.id]}
                      onCancelRequest={(m) => void cancelRequest(m.id)}
                      onLeave={openLeave}
                      onCancel={openCancel}
                      onOpen={handleOpen}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <MatchDetailSheet
        open={detailOpen}
        onClose={closeDetail}
        shownMatch={shownMatch}
        isGuest={user === null}
        detailLoading={detailLoading}
        detail={detail}
        detailApproval={detailApproval}
        queue={queue}
        busyIds={busyIds}
        request={detail ? requests[detail.id] : undefined}
        joining={Boolean(detail && joiningIds[detail.id])}
        detailError={detailError}
        now={now}
        onGuestLogin={openGuestLoginFromDetail}
        onDecide={(matchId, requestUserId, action) => void decide(matchId, requestUserId, action)}
        onCancelRequest={(id) => void cancelRequest(id)}
        onJoin={handleJoin}
        onOpenLeave={openLeave}
        onOpenCancel={openCancel}
      />

      <MatchActionSheets
        leaveTarget={leaveTarget}
        leaveBusy={leaveBusy}
        leaveError={leaveError}
        onCloseLeave={closeLeave}
        onConfirmLeave={() => void confirmLeave()}
        cancelTarget={cancelTarget}
        cancelBusy={cancelBusy}
        cancelError={cancelError}
        onCloseCancel={closeCancel}
        onConfirmCancel={() => void confirmCancel()}
        guestLoginOpen={guestLoginOpen}
        onCloseGuestLogin={() => setGuestLoginOpen(false)}
        onGuestLoggedIn={onGuestLoggedIn}
        sessionLoginOpen={sessionLoginOpen}
        onCloseSessionLogin={closeSessionLogin}
        onSessionLoggedIn={onSessionLoggedIn}
        playerSheetOpen={playerSheetOpen}
        onClosePlayerSheet={() => setPlayerSheetOpen(false)}
      />
    </div>
  );
}
