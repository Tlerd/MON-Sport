// Proves scripts/db-sql.mjs: it reads DATABASE_URL, runs only on a local host, and keeps the password off argv.

import { expect, test } from 'vitest';
import { envUrl, localTarget, parseArgs, psqlArgs } from '../scripts/db-sql.mjs';

test('envUrl reads DATABASE_URL from an .env text, with or without quotes', () => {
  expect(envUrl('A=1\nDATABASE_URL=postgresql://u:p@localhost:55432/monsport_dev\n')).toBe('postgresql://u:p@localhost:55432/monsport_dev');
  expect(envUrl('DATABASE_URL="postgresql://u:p@localhost/x"\r\n')).toBe('postgresql://u:p@localhost/x');
  expect(envUrl('OTHER=1')).toBe('');
});

test('localTarget accepts localhost, 127.0.0.1 and ::1, and takes --db over the URL database', () => {
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

test('localTarget refuses a remote host, a non-Postgres URL, a missing URL, and an odd database name', () => {
  expect(() => localTarget('postgresql://u:p@10.0.0.5:5432/monsport')).toThrow(/not local/);
  expect(() => localTarget('postgresql://u:p@db.example.com/monsport')).toThrow(/not local/);
  expect(() => localTarget('postgresql://u:p@localhost.example.com/monsport')).toThrow(/not local/);
  expect(() => localTarget('mysql://u:p@localhost/x')).toThrow(/not a Postgres URL/);
  expect(() => localTarget('')).toThrow(/missing/);
  expect(() => localTarget('postgresql://u:p@localhost/x', 'a;drop')).toThrow(/database name/);
});

test('psqlArgs stops on the first error, never holds the password, and runs -c or -f', () => {
  const t = localTarget('postgresql://monsport:s3cret@localhost:55432/monsport_dev');
  const sqlArgs = psqlArgs(t, { sql: 'select 1' });
  expect(sqlArgs).toContain('ON_ERROR_STOP=1');
  expect(sqlArgs.slice(-2)).toEqual(['-c', 'select 1']);
  expect(sqlArgs.join(' ')).not.toContain('s3cret');
  expect(psqlArgs(t, { file: 'q.sql' }).slice(-2)).toEqual(['-f', 'q.sql']);
});

test('parseArgs joins the SQL words and reads --db and --file', () => {
  expect(parseArgs(['select', '1', '--db', 'monsport_preview'])).toEqual({ sql: 'select 1', db: 'monsport_preview', file: undefined });
  expect(parseArgs(['--file', 'q.sql'])).toEqual({ sql: '', db: undefined, file: 'q.sql' });
});
