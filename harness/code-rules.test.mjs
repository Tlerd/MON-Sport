import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';
import { expect, test } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const ts = createRequire(join(ROOT, 'apps/api/package.json'))('typescript');
const SOURCE = /^(apps|packages)\/[^/]+\/src\/.+\.(ts|tsx|js|jsx|mjs|cjs)$/;
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const EXCLUDED = ['apps/api/src/generated/'];

const ANY_TYPE = /(:\s*any\b|\bas any\b|<any>)/;
const AS_UNKNOWN_AS = /\bas unknown as\b/;
const EMPTY_CATCH = /catch\s*(\([^)]*\))?\s*\{\s*\}/;
const RETHROW_CATCH = /catch\s*\((\w+)[^)]*\)\s*\{\s*throw\s+\1;?\s*\}/;
const COPIED_DEADLOCK = /isDeadlock\([^)]*\)\)\s*throw new ConflictException/;
const COPIED_ERROR_TEXT = /instanceof ApiError\s*\?/;

const DIRECTIVE_PREFIXES = ['// eslint-', '// @ts-', '/* eslint-', '/// <reference'];

const AS_UNKNOWN_AS_ALLOWED = [
  {
    path: 'apps/api/src/modules/push/push-sender.ts',
    reason: 'web-push types do not accept null in setVapidDetails',
  },
];

const DEADLOCK_ALLOWED = ['apps/api/src/modules/database/prisma.service.ts'];
const ERROR_TEXT_ALLOWED = ['packages/client/src/errors.ts'];
const COMMENT_ALLOWED = [];

function isCheckedSource(path) {
  return SOURCE.test(path) && !TEST_FILE.test(path) && !EXCLUDED.some((prefix) => path.startsWith(prefix));
}

function findMatches(text, pattern) {
  const regex = new RegExp(pattern.source, 'g');
  return Array.from(text.matchAll(regex), (match) => text.slice(0, match.index).split('\n').length);
}

function scriptKind(path) {
  const ext = extname(path);
  if (ext === '.tsx') return ts.ScriptKind.TSX;
  if (ext === '.jsx') return ts.ScriptKind.JSX;
  if (ext === '.ts' || ext === '.mts' || ext === '.cts') return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function isDirective(comment) {
  return DIRECTIVE_PREFIXES.some((prefix) => comment.startsWith(prefix));
}

function findCommentLines(text, path = 'file.tsx') {
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKind(path));
  const ranges = new Map();
  const jsxText = [];
  const collect = (list) => {
    for (const range of list ?? []) ranges.set(range.pos, range);
  };
  const visit = (node) => {
    const children = node.getChildren(sf);
    if (node.kind === ts.SyntaxKind.JsxText) jsxText.push(node);
    else if (children.length === 0) {
      collect(ts.getLeadingCommentRanges(text, node.pos));
      collect(ts.getTrailingCommentRanges(text, node.end));
    }
    for (const child of children) visit(child);
  };
  visit(sf);
  collect(ts.getLeadingCommentRanges(text, sf.endOfFileToken.pos));
  return [...ranges.values()]
    .filter((range) => !jsxText.some((node) => range.pos >= node.pos && range.pos < node.end))
    .filter((range) => !isDirective(text.slice(range.pos, range.end)))
    .sort((a, b) => a.pos - b.pos)
    .map((range) => sf.getLineAndCharacterOfPosition(range.pos).line + 1);
}

let cachedFiles;

function loadSourceFiles() {
  if (cachedFiles) return cachedFiles;
  cachedFiles = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(isCheckedSource)
    .flatMap((path) => {
      try {
        return [{ path, text: readFileSync(join(ROOT, path), 'utf8') }];
      } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
      }
    });
  return cachedFiles;
}

test('source selection includes non-test source files and skips tests and generated code', () => {
  expect(isCheckedSource('apps/web/src/components/SlotGrid.tsx')).toBe(true);
  expect(isCheckedSource('packages/shared/src/booking.ts')).toBe(true);
  expect(isCheckedSource('apps/api/src/modules/bookings/bookings.service.ts')).toBe(true);
  expect(isCheckedSource('apps/web/src/features/home/HomePage.test.tsx')).toBe(false);
  expect(isCheckedSource('apps/api/src/modules/x.spec.ts')).toBe(false);
  expect(isCheckedSource('apps/api/src/generated/prisma/client.ts')).toBe(false);
  expect(isCheckedSource('scripts/check.mjs')).toBe(false);
});

test('matchers detect forbidden patterns and ignore valid code', () => {
  expect(findMatches('const a: any = 1;\nx as any;\nArray<any>;', ANY_TYPE)).toEqual([1, 2, 3]);
  expect(findMatches('const many = 1;\nconst anyValue = company;', ANY_TYPE)).toEqual([]);

  expect(findMatches('const x = v as unknown as Target;', AS_UNKNOWN_AS)).toEqual([1]);
  expect(findMatches('const x = v as unknown;', AS_UNKNOWN_AS)).toEqual([]);

  expect(findMatches('try { a(); } catch {}\ntry {\n  b();\n} catch (err) {\n  \n}', EMPTY_CATCH)).toEqual([1, 4]);
  expect(findMatches('try { a(); } catch { return 1; }', EMPTY_CATCH)).toEqual([]);

  expect(
    findMatches('try { a(); } catch (err) { throw err; }\ntry {\n  b();\n} catch (e: unknown) {\n  throw e;\n}', RETHROW_CATCH),
  ).toEqual([1, 4]);
  expect(findMatches('try { a(); } catch (err) { cleanup(); throw err; }', RETHROW_CATCH)).toEqual([]);

  expect(findMatches("if (isDeadlock(err)) throw new ConflictException('busy');", COPIED_DEADLOCK)).toEqual([1]);
  expect(findMatches("retryOnDeadlock(() => run(), 'busy');", COPIED_DEADLOCK)).toEqual([]);

  expect(findMatches("const msg = err instanceof ApiError ? err.message : 'fallback';", COPIED_ERROR_TEXT)).toEqual([1]);
  expect(findMatches("const msg = errorMessage(err, 'fallback');", COPIED_ERROR_TEXT)).toEqual([]);

  expect(findCommentLines('const a = 1;\n  // note\n', 'a.ts')).toEqual([2]);
  expect(findCommentLines('const a = 1; // note\nconst b = 2;', 'a.ts')).toEqual([1]);
  expect(findCommentLines('const el = <div>{/* x */}</div>;', 'a.tsx')).toEqual([1]);
  expect(findCommentLines('/* block\n * line\n */\nconst a = 1;', 'a.ts')).toEqual([1]);
  expect(findCommentLines('const a = 1;\n/** doc */\nfunction f() {}', 'a.ts')).toEqual([2]);
  expect(
    findCommentLines(
      '// eslint-disable-next-line no-console\n// @ts-expect-error test\n/* eslint-disable */\n/// <reference types="vite/client" />\nconst a = 1;',
      'a.ts',
    ),
  ).toEqual([]);
  expect(
    findCommentLines("const url = 'https://example.com';\nconst s = 'a // b';\nconst t = `/* c */`;", 'a.ts'),
  ).toEqual([]);
  expect(findCommentLines('const el = <p>see // here and /* there */</p>;', 'a.tsx')).toEqual([]);
  expect(findCommentLines('const el = <p>// here</p>;', 'a.tsx')).toEqual([]);
});

test('no source file uses any', () => {
  const files = loadSourceFiles();
  expect(files.length).toBeGreaterThan(50);
  const violations = files.flatMap((file) =>
    findMatches(file.text, ANY_TYPE).map(
      (line) => `FAIL code: ${file.path}:${line} uses any. Fix: use a specific type or narrow unknown with a type guard or instanceof.`,
    ),
  );
  expect(violations).toEqual([]);
});

test('no source file uses as unknown as outside the allowlist', () => {
  const allowed = new Set(AS_UNKNOWN_AS_ALLOWED.filter((entry) => entry.path && entry.reason).map((entry) => entry.path));
  const violations = loadSourceFiles()
    .filter((file) => !allowed.has(file.path))
    .flatMap((file) =>
      findMatches(file.text, AS_UNKNOWN_AS).map(
        (line) => `FAIL code: ${file.path}:${line} uses as unknown as. Fix: narrow unknown with a type guard or instanceof.`,
      ),
    );
  expect(violations).toEqual([]);
});

test('no source file has an empty catch block', () => {
  const violations = loadSourceFiles().flatMap((file) =>
    findMatches(file.text, EMPTY_CATCH).map(
      (line) => `FAIL code: ${file.path}:${line} has an empty catch block. Fix: handle the error to change the result or remove the try/catch.`,
    ),
  );
  expect(violations).toEqual([]);
});

test('no source file catches only to rethrow', () => {
  const violations = loadSourceFiles().flatMap((file) =>
    findMatches(file.text, RETHROW_CATCH).map(
      (line) => `FAIL code: ${file.path}:${line} catches only to rethrow. Fix: remove the catch block or change the result.`,
    ),
  );
  expect(violations).toEqual([]);
});

test('no source file copies deadlock to ConflictException mapping outside prisma.service.ts', () => {
  const allowed = new Set(DEADLOCK_ALLOWED);
  const violations = loadSourceFiles()
    .filter((file) => !allowed.has(file.path))
    .flatMap((file) =>
      findMatches(file.text, COPIED_DEADLOCK).map(
        (line) =>
          `FAIL code: ${file.path}:${line} copies deadlock mapping. Fix: use retryOnDeadlock or conflictOnDeadlock in apps/api/src/modules/database/prisma.service.ts.`,
      ),
    );
  expect(violations).toEqual([]);
});

test('no source file copies ApiError message formatting outside packages/client/src/errors.ts', () => {
  const allowed = new Set(ERROR_TEXT_ALLOWED);
  const violations = loadSourceFiles()
    .filter((file) => !allowed.has(file.path))
    .flatMap((file) =>
      findMatches(file.text, COPIED_ERROR_TEXT).map(
        (line) => `FAIL code: ${file.path}:${line} copies ApiError message check. Fix: use errorMessage in packages/client/src/errors.ts.`,
      ),
    );
  expect(violations).toEqual([]);
});

test('no source file outside COMMENT_ALLOWED has code comments', () => {
  const allowed = new Set(COMMENT_ALLOWED);
  const violations = loadSourceFiles()
    .filter((file) => !allowed.has(file.path))
    .flatMap((file) =>
      findCommentLines(file.text, file.path).map(
        (line) => `FAIL code: ${file.path}:${line} has a code comment. Fix: remove the comment and let a name or a test carry the meaning.`,
      ),
    );
  expect(violations).toEqual([]);
});
