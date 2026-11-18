import { minuteOfDayVN, vnDateString } from '@monsport/shared';

export type SlotCellStatus = 'free' | 'taken' | 'mine' | 'pending' | 'confirmed';

export interface SlotCellInfo {
  startMinute: number;
  status: SlotCellStatus;
  label?: string;
  bookingId?: string;
  customerName?: string;
}

export interface CourtItem {
  id: string;
  name: string;
}

export interface SelectedSlot {
  courtId: string;
  startMinute: number;
}

export interface SlotGridProps {
  courts: CourtItem[];
  date?: string;
  cells?: Record<string, SlotCellInfo[] | Record<number, SlotCellInfo>>;
  mode?: 'pick' | 'manage';
  selected?: SelectedSlot | SelectedSlot[] | null;
  onPick?: (courtId: string, startMinute: number, cell?: SlotCellInfo) => void;
  opensAt?: number;
  closesAt?: number;
  className?: string;
  now?: Date;
  windowId?: WindowId;
  onWindowChange?: (id: WindowId) => void;
}

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
  return WINDOWS.map((w) => ({ ...w, from: Math.max(w.from, opensAt), to: Math.min(w.to, closesAt) })).filter(
    (w) => w.to - w.from >= 30,
  );
}

export function firstWindow(windows: TimeWindow[], date: string | undefined, now: Date): WindowId | undefined {
  if (date === vnDateString(now)) {
    const minute = minuteOfDayVN(now);
    const current = windows.find((w) => minute < w.to);
    if (current) return current.id;
  }
  return (windows.find((w) => w.id === 'toi') ?? windows[0])?.id;
}

export const isPeakMinute = (m: number) => m >= 17 * 60 && m < 22 * 60;
