import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';

const HEALTH_TIMEOUT_MS = 3_000;

@Injectable()
export class Database implements OnModuleDestroy {
  private readonly pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: HEALTH_TIMEOUT_MS,
    query_timeout: HEALTH_TIMEOUT_MS,
  });

  constructor() {
    this.pool.on('error', () => undefined);
  }

  async isUp(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
