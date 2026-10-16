import { Module } from '@nestjs/common';
import { Database } from './database.js';
import { HealthController } from './health.controller.js';

@Module({
  controllers: [HealthController],
  providers: [Database],
})
export class HealthModule {}
