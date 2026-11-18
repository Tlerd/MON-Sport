import { useRef, useState, type KeyboardEvent } from 'react';
import { minuteOfDayVN, vnDateString } from '@monsport/shared';
import { hhmm } from '@monsport/client';
import { Chip } from './Chip.tsx';
import {
  firstWindow,
  isPeakMinute,
  windowsFor,
  type SlotCellInfo,
  type SlotGridProps,
  type TimeWindow,
  type WindowId,
} from './slotGridModel.ts';

export type {
  CourtItem,
  SelectedSlot,
  SlotCellInfo,
  SlotCellStatus,
  SlotGridProps,
  TimeWindow,
  WindowId,
} from './slotGridModel.ts';
export { firstWindow, isPeakMinute, windowsFor } from './slotGridModel.ts';

export function SlotGrid({
  courts,
  date,
  cells = {},
  mode = 'pick',
  selected = null,
  onPick,
  opensAt = 360,
  closesAt = 1380,
  className = '',
  now = new Date(),
  windowId,
  onWindowChange,
}: SlotGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const windows = windowsFor(opensAt, closesAt);
  const [chosen, setChosen] = useState<{ key: string; id: WindowId } | null>(null);
  const key = `${date ?? ''}|${opensAt}|${closesAt}`;
  const active =
    windows.find((w) => w.id === (windowId ?? (chosen?.key === key ? chosen.id : firstWindow(windows, date, now)))) ?? windows[0];
  const today = vnDateString(now);
  const pastBefore = date === today ? minuteOfDayVN(now) : -1;

  const from = active?.from ?? opensAt;
  const to = active?.to ?? opensAt;
  const totalCols = Math.max(0, Math.floor((to - from) / 30));
  const cols = Array.from({ length: totalCols }, (_, i) => from + i * 30);

  function getCellInfo(courtId: string, minute: number): SlotCellInfo {
    const courtCells = cells[courtId];
    if (!courtCells) return { startMinute: minute, status: 'free' };
    if (Array.isArray(courtCells)) {
      return courtCells.find((c) => c.startMinute === minute) ?? { startMinute: minute, status: 'free' };
    }
    return courtCells[minute] ?? { startMinute: minute, status: 'free' };
  }

  function isSelected(courtId: string, minute: number): boolean {
    if (!selected) return false;
    if (Array.isArray(selected)) {
      return selected.some((s) => s.courtId === courtId && s.startMinute === minute);
    }
    return selected.courtId === courtId && selected.startMinute === minute;
  }

  function focusAt(r: number, c: number) {
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(
      `button[data-court-idx="${r}"][data-col-idx="${c}"]:not(:disabled)`,
    );
    if (btn) btn.focus();
    return Boolean(btn);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, courtIdx: number, colIdx: number) {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'ArrowRight') {
      for (let c = colIdx + 1; c < totalCols; c++) if (focusAt(courtIdx, c)) return;
    } else if (e.key === 'ArrowLeft') {
      for (let c = colIdx - 1; c >= 0; c--) if (focusAt(courtIdx, c)) return;
    } else if (e.key === 'ArrowDown') {
      for (let r = courtIdx + 1; r < courts.length; r++) if (focusAt(r, colIdx)) return;
    } else if (e.key === 'ArrowUp') {
      for (let r = courtIdx - 1; r >= 0; r--) if (focusAt(r, colIdx)) return;
    }
  }

  function freeHours(w: TimeWindow): number {
    let free = 0;
    for (const court of courts) {
      for (let m = w.from; m < w.to; m += 30) {
        if (m >= pastBefore && getCellInfo(court.id, m).status === 'free') free++;
      }
    }
    return free / 2;
  }

  function pendingCount(w: TimeWindow): number {
    const ids = new Set<string>();
    for (const court of courts) {
      for (let m = w.from; m < w.to; m += 30) {
        const cell = getCellInfo(court.id, m);
        if (cell.status === 'pending') ids.add(cell.bookingId ?? `${court.id}-${m}`);
      }
    }
    return ids.size;
  }

  const shortTime = (m: number) => (m % 60 === 0 ? hhmm(m).slice(0, 2) : hhmm(m));

  return (
    <div
      ref={gridRef}
      className={`slot-grid-wrap ${className}`.trim()}
      role="region"
      aria-label={`Lưới giờ sân ${date ?? ''}`}
    >
      {windows.length > 1 && (
        <div className="slot-windows" role="group" aria-label="Buổi">
          {windows.map((w) => {
            const countText =
              mode === 'pick'
                ? `${freeHours(w).toLocaleString('vi-VN')} giờ trống`
                : pendingCount(w) > 0
                  ? `${pendingCount(w)} chờ`
                  : '';
            const baseText = `${w.name} ${shortTime(w.from)}–${shortTime(w.to)}`;
            const fullText = countText ? `${baseText}, ${countText}` : baseText;

            return (
              <Chip
                key={w.id}
                selected={w.id === active?.id}
                aria-label={fullText}
                title={countText ? fullText : undefined}
                onClick={() => {
                  setChosen({ key, id: w.id });
                  onWindowChange?.(w.id);
                }}
              >
                {baseText}
                {countText ? <small className="slot-window-count"> · {countText}</small> : null}
              </Chip>
            );
          })}
        </div>
      )}
      <div className="slot-grid-scroll">
        <div
          className="slot-grid"
          style={{ gridTemplateColumns: `var(--slot-label-width) repeat(${totalCols}, minmax(28px, 1fr))` }}
        >
          <div className="slot-grid-corner g-corner" />
          {cols.length > 0 && cols[0] % 60 !== 0 && <div key="h-leading" className="slot-grid-h g-hour" />}
          {cols.map((minute) => {
            if (minute % 60 === 0) {
              const span = cols.includes(minute + 30) ? 2 : 1;
              return (
                <div
                  key={`h-${minute}`}
                  className="slot-grid-h g-hour tnum"
                  style={{ gridColumn: `span ${span}`, fontSize: '12px', color: 'var(--ink3)' }}
                >
                  {hhmm(minute)}
                </div>
              );
            }
            return null;
          })}

          {courts.map((court, courtIdx) => (
            <div key={court.id} style={{ display: 'contents' }}>
              <div
                className="slot-grid-court-label g-head"
                style={{
                  fontSize: '13.5px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--ink)',
                }}
              >
                {court.name}
              </div>

              {cols.map((minute, colIdx) => {
                const cell = getCellInfo(court.id, minute);
                const peak = isPeakMinute(minute);
                const sel = isSelected(court.id, minute);

                const isTaken = cell.status === 'taken' || cell.status === 'mine';
                const isPending = cell.status === 'pending';
                const isConfirmed = cell.status === 'confirmed';
                const past = mode === 'pick' && minute < pastBefore;
                const mockStateClass =
                  isPending
                    ? 'pending'
                    : isTaken || isConfirmed
                      ? 'booked'
                      : past
                        ? 'past'
                        : sel
                          ? 'free on'
                          : 'free';

                const classNames = [
                  'cell',
                  'slot-cell',
                  'g-cell',
                  mode === 'manage' ? 'owner' : '',
                  mockStateClass,
                  peak ? 'peak' : '',
                  past ? 'past' : '',
                  sel ? 'sel selected' : '',
                  cell.status,
                ].filter(Boolean).join(' ');

                if (mode === 'pick') {
                  const disabled = isTaken || isPending || isConfirmed || past;
                  const ariaLabel = `${court.name} ${hhmm(minute)} ${past ? 'đã qua' : disabled ? 'đã có người' : 'trống'}`;

                  return (
                    <button
                      key={`${court.id}-${minute}`}
                      type="button"
                      disabled={disabled}
                      className={classNames}
                      data-court-idx={courtIdx}
                      data-col-idx={colIdx}
                      data-court-id={court.id}
                      data-minute={minute}
                      aria-label={ariaLabel}
                      onClick={() => onPick?.(court.id, minute, cell)}
                      onKeyDown={(e) => handleKeyDown(e, courtIdx, colIdx)}
                    />
                  );
                }

                const ariaLabel = `${court.name} ${hhmm(minute)} ${cell.customerName || cell.label || cell.status}`;
                const displayText = cell.customerName || cell.label || '';

                return (
                  <button
                    key={`${court.id}-${minute}`}
                    type="button"
                    className={classNames}
                    data-court-idx={courtIdx}
                    data-col-idx={colIdx}
                    data-court-id={court.id}
                    data-minute={minute}
                    aria-label={ariaLabel}
                    onClick={() => onPick?.(court.id, minute, cell)}
                    onKeyDown={(e) => handleKeyDown(e, courtIdx, colIdx)}
                  >
                    {displayText && <span className="cell-text" data-field="customer">{displayText}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
