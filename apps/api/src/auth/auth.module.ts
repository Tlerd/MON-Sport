import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AUTH_PROVIDER } from './auth.constants';
import { MockZaloProvider } from './providers/mock-zalo.provider';

// Bind thang toi MockZaloProvider (useClass) — chua can factory theo bien moi
// truong vi moi co dung 1 adapter. Them nhanh env khi co adapter that thu hai.
@Module({
  controllers: [AuthController],
  providers: [AuthService, { provide: AUTH_PROVIDER, useClass: MockZaloProvider }],
})
export class AuthModule {}
