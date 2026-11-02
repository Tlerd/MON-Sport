import { dayHeading, formatVnd, hhmm, type LobbyCard } from '@monsport/client';
import { minuteOfDayVN, vnDateString, type MatchView } from '@monsport/shared';
import { SPORT_LABEL, SportIcon } from '../../components/SportIcon.tsx';

export interface LobbyMatchCardProps {
  card: LobbyCard;
  onJoin?: (match: MatchView) => void;
}

const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '24px',
  padding: '0 var(--space-sm)',
  borderRadius: 'var(--radius-full)',
  font: 'var(--font-label)',
} as const;

export function LobbyMatchCard({ card, onJoin }: LobbyMatchCardProps) {
  const { match, joined, isHost } = card;
  const startDate = new Date(match.startAt);
  const endDate = new Date(match.endAt);
  const dateHeading = dayHeading(vnDateString(startDate));
  const timeRange = `${hhmm(minuteOfDayVN(startDate))}–${hhmm(minuteOfDayVN(endDate))}`;
  const sportName = SPORT_LABEL[match.sport] ?? match.sport;
  const isConfirmed = match.bookingStatus === 'CONFIRMED';
  const canJoin = match.status === 'OPEN' && !joined && !isHost;

  return (
    <article
      data-match-id={match.id}
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
              Đầy
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

      {canJoin && (
        <button
          type="button"
          onClick={() => onJoin?.(match)}
          style={{
            alignSelf: 'flex-start',
            minHeight: '44px',
            minWidth: '44px',
            padding: '0 var(--space-base)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            font: 'var(--font-body-strong)',
            cursor: 'pointer',
          }}
        >
          Vào trận
        </button>
      )}
    </article>
  );
}
