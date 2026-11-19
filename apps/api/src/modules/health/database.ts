import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';

@Injectable()
export class Database implements OnModuleDestroy {
  private readonly pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

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
