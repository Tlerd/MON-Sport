import type { CourtView, VenueView } from '@monsport/shared';
import type { Court, Venue } from '../../generated/prisma/client.js';

export function toCourtView({ id, name, sport, priceNormal, pricePeak }: Court): CourtView {
  return { id, name, sport, priceNormal, pricePeak };
}

export function toVenueView({ id, name, address, phone, opensAt, closesAt, courts }: Venue & { courts: Court[] }): VenueView {
  return { id, name, address, phone, opensAt, closesAt, courts: courts.map(toCourtView) };
}
