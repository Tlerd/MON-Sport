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

export const PHONE_MESSAGE = 'Số điện thoại có 10 chữ số và bắt đầu bằng 0';
export const Phone = z.string().regex(/^0\d{9}$/, PHONE_MESSAGE);

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

/**
 * Brief F-007 (UC-5): an owner enters the booking of a customer who phoned. The name and the phone are optional.
 * A name of only spaces counts as no name.
 */
export const CreatePhoneBookingRequest = CreateBookingRequest.extend({
  customerName: z
    .string()
    .trim()
    .max(100)
    .transform((name) => name || undefined)
    .optional(),
  // An empty phone box counts as no phone.
  customerPhone: z.preprocess((phone) => (phone === '' ? undefined : phone), Phone.optional()),
}).strict();
export type CreatePhoneBookingRequest = z.infer<typeof CreatePhoneBookingRequest>;

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
  cancelledAt: Instant.nullable(),
  createdAt: Instant,
});
export type BookingView = z.infer<typeof BookingView>;

export const OwnerBookingView = BookingView.extend({
  customer: z.object({ name: z.string(), phone: Phone.nullable() }),
});
export type OwnerBookingView = z.infer<typeof OwnerBookingView>;
