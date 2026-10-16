import { describe, expect, it } from 'vitest';
import { CourtInput, errorMessage, Messages, RegisterRequest, VenueInput, VenueUpdate } from './account.ts';

const lan = { name: '  Lan ', phone: '0901112233', password: 'matkhau123', consent: true };
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

  it('answers a generic message for an error without a Vietnamese text', () => {
    expect(messageOf(RegisterRequest.safeParse({ ...lan, phone: 42 }))).toBe(Messages.invalid);
  });

  it('accepts a venue that opens at 06:00 and closes at 23:00', () => {
    expect(VenueInput.parse(venue)).toEqual(venue);
  });

  it('AC-12: refuses a venue that closes before it opens', () => {
    expect(messageOf(VenueInput.safeParse({ ...venue, opensAt: 1380, closesAt: 360 }))).toBe(Messages.hours);
  });

  it('refuses opening hours off the 30-minute grid', () => {
    expect(messageOf(VenueInput.safeParse({ ...venue, opensAt: 375 }))).toBe(Messages.grid);
  });

  it('accepts a partial venue update', () => {
    expect(VenueUpdate.parse({ closesAt: 1320 })).toEqual({ closesAt: 1320 });
  });

  it('refuses a court price of 0', () => {
    expect(messageOf(CourtInput.safeParse({ name: 'Sân 1', sport: 'BADMINTON', priceNormal: 0, pricePeak: 120_000 }))).toBe(Messages.price);
  });
});
