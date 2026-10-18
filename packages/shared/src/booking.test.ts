import { describe, expect, it } from 'vitest';
import { BookingView, CALL_OWNER_MESSAGE, CreateBookingRequest, CreatePhoneBookingRequest, LoginRequest, MyBookingView, PHONE_MESSAGE } from './booking.ts';

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

  it('AC-1: a my booking view adds the court, the venue, and the public venue phone', () => {
    const mine = { ...view, courtName: 'Sân 1', venueName: 'Cầu lông A', venuePhone: '0911111111' };
    expect(MyBookingView.parse(mine)).toEqual(mine);
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
});
