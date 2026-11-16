import { CheckCircle2, Clock, Users } from 'lucide-react';
import { dayHeading, formatVnd, hhmm, type LobbyCard } from '@monsport/client';
import { minuteOfDayVN, userCancelDecision, vnDateString, type MatchView } from '@monsport/shared';
import { SPORT_LABEL, SportIcon } from '../../components/SportIcon.tsx';

export interface LobbyMatchCardProps {
  card: LobbyCard;
  onJoin?: (match: MatchView) => void;
  /** A tap on the card body. */
  onOpen?: (match: MatchView) => void;
  onLeave?: (match: MatchView) => void;
  onCancel?: (match: MatchView) => void;
  /** Cancel the pending request of the viewer: the same call as a leave (BR-50). */
  onCancelRequest?: (match: MatchView) => void;
  /** The request of the viewer on a "Host duyệt" match, when the detail told it. */
  request?: 'PENDING' | 'REJECTED';
  /** The join request runs: the join button is disabled. */
  busy?: boolean;
  /** The error message of the last action on this card. */
  error?: string;
  /** For the cancel rule of the host (BR-11). Tests pass a fixed value. */
  now?: Date;
}

const actionStyle = {
  minHeight: '44px',
  minWidth: '44px',
  padding: '0 var(--space-base)',
  borderRadius: 'var(--radius-sm)',
  font: 'var(--font-body-strong)',
} as const;
const primaryStyle = {
  border: 'none',
  backgroundColor: 'var(--color-primary)',
  color: 'var(--color-on-primary)',
} as const;
const secondaryStyle = {
  border: '1px solid var(--color-line)',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-ink)',
} as const;

const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-xs)',
  minHeight: '24px',
  padding: '0 var(--space-sm)',
  borderRadius: 'var(--radius-full)',
  font: 'var(--font-label)',
} as const;

/** The text for a host who cannot cancel any more: the server answers 409 (BR-11). */
export const CALL_OWNER_TO_CANCEL_HINT =
  'Còn dưới 6 giờ nữa tới giờ bắt đầu. Gọi chủ sân ở tab Lịch của tôi để hủy trận.';

/** Texts of a request on a "Host duyệt" match (BR-50, BR-51). */
export const REQUEST_PENDING_TEXT = 'Đã gửi yêu cầu. Chờ host duyệt';
export const REQUEST_REJECTED_TEXT = 'Host đã từ chối yêu cầu của bạn';

export function LobbyMatchCard({
  card,
  onJoin,
  onOpen,
  onLeave,
  onCancel,
  onCancelRequest,
  request,
  busy,
  error,
  now = new Date(),
}: LobbyMatchCardProps) {
  const { match, joined, isHost } = card;
  // A missing joinMode is INSTANT: the field is optional in the contract.
  const approval = match.joinMode === 'APPROVAL';
  const asking = approval && !joined && !isHost;
  const requestPending = asking && request === 'PENDING';
  const requestRejected = asking && request === 'REJECTED';
  // A FULL "Host duyệt" match takes requests too: the host approves when a slot frees (BR-52).
  const canJoin = (approval ? match.status !== 'CANCELLED' : match.status === 'OPEN') && !joined && !isHost;
  const canAsk = canJoin && !requestPending && !requestRejected;
  const startDate = new Date(match.startAt);
  const endDate = new Date(match.endAt);
  const dateHeading = dayHeading(vnDateString(startDate));
  const timeRange = `${hhmm(minuteOfDayVN(startDate))}–${hhmm(minuteOfDayVN(endDate))}`;
  const sportName = SPORT_LABEL[match.sport] ?? match.sport;
  const isConfirmed = match.bookingStatus === 'CONFIRMED';
  // The feed keeps only future matches, so a joined non-host card can leave (BR-18).
  const canLeave = joined && !isHost;
  const cancelDecision = isHost
    ? userCancelDecision({ status: match.bookingStatus, startAt: startDate }, now)
    : 'NONE';

  return (
    <article
      data-match-id={match.id}
      onClick={() => onOpen?.(match)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-xs)',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        padding: 'var(--space-md) var(--space-base)',
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-line)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 'var(--space-sm)',
          minWidth: 0,
        }}
      >
        <span style={{ font: 'var(--font-headline-mobile)', overflowWrap: 'anywhere', minWidth: 0 }}>
          {match.venueName}
        </span>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 'var(--space-xs)',
          }}
        >
          {match.status === 'FULL' && (
            <span
              className="badge badge-off"
              style={{
                ...badgeStyle,
                color: 'var(--color-status-off)',
                backgroundColor: 'var(--color-status-off-bg)',
              }}
            >
              <Users size={12} aria-hidden="true" />
              Đầy
            </span>
          )}
          {approval && (
            <span
              style={{ ...badgeStyle, color: 'var(--color-ink)', backgroundColor: 'var(--color-line)' }}
            >
              Host duyệt
            </span>
          )}
          <span
            className={`badge ${isConfirmed ? 'badge-ok' : 'badge-wait'}`}
            style={{
              ...badgeStyle,
              color: isConfirmed ? 'var(--color-status-ok)' : 'var(--color-status-wait)',
              backgroundColor: isConfirmed ? 'var(--color-status-ok-bg)' : 'var(--color-status-wait-bg)',
            }}
          >
            {isConfirmed ? (
              <CheckCircle2 size={12} aria-hidden="true" />
            ) : (
              <Clock size={12} aria-hidden="true" />
            )}
            {isConfirmed ? 'Đã xác nhận' : 'Chưa xác nhận'}
          </span>
        </div>
      </div>

      <div style={{ font: 'var(--font-body)', color: 'var(--color-ink)', overflowWrap: 'anywhere', minWidth: 0 }}>
        <span>{match.courtName}</span> · <span>{dateHeading}</span>
      </div>

      <div
        className="tnum"
        style={{
          font: 'var(--font-numeric)',
          color: 'var(--color-ink-muted)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          minWidth: 0,
        }}
      >
        <span>{timeRange}</span> · <span>{`${match.joinedCount}/${match.capacity} suất`}</span> ·{' '}
        <span>{`${formatVnd(match.pricePerSlot)}/suất`}</span>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          font: 'var(--font-meta)',
          color: 'var(--color-ink-muted)',
          overflowWrap: 'anywhere',
          minWidth: 0,
        }}
      >
        <SportIcon sport={match.sport} size={14} />
        <span>{sportName}</span>
        <span>·</span>
        <span>Host: {match.hostName}</span>
        {isHost && (
          <span
            style={{ ...badgeStyle, color: 'var(--color-ink)', backgroundColor: 'var(--color-line)' }}
          >
            Bạn là host
          </span>
        )}
        {joined && !isHost && (
          <span
            style={{ ...badgeStyle, color: 'var(--color-ink)', backgroundColor: 'var(--color-line)' }}
          >
            Bạn đã vào
          </span>
        )}
      </div>

      {requestPending && (
        <p role="status" style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-ink-muted)' }}>
          {REQUEST_PENDING_TEXT}
        </p>
      )}
      {requestRejected && error !== REQUEST_REJECTED_TEXT && (
        <p role="status" style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }}>
          {REQUEST_REJECTED_TEXT}
        </p>
      )}

      {error && (
        <p
          role="alert"
          style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }}
        >
          {error}
        </p>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          minWidth: 0,
        }}
      >
        {canAsk && (
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onJoin?.(match);
            }}
            style={{
              ...actionStyle,
              ...primaryStyle,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {approval ? 'Xin vào' : 'Vào trận'}
          </button>
        )}
        {requestPending && (
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onCancelRequest?.(match);
            }}
            style={{
              ...actionStyle,
              ...secondaryStyle,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            Hủy yêu cầu
          </button>
        )}
        {canLeave && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onLeave?.(match);
            }}
            style={{
              ...actionStyle,
              ...secondaryStyle,
              cursor: 'pointer',
            }}
          >
            Rời trận
          </button>
        )}
        {cancelDecision === 'ALLOW' && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCancel?.(match);
            }}
            style={{
              ...actionStyle,
              ...secondaryStyle,
              cursor: 'pointer',
            }}
          >
            Hủy trận
          </button>
        )}
        <button
          type="button"
          aria-label={`Chi tiết ${match.venueName} ${timeRange}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpen?.(match);
          }}
          style={{
            minHeight: '44px',
            minWidth: '44px',
            padding: '0 var(--space-sm)',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-primary)',
            font: 'var(--font-body-strong)',
            cursor: 'pointer',
          }}
        >
          Chi tiết
        </button>
      </div>
      {cancelDecision === 'CALL_OWNER' && (
        <div style={{ font: 'var(--font-meta)', color: 'var(--color-ink-muted)', overflowWrap: 'anywhere' }}>
          {CALL_OWNER_TO_CANCEL_HINT}
        </div>
      )}
    </article>
  );
}
