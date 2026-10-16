// Starts the local development Postgres on port 55432: `pnpm db:start`.
// The first run creates a cluster owned by the role `monsport` with the databases
// `monsport_dev` and `monsport_test`. It needs no superuser password of the system Postgres.
// The password is a local test value. apps/api/.env.example and apps/api/vitest.config.ts use it.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = '55432';
const USER = 'monsport';
const PASSWORD = 'monsport';
const BIN = process.env.PG_BIN ?? 'C:\\Program Files\\PostgreSQL\\18\\bin';
const HOME = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'monsport') : join(homedir(), '.monsport');
const DATA = join(HOME, 'pgdata');
const exe = (name) => join(BIN, process.platform === 'win32' ? `${name}.exe` : name);
const env = { ...process.env, PGPASSWORD: PASSWORD };
const run = (name, args) => {
  const r = spawnSync(exe(name), args, { encoding: 'utf8', env });
  if (r.status !== 0) throw new Error(`${name} failed: ${(r.stderr || r.stdout || r.error?.message || '').trim()}`);
  return r.stdout;
};
const ready = () => spawnSync(exe('pg_isready'), ['-h', 'localhost', '-p', PORT], { env }).status === 0;

if (!existsSync(exe('initdb'))) {
  console.error(`Postgres binaries not found in ${BIN}. Set PG_BIN to the folder that holds initdb.`);
  process.exit(1);
}

const fresh = !existsSync(DATA);
if (fresh) {
  mkdirSync(HOME, { recursive: true });
  const pwfile = join(tmpdir(), `monsport-pw-${process.pid}`);
  writeFileSync(pwfile, PASSWORD);
  try {
    run('initdb', ['-D', DATA, '-U', USER, '--auth=scram-sha-256', `--pwfile=${pwfile}`, '-E', 'UTF8', '--locale=C']);
  } finally {
    rmSync(pwfile, { force: true });
  }
}

if (!ready()) {
  // Detached, with no inherited pipes, so this script exits while the server keeps running.
  spawn(exe('pg_ctl'), ['-D', DATA, '-l', join(HOME, 'pg.log'), '-o', `-p ${PORT} -c listen_addresses=localhost`, 'start'], {
    detached: true,
    stdio: 'ignore',
  }).unref();
  for (let i = 0; i < 30 && !ready(); i++) spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},500)']);
}
if (!ready()) {
  console.error(`Postgres did not start. Read ${join(HOME, 'pg.log')}.`);
  process.exit(1);
}

if (fresh) for (const db of ['monsport_dev', 'monsport_test']) run('createdb', ['-h', 'localhost', '-p', PORT, '-U', USER, db]);
console.log(`Postgres runs on localhost:${PORT}. Data: ${DATA}`);
