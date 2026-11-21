import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { buildCheckEntry, checkLogPath, computeTreeHash, parseVitestFailures, recordCheckResult } from '../scripts/check-log.mjs';

const tempDirs = [];

function makeTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'monsport-checklog-'));
  tempDirs.push(dir);
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir, stdio: 'ignore' });
  writeFileSync(join(dir, 'a.txt'), 'v1\n');
  execFileSync('git', ['add', 'a.txt'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

describe('check-log', () => {
  test('parses failed test names from vitest output with and without project tags', () => {
    const sample = [
      ' RUN  v5.0.4 D:/MON-Sport',
      ' FAIL  |api| src/modules/auth/google-auth.e2e.test.ts > Google Auth > AC-36: code check',
      'Error: expected 400, got 429',
      ' FAIL  |mobile| src/features/venues/VenueScreen.test.tsx > VenueScreen > AC-9: scroll',
      ' FAIL  harness/boundaries.test.mjs > allowed imports pass',
      ' FAIL  |api| src/modules/auth/google-auth.e2e.test.ts > Google Auth > AC-36: code check',
    ].join('\n');

    expect(parseVitestFailures(sample)).toEqual([
      'src/modules/auth/google-auth.e2e.test.ts > Google Auth > AC-36: code check',
      'src/features/venues/VenueScreen.test.tsx > VenueScreen > AC-9: scroll',
      'harness/boundaries.test.mjs > allowed imports pass',
    ]);
  });

  test('strips GitHub Actions job/step/timestamp prefixes (and optional BOM) from gh run view --log-failed', () => {
    const ghLog = [
      'check\tRun pnpm check\t\uFEFF2026-11-16T02:55:50.9395798Z  FAIL  |mobile| src/features/venues/VenueScreen.test.tsx > VenueScreen > AC-9: scroll',
      'check\tUNKNOWN STEP\t2026-11-16T02:55:51.0000000Z  FAIL  |api| src/modules/auth/google-auth.e2e.test.ts > Google Auth > AC-31: timing',
    ].join('\n');

    expect(parseVitestFailures(ghLog)).toEqual([
      'src/features/venues/VenueScreen.test.tsx > VenueScreen > AC-9: scroll',
      'src/modules/auth/google-auth.e2e.test.ts > Google Auth > AC-31: timing',
    ]);
  });

  test('computes deterministic tree hash from working tree without touching real index or GIT_INDEX_FILE', () => {
    const dir = makeTempRepo();
    const realIndexBefore = readFileSync(join(dir, '.git', 'index'));
    const h1 = computeTreeHash(dir, { ...process.env, GIT_INDEX_FILE: join(dir, '.git', 'nonexistent-hook-index') });
    expect(h1).toMatch(/^[0-9a-f]{40}$/);

    writeFileSync(join(dir, 'untracked.txt'), 'hello\n');
    const h2 = computeTreeHash(dir, { ...process.env, GIT_INDEX_FILE: join(dir, '.git', 'nonexistent-hook-index') });
    expect(h2).toMatch(/^[0-9a-f]{40}$/);
    expect(h2).not.toBe(h1);

    rmSync(join(dir, 'untracked.txt'));
    const h3 = computeTreeHash(dir);
    expect(h3).toBe(h1);
    expect(readFileSync(join(dir, '.git', 'index'))).toEqual(realIndexBefore);
  });

  test('resolves log path from MONSPORT_CHECK_LOG, then LOCALAPPDATA, then HOME', () => {
    expect(checkLogPath({ MONSPORT_CHECK_LOG: '/tmp/custom.jsonl', LOCALAPPDATA: '/local' })).toBe('/tmp/custom.jsonl');
    expect(checkLogPath({ LOCALAPPDATA: '/local', HOME: '/home/u' })).toBe(join('/local', 'monsport', 'check.jsonl'));
    expect(checkLogPath({ HOME: '/home/u' })).toBe(join('/home/u', '.local', 'monsport', 'check.jsonl'));
  });

  test('writes one JSON line with tree hash, failedSteps, and failedTests', () => {
    const dir = makeTempRepo();
    const logFile = join(dir, 'logs', 'check.jsonl');
    const now = new Date('2026-11-21T10:00:00.000Z');
    const res = recordCheckResult({
      root: dir,
      ok: false,
      failedSteps: ['tests'],
      testOutput: ' FAIL  |harness| harness/boundaries.test.mjs > allowed imports pass\n',
      env: { ...process.env, CI: '', MONSPORT_CHECK_LOG: logFile },
      now,
    });

    expect(res.written).toBe(true);
    const lines = readFileSync(logFile, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed).toEqual(
      buildCheckEntry({
        ok: false,
        failedSteps: ['tests'],
        testOutput: ' FAIL  |harness| harness/boundaries.test.mjs > allowed imports pass\n',
        tree: parsed.tree,
        now,
      }),
    );
    expect(parsed.tree).toMatch(/^[0-9a-f]{40}$/);
    expect(parsed.failedTests).toEqual(['harness/boundaries.test.mjs > allowed imports pass']);
  });

  test('does not write when CI is set', () => {
    const dir = makeTempRepo();
    const logFile = join(dir, 'ci.jsonl');
    const res = recordCheckResult({
      root: dir,
      ok: true,
      failedSteps: [],
      testOutput: '',
      env: { ...process.env, CI: 'true', MONSPORT_CHECK_LOG: logFile },
    });
    expect(res).toEqual({ written: false, reason: 'ci' });
  });

  test('swallows write errors so check result never changes', () => {
    const dir = makeTempRepo();
    const blocker = join(dir, 'not-a-dir');
    writeFileSync(blocker, 'file');
    const badLog = join(blocker, 'check.jsonl');
    const res = recordCheckResult({
      root: dir,
      ok: true,
      failedSteps: [],
      testOutput: '',
      env: { ...process.env, CI: '', MONSPORT_CHECK_LOG: badLog },
    });
    expect(res.written).toBe(false);
    expect(res.reason).toBe('error');
  });
});
