import type { CourtView, FreeRange } from '@monsport/shared';
import { hhmm } from './format.ts';

export const DURATIONS = [60, 90, 120, 150, 180];

const SHORT_DAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const LONG_DAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/**
 * The instant of a minute of the day on a date, in Asia/Ho_Chi_Minh. A slot may end at 24:00 (Venue.closesAt is up to
 * 1440), and ISO has no hour 24, so that minute becomes 00:00 of the next day.
 */
export function slotAt(date: string, minute: number): string {
  if (minute < 1440) return `${date}T${hhmm(minute)}:00+07:00`;
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return `${next.toISOString().slice(0, 10)}T${hhmm(minute - 1440)}:00+07:00`;
}

// The weekday of a calendar date does not depend on the time zone, so read it in UTC at noon.
const weekday = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay();
const dayMonth = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

/** "T6 30/10" */
export const dayChipLabel = (ymd: string) => `${SHORT_DAY[weekday(ymd)]} ${dayMonth(ymd)}`;

/** "Thứ Sáu, 30/10/2026" */
export const dayHeading = (ymd: string) => `${LONG_DAY[weekday(ymd)]}, ${dayMonth(ymd)}/${ymd.slice(0, 4)}`;

/** "70k–120k", "100k" when both ends are equal, "—" when there is no court. */
export function priceRangeK(courts: CourtView[]): string {
  if (courts.length === 0) return '—';
  const low = Math.round(Math.min(...courts.map((c) => c.priceNormal)) / 1000);
  const high = Math.round(Math.max(...courts.map((c) => c.pricePeak)) / 1000);
  return low === high ? `${low}k` : `${low}k–${high}k`;
}

const HOUR = 60;
const MINUTE_MS = 60_000;

/** The free range that holds [start, end], or undefined. Compares instants, not strings. */
function rangeHolding(date: string, free: FreeRange[], start: number, end: number): FreeRange | undefined {
  const from = Date.parse(slotAt(date, start));
  const to = Date.parse(slotAt(date, end));
  return free.find((r) => Date.parse(r.startAt) <= from && to <= Date.parse(r.endAt));
}

/**
 * Start minutes (multiples of 30) with at least 60 free minutes after them, and a start later than now + 60 minutes
 * (BR-3, BR-9).
 */
export function startableMinutes(date: string, free: FreeRange[], now: Date): number[] {
  const result: number[] = [];
  for (let m = 0; m <= 1410; m += 30) {
    if (!rangeHolding(date, free, m, m + HOUR)) continue;
    if (Date.parse(slotAt(date, m)) - HOUR * MINUTE_MS > now.getTime()) result.push(m);
  }
  return result;
}

/** The durations that fit between start and the end of the free range that holds start. */
export function durationsAt(date: string, start: number, free: FreeRange[], now: Date): number[] {
  if (!startableMinutes(date, free, now).includes(start)) return [];
  return DURATIONS.filter((d) => rangeHolding(date, free, start, start + d) !== undefined);
}
