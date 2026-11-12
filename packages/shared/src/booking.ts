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
  seriesId: z.uuid().nullable().optional(),
});
export type BookingView = z.infer<typeof BookingView>;

// Brief F-011: declared here and re-exported in match.ts so MyBookingView and match.ts share them without a cycle.
export const MatchStatus = z.enum(['OPEN', 'FULL', 'CANCELLED', 'FINISHED']);
export type MatchStatus = z.infer<typeof MatchStatus>;

export const MatchSummary = z.object({
  id: z.uuid(),
  status: MatchStatus,
  capacity: z.int().min(2).max(30),
  joinedCount: z.int().nonnegative(),
  pricePerSlot: z.int().nonnegative(),
});
export type MatchSummary = z.infer<typeof MatchSummary>;

/** Brief F-009 & F-011: the history of the user. venuePhone is the public phone of the venue, as in VenueView. */
export const MyBookingView = BookingView.extend({
  courtName: z.string(),
  venueName: z.string(),
  venuePhone: Phone,
  sport: Sport,
  match: MatchSummary.nullable(),
});
export type MyBookingView = z.infer<typeof MyBookingView>;

export const CALL_OWNER_MESSAGE = 'Còn dưới 6 giờ nữa tới giờ bắt đầu. Hãy gọi chủ sân';

export const OwnerBookingView = BookingView.extend({
  paidAtVenue: z.boolean().default(false),
  customer: z.object({ name: z.string(), phone: Phone.nullable() }),
});
export type OwnerBookingView = z.infer<typeof OwnerBookingView>;

export const RECURRING_MIN_WEEKS = 2;
export const RECURRING_MAX_WEEKS = 12;
export const ALL_WEEKS_TAKEN = 'Mọi buổi đều đã có người đặt';

export const RecurringPhoneBookingRequest = CreatePhoneBookingRequest.extend({
  weeks: z.int().min(RECURRING_MIN_WEEKS).max(RECURRING_MAX_WEEKS),
}).strict();
export type RecurringPhoneBookingRequest = z.infer<typeof RecurringPhoneBookingRequest>;

export const RecurringPhoneBookingResponse = z.object({
  seriesId: z.uuid(),
  created: z.array(OwnerBookingView),
  skipped: z.array(z.object({ startAt: Instant, endAt: Instant })),
});
export type RecurringPhoneBookingResponse = z.infer<typeof RecurringPhoneBookingResponse>;


