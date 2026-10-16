import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TEST_DATABASE_URL } from './database-url.js';

// Vitest global setup: bring the test database to the latest migration before any test runs.
// It runs from apps/api, where prisma.config.ts lives, whatever folder started Vitest.
// Global setup does not get `test.env`, so it passes the test database URL itself.
export default function setup(): void {
  execSync('pnpm exec prisma migrate deploy', {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
