import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const MAX_LINES = 300;
const SOURCE = /^(apps|packages)\/[^/]+\/src\/.+\.(ts|tsx|js|jsx|mjs|cjs)$/;
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const EXCLUDED = ['apps/api/src/generated/'];

function isLimitedSource(path) {
  return SOURCE.test(path) && !TEST_FILE.test(path) && !EXCLUDED.some((prefix) => path.startsWith(prefix));
}

function countLines(text) {
  const trimmed = text.replace(/\s+$/, '');
  return trimmed === '' ? 0 : trimmed.split(/\r?\n/).length;
}

test('a source file under apps or packages src is limited', () => {
  expect(isLimitedSource('apps/web/src/components/SlotGrid.tsx')).toBe(true);
  expect(isLimitedSource('packages/shared/src/booking.ts')).toBe(true);
  expect(isLimitedSource('apps/api/src/modules/bookings/bookings.service.ts')).toBe(true);
});

test('test files, generated code, and files outside src are not limited', () => {
  expect(isLimitedSource('apps/web/src/features/home/HomePage.test.tsx')).toBe(false);
  expect(isLimitedSource('apps/api/src/modules/x.spec.ts')).toBe(false);
  expect(isLimitedSource('apps/api/src/generated/prisma/client.ts')).toBe(false);
  expect(isLimitedSource('apps/web/vite.config.ts')).toBe(false);
  expect(isLimitedSource('scripts/check.mjs')).toBe(false);
  expect(isLimitedSource('apps/web/src/styles/app.css')).toBe(false);
});

test('trailing blank lines do not count', () => {
  expect(countLines('a\nb\n\n\n')).toBe(2);
  expect(countLines('a\r\nb\r\n')).toBe(2);
  expect(countLines('')).toBe(0);
});

test(`every non-test source file under apps/*/src and packages/*/src has at most ${MAX_LINES} lines`, () => {
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(isLimitedSource);
  expect(files.length).toBeGreaterThan(50);
  const over = files
    .map((path) => {
      try {
        return { path, lines: countLines(readFileSync(join(ROOT, path), 'utf8')) };
      } catch (err) {
        if (err.code === 'ENOENT') return { path, lines: 0 };
        throw err;
      }
    })
    .filter((f) => f.lines > MAX_LINES)
    .map((f) => `FAIL size: ${f.path} has ${f.lines} lines and the limit is ${MAX_LINES}. Fix: move a hook, a helper, or a part into a sibling file.`);
  expect(over).toEqual([]);
});
