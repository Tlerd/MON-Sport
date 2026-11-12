import { describe, expect, it } from 'vitest';
import {
  ALL_WEEKS_TAKEN,
  BookingView,
  CALL_OWNER_MESSAGE,
  CreateBookingRequest,
  CreatePhoneBookingRequest,
  LoginRequest,
  MyBookingView,
  OwnerBookingView,
  PHONE_MESSAGE,
  RECURRING_MAX_WEEKS,
  RECURRING_MIN_WEEKS,
  RecurringPhoneBookingRequest,
  RecurringPhoneBookingResponse,
  Role,
  SessionUser,
} from './booking.ts';

const slot = { courtId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', startAt: '2026-11-20T17:00:00+07:00', endAt: '2026-11-20T18:00:00+07:00' };

describe('phone booking contract, brief F-007', () => {
  it('accepts a name and a phone, and trims the name', () => {
    expect(CreatePhoneBookingRequest.parse({ ...slot, customerName: ' Chú Tư ', customerPhone: '0987654321' })).toEqual({
      ...slot,
      customerName: 'Chú Tư',
      customerPhone: '0987654321',
    });
  });

  it('AC-2: accepts no name and no phone, and reads a name of spaces as no name', () => {
    expect(CreatePhoneBookingRequest.parse(slot)).toEqual(slot);
    expect(CreatePhoneBookingRequest.parse({ ...slot, customerName: '   ', customerPhone: '' })).toEqual(slot);
  });

  it('AC-6: refuses a customer phone that is not 10 digits from 0, with the phone text', () => {
    const result = CreatePhoneBookingRequest.safeParse({ ...slot, customerPhone: '12345' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(PHONE_MESSAGE);
  });

  it('refuses a name above 100 characters, and an unknown field', () => {
    expect(CreatePhoneBookingRequest.safeParse({ ...slot, customerName: 'a'.repeat(101) }).success).toBe(false);
    expect(CreatePhoneBookingRequest.safeParse({ ...slot, status: 'PENDING' }).success).toBe(false);
  });
});

describe('my booking contract, brief F-009', () => {
  const view = {
    id: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
    courtId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c',
    startAt: '2026-11-20T20:00:00+07:00',
    endAt: '2026-11-20T21:00:00+07:00',
    status: 'CANCELLED',
    source: 'APP',
    priceTotal: 120_000,
    confirmDeadline: null,
    confirmedAt: null,
    cancelledAt: '2026-11-20T10:00:00+07:00',
    createdAt: '2026-11-20T08:00:00+07:00',
  };

  it('AC-1: a my booking view adds the court, the venue, the public venue phone, the sport, and an optional match summary', () => {
    const mine = { ...view, courtName: 'Sân 1', venueName: 'Cầu lông A', venuePhone: '0911111111', sport: 'BADMINTON', match: null };
    expect(MyBookingView.parse(mine)).toEqual(mine);
    const withMatch = {
      ...mine,
      match: { id: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d', status: 'OPEN', capacity: 4, joinedCount: 1, pricePerSlot: 50_000 },
    };
    expect(MyBookingView.parse(withMatch)).toEqual(withMatch);
    expect(BookingView.safeParse(view).success).toBe(true);
    expect(MyBookingView.safeParse(view).success).toBe(false);
    expect(MyBookingView.safeParse({ ...mine, venuePhone: '911111111' }).success).toBe(false);
  });

  it('AC-4: the call-the-owner text is fixed', () => {
    expect(CALL_OWNER_MESSAGE).toBe('Còn dưới 6 giờ nữa tới giờ bắt đầu. Hãy gọi chủ sân');
  });
});

describe('booking contract', () => {
  it('accepts a booking request with offsets', () => {
    const body = {
      courtId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
      startAt: '2026-11-20T20:00:00+07:00',
      endAt: '2026-11-20T21:00:00+07:00',
    };
    expect(CreateBookingRequest.parse(body)).toEqual(body);
  });

  it('refuses a booking request without a time zone', () => {
    const body = { courtId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', startAt: '2026-11-20T20:00:00', endAt: '2026-11-20T21:00:00' };
    expect(CreateBookingRequest.safeParse(body).success).toBe(false);
  });

  it('refuses a phone number that is not 10 digits from 0', () => {
    expect(LoginRequest.safeParse({ phone: '901234567', password: 'x' }).success).toBe(false);
  });

  it('OwnerBookingView includes paidAtVenue with default false', () => {
    const ownerBooking = {
      id: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
      courtId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c',
      startAt: '2026-11-20T20:00:00+07:00',
      endAt: '2026-11-20T21:00:00+07:00',
      status: 'CONFIRMED',
      source: 'APP',
      priceTotal: 120_000,
      confirmDeadline: null,
      confirmedAt: '2026-11-20T10:00:00+07:00',
      cancelledAt: null,
      createdAt: '2026-11-20T08:00:00+07:00',
      customer: { name: 'An', phone: '0901234567' },
    };
    expect(OwnerBookingView.parse(ownerBooking)).toEqual({
      ...ownerBooking,
      paidAtVenue: false,
    });
    expect(OwnerBookingView.parse({ ...ownerBooking, paidAtVenue: true })).toEqual({
      ...ownerBooking,
      paidAtVenue: true,
    });
  });
});

describe('recurring phone booking contract, brief F-030', () => {
  const recurringSlot = {
    ...slot,
    customerName: 'Chú Tư',
    customerPhone: '0987654321',
    weeks: 4,
  };

  it('AC-1: RecurringPhoneBookingRequest accepts all fields of CreatePhoneBookingRequest and integer weeks from 2 to 12', () => {
    expect(RECURRING_MIN_WEEKS).toBe(2);
    expect(RECURRING_MAX_WEEKS).toBe(12);
    expect(ALL_WEEKS_TAKEN).toBe('Mọi buổi đều đã có người đặt');

    for (let w = 2; w <= 12; w++) {
      const parsed = RecurringPhoneBookingRequest.parse({ ...recurringSlot, weeks: w });
      expect(parsed.weeks).toBe(w);
      expect(parsed.courtId).toBe(recurringSlot.courtId);
      expect(parsed.startAt).toBe(recurringSlot.startAt);
      expect(parsed.endAt).toBe(recurringSlot.endAt);
      expect(parsed.customerName).toBe('Chú Tư');
      expect(parsed.customerPhone).toBe('0987654321');
    }
  });

  it('AC-1: RecurringPhoneBookingRequest rejects weeks values 1, 13, and 2.5', () => {
    expect(RecurringPhoneBookingRequest.safeParse({ ...recurringSlot, weeks: 1 }).success).toBe(false);
    expect(RecurringPhoneBookingRequest.safeParse({ ...recurringSlot, weeks: 13 }).success).toBe(false);
    expect(RecurringPhoneBookingRequest.safeParse({ ...recurringSlot, weeks: 2.5 }).success).toBe(false);
  });

  it('AC-1: RecurringPhoneBookingResponse schema contains seriesId (uuid), created (array of OwnerBookingView), skipped (array of { startAt, endAt })', () => {
    const validResponse = {
      seriesId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a50',
      created: [
        {
          id: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a51',
          courtId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
          startAt: '2026-11-20T17:00:00+07:00',
          endAt: '2026-11-20T18:00:00+07:00',
          status: 'CONFIRMED',
          source: 'PHONE',
          priceTotal: 100_000,
          confirmDeadline: null,
          confirmedAt: '2026-11-12T10:00:00+07:00',
          cancelledAt: null,
          createdAt: '2026-11-12T10:00:00+07:00',
          paidAtVenue: false,
          customer: { name: 'Chú Tư', phone: '0987654321' },
          seriesId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a50',
        },
      ],
      skipped: [
        {
          startAt: '2026-11-27T17:00:00+07:00',
          endAt: '2026-11-27T18:00:00+07:00',
        },
      ],
    };

    expect(RecurringPhoneBookingResponse.parse(validResponse)).toEqual(validResponse);

    expect(
      RecurringPhoneBookingResponse.safeParse({
        ...validResponse,
        seriesId: 'not-a-uuid',
      }).success,
    ).toBe(false);

    expect(
      RecurringPhoneBookingResponse.safeParse({
        ...validResponse,
        created: [{ id: 'invalid-owner-booking' }],
      }).success,
    ).toBe(false);

    expect(
      RecurringPhoneBookingResponse.safeParse({
        ...validResponse,
        skipped: [{ startAt: '2026-11-27T17:00:00+07:00' }],
      }).success,
    ).toBe(false);
  });

  it('AC-1: BookingView and OwnerBookingView support optional nullable seriesId', () => {
    const ownerBooking = {
      id: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
      courtId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c',
      startAt: '2026-11-20T20:00:00+07:00',
      endAt: '2026-11-20T21:00:00+07:00',
      status: 'CONFIRMED',
      source: 'PHONE',
      priceTotal: 120_000,
      confirmDeadline: null,
      confirmedAt: '2026-11-20T10:00:00+07:00',
      cancelledAt: null,
      createdAt: '2026-11-20T08:00:00+07:00',
      paidAtVenue: false,
      customer: { name: 'An', phone: '0901234567' },
    };

    // without seriesId
    expect(BookingView.parse(ownerBooking).seriesId).toBeUndefined();
    expect(OwnerBookingView.parse(ownerBooking).seriesId).toBeUndefined();

    // with null seriesId
    expect(BookingView.parse({ ...ownerBooking, seriesId: null }).seriesId).toBeNull();
    expect(OwnerBookingView.parse({ ...ownerBooking, seriesId: null }).seriesId).toBeNull();

    // with uuid seriesId
    const uuid = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d';
    expect(BookingView.parse({ ...ownerBooking, seriesId: uuid }).seriesId).toBe(uuid);
    expect(OwnerBookingView.parse({ ...ownerBooking, seriesId: uuid }).seriesId).toBe(uuid);
  });
});

describe('staff role, brief F-031', () => {
  it('AC-1: Role includes STAFF and SessionUser accepts STAFF role', () => {
    expect(Role.parse('STAFF')).toBe('STAFF');
    expect(Role.options).toContain('STAFF');
    const staffSession = {
      id: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
      name: 'Nhân viên A',
      role: 'STAFF',
    };
    expect(SessionUser.parse(staffSession)).toEqual(staffSession);
  });
});

