import { type FreeRange, vnDateString } from '@monsport/shared';
import { DURATIONS, slotAt } from './booking.ts';

const HOUR = 60;

/** The free range that holds [start, end], or undefined. Compares instants, not strings. */
function rangeHolding(date: string, free: FreeRange[], start: number, end: number): FreeRange | undefined {
  const from = Date.parse(slotAt(date, start));
  const to = Date.parse(slotAt(date, end));
  return free.find((r) => Date.parse(r.startAt) <= from && to <= Date.parse(r.endAt));
}

/** Start minutes (multiples of 30) after now with at least 60 free minutes after them (BR-2, BR-3). */
export function ownerStartableMinutes(date: string, free: FreeRange[], now: Date): number[] {
  const result: number[] = [];
  for (let m = 0; m <= 1410; m += 30) {
    if (!rangeHolding(date, free, m, m + HOUR)) continue;
    if (Date.parse(slotAt(date, m)) > now.getTime()) result.push(m);
  }
  return result;
}

/** The durations that fit between start and the end of the free range that holds start, for an owner booking. */
export function ownerDurationsAt(date: string, start: number, free: FreeRange[], now: Date): number[] {
  if (!ownerStartableMinutes(date, free, now).includes(start)) return [];
  return DURATIONS.filter((d) => rangeHolding(date, free, start, start + d) !== undefined);
}

/** Bookings whose startAt falls on date in Asia/Ho_Chi_Minh and whose courtId is in courtIds, sorted by startAt. */
export function bookingsOfDay<T extends { startAt: string; courtId: string }>(
  bookings: T[],
  date: string,
  courtIds: string[],
): T[] {
  const courts = new Set(courtIds);
  return bookings
    .filter((b) => courts.has(b.courtId) && vnDateString(new Date(b.startAt)) === date)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}
