import { z } from 'zod';

// Names and values follow docs/requirements/data-dictionary.md.
export const Role = z.enum(['ADMIN', 'OWNER', 'USER']);
export type Role = z.infer<typeof Role>;

export const Sport = z.enum(['FOOTBALL', 'BADMINTON']);
export type Sport = z.infer<typeof Sport>;

export const BookingStatus = z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED']);
export type BookingStatus = z.infer<typeof BookingStatus>;

export const BookingSource = z.enum(['APP', 'PHONE']);
export type BookingSource = z.infer<typeof BookingSource>;

export const Phone = z.string().regex(/^0\d{9}$/, 'Số điện thoại có 10 chữ số và bắt đầu bằng 0');

const Instant = z.iso.datetime({ offset: true });

export const LoginRequest = z.object({
  phone: Phone,
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const SessionUser = z.object({
  id: z.uuid(),
  name: z.string(),
  role: Role,
});
export type SessionUser = z.infer<typeof SessionUser>;

export const CourtView = z.object({
  id: z.uuid(),
  name: z.string(),
  sport: Sport,
  priceNormal: z.int().positive(),
  pricePeak: z.int().positive(),
});
export type CourtView = z.infer<typeof CourtView>;

export const VenueView = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  phone: Phone,
  opensAt: z.int().min(0).max(1410),
  closesAt: z.int().min(30).max(1440),
  courts: z.array(CourtView),
});
export type VenueView = z.infer<typeof VenueView>;

export const CreateBookingRequest = z.object({
  courtId: z.uuid(),
  startAt: Instant,
  endAt: Instant,
});
export type CreateBookingRequest = z.infer<typeof CreateBookingRequest>;

export const BookingView = z.object({
  id: z.uuid(),
  courtId: z.uuid(),
  startAt: Instant,
  endAt: Instant,
  status: BookingStatus,
  source: BookingSource,
  priceTotal: z.int().nonnegative(),
  confirmDeadline: Instant.nullable(),
  confirmedAt: Instant.nullable(),
  createdAt: Instant,
});
export type BookingView = z.infer<typeof BookingView>;

export const OwnerBookingView = BookingView.extend({
  customer: z.object({ name: z.string(), phone: Phone.nullable() }),
});
export type OwnerBookingView = z.infer<typeof OwnerBookingView>;
