import { Global, Module } from '@nestjs/common';
import { Clock } from './clock.js';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService, Clock],
  exports: [PrismaService, Clock],
})
export class DatabaseModule {}
