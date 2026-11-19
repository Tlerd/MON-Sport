import type { CourtView, FreeRange } from '@monsport/shared';
import { hhmm } from './format.ts';

export const DURATIONS = [60, 90, 120, 150, 180];

export function fitsAnyDuration(startMinute: number, closesAt: number): boolean {
  return DURATIONS.some((d) => startMinute + d <= closesAt);
}

const SHORT_DAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const LONG_DAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export function slotAt(date: string, minute: number): string {
  if (minute < 1440) return `${date}T${hhmm(minute)}:00+07:00`;
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return `${next.toISOString().slice(0, 10)}T${hhmm(minute - 1440)}:00+07:00`;
}

const weekday = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay();
const dayMonth = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

export const dayChipLabel = (ymd: string) => `${SHORT_DAY[weekday(ymd)]} ${dayMonth(ymd)}`;

export const dayHeading = (ymd: string) => `${LONG_DAY[weekday(ymd)]}, ${dayMonth(ymd)}/${ymd.slice(0, 4)}`;

export function priceRangeK(courts: CourtView[]): string {
  if (courts.length === 0) return '—';
  const low = Math.round(Math.min(...courts.map((c) => c.priceNormal)) / 1000);
  const high = Math.round(Math.max(...courts.map((c) => c.pricePeak)) / 1000);
  return low === high ? `${low}k` : `${low}k–${high}k`;
}

const HOUR = 60;
const MINUTE_MS = 60_000;

export function rangeHolding(date: string, free: FreeRange[], start: number, end: number): FreeRange | undefined {
  const from = Date.parse(slotAt(date, start));
  const to = Date.parse(slotAt(date, end));
  return free.find((r) => Date.parse(r.startAt) <= from && to <= Date.parse(r.endAt));
}

export function startableMinutes(date: string, free: FreeRange[], now: Date): number[] {
  const result: number[] = [];
  for (let m = 0; m <= 1410; m += 30) {
    if (!rangeHolding(date, free, m, m + HOUR)) continue;
    if (Date.parse(slotAt(date, m)) - HOUR * MINUTE_MS > now.getTime()) result.push(m);
  }
  return result;
}

export function durationsAt(date: string, start: number, free: FreeRange[], now: Date): number[] {
  if (!startableMinutes(date, free, now).includes(start)) return [];
  return DURATIONS.filter((d) => rangeHolding(date, free, start, start + d) !== undefined);
}
