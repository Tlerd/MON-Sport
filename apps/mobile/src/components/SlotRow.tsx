import { hhmm } from '@monsport/client';
import { useEffect, useRef, type KeyboardEvent } from 'react';

export interface SlotRowProps {
  courtId: string;
  courtName: string;
  opensAt: number;
  closesAt: number;
  startable: number[];
  selected?: number;
  onPick: (minute: number) => void;
  scrollToMinute?: number;
  scrollSignal?: string | number;
  onCellKeyDown?: (event: KeyboardEvent<HTMLButtonElement>, minute: number) => void;
}

const isPeak = (minute: number) => minute >= 17 * 60 && minute < 22 * 60;

export function SlotRow({
  courtId,
  courtName,
  opensAt,
  closesAt,
  startable,
  selected,
  onPick,
  scrollToMinute,
  scrollSignal,
  onCellKeyDown,
}: SlotRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || scrollToMinute === undefined) return;
    const cell = row.querySelector<HTMLElement>(`[data-minute="${scrollToMinute}"]`);
    if (cell && typeof row.scrollTo === 'function') row.scrollTo({ left: cell.offsetLeft });
  }, [scrollToMinute, scrollSignal]);

  const minutes: number[] = [];
  for (let m = opensAt; m <= closesAt - 30; m += 30) minutes.push(m);

  return (
    <div
      ref={rowRef}
      className="slot-row"
      role="group"
      aria-label={`Giờ trống ${courtName}`}
      data-court-id={courtId}
    >
      {minutes.map((minute, index) => {
        const classNames = [
          'slot-cell',
          isPeak(minute) ? 'peak-marker' : '',
          startable.includes(minute) ? 'slot-free' : 'slot-taken',
          selected === minute ? 'slot-selected' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <div key={minute} className="slot-col">
            <span className="slot-hour tnum" aria-hidden="true">
              {index % 2 === 0 ? hhmm(minute) : ''}
            </span>
            {startable.includes(minute) ? (
              <button
                type="button"
                className={classNames}
                data-minute={minute}
                aria-label={`${courtName} ${hhmm(minute)}`}
                aria-pressed={selected === minute}
                onClick={() => onPick(minute)}
                onKeyDown={(event) => onCellKeyDown?.(event, minute)}
              />
            ) : (
              <div className={classNames} data-minute={minute} aria-disabled="true" tabIndex={-1} />
            )}
          </div>
        );
      })}
    </div>
  );
}
