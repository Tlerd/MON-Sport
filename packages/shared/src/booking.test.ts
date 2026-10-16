import { describe, expect, it } from 'vitest';
import { CreateBookingRequest, LoginRequest } from './booking.ts';

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
