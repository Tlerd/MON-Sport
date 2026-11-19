import { z } from 'zod';

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
  date: string;
  opensAt: number;
  closesAt: number;
  now: Date;
  busy: { startAt: Date; endAt: Date }[];
}

export function startOfDayVN(date: string): Date {
  return new Date(`${date}T00:00:00${VN_OFFSET}`);
}

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
