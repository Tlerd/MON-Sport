import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// CI sets DATABASE_URL. Locally the tests use the Postgres that `pnpm db:start` runs.
// The main checkout uses `monsport_test`. Each git worktree gets its own database, named from its path,
// so agents in two worktrees never share rows or locks. `prisma migrate deploy` creates a missing database.
const root = fileURLToPath(new URL('../../..', import.meta.url));
const isWorktree = statSync(`${root}/.git`, { throwIfNoEntry: false })?.isFile() ?? false;
const name = isWorktree ? `monsport_test_${createHash('sha1').update(root.toLowerCase()).digest('hex').slice(0, 8)}` : 'monsport_test';

export const TEST_DATABASE_URL = process.env.DATABASE_URL ?? `postgresql://monsport:monsport@localhost:55432/${name}`;
