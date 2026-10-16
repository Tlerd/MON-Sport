import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 reads no .env file by itself. CI sets DATABASE_URL directly.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.ts',
  },
  // process.env, not env(): `prisma generate` runs at install time, when no database exists.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
