import { dayHeading, formatVnd, hhmm } from '@monsport/client';
import {
  minuteOfDayVN,
  SKILL_LEVEL_LABELS,
  userCancelDecision,
  vnDateString,
  type MatchDetailView,
  type MatchRequestView,
  type MatchView,
} from '@monsport/shared';
import { Sheet } from '../../components/Sheet.tsx';
import {
  CALL_OWNER_TO_CANCEL_HINT,
  REQUEST_PENDING_TEXT,
  REQUEST_REJECTED_TEXT,
} from './LobbyMatchCard.tsx';
import { RequestQueue } from './RequestQueue.tsx';

export interface MatchDetailSheetProps {
  open: boolean;
  onClose: () => void;
  shownMatch: MatchView | null;
  isGuest: boolean;
  detailLoading: boolean;
  detail: MatchDetailView | null;
  detailApproval: boolean;
  queue: MatchRequestView[] | null;
  busyIds: ReadonlySet<string>;
  request: 'PENDING' | 'REJECTED' | undefined;
  joining: boolean;
  detailError: string;
  now: Date;
  onGuestLogin: () => void;
  onDecide: (matchId: string, requestUserId: string, action: 'approve' | 'reject') => void;
  onCancelRequest: (id: string) => void;
  onJoin: (match: MatchView) => void;
  onOpenLeave: (match: MatchView) => void;
  onOpenCancel: (match: MatchView) => void;
}

const sheetBtnStyle = {
  minHeight: '44px',
  minWidth: '44px',
  padding: '0 var(--space-base)',
  borderRadius: 'var(--radius-sm)',
  font: 'var(--font-body-strong)',
  cursor: 'pointer',
} as const;

export function MatchDetailSheet({
  open,
  onClose,
  shownMatch,
  isGuest,
  detailLoading,
  detail,
  detailApproval,
  queue,
  busyIds,
  request,
  joining,
  detailError,
  now,
  onGuestLogin,
  onDecide,
  onCancelRequest,
  onJoin,
  onOpenLeave,
  onOpenCancel,
}: MatchDetailSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Chi tiết trận">
      {shownMatch && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', minWidth: 0 }}>
          <div style={{ font: 'var(--font-body-strong)', overflowWrap: 'anywhere', minWidth: 0 }}>
            {`${shownMatch.venueName} · ${shownMatch.courtName}`}
          </div>
          <div style={{ font: 'var(--font-body)', minWidth: 0 }}>
            {dayHeading(vnDateString(new Date(shownMatch.startAt)))}
          </div>
          <div className="tnum" style={{ font: 'var(--font-numeric)', color: 'var(--color-ink-muted)', minWidth: 0 }}>
            {`${hhmm(minuteOfDayVN(new Date(shownMatch.startAt)))}–${hhmm(minuteOfDayVN(new Date(shownMatch.endAt)))} · ${shownMatch.joinedCount}/${shownMatch.capacity} suất · ${formatVnd(shownMatch.pricePerSlot)}/suất`}
          </div>
          {shownMatch.hostSkillLevel && (
            <div style={{ font: 'var(--font-body)', minWidth: 0 }}>
              {`Trình độ: ${SKILL_LEVEL_LABELS[shownMatch.hostSkillLevel]}`}
            </div>
          )}
          {isGuest ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', minWidth: 0 }}>
              <p style={{ margin: 0, font: 'var(--font-body)' }}>Đăng nhập để xem người chơi</p>
              <button
                type="button"
                onClick={onGuestLogin}
                style={{
                  ...sheetBtnStyle,
                  border: 'none',
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  alignSelf: 'flex-start',
                }}
              >
                Đăng nhập
              </button>
            </div>
          ) : detailLoading ? (
            <p style={{ margin: 0, font: 'var(--font-body)', color: 'var(--color-ink-muted)' }}>Đang tải</p>
          ) : (
            detail && (
              <>
                <ul
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-xs)',
                    minWidth: 0,
                  }}
                >
                  {(detail.players ?? [])
                    .filter((p) => !('status' in p) || (p as { status?: string }).status === 'ACTIVE')
                    .map((p) => (
                      <li
                        key={p.userId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 'var(--space-sm)',
                          minWidth: 0,
                        }}
                      >
                        <span className="queue-user" style={{ font: 'var(--font-body)', overflowWrap: 'anywhere', minWidth: 0 }}>
                          {p.name}
                        </span>
                        {detail.viewerRole === 'HOST' && p.phone && (
                          <a
                            href={`tel:${p.phone}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              minHeight: '44px',
                              color: 'var(--color-primary)',
                              font: 'var(--font-body-strong)',
                            }}
                          >
                            {p.phone}
                          </a>
                        )}
                      </li>
                    ))}
                </ul>
                {detail.viewerRole === 'HOST' && detailApproval && queue && (
                  <RequestQueue matchId={detail.id} queue={queue} busyIds={busyIds} onDecide={onDecide} />
                )}
                {detailApproval && detail.viewerRole === 'NONE' && request === 'PENDING' && (
                  <>
                    <p role="status" style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-ink-muted)' }}>
                      {REQUEST_PENDING_TEXT}
                    </p>
                    <button
                      type="button"
                      disabled={joining}
                      onClick={() => onCancelRequest(detail.id)}
                      style={{
                        ...sheetBtnStyle,
                        border: '1px solid var(--color-line)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-ink)',
                        alignSelf: 'flex-start',
                        cursor: joining ? 'not-allowed' : 'pointer',
                        opacity: joining ? 0.6 : 1,
                      }}
                    >
                      Hủy yêu cầu
                    </button>
                  </>
                )}
                {detailApproval &&
                  detail.viewerRole === 'NONE' &&
                  request === 'REJECTED' &&
                  detailError !== REQUEST_REJECTED_TEXT && (
                    <p role="status" style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }}>
                      {REQUEST_REJECTED_TEXT}
                    </p>
                  )}
                {detail.viewerRole === 'NONE' &&
                  (detailApproval ? detail.status !== 'CANCELLED' : detail.status === 'OPEN') &&
                  !(detailApproval && request) && (
                    <button
                      type="button"
                      disabled={joining}
                      onClick={() => onJoin(detail)}
                      style={{
                        ...sheetBtnStyle,
                        border: 'none',
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-on-primary)',
                        alignSelf: 'flex-start',
                        cursor: joining ? 'not-allowed' : 'pointer',
                        opacity: joining ? 0.6 : 1,
                      }}
                    >
                      {detailApproval ? 'Xin vào' : 'Vào trận'}
                    </button>
                  )}
                {detail.viewerRole === 'PLAYER' && Date.parse(detail.startAt) > now.getTime() && (
                  <button
                    type="button"
                    onClick={() => onOpenLeave(detail)}
                    style={{
                      ...sheetBtnStyle,
                      border: '1px solid var(--color-line)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-ink)',
                      alignSelf: 'flex-start',
                    }}
                  >
                    Rời trận
                  </button>
                )}
                {detail.viewerRole === 'HOST' &&
                  userCancelDecision(
                    { status: detail.bookingStatus, startAt: new Date(detail.startAt) },
                    now,
                  ) === 'CALL_OWNER' && (
                    <p style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-ink-muted)' }}>
                      {CALL_OWNER_TO_CANCEL_HINT}
                    </p>
                  )}
                {detail.viewerRole === 'HOST' &&
                  userCancelDecision(
                    { status: detail.bookingStatus, startAt: new Date(detail.startAt) },
                    now,
                  ) === 'ALLOW' && (
                    <button
                      type="button"
                      onClick={() => onOpenCancel(detail)}
                      style={{
                        ...sheetBtnStyle,
                        border: '1px solid var(--color-line)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-ink)',
                        alignSelf: 'flex-start',
                      }}
                    >
                      Hủy trận
                    </button>
                  )}
              </>
            )
          )}
          {detailError && (
            <p role="alert" style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }}>
              {detailError}
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
