#!/usr/bin/env node
// Runs SQL on the LOCAL development Postgres: pnpm db:sql "<sql>" [--db <name>] [--file <path>]
// The connection comes from DATABASE_URL (the shell, then apps/api/.env). Any host other than
// localhost is refused, so this never reaches Cloud SQL or the live service.
// The password goes to psql through PGPASSWORD, never on the command line.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function envUrl(text = '') {
  const line = text.split(/\r?\n/).find((l) => /^\s*DATABASE_URL\s*=/.test(l));
  return line ? line.replace(/^\s*DATABASE_URL\s*=\s*/, '').replace(/^["']|["']\s*$/g, '').trim() : '';
}

/** The psql target for a DATABASE_URL. Throws for a URL that is not on this machine. */
export function localTarget(url, db) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('DATABASE_URL is missing or not a URL. Copy apps/api/.env.example to apps/api/.env');
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) throw new Error(`DATABASE_URL is not a Postgres URL (${parsed.protocol})`);
  if (!LOCAL_HOSTS.has(parsed.hostname)) throw new Error(`refused: host ${parsed.hostname} is not local. db:sql runs on the local Postgres only`);
  const name = db ?? decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!/^[\w-]+$/.test(name)) throw new Error(`refused: database name "${name}"`);
  return {
    host: parsed.hostname.replace(/^\[|\]$/g, ''),
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    db: name,
  };
}

export function psqlArgs(target, { sql, file }) {
  const base = ['-X', '-v', 'ON_ERROR_STOP=1', '-P', 'pager=off', '-h', target.host, '-p', target.port, '-U', target.user, '-d', target.db];
  return file ? [...base, '-f', file] : [...base, '-c', sql];
}

export function parseArgs(argv) {
  const opts = { sql: '', db: undefined, file: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--db') opts.db = argv[++i];
    else if (argv[i] === '--file') opts.file = argv[++i];
    else opts.sql = opts.sql ? `${opts.sql} ${argv[i]}` : argv[i];
  }
  return opts;
}

if (import.meta.main) {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.sql && !opts.file) {
    console.error('Usage: pnpm db:sql "<sql>" [--db <name>] [--file <path>]');
    process.exit(2);
  }
  const envFile = join(ROOT, 'apps', 'api', '.env');
  const url = process.env.DATABASE_URL || (existsSync(envFile) ? envUrl(readFileSync(envFile, 'utf8')) : '');
  let target;
  try {
    target = localTarget(url, opts.db);
  } catch (error) {
    console.error(`FAIL db:sql: ${error.message}`);
    process.exit(1);
  }
  const bin = process.env.PG_BIN ?? 'C:\\Program Files\\PostgreSQL\\18\\bin';
  const psql = existsSync(join(bin, 'psql.exe')) ? join(bin, 'psql.exe') : existsSync(join(bin, 'psql')) ? join(bin, 'psql') : 'psql';
  const r = spawnSync(psql, psqlArgs(target, opts), { stdio: 'inherit', env: { ...process.env, PGPASSWORD: target.password } });
  if (r.error) console.error(`FAIL db:sql: ${r.error.message}. Set PG_BIN to the folder that holds psql, and run pnpm db:start`);
  process.exit(r.status ?? 1);
}
