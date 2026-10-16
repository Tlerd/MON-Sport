import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse } from '@monsport/shared';
import { Database } from './database.js';

@Controller('health')
export class HealthController {
  constructor(private readonly db: Database) {}

  @Get()
  async get(): Promise<HealthResponse> {
    if (!(await this.db.isUp())) throw new ServiceUnavailableException({ status: 'error', db: 'down' } satisfies HealthResponse);
    return { status: 'ok', db: 'up' };
  }
}
