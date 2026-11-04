import type { VenueView } from '@monsport/shared';

export interface CourtLabel {
  courtName: string;
  venueName: string;
}

/** Text for the time left before a booking request expires, rounded down to minutes. */
export function deadlineLeft(confirmDeadline: string | null, now: Date): string {
  if (confirmDeadline === null) return '';
  const ms = Date.parse(confirmDeadline) - now.getTime();
  if (ms <= 0) return 'Hết hạn';
  const min = Math.floor(ms / 60000);
  if (min === 0) return 'Còn dưới 1 phút';
  const hours = Math.floor(min / 60);
  const rest = min % 60;
  if (hours > 0 && rest > 0) return `Còn ${hours} giờ ${rest} phút`;
  if (hours > 0) return `Còn ${hours} giờ`;
  return `Còn ${rest} phút`;
}

/** Map from court id to the court name and venue name, for all courts of the venues. */
export function courtLabels(venues: VenueView[]): Map<string, CourtLabel> {
  const map = new Map<string, CourtLabel>();
  for (const venue of venues) {
    for (const court of venue.courts) {
      map.set(court.id, { courtName: court.name, venueName: venue.name });
    }
  }
  return map;
}
