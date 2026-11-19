import { z } from 'zod';
import { Messages } from './account.ts';
import { Phone } from './booking.ts';

export const OTP_CODE_MESSAGE = 'Mã OTP gồm 6 chữ số';
export const OtpCode = z.string().regex(/^\d{6}$/, OTP_CODE_MESSAGE);

export const ProvidersResponse = z.object({
  google: z.boolean(),
});
export type ProvidersResponse = z.infer<typeof ProvidersResponse>;

export const OtpResponse = z.object({
  resendAfter: z.int().min(0),
});
export type OtpResponse = z.infer<typeof OtpResponse>;

export const GoogleOtpSignupRequest = z.object({
  purpose: z.literal('google_signup'),
  phone: Phone,
  consent: z.literal(true, { error: Messages.consent }),
});
export type GoogleOtpSignupRequest = z.infer<typeof GoogleOtpSignupRequest>;

export const GoogleOtpVerifyRequest = z.object({
  purpose: z.literal('google_verify'),
});
export type GoogleOtpVerifyRequest = z.infer<typeof GoogleOtpVerifyRequest>;

export const GoogleOtpRequest = z.discriminatedUnion('purpose', [
  GoogleOtpSignupRequest,
  GoogleOtpVerifyRequest,
]);
export type GoogleOtpRequest = z.infer<typeof GoogleOtpRequest>;

const Name = z.string({ error: Messages.name }).trim().min(1, Messages.name).max(100, Messages.name);

export const GoogleCompleteRequest = z.object({
  name: Name,
  phone: Phone,
  code: OtpCode,
  consent: z.literal(true, { error: Messages.consent }),
});
export type GoogleCompleteRequest = z.infer<typeof GoogleCompleteRequest>;

export const GoogleVerifyRequest = z.object({
  code: OtpCode,
});
export type GoogleVerifyRequest = z.infer<typeof GoogleVerifyRequest>;

export const GooglePendingView = z.object({
  name: z.string(),
  email: z.string().nullable(),
});
export type GooglePendingView = z.infer<typeof GooglePendingView>;

export const GoogleLinkStartRequest = z.object({
  password: z.string().min(1),
});
export type GoogleLinkStartRequest = z.infer<typeof GoogleLinkStartRequest>;

export const GoogleLinkStartResponse = z.object({
  url: z.string(),
});
export type GoogleLinkStartResponse = z.infer<typeof GoogleLinkStartResponse>;
