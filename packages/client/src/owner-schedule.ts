import { type FreeRange, vnDateString } from '@monsport/shared';
import { DURATIONS, rangeHolding, slotAt } from './booking.ts';

const HOUR = 60;

export function ownerStartableMinutes(date: string, free: FreeRange[], now: Date): number[] {
  const result: number[] = [];
  for (let m = 0; m <= 1410; m += 30) {
    if (!rangeHolding(date, free, m, m + HOUR)) continue;
    if (Date.parse(slotAt(date, m)) > now.getTime()) result.push(m);
  }
  return result;
}

export function ownerDurationsAt(date: string, start: number, free: FreeRange[], now: Date): number[] {
  if (!ownerStartableMinutes(date, free, now).includes(start)) return [];
  return DURATIONS.filter((d) => rangeHolding(date, free, start, start + d) !== undefined);
}

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
