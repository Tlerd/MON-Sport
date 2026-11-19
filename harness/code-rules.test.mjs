import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';
import { expect, test } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const ts = createRequire(import.meta.url)('typescript');
const SOURCE = /^(apps|packages)\/[^/]+\/src\/.+\.(ts|tsx|js|jsx|mjs|cjs)$/;
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const EXCLUDED = ['apps/api/src/generated/'];

const COPIED_DEADLOCK = /isDeadlock\([^)]*\)\)\s*throw new ConflictException/;
const COPIED_ERROR_TEXT = /instanceof ApiError\s*\?/;

const DIRECTIVE_PREFIXES = ['// eslint-', '// @ts-', '/* eslint-', '/// <reference'];

const AS_UNKNOWN_AS_ALLOWED = [
  {
    path: 'apps/api/src/modules/push/push-sender.ts',
    reason: 'web-push types do not accept null in setVapidDetails',
    count: 1,
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

function sourceFile(input, path = 'file.tsx') {
  return typeof input === 'string' ? ts.createSourceFile(path, input, ts.ScriptTarget.Latest, true, scriptKind(path)) : input;
}

function collectAstLines(input, match, path = 'file.tsx') {
  const sf = sourceFile(input, path);
  const lines = [];
  const visit = (node) => {
    const pos = match(node, sf);
    if (pos !== null) lines.push(sf.getLineAndCharacterOfPosition(pos).line + 1);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return lines.sort((a, b) => a - b);
}

function findAstLines(input, match, path = 'file.tsx') {
  return [...new Set(collectAstLines(input, match, path))];
}

function unwrapParens(node) {
  let current = node;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

const isCast = (node) => ts.isAsExpression(node) || ts.isTypeAssertionExpression(node);

function findAnyLines(input, path = 'file.tsx') {
  return findAstLines(input, (node, sf) => (node.kind === ts.SyntaxKind.AnyKeyword ? node.getStart(sf) : null), path);
}

function findDoubleCastLines(input, path = 'file.tsx') {
  return collectAstLines(
    input,
    (node, sf) => {
      if (!isCast(node)) return null;
      const inner = unwrapParens(node.expression);
      if (!isCast(inner) || inner.type.kind !== ts.SyntaxKind.UnknownKeyword) return null;
      return inner.type.getStart(sf);
    },
    path,
  );
}

function promiseCatchHandler(node) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null;
  if (node.expression.name.text !== 'catch' || node.arguments.length === 0) return null;
  const handler = unwrapParens(node.arguments[0]);
  return ts.isArrowFunction(handler) || ts.isFunctionExpression(handler) ? handler : null;
}

function findEmptyCatchLines(input, path = 'file.tsx') {
  return findAstLines(
    input,
    (node, sf) => {
      if (ts.isCatchClause(node) && node.block.statements.length === 0) return node.getStart(sf);
      const handler = promiseCatchHandler(node);
      if (handler && ts.isBlock(handler.body) && handler.body.statements.length === 0) {
        return node.expression.name.getStart(sf);
      }
      return null;
    },
    path,
  );
}

function singleParamName(params) {
  if (params.length !== 1 || !ts.isIdentifier(params[0].name)) return null;
  return params[0].name.text;
}

function rethrowsParam(block, paramName) {
  if (!paramName || !ts.isBlock(block) || block.statements.length !== 1) return false;
  const stmt = block.statements[0];
  return ts.isThrowStatement(stmt) && Boolean(stmt.expression) && ts.isIdentifier(stmt.expression) && stmt.expression.text === paramName;
}

function findRethrowCatchLines(input, path = 'file.tsx') {
  return findAstLines(
    input,
    (node, sf) => {
      if (ts.isCatchClause(node)) {
        const paramName = node.variableDeclaration && ts.isIdentifier(node.variableDeclaration.name) ? node.variableDeclaration.name.text : null;
        return rethrowsParam(node.block, paramName) ? node.getStart(sf) : null;
      }
      const handler = promiseCatchHandler(node);
      if (handler && rethrowsParam(handler.body, singleParamName(handler.parameters))) {
        return node.expression.name.getStart(sf);
      }
      return null;
    },
    path,
  );
}

function isDirective(comment) {
  return DIRECTIVE_PREFIXES.some((prefix) => comment.startsWith(prefix));
}

function findCommentLines(input, path = 'file.tsx') {
  const sf = sourceFile(input, path);
  const text = sf.text;
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
  const lines = [...ranges.values()]
    .filter((range) => !jsxText.some((node) => range.pos >= node.pos && range.pos < node.end))
    .filter((range) => !isDirective(text.slice(range.pos, range.end)))
    .map((range) => sf.getLineAndCharacterOfPosition(range.pos).line + 1);
  return [...new Set(lines)].sort((a, b) => a - b);
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
        const text = readFileSync(join(ROOT, path), 'utf8');
        return [{ path, text, sf: sourceFile(text, path) }];
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
  expect(findAnyLines('const a: any = 1;\nx as any;\nArray<any>;\nRecord<string, any>;\ntype X = any;\nlet u: string | any;', 'a.ts')).toEqual([
    1, 2, 3, 4, 5, 6,
  ]);
  expect(findAnyLines('const many = 1;\nconst anyValue = company;\nconst s = "any value";', 'a.ts')).toEqual([]);

  expect(
    findDoubleCastLines(
      'const x = v as unknown as Target;\nconst y = (v as unknown) as Target;\nconst z = v as\n  unknown as\n  Target;',
      'a.ts',
    ),
  ).toEqual([1, 2, 4]);
  expect(findDoubleCastLines('const a = x as unknown as A, b = y as unknown as B;', 'a.ts')).toEqual([1, 1]);
  expect(findDoubleCastLines('const x = <A><unknown>v;', 'a.ts')).toEqual([1]);
  expect(findDoubleCastLines('const x = v as unknown;', 'a.ts')).toEqual([]);

  expect(
    findEmptyCatchLines(
      'try { a(); } catch {}\ntry {\n  b();\n} catch (err) {\n  \n}\np.catch(() => {});\np.catch(function () {});',
      'a.ts',
    ),
  ).toEqual([1, 4, 7, 8]);
  expect(findEmptyCatchLines('try { a(); } catch { return 1; }\np.catch(() => undefined);', 'a.ts')).toEqual([]);

  expect(
    findRethrowCatchLines(
      'try { a(); } catch (err) { throw err; }\ntry {\n  b();\n} catch (e: unknown) {\n  throw e;\n}\np.catch((e) => { throw e; });\np.catch(function (e) { throw e; });',
      'a.ts',
    ),
  ).toEqual([1, 4, 7, 8]);
  expect(
    findRethrowCatchLines('try { a(); } catch (err) { cleanup(); throw err; }\np.catch((e) => { cleanup(); throw e; });', 'a.ts'),
  ).toEqual([]);

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
  expect(findCommentLines('const a = 1; /* x */ /* y */', 'a.ts')).toEqual([1]);
  expect(findCommentLines('/** @param x // foo */', 'a.ts')).toEqual([1]);
});

test('no source file uses any', () => {
  const files = loadSourceFiles();
  expect(files.length).toBeGreaterThan(50);
  const violations = files.flatMap((file) =>
    findAnyLines(file.sf).map(
      (line) => `FAIL code: ${file.path}:${line} uses any. Fix: use a specific type or narrow unknown with a type guard or instanceof.`,
    ),
  );
  expect(violations).toEqual([]);
});

test('no source file uses as unknown as outside the allowlist', () => {
  const allowed = new Map(
    AS_UNKNOWN_AS_ALLOWED.filter((entry) => entry.path && entry.reason && entry.count > 0).map((entry) => [entry.path, entry.count]),
  );
  const violations = loadSourceFiles().flatMap((file) =>
    findDoubleCastLines(file.sf)
      .slice(allowed.get(file.path) ?? 0)
      .map((line) => `FAIL code: ${file.path}:${line} uses as unknown as. Fix: narrow unknown with a type guard or instanceof.`),
  );
  expect(violations).toEqual([]);
});

test('no source file has an empty catch block', () => {
  const violations = loadSourceFiles().flatMap((file) =>
    findEmptyCatchLines(file.sf).map(
      (line) => `FAIL code: ${file.path}:${line} has an empty catch block. Fix: handle the error to change the result or remove the try/catch.`,
    ),
  );
  expect(violations).toEqual([]);
});

test('no source file catches only to rethrow', () => {
  const violations = loadSourceFiles().flatMap((file) =>
    findRethrowCatchLines(file.sf).map(
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
      findCommentLines(file.sf).map(
        (line) => `FAIL code: ${file.path}:${line} has a code comment. Fix: remove the comment and let a name or a test carry the meaning.`,
      ),
    );
  expect(violations).toEqual([]);
});
