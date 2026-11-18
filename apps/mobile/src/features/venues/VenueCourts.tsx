import { minuteOfDayVN, vnDateString, type CourtView, type VenueView } from '@monsport/shared';
import { useState, type KeyboardEvent } from 'react';
import { Chip } from '../../components/Chip.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { SlotRow } from '../../components/SlotRow.tsx';
import { HOUR, type CourtState } from './useVenueAvailability.ts';

type WindowId = 'sang' | 'chieu' | 'toi';
interface TimeWindow {
  id: WindowId;
  name: string;
  from: number;
  to: number;
}

const WINDOWS: TimeWindow[] = [
  { id: 'sang', name: 'Sáng', from: 0, to: 12 * 60 },
  { id: 'chieu', name: 'Chiều', from: 12 * 60, to: 17 * 60 },
  { id: 'toi', name: 'Tối', from: 17 * 60, to: 24 * 60 },
];

function windowsFor(opensAt: number, closesAt: number): TimeWindow[] {
  return WINDOWS.map((w) => ({ ...w, from: Math.max(w.from, opensAt), to: Math.min(w.to, closesAt) })).filter(
    (w) => w.to - w.from >= 30,
  );
}

function firstWindow(windows: TimeWindow[], date: string, now: Date): WindowId | undefined {
  if (date === vnDateString(now)) {
    const minute = minuteOfDayVN(now);
    const current = windows.find((w) => minute < w.to);
    if (current) return current.id;
  }
  return (windows.find((w) => w.id === 'toi') ?? windows[0])?.id;
}

const shortTime = (m: number) =>
  m % 60 === 0 ? String(m / 60) : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

function nearest(list: number[], minute: number): number | undefined {
  let best: number | undefined;
  for (const m of list) {
    if (best === undefined || Math.abs(m - minute) < Math.abs(best - minute)) best = m;
  }
  return best;
}

const focusCell = (courtId: string, minute: number) => {
  document
    .querySelector<HTMLElement>(`[data-court-id="${courtId}"] button[data-minute="${minute}"]`)
    ?.focus();
};

export interface VenueCourtsProps {
  venue: VenueView;
  date: string;
  now: Date;
  selected: { courtId: string; start: number; duration: number } | undefined;
  allEmpty: boolean;
  stateOf: (court: CourtView) => CourtState | undefined;
  startableOf: (court: CourtView) => number[];
  onRetryCourt: (courtId: string) => void;
  onSelectSlot: (slot: { courtId: string; start: number; duration: number }) => void;
}

export function VenueCourts({
  venue,
  date,
  now,
  selected,
  allEmpty,
  stateOf,
  startableOf,
  onRetryCourt,
  onSelectSlot,
}: VenueCourtsProps) {
  const [chosenWindow, setChosenWindow] = useState<{ key: string; id: WindowId; n: number } | null>(null);

  const windows = windowsFor(venue.opensAt, venue.closesAt);
  const windowKey = `${date}|${venue.opensAt}|${venue.closesAt}`;
  const activeId = chosenWindow?.key === windowKey ? chosenWindow.id : firstWindow(windows, date, now);
  const activeWindow = windows.find((w) => w.id === activeId) ?? windows[0];
  const scrollSignal = `${windowKey}|${chosenWindow?.key === windowKey ? chosenWindow.n : 0}`;

  const onCellKeyDown = (event: KeyboardEvent<HTMLButtonElement>, courtIndex: number, minute: number) => {
    const currentCourt = venue.courts[courtIndex];
    if (!currentCourt) return;
    const own = startableOf(currentCourt);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next =
        event.key === 'ArrowRight' ? own.find((m) => m > minute) : [...own].reverse().find((m) => m < minute);
      if (next !== undefined) focusCell(currentCourt.id, next);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      for (let i = courtIndex + step; i >= 0 && i < venue.courts.length; i += step) {
        const candidate = venue.courts[i];
        if (!candidate) continue;
        const target = nearest(startableOf(candidate), minute);
        if (target !== undefined) {
          focusCell(candidate.id, target);
          return;
        }
      }
    }
  };

  return (
    <>
      {windows.length > 1 && (
        <div
          role="group"
          aria-label="Buổi"
          style={{
            display: 'flex',
            gap: 'var(--space-sm)',
            padding: '0 var(--space-base) var(--space-md)',
            minWidth: 0,
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {windows.map((w) => (
            <Chip
              key={w.id}
              selected={w.id === activeWindow?.id}
              onClick={() =>
                setChosenWindow({ key: windowKey, id: w.id, n: (chosenWindow?.n ?? 0) + 1 })
              }
            >
              {`${w.name} ${shortTime(w.from)}–${shortTime(w.to)}`}
            </Chip>
          ))}
        </div>
      )}

      {allEmpty && <EmptyState message="Hết giờ trống trong ngày này. Hãy chọn ngày khác." />}

      {venue.courts.map((court, courtIndex) => {
        const state = stateOf(court);
        return (
          <section key={court.id} style={{ minWidth: 0, padding: 'var(--space-sm) 0' }}>
            <h2
              style={{
                margin: 0,
                padding: '0 var(--space-base) var(--space-xs)',
                font: 'var(--font-body-strong)',
                color: 'var(--color-ink)',
              }}
            >
              {court.name}
            </h2>
            {state?.status === 'error' ? (
              <EmptyState
                message="Không tải được giờ trống"
                actionLabel="Thử lại"
                onAction={() => onRetryCourt(court.id)}
              />
            ) : (
              <SlotRow
                courtId={court.id}
                courtName={court.name}
                opensAt={venue.opensAt}
                closesAt={venue.closesAt}
                startable={startableOf(court)}
                selected={selected?.courtId === court.id ? selected.start : undefined}
                onPick={(start) => onSelectSlot({ courtId: court.id, start, duration: HOUR })}
                scrollToMinute={activeWindow?.from}
                scrollSignal={scrollSignal}
                onCellKeyDown={(event, minute) => onCellKeyDown(event, courtIndex, minute)}
              />
            )}
          </section>
        );
      })}
    </>
  );
}
