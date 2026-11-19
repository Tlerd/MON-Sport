import {
  minuteOfDayVN,
  vnDateString,
  type CourtView,
  type OwnerBookingView,
  type VenueView,
} from '@monsport/shared';
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
import type { CourtState, ScheduleNotice } from './useOwnerSchedule.ts';

export interface ScheduleCourtsProps {
  venue: VenueView;
  date: string;
  now: Date;
  bookings: OwnerBookingView[];
  notice: ScheduleNotice | null;
  sheetTarget: { court: CourtView; start: number } | null;
  stateOf: (court: CourtView) => CourtState | undefined;
  startableOf: (court: CourtView) => number[];
  onRetryCourt: (courtId: string) => void;
  onPickSlot: (court: CourtView, start: number) => void;
}

export function ScheduleCourts({
  venue,
  date,
  now,
  bookings,
  notice,
  sheetTarget,
  stateOf,
  startableOf,
  onRetryCourt,
  onPickSlot,
}: ScheduleCourtsProps) {
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
            padding: 'var(--space-sm) var(--space-base)',
            minWidth: 0,
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {windows.map((w) => {
            const courtIds = new Set(venue.courts.map((c) => c.id));
            const pendingInWindow = bookings.filter((b) => {
              if (b.status !== 'PENDING' || !courtIds.has(b.courtId)) return false;
              const d = new Date(b.startAt);
              if (vnDateString(d) !== date) return false;
              const m = minuteOfDayVN(d);
              return m >= w.from && m < w.to;
            }).length;
            const baseLabel = `${w.name} ${shortTime(w.from)}–${shortTime(w.to)}`;
            const pendingSuffix = pendingInWindow > 0 ? ` (${pendingInWindow} chờ)` : '';
            return (
              <Chip
                key={w.id}
                selected={w.id === activeWindow?.id}
                aria-label={`${baseLabel}${pendingSuffix}`}
                title={pendingInWindow > 0 ? `${pendingInWindow} yêu cầu đang chờ` : undefined}
                onClick={() =>
                  setChosenWindow({ key: windowKey, id: w.id, n: (chosenWindow?.n ?? 0) + 1 })
                }
              >
                {baseLabel}
              </Chip>
            );
          })}
        </div>
      )}

      {notice && (
        <p
          role={notice.kind === 'alert' ? 'alert' : 'status'}
          style={{
            margin: 0,
            padding: 'var(--space-sm) var(--space-base)',
            minWidth: 0,
            font: 'var(--font-meta)',
            color: notice.kind === 'alert' ? 'var(--color-status-no)' : 'var(--color-ink-muted)',
            overflowWrap: 'anywhere',
          }}
        >
          {notice.text}
        </p>
      )}

      {venue.courts.map((court, courtIndex) => {
        const state = stateOf(court);
        return (
          <section key={court.id} style={{ minWidth: 0, maxWidth: '100%', padding: 'var(--space-sm) 0' }}>
            <h2
              style={{
                margin: 0,
                padding: '0 var(--space-base) var(--space-xs)',
                font: 'var(--font-body-strong)',
                color: 'var(--color-ink)',
                minWidth: 0,
                overflowWrap: 'anywhere',
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
                selected={sheetTarget?.court.id === court.id ? sheetTarget.start : undefined}
                onPick={(start) => onPickSlot(court, start)}
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
