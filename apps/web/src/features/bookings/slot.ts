import { hhmm } from '../../lib/format.ts';

export const DURATIONS = [60, 90, 120, 150, 180];

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
