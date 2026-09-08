import { Global, Module } from '@nestjs/common';
import { JwtModule as NestJwtModule } from '@nestjs/jwt';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET chưa được cấu hình trong .env');
}

// Boc JwtModule cua Nest thanh mot module @Global() rieng (giong PrismaModule)
// de UsersModule dung duoc JwtService ma khong phai import AuthModule.
@Global()
@Module({
  imports: [
    NestJwtModule.register({
      secret: jwtSecret,
      // So giay (khong dung chuoi "7d") de khop kieu `number` cua expiresIn,
      // tranh phai ep kieu sang StringValue cua thu vien `ms`.
      signOptions: { expiresIn: Number(process.env.JWT_EXPIRES_IN ?? 604_800) },
    }),
  ],
  exports: [NestJwtModule],
})
export class JwtModule {}
