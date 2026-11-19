import type { CourtView, VenueView } from '@monsport/shared';
import { useState } from 'react';
import { Chip } from '../../components/Chip.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { SlotRow } from '../../components/SlotRow.tsx';
import {
  firstWindow,
  handleSlotCellKeyDown,
  shortTime,
  windowsFor,
  type WindowId,
} from '../../lib/slotWindows.ts';
import { HOUR, type CourtState } from './useVenueAvailability.ts';

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
                onCellKeyDown={(event, minute) =>
                  handleSlotCellKeyDown(event, venue.courts, startableOf, courtIndex, minute)
                }
              />
            )}
          </section>
        );
      })}
    </>
  );
}
