import { api, hhmm, priceRangeK } from '@monsport/client';
import type { VenueView } from '@monsport/shared';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Chip } from '../../components/Chip.tsx';
import { ContextBar } from '../../components/ContextBar.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { IconBadminton, IconFootball, SPORT_LABEL, SportIcon } from '../../components/SportIcon.tsx';

type SportFilter = 'ALL' | 'BADMINTON' | 'FOOTBALL';

const NOTICE = 'App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.';

const sportsOf = (venue: VenueView) => [...new Set(venue.courts.map((c) => c.sport))];

export function VenueListScreen() {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<VenueView[] | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [sport, setSport] = useState<SportFilter>('ALL');

  const load = useCallback(() => {
    setFailed(false);
    api<VenueView[]>('/api/venues').then(
      (list) => setVenues(list),
      () => setFailed(true),
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = venues?.filter((v) => sport === 'ALL' || v.courts.some((c) => c.sport === sport));

  return (
    <div style={{ minWidth: 0 }}>
      <ContextBar aria-label="Môn thể thao">
        <Chip selected={sport === 'ALL'} onClick={() => setSport('ALL')}>
          Tất cả
        </Chip>
        <Chip selected={sport === 'BADMINTON'} icon={<IconBadminton size={18} />} onClick={() => setSport('BADMINTON')}>
          {SPORT_LABEL.BADMINTON}
        </Chip>
        <Chip selected={sport === 'FOOTBALL'} icon={<IconFootball size={18} />} onClick={() => setSport('FOOTBALL')}>
          {SPORT_LABEL.FOOTBALL}
        </Chip>
      </ContextBar>

      <div style={{ paddingTop: '61px', minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            padding: 'var(--space-md) var(--space-base)',
            font: 'var(--font-meta)',
            color: 'var(--color-ink-muted)',
          }}
        >
          {NOTICE}
        </p>

        {failed ? (
          <EmptyState message="Không tải được danh sách đơn vị" actionLabel="Thử lại" onAction={load} />
        ) : !shown ? (
          <p style={{ margin: 0, padding: 'var(--space-xl) var(--space-base)', textAlign: 'center', font: 'var(--font-meta)', color: 'var(--color-ink-muted)' }}>
            Đang tải…
          </p>
        ) : shown.length === 0 ? (
          <EmptyState message="Chưa có đơn vị nào cho môn này" />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
            {shown.map((venue) => {
              const sports = sportsOf(venue);
              return (
                <li key={venue.id} style={{ minWidth: 0 }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/don-vi/${venue.id}`)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-xs)',
                      width: '100%',
                      minWidth: 0,
                      minHeight: '44px',
                      padding: 'var(--space-md) var(--space-base)',
                      border: 'none',
                      borderRadius: 'var(--radius-none)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-ink)',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ font: 'var(--font-headline-mobile)', overflowWrap: 'anywhere' }}>{venue.name}</span>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-xs)',
                        font: 'var(--font-meta)',
                        color: 'var(--color-ink-muted)',
                      }}
                    >
                      {sports.map((s) => (
                        <SportIcon key={s} sport={s} size={16} />
                      ))}
                      <span>{`${sports.map((s) => SPORT_LABEL[s]).join(', ')} · ${venue.courts.length} sân`}</span>
                    </span>
                    <span className="tnum" style={{ font: 'var(--font-numeric)' }}>
                      {`${priceRangeK(venue.courts)} · ${hhmm(venue.opensAt)}–${hhmm(venue.closesAt)}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
