import { minuteOfDayVN, vnDateString } from '@monsport/shared';

export type WindowId = 'sang' | 'chieu' | 'toi';

export interface TimeWindow {
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

export function windowsFor(opensAt: number, closesAt: number): TimeWindow[] {
  return WINDOWS.map((w) => ({
    ...w,
    from: Math.max(w.from, opensAt),
    to: Math.min(w.to, closesAt),
  })).filter((w) => w.to - w.from >= 30);
}

export function firstWindow(windows: TimeWindow[], date: string, now: Date): WindowId | undefined {
  if (date === vnDateString(now)) {
    const minute = minuteOfDayVN(now);
    const current = windows.find((w) => minute < w.to);
    if (current) return current.id;
  }
  return (windows.find((w) => w.id === 'toi') ?? windows[0])?.id;
}

export const shortTime = (m: number) =>
  m % 60 === 0 ? String(m / 60) : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

export function nearestMinute(list: number[], minute: number): number | undefined {
  let best: number | undefined;
  for (const m of list) {
    if (best === undefined || Math.abs(m - minute) < Math.abs(best - minute)) best = m;
  }
  return best;
}

const focusSlotCell = (courtId: string, minute: number) => {
  document
    .querySelector<HTMLElement>(`[data-court-id="${courtId}"] button[data-minute="${minute}"]`)
    ?.focus();
};

export function handleSlotCellKeyDown<T extends { id: string }>(
  event: { key: string; preventDefault: () => void },
  courts: readonly T[],
  startableOf: (court: T) => number[],
  courtIndex: number,
  minute: number,
): void {
  const currentCourt = courts[courtIndex];
  if (!currentCourt) return;
  const own = startableOf(currentCourt);
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    const next =
      event.key === 'ArrowRight' ? own.find((m) => m > minute) : [...own].reverse().find((m) => m < minute);
    if (next !== undefined) focusSlotCell(currentCourt.id, next);
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    for (let i = courtIndex + step; i >= 0 && i < courts.length; i += step) {
      const candidate = courts[i];
      if (!candidate) continue;
      const target = nearestMinute(startableOf(candidate), minute);
      if (target !== undefined) {
        focusSlotCell(candidate.id, target);
        return;
      }
    }
  }
}
