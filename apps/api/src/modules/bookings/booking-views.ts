import type { BookingView, MyBookingView, OwnerBookingView } from '@monsport/shared';
import type { Booking, Prisma } from '../../generated/prisma/client.js';

export const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toView(b: Booking): BookingView {
  return {
    id: b.id,
    courtId: b.courtId,
    seriesId: b.seriesId ?? null,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    status: b.status,
    source: b.source,
    priceTotal: b.priceTotal,
    confirmDeadline: iso(b.confirmDeadline),
    confirmedAt: iso(b.confirmedAt),
    cancelledAt: iso(b.cancelledAt),
    createdAt: b.createdAt.toISOString(),
  };
}

export type BookingWithVenue = Prisma.BookingGetPayload<{ include: { court: { include: { venue: true } }; match: true } }>;

export function toMyView(b: BookingWithVenue): MyBookingView {
  const match = b.match
    ? {
        id: b.match.id,
        status: b.match.status,
        capacity: b.match.capacity,
        joinedCount: b.match.joinedCount,
        pricePerSlot: b.match.pricePerSlot,
      }
    : null;
  return { ...toView(b), courtName: b.court.name, venueName: b.court.venue.name, venuePhone: b.court.venue.phone, sport: b.court.sport, match };
}

export function toOwnerView(b: Booking & { createdBy: { name: string; phone: string } | null }): OwnerBookingView {
  const customer = b.source === 'PHONE' || !b.createdBy
    ? { name: b.customerName ?? '', phone: b.customerPhone }
    : { name: b.createdBy.name, phone: b.createdBy.phone };
  return { ...toView(b), paidAtVenue: b.paidAtVenue, customer };
}
