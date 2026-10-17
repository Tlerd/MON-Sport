import { describe, expect, it } from 'vitest';
import { CourtInput, CourtUpdate, CreateOwnerRequest, errorMessage, Messages, RegisterRequest, UserSearchRequest, VenueInput, VenueUpdate } from './account.ts';

const lan = { name: '  Lan ', phone: '0901112233', password: 'san-cau-long-2026', consent: true };
const venue = { ownerId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', name: 'Cầu lông C', address: '12 Lê Lợi', phone: '0912345680', opensAt: 360, closesAt: 1380 };
const messageOf = (result: { success: boolean; error?: Parameters<typeof errorMessage>[0] }) =>
  result.success ? 'ok' : errorMessage(result.error!);

describe('account contract', () => {
  it('accepts a sign-up and trims the name', () => {
    expect(RegisterRequest.parse(lan)).toEqual({ ...lan, name: 'Lan' });
  });

  it('AC-5: refuses a sign-up without consent, or with consent false', () => {
    expect(messageOf(RegisterRequest.safeParse({ ...lan, consent: false }))).toBe(Messages.consent);
    const { consent: _consent, ...withoutConsent } = lan;
    expect(messageOf(RegisterRequest.safeParse(withoutConsent))).toBe(Messages.consent);
  });

  it('AC-6: refuses a password of 7 characters', () => {
    expect(messageOf(RegisterRequest.safeParse({ ...lan, password: '1234567' }))).toBe(Messages.passwordLength);
  });

  it('AC-10: refuses a common password, in any case, a password with the phone number, and one repeated character', () => {
    for (const password of ['matkhau123', 'PASSWORD123', '12345678', 'aaaaaaaaaa', '0901112233x'])
      expect(messageOf(RegisterRequest.safeParse({ ...lan, password })), password).toBe(Messages.weakPassword);
    expect(messageOf(CreateOwnerRequest.safeParse({ name: 'Giang', phone: '0912345681', password: 'matkhau123' }))).toBe(Messages.weakPassword);
  });

  it('answers the length text before the weak-password text', () => {
    expect(messageOf(RegisterRequest.safeParse({ ...lan, password: 'aaaa' }))).toBe(Messages.passwordLength);
  });

  it('answers a generic message for an error without a Vietnamese text', () => {
    expect(messageOf(RegisterRequest.safeParse({ ...lan, phone: 42 }))).toBe(Messages.invalid);
  });

  it('accepts a venue that opens at 06:00 and closes at 23:00', () => {
    expect(VenueInput.parse(venue)).toEqual(venue);
  });

  it('AC-18: refuses a venue that closes before it opens', () => {
    expect(messageOf(VenueInput.safeParse({ ...venue, opensAt: 1380, closesAt: 360 }))).toBe(Messages.hours);
  });

  it('refuses opening hours off the 30-minute grid', () => {
    expect(messageOf(VenueInput.safeParse({ ...venue, opensAt: 375 }))).toBe(Messages.grid);
  });

  it('accepts a partial venue update', () => {
    expect(VenueUpdate.parse({ closesAt: 1320 })).toEqual({ closesAt: 1320 });
  });

  it('refuses opening hours outside 00:00-24:00 with the range text', () => {
    expect(messageOf(VenueInput.safeParse({ ...venue, opensAt: 1440, closesAt: 1440 }))).toBe(Messages.range);
  });

  it('refuses a court price of 0, and a price above 10.000.000đ', () => {
    const sanMot = { name: 'Sân 1', sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 };
    expect(messageOf(CourtInput.safeParse({ ...sanMot, priceNormal: 0 }))).toBe(Messages.price);
    expect(messageOf(CourtInput.safeParse({ ...sanMot, pricePeak: 10_000_001 }))).toBe(Messages.priceMax);
    expect(messageOf(CourtInput.safeParse({ ...sanMot, pricePeak: 80000.5 }))).toBe(Messages.invalid);
  });

  it('refuses a court update that changes the sport', () => {
    expect(CourtUpdate.safeParse({ sport: 'FOOTBALL' }).success).toBe(false);
    expect(CourtUpdate.parse({ pricePeak: 150_000 })).toEqual({ pricePeak: 150_000 });
  });

  it('answers the phone text for a short phone number', () => {
    expect(messageOf(UserSearchRequest.safeParse({ phone: '09' }))).toBe(Messages.phone);
  });
});
