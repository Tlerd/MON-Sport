// Pure booking rules from docs/requirements/business-rules.md. The server and the web both use them.
// Vietnam has no daylight saving time, so Asia/Ho_Chi_Minh is always UTC+7 (BR-27).

import type { BookingStatus } from './booking.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const SLOT = 30 * MINUTE;
const VN_OFFSET = 7 * HOUR;
const PEAK_START = 17 * 60; // BR-4: 17:00 is peak.
const PEAK_END = 22 * 60; // BR-4: 22:00 is normal again.

/** Minutes since 00:00 in Asia/Ho_Chi_Minh. */
export function minuteOfDayVN(at: Date): number {
  return Math.floor((at.getTime() + VN_OFFSET) / MINUTE) % (24 * 60);
}

/** BR-2: an instant on the 30-minute grid. */
export function isOnGrid(at: Date): boolean {
  return at.getTime() % SLOT === 0;
}

/** BR-3: a booking lasts 1 hour or more. */
export function isLongEnough(startAt: Date, endAt: Date): boolean {
  return endAt.getTime() - startAt.getTime() >= HOUR;
}

/** BR-4, BR-5: the sum of the 30-minute slots, each at half the hourly price of its band. Whole VND (BR-25). */
export function bookingPrice(startAt: Date, endAt: Date, priceNormal: number, pricePeak: number): number {
  let hourlySum = 0;
  for (let t = startAt.getTime(); t < endAt.getTime(); t += SLOT) {
    const minute = minuteOfDayVN(new Date(t));
    hourlySum += minute >= PEAK_START && minute < PEAK_END ? pricePeak : priceNormal;
  }
  return Math.round(hourlySum / 2);
}

/** BR-7: the earlier of request time + 2 hours and start time - 1 hour. */
export function confirmDeadline(requestedAt: Date, startAt: Date): Date {
  return new Date(Math.min(requestedAt.getTime() + 2 * HOUR, startAt.getTime() - HOUR));
}

/** BR-11: a user cancels a confirmed booking with this much time or more left. The server and the web share it. */
export const USER_CANCEL_WINDOW_MS = 6 * HOUR;

/**
 * Brief F-009: what a user may do to their own booking. A pending request is cancelled until it starts (BR-12).
 * A confirmed booking is cancelled with 6 hours or more left (BR-11), and later the user calls the owner.
 */
export function userCancelDecision(booking: { status: BookingStatus; startAt: Date }, now: Date): 'ALLOW' | 'CALL_OWNER' | 'NONE' {
  const untilStart = booking.startAt.getTime() - now.getTime();
  if (untilStart <= 0) return 'NONE';
  if (booking.status === 'PENDING') return 'ALLOW';
  if (booking.status !== 'CONFIRMED') return 'NONE';
  return untilStart >= USER_CANCEL_WINDOW_MS ? 'ALLOW' : 'CALL_OWNER';
}

const DAY = 24 * HOUR;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Midnight of a calendar day as a UTC instant, or NaN when the day does not exist. setUTCFullYear keeps years 0 to 99 as they are. */
function utcMidnight(ymd: string): number {
  const match = YMD.exec(ymd);
  if (!match) return Number.NaN;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? date.getTime() : Number.NaN;
}

function formatYmd(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

/** Brief F-016: the calendar day of an instant in Asia/Ho_Chi_Minh, as YYYY-MM-DD. */
export function vnDateString(at: Date): string {
  return formatYmd(at.getTime() + VN_OFFSET);
}

/** Brief F-016: true for a day that exists, such as 2028-02-29. False for any other string. It never throws. */
export function isRealDate(ymd: string): boolean {
  return typeof ymd === 'string' && !Number.isNaN(utcMidnight(ymd));
}

/** Brief F-016: the calendar day that is `days` after `ymd` (before when negative). Throws a RangeError when `ymd` is not a real date. */
export function addDaysYmd(ymd: string, days: number): string {
  const base = utcMidnight(ymd);
  if (Number.isNaN(base)) throw new RangeError(`Not a real date: ${ymd}`);
  return formatYmd(base + days * DAY);
}

/**
 * Brief F-016: the Monday to Sunday week of a day in Asia/Ho_Chi_Minh.
 * `from` is Monday 00:00. `to` is the next Monday 00:00 and is not part of the week: filter with `gte: from, lt: to`.
 */
export function vnWeekRange(ymd: string): { weekStart: string; weekEnd: string; from: Date; to: Date } {
  const base = utcMidnight(ymd);
  if (Number.isNaN(base)) throw new RangeError(`Not a real date: ${ymd}`);
  const daysFromMonday = (new Date(base).getUTCDay() + 6) % 7; // Sunday is 0 and counts 6 days from Monday.
  const mondayUtc = base - daysFromMonday * DAY;
  const from = new Date(mondayUtc - VN_OFFSET);
  return {
    weekStart: formatYmd(mondayUtc),
    weekEnd: formatYmd(mondayUtc + 6 * DAY),
    from,
    to: new Date(from.getTime() + 7 * DAY),
  };
}
