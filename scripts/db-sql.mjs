#!/usr/bin/env node
// Runs SQL on the LOCAL development Postgres: pnpm db:sql "<sql>" [--db <name>] | pnpm db:sql --file <path> [--db <name>]
// The connection comes from DATABASE_URL in apps/api/.env (the shell only when that file is missing).
// Only the cluster of `pnpm db:start` is allowed: a local host on port 55432, with no URL options.
// That refuses Cloud SQL, its proxy on localhost:5433, and the `?host=/cloudsql/...` form of docs/deploy-gcp.md.
// psql gets a clean environment: every PG* variable is dropped (PGHOSTADDR and PGSERVICE could reroute it),
// and the password goes through PGPASSWORD, never on the command line.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
export const LOCAL_PORT = '55432';

export function envUrl(text = '') {
  const line = text.split(/\r?\n/).find((l) => /^\s*DATABASE_URL\s*=/.test(l));
  return line ? line.replace(/^\s*DATABASE_URL\s*=\s*/, '').replace(/^["']|["']\s*$/g, '').trim() : '';
}

/** The psql target for a DATABASE_URL. Throws for anything but the local db:start cluster. */
export function localTarget(url, db) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('DATABASE_URL is missing or not a URL. Copy apps/api/.env.example to apps/api/.env');
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) throw new Error(`DATABASE_URL is not a Postgres URL (${parsed.protocol})`);
  if (!LOCAL_HOSTS.has(parsed.hostname)) throw new Error(`refused: host ${parsed.hostname} is not local. db:sql runs on the local Postgres only`);
  if (parsed.port !== LOCAL_PORT) throw new Error(`refused: port ${parsed.port || '5432'} is not ${LOCAL_PORT}, the port of pnpm db:start (a Cloud SQL proxy listens on another local port)`);
  if (parsed.search) throw new Error('refused: DATABASE_URL has options (?host=, ?hostaddr=, ?service= can reroute psql)');
  const user = decodeURIComponent(parsed.username);
  if (!user) throw new Error('refused: DATABASE_URL has no user');
  const name = db ?? decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!/^[\w-]+$/.test(name)) throw new Error(`refused: database name "${name}"`);
  return { host: parsed.hostname.replace(/^\[|\]$/g, ''), port: LOCAL_PORT, user, password: decodeURIComponent(parsed.password), db: name };
}

export function psqlArgs(target, { sql, file }) {
  const base = ['-X', '-v', 'ON_ERROR_STOP=1', '-P', 'pager=off', '-h', target.host, '-p', target.port, '-U', target.user, '-d', target.db];
  return file ? [...base, '-f', file] : [...base, '-c', sql];
}

/** The environment for psql: no PG* variable from the shell, only the password of the target. */
export function psqlEnv(env, password) {
  const clean = Object.fromEntries(Object.entries(env).filter(([key]) => !/^PG/i.test(key)));
  return { ...clean, PGPASSWORD: password };
}

export function parseArgs(argv) {
  const opts = { sql: '', db: undefined, file: undefined };
  const value = (i, flag) => {
    const v = argv[i];
    if (v === undefined || v.startsWith('--')) throw new Error(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--db') opts.db = value(++i, '--db');
    else if (arg === '--file') opts.file = value(++i, '--file');
    else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}; use --db <name> or --file <path>`);
    else opts.sql = opts.sql ? `${opts.sql} ${arg}` : arg;
  }
  if (opts.sql && opts.file) throw new Error('give SQL text or --file, not both');
  if (!opts.sql && !opts.file) throw new Error('no SQL');
  return opts;
}

if (import.meta.main) {
  const usage = 'Usage: pnpm db:sql "<sql>" [--db <name>] | pnpm db:sql --file <path> [--db <name>]';
  let opts;
  let target;
  try {
    opts = parseArgs(process.argv.slice(2));
    const envFile = join(ROOT, 'apps', 'api', '.env');
    const url = existsSync(envFile) ? envUrl(readFileSync(envFile, 'utf8')) : process.env.DATABASE_URL ?? '';
    target = localTarget(url, opts.db);
  } catch (error) {
    console.error(`FAIL db:sql: ${error.message}\n${usage}`);
    process.exit(2);
  }
  const bin = process.env.PG_BIN || 'C:\\Program Files\\PostgreSQL\\18\\bin';
  const exe = join(bin, process.platform === 'win32' ? 'psql.exe' : 'psql');
  const r = spawnSync(existsSync(exe) ? exe : 'psql', psqlArgs(target, opts), { stdio: 'inherit', env: psqlEnv(process.env, target.password) });
  if (r.error) console.error(`FAIL db:sql: ${r.error.message}. Set PG_BIN to the folder that holds psql, and run pnpm db:start`);
  process.exit(r.status ?? 1);
}
