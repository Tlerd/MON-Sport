import type { CourtView, VenueView } from '@monsport/shared';
import type { Court, Venue } from '../../generated/prisma/client.js';

// Each field is named, so a new column does not leak to the public list, which needs no login.

/** The public shape of a court: no venueId. */
export function toCourtView({ id, name, sport, priceNormal, pricePeak }: Court): CourtView {
  return { id, name, sport, priceNormal, pricePeak };
}

/** The public shape of a venue: no ownerId. The caller orders the courts. */
export function toVenueView({ id, name, address, phone, opensAt, closesAt, courts }: Venue & { courts: Court[] }): VenueView {
  return { id, name, address, phone, opensAt, closesAt, courts: courts.map(toCourtView) };
}
