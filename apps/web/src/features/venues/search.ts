import type { CourtView, VenueView } from '@monsport/shared';

export function normalizeName(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
}

export interface VenueMatch {
  venue: VenueView;
  courts: CourtView[];
}

export function findVenues(venues: VenueView[], query: string): VenueMatch[] {
  const wanted = normalizeName(query);
  if (!wanted) return [];
  return venues
    .map((venue) => ({ venue, courts: venue.courts.filter((c) => normalizeName(c.name).includes(wanted)) }))
    .filter((match) => match.courts.length > 0)
    .sort((a, b) => a.venue.name.localeCompare(b.venue.name, 'vi'));
}
