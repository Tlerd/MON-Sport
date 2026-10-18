import type { CourtView, VenueView } from '@monsport/shared';

/**
 * Brief F-010 (UC-2 2.1): a court name matches without case, accents, and extra spaces. The steps run in this order.
 * NFD does not split đ and Đ, so lower case comes first, and then đ is mapped by hand.
 */
export function normalizeName(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
}

export interface VenueMatch {
  venue: VenueView;
  courts: CourtView[];
}

/** The venues with at least one court whose name contains the query, by venue name. An empty query finds nothing. */
export function findVenues(venues: VenueView[], query: string): VenueMatch[] {
  const wanted = normalizeName(query);
  if (!wanted) return [];
  return venues
    .map((venue) => ({ venue, courts: venue.courts.filter((c) => normalizeName(c.name).includes(wanted)) }))
    .filter((match) => match.courts.length > 0)
    .sort((a, b) => a.venue.name.localeCompare(b.venue.name, 'vi'));
}
