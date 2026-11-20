// Proves scripts/db-sql.mjs: it reaches only the local db:start cluster and keeps the password off argv.

import { expect, test } from 'vitest';
import { envUrl, localTarget, parseArgs, psqlArgs, psqlEnv } from '../scripts/db-sql.mjs';

test('envUrl reads DATABASE_URL from an .env text, with or without quotes', () => {
  expect(envUrl('A=1\nDATABASE_URL=postgresql://u:p@localhost:55432/monsport_dev\n')).toBe('postgresql://u:p@localhost:55432/monsport_dev');
  expect(envUrl('DATABASE_URL="postgresql://u:p@localhost/x"\r\n')).toBe('postgresql://u:p@localhost/x');
  expect(envUrl('OTHER=1')).toBe('');
});

test('localTarget accepts the db:start cluster on localhost, 127.0.0.1 or ::1, and takes --db over the URL database', () => {
  expect(localTarget('postgresql://monsport:monsport@localhost:55432/monsport_preview')).toEqual({
    host: 'localhost',
    port: '55432',
    user: 'monsport',
    password: 'monsport',
    db: 'monsport_preview',
  });
  expect(localTarget('postgres://u:p@127.0.0.1:55432/a', 'monsport_test').db).toBe('monsport_test');
  expect(localTarget('postgresql://u:p@[::1]:55432/a').host).toBe('::1');
});

test('localTarget refuses a remote host, another port, URL options, no user, a non-Postgres URL, and an odd database name', () => {
  expect(() => localTarget('postgresql://u:p@10.0.0.5:55432/monsport')).toThrow(/not local/);
  expect(() => localTarget('postgresql://u:p@localhost.example.com:55432/monsport')).toThrow(/not local/);
  expect(() => localTarget('postgresql://u:p@localhost:5433/monsport')).toThrow(/port 5433/);
  expect(() => localTarget('postgresql://u:p@localhost/monsport')).toThrow(/port 5432/);
  expect(() => localTarget('postgresql://monsport:x@localhost:55432/monsport?host=/cloudsql/p:r:i')).toThrow(/options/);
  expect(() => localTarget('postgresql://u:p@localhost:55432/x?hostaddr=10.0.0.5')).toThrow(/options/);
  expect(() => localTarget('postgresql://u:p@localhost:55432/x?service=prod')).toThrow(/options/);
  expect(() => localTarget('postgresql://localhost:55432/x')).toThrow(/no user/);
  expect(() => localTarget('mysql://u:p@localhost:55432/x')).toThrow(/not a Postgres URL/);
  expect(() => localTarget('')).toThrow(/missing/);
  expect(() => localTarget('postgresql://u:p@localhost:55432/x', 'a;drop')).toThrow(/database name/);
});

test('psqlArgs stops on the first error, never holds the password, and runs -c or -f', () => {
  const t = localTarget('postgresql://monsport:s3cret@localhost:55432/monsport_dev');
  const sqlArgs = psqlArgs(t, { sql: 'select 1' });
  expect(sqlArgs).toContain('ON_ERROR_STOP=1');
  expect(sqlArgs[0]).toBe('-X');
  expect(sqlArgs.slice(-2)).toEqual(['-c', 'select 1']);
  expect(sqlArgs.join(' ')).not.toContain('s3cret');
  expect(psqlArgs(t, { file: 'q.sql' }).slice(-2)).toEqual(['-f', 'q.sql']);
});

test('psqlEnv drops every PG variable of the shell and sets only the password', () => {
  const env = psqlEnv({ PATH: 'p', PGHOSTADDR: '10.0.0.5', PGSERVICE: 'prod', PGSERVICEFILE: 'f', PGSYSCONFDIR: 'd', PGUSER: 'x', pghost: 'h', PGPASSWORD: 'old' }, 'new');
  expect(env).toEqual({ PATH: 'p', PGPASSWORD: 'new' });
});

test('parseArgs joins the SQL words, reads --db and --file, and refuses a missing value, an unknown option, or SQL with --file', () => {
  expect(parseArgs(['select', '1', '--db', 'monsport_preview'])).toEqual({ sql: 'select 1', db: 'monsport_preview', file: undefined });
  expect(parseArgs(['--file', 'q.sql'])).toEqual({ sql: '', db: undefined, file: 'q.sql' });
  expect(() => parseArgs(['delete from "User"', '--db'])).toThrow(/--db needs a value/);
  expect(() => parseArgs(['--db', '--file', 'q.sql'])).toThrow(/--db needs a value/);
  expect(() => parseArgs(['--db=monsport_preview', 'select 1'])).toThrow(/unknown option/);
  expect(() => parseArgs(['select 1', '--file', 'q.sql'])).toThrow(/not both/);
  expect(() => parseArgs([])).toThrow(/no SQL/);
});
