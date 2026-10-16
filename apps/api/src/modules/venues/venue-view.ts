import type { CourtView, VenueView } from '@monsport/shared';
import type { Court, Venue } from '../../generated/prisma/client.js';

/** The public shape of a court: no venueId. */
export function toCourtView({ venueId: _venueId, ...court }: Court): CourtView {
  return court;
}

/** The public shape of a venue: no ownerId. The caller orders the courts. */
export function toVenueView({ ownerId: _ownerId, courts, ...venue }: Venue & { courts: Court[] }): VenueView {
  return { ...venue, courts: courts.map(toCourtView) };
}
