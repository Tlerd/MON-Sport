import { dayHeading, hhmm } from '@monsport/client';
import { minuteOfDayVN, vnDateString, type MatchView } from '@monsport/shared';
import { SPORT_LABEL, SportIcon } from '../../components/SportIcon.tsx';

export interface MatchCardProps {
  match: MatchView;
}

export function MatchCard({ match }: MatchCardProps) {
  const startDate = new Date(match.startAt);
  const endDate = new Date(match.endAt);
  const dateHeading = dayHeading(vnDateString(startDate));
  const timeRange = `${hhmm(minuteOfDayVN(startDate))}–${hhmm(minuteOfDayVN(endDate))}`;
  const sportName = SPORT_LABEL[match.sport] ?? match.sport;
  const isConfirmed = match.bookingStatus === 'CONFIRMED';
  const statusLabel = isConfirmed ? 'Đã xác nhận' : 'Chưa xác nhận';
  const slotsLabel = `${match.joinedCount}/${match.capacity} suất`;

  return (
    <article
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
          alignItems: 'center',
          gap: 'var(--space-sm)',
        }}
      >
        <span style={{ font: 'var(--font-headline-mobile)', overflowWrap: 'anywhere' }}>
          {match.venueName}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          {match.status === 'FULL' && (
            <span
              className="badge badge-off"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: '24px',
                padding: '0 var(--space-sm)',
                borderRadius: 'var(--radius-full)',
                font: 'var(--font-label)',
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
              display: 'inline-flex',
              alignItems: 'center',
              height: '24px',
              padding: '0 var(--space-sm)',
              borderRadius: 'var(--radius-full)',
              font: 'var(--font-label)',
              color: isConfirmed ? 'var(--color-status-ok)' : 'var(--color-status-wait)',
              backgroundColor: isConfirmed ? 'var(--color-status-ok-bg)' : 'var(--color-status-wait-bg)',
            }}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      <div style={{ font: 'var(--font-body)', color: 'var(--color-ink)' }}>
        <span>{match.courtName}</span> · <span>{dateHeading}</span>
      </div>

      <div
        className="tnum"
        style={{
          font: 'var(--font-numeric)',
          color: 'var(--color-ink-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
        }}
      >
        <span>{timeRange}</span> · <span>{slotsLabel}</span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          font: 'var(--font-meta)',
          color: 'var(--color-ink-muted)',
        }}
      >
        <SportIcon sport={match.sport} size={14} />
        <span>{sportName}</span>
        <span>·</span>
        <span>Host: </span>
        <span>{match.hostName}</span>
      </div>
    </article>
  );
}
