import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { DevOtpSender, EsmsOtpSender, OTP_SENDER, type OtpSender } from './otp-sender.js';
import { OtpService } from './otp.service.js';

@Global()
@Module({
  imports: [AuthModule],
  providers: [
    OtpService,
    {
      provide: OTP_SENDER,
      useFactory: (prisma: PrismaService): OtpSender => {
        const provider = process.env.OTP_PROVIDER;
        if (provider === 'esms') return new EsmsOtpSender();
        if (provider === 'dev') return new DevOtpSender(prisma);
        return {
          async send(): Promise<void> {
            throw new Error('OTP_PROVIDER is not configured');
          },
        };
      },
      inject: [PrismaService],
    },
  ],
  exports: [OtpService, OTP_SENDER],
})
export class OtpModule {}
