import { describe, expect, it } from 'vitest';
import { errorMessage, Messages } from './account.ts';
import {
  GoogleCompleteRequest,
  GoogleOtpRequest,
  GoogleVerifyRequest,
  OtpCode,
  OtpResponse,
  ProvidersResponse,
} from './google-auth.ts';

const messageOf = (result: { success: boolean; error?: Parameters<typeof errorMessage>[0] }) =>
  result.success ? 'ok' : errorMessage(result.error!);

describe('google auth schemas', () => {
  describe('OtpCode', () => {
    it('accepts a 6-digit numeric string', () => {
      expect(OtpCode.parse('123456')).toBe('123456');
      expect(OtpCode.parse('000000')).toBe('000000');
      expect(OtpCode.parse('999999')).toBe('999999');
    });

    it('refuses code that is not exactly 6 digits', () => {
      expect(OtpCode.safeParse('12345').success).toBe(false);
      expect(OtpCode.safeParse('1234567').success).toBe(false);
      expect(OtpCode.safeParse('12345a').success).toBe(false);
      expect(OtpCode.safeParse('').success).toBe(false);
      expect(OtpCode.safeParse('abcdef').success).toBe(false);
    });
  });

  describe('GoogleOtpRequest', () => {
    it('accepts google_signup with valid phone and consent true', () => {
      const valid = { purpose: 'google_signup', phone: '0901112233', consent: true };
      expect(GoogleOtpRequest.parse(valid)).toEqual(valid);
    });

    it('AC-41: refuses google_signup when consent is false or missing', () => {
      const withFalse = { purpose: 'google_signup', phone: '0901112233', consent: false };
      expect(messageOf(GoogleOtpRequest.safeParse(withFalse))).toBe(Messages.consent);

      const withoutConsent = { purpose: 'google_signup', phone: '0901112233' };
      expect(messageOf(GoogleOtpRequest.safeParse(withoutConsent))).toBe(Messages.consent);
    });

    it('refuses google_signup with invalid phone number', () => {
      const invalidPhone = { purpose: 'google_signup', phone: '090111223', consent: true };
      expect(GoogleOtpRequest.safeParse(invalidPhone).success).toBe(false);
    });

    it('accepts google_verify without phone or consent', () => {
      const valid = { purpose: 'google_verify' };
      expect(GoogleOtpRequest.parse(valid)).toEqual(valid);
    });

    it('refuses an unknown purpose', () => {
      expect(GoogleOtpRequest.safeParse({ purpose: 'other' }).success).toBe(false);
    });
  });

  describe('GoogleCompleteRequest', () => {
    const valid = {
      name: '  Lan ',
      phone: '0901112233',
      code: '123456',
      consent: true,
    };

    it('accepts valid complete request and trims name', () => {
      expect(GoogleCompleteRequest.parse(valid)).toEqual({
        name: 'Lan',
        phone: '0901112233',
        code: '123456',
        consent: true,
      });
    });

    it('refuses code that is not 6 digits', () => {
      expect(GoogleCompleteRequest.safeParse({ ...valid, code: '12345' }).success).toBe(false);
      expect(GoogleCompleteRequest.safeParse({ ...valid, code: '1234567' }).success).toBe(false);
      expect(GoogleCompleteRequest.safeParse({ ...valid, code: '12345a' }).success).toBe(false);
    });

    it('refuses consent false or missing', () => {
      expect(messageOf(GoogleCompleteRequest.safeParse({ ...valid, consent: false }))).toBe(Messages.consent);
      const { consent: _c, ...withoutConsent } = valid;
      expect(messageOf(GoogleCompleteRequest.safeParse(withoutConsent))).toBe(Messages.consent);
    });

    it('refuses invalid phone or empty name', () => {
      expect(GoogleCompleteRequest.safeParse({ ...valid, phone: '123' }).success).toBe(false);
      expect(GoogleCompleteRequest.safeParse({ ...valid, name: '   ' }).success).toBe(false);
    });
  });

  describe('GoogleVerifyRequest', () => {
    it('accepts a 6-digit code', () => {
      expect(GoogleVerifyRequest.parse({ code: '654321' })).toEqual({ code: '654321' });
    });

    it('refuses a code that is not 6 digits', () => {
      expect(GoogleVerifyRequest.safeParse({ code: '123' }).success).toBe(false);
      expect(GoogleVerifyRequest.safeParse({ code: '1234567' }).success).toBe(false);
    });
  });

  describe('ProvidersResponse and OtpResponse', () => {
    it('validates ProvidersResponse', () => {
      expect(ProvidersResponse.parse({ google: true })).toEqual({ google: true });
      expect(ProvidersResponse.parse({ google: false })).toEqual({ google: false });
      expect(ProvidersResponse.safeParse({ google: 'yes' }).success).toBe(false);
    });

    it('validates OtpResponse', () => {
      expect(OtpResponse.parse({ resendAfter: 60 })).toEqual({ resendAfter: 60 });
      expect(OtpResponse.safeParse({ resendAfter: -1 }).success).toBe(false);
      expect(OtpResponse.safeParse({ resendAfter: 1.5 }).success).toBe(false);
    });
  });
});
