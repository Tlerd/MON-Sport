import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { JwtModule } from './common/jwt/jwt.module';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PrismaModule, JwtModule, AuthModule, UsersModule],
  providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
})
export class AppModule {}
