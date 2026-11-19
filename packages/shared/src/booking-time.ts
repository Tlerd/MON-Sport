import type { BookingStatus } from './booking.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const SLOT = 30 * MINUTE;
const VN_OFFSET = 7 * HOUR;
const PEAK_START = 17 * 60;
const PEAK_END = 22 * 60;

export function minuteOfDayVN(at: Date): number {
  return Math.floor((at.getTime() + VN_OFFSET) / MINUTE) % (24 * 60);
}

export function isOnGrid(at: Date): boolean {
  return at.getTime() % SLOT === 0;
}

export function isLongEnough(startAt: Date, endAt: Date): boolean {
  return endAt.getTime() - startAt.getTime() >= HOUR;
}

export function bookingPrice(startAt: Date, endAt: Date, priceNormal: number, pricePeak: number): number {
  let hourlySum = 0;
  for (let t = startAt.getTime(); t < endAt.getTime(); t += SLOT) {
    const minute = minuteOfDayVN(new Date(t));
    hourlySum += minute >= PEAK_START && minute < PEAK_END ? pricePeak : priceNormal;
  }
  return Math.round(hourlySum / 2);
}

export function confirmDeadline(requestedAt: Date, startAt: Date): Date {
  return new Date(Math.min(requestedAt.getTime() + 2 * HOUR, startAt.getTime() - HOUR));
}

export const USER_CANCEL_WINDOW_MS = 6 * HOUR;

export function userCancelDecision(booking: { status: BookingStatus; startAt: Date }, now: Date): 'ALLOW' | 'CALL_OWNER' | 'NONE' {
  const untilStart = booking.startAt.getTime() - now.getTime();
  if (untilStart <= 0) return 'NONE';
  if (booking.status === 'PENDING') return 'ALLOW';
  if (booking.status !== 'CONFIRMED') return 'NONE';
  return untilStart >= USER_CANCEL_WINDOW_MS ? 'ALLOW' : 'CALL_OWNER';
}

const DAY = 24 * HOUR;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

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

export function vnDateString(at: Date): string {
  return formatYmd(at.getTime() + VN_OFFSET);
}

export function isRealDate(ymd: string): boolean {
  return typeof ymd === 'string' && !Number.isNaN(utcMidnight(ymd));
}

export function addDaysYmd(ymd: string, days: number): string {
  const base = utcMidnight(ymd);
  if (Number.isNaN(base)) throw new RangeError(`Not a real date: ${ymd}`);
  return formatYmd(base + days * DAY);
}

export function vnWeekRange(ymd: string): { weekStart: string; weekEnd: string; from: Date; to: Date } {
  const base = utcMidnight(ymd);
  if (Number.isNaN(base)) throw new RangeError(`Not a real date: ${ymd}`);
  const daysFromMonday = (new Date(base).getUTCDay() + 6) % 7;
  const mondayUtc = base - daysFromMonday * DAY;
  const from = new Date(mondayUtc - VN_OFFSET);
  return {
    weekStart: formatYmd(mondayUtc),
    weekEnd: formatYmd(mondayUtc + 6 * DAY),
    from,
    to: new Date(from.getTime() + 7 * DAY),
  };
}
