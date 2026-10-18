import { z } from 'zod';

// Brief F-008 (UC-2): the free hours of one court on one day. The server and the tests share freeRanges.
// Vietnam has no daylight saving time, so Asia/Ho_Chi_Minh is always UTC+7 (BR-27).

const MINUTE = 60_000;
const SLOT = 30 * MINUTE;
const HOUR = 60 * MINUTE;
const VN_OFFSET = '+07:00';

const Instant = z.iso.datetime({ offset: true });

export const AvailabilityQuery = z.object({ date: z.iso.date() }).strict();
export type AvailabilityQuery = z.infer<typeof AvailabilityQuery>;

export const FreeRange = z.object({ startAt: Instant, endAt: Instant });
export type FreeRange = z.infer<typeof FreeRange>;

export const Availability = z.object({
  courtId: z.uuid(),
  date: z.iso.date(),
  opensAt: z.int().min(0).max(1410),
  closesAt: z.int().min(30).max(1440),
  free: z.array(FreeRange),
});
export type Availability = z.infer<typeof Availability>;

export interface FreeRangesInput {
  /** `YYYY-MM-DD`, a day in Asia/Ho_Chi_Minh. */
  date: string;
  /** Minutes since 00:00 of `date`. */
  opensAt: number;
  /** Minutes since 00:00 of `date`. 1440 is 00:00 of the next day. */
  closesAt: number;
  now: Date;
  /** The time that PENDING (before the deadline) and CONFIRMED bookings hold. */
  busy: { startAt: Date; endAt: Date }[];
}

/** The start of `date` in Asia/Ho_Chi_Minh. */
export function startOfDayVN(date: string): Date {
  return new Date(`${date}T00:00:00${VN_OFFSET}`);
}

/**
 * The free time of a court on one day. The window runs from opening to closing (BR-27). It starts no earlier than the
 * first 30-minute mark after `now`, because a booking starts after now (BR-2). The busy time comes out of it, and a
 * range shorter than 1 hour goes (BR-3).
 */
export function freeRanges({ date, opensAt, closesAt, now, busy }: FreeRangesInput): FreeRange[] {
  const dayStart = startOfDayVN(date).getTime();
  const windowEnd = dayStart + closesAt * MINUTE;
  const earliest = (Math.floor(now.getTime() / SLOT) + 1) * SLOT;
  let cursor = Math.max(dayStart + opensAt * MINUTE, earliest);
  const free: FreeRange[] = [];
  const keep = (from: number, to: number) => {
    if (to - from >= HOUR) free.push({ startAt: new Date(from).toISOString(), endAt: new Date(to).toISOString() });
  };
  for (const { startAt, endAt } of [...busy].sort((a, b) => a.startAt.getTime() - b.startAt.getTime())) {
    if (cursor >= windowEnd) break;
    if (startAt.getTime() > cursor) keep(cursor, Math.min(startAt.getTime(), windowEnd));
    cursor = Math.max(cursor, endAt.getTime());
  }
  if (cursor < windowEnd) keep(cursor, windowEnd);
  return free;
}
