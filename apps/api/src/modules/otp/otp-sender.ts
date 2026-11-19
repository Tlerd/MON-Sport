import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { OtpSender } from './otp.types.js';

export { OTP_SENDER, type OtpSender } from './otp.types.js';

@Injectable()
export class DevOtpSender implements OtpSender {
  constructor(private readonly prisma: PrismaService) {}

  async send(phone: string, code: string, _channel: 'sms' | 'zalo'): Promise<void> {
    await this.prisma.devOtpOutbox.create({
      data: { phone, code },
    });
  }
}

@Injectable()
export class EsmsOtpSender implements OtpSender {
  async send(phone: string, code: string, _channel: 'sms' | 'zalo'): Promise<void> {
    const apiKey = process.env.ESMS_API_KEY;
    const secretKey = process.env.ESMS_SECRET_KEY;
    const brandname = process.env.ESMS_BRANDNAME;

    const res = await fetch('https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        ApiKey: apiKey,
        SecretKey: secretKey,
        Brandname: brandname,
        Phone: phone,
        Content: `Ma OTP MONSPORT cua ban la ${code}`,
        SmsType: '2',
      }),
    });

    if (!res.ok) {
      throw new Error(`eSMS send failed with HTTP ${res.status}`);
    }

    const data = (await res.json()) as { CodeResult?: string };
    if (data.CodeResult !== '100') {
      throw new Error(`eSMS send failed with CodeResult ${data.CodeResult ?? 'unknown'}`);
    }
  }
}
