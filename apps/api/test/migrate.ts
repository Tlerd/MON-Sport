import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TEST_DATABASE_URL } from './database-url.js';

// Vitest global setup: bring the test database to the latest migration before any test runs.
// It runs from apps/api, where prisma.config.ts lives, whatever folder started Vitest.
// Global setup does not get `test.env`, so it passes the test database URL itself.
export default function setup(): void {
  const result = spawnSync('pnpm exec prisma migrate deploy', {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
  if (result.status === 0) return;
  // Throw the Prisma text, not the raw child-process buffers.
  const prisma = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split(/\r?\n/).filter((line) => /error|P\d{4}/i.test(line));
  const hint = /P1001/.test(prisma.join('\n')) ? '\nFix: run `pnpm db:start`, then run the tests again.' : '';
  throw new Error(`prisma migrate deploy failed\n${prisma.join('\n') || result.error?.message}${hint}`);
}
