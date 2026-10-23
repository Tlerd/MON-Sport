export const OTP_SENDER = 'OTP_SENDER';

export interface OtpSender {
  send(phone: string, code: string, channel: 'sms' | 'zalo'): Promise<void>;
}
