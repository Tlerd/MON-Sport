// Proves the path filter of scripts/ci-changes.mjs without GitHub Actions.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { changedFiles, classify } from '../scripts/ci-changes.mjs';

const allTrue = { check: true, image: true, deploy: true };
const allFalse = { check: false, image: false, deploy: false };
const checkOnly = { check: true, image: false, deploy: false };
const imageOnly = { check: false, image: true, deploy: false };

test('an empty file list runs every job as the safe default', () => {
  expect(classify([])).toEqual(allTrue);
  expect(classify()).toEqual(allTrue);
});

test('docs, agent configs, and markdown outside AGENTS.md, PROGRESS.md, and @map.md skip all jobs', () => {
  expect(classify(['docs/briefs/F-1.md'])).toEqual(allFalse);
  expect(classify(['HUMAN_DECISIONS.md'])).toEqual(allFalse);
  expect(classify(['REVIEW.md', 'DESIGN.md'])).toEqual(allFalse);
  expect(classify(['.agents/skills/verify-flow/SKILL.md'])).toEqual(allFalse);
  expect(classify(['.claude/settings.json'])).toEqual(allFalse);
  expect(classify(['.gemini/settings.json'])).toEqual(allFalse);
});

test('AGENTS.md, PROGRESS.md, @map.md, and harness tests run check only', () => {
  expect(classify(['PROGRESS.md'])).toEqual(checkOnly);
  expect(classify(['@map.md'])).toEqual(checkOnly);
  expect(classify(['AGENTS.md'])).toEqual(checkOnly);
  expect(classify(['harness/x.test.mjs'])).toEqual(checkOnly);
});

test('verify-flow scripts run image without check or deploy', () => {
  expect(classify(['.agents/skills/verify-flow/scripts/lib.mjs'])).toEqual(imageOnly);
});

test('app code, scripts, and workflow files run every job, even alongside docs', () => {
  expect(classify(['scripts/merge.mjs'])).toEqual(allTrue);
  expect(classify(['apps/mobile/src/a.tsx'])).toEqual(allTrue);
  expect(classify(['.github/workflows/ci.yml'])).toEqual(allTrue);
  expect(classify(['docs/briefs/F-1.md', 'HUMAN_DECISIONS.md', 'apps/mobile/src/a.tsx'])).toEqual(allTrue);
});

test('renaming app code into docs still lists the old path and runs every job', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ci-changes-'));
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], {
      cwd: dir,
      stdio: 'ignore',
      // A git hook sets GIT_DIR and GIT_INDEX_FILE. The temp repository must not inherit them.
      env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
    });
  try {
    git('init');
    mkdirSync(join(dir, 'apps'), { recursive: true });
    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(join(dir, 'apps/x.ts'), 'export const x = 1;\n');
    git('add', 'apps/x.ts');
    git('commit', '-m', 'add apps/x.ts');
    git('mv', 'apps/x.ts', 'docs/x.ts');
    git('commit', '-m', 'move to docs/x.ts');

    const files = changedFiles(['--range', 'HEAD~1..HEAD'], dir);
    expect(files).toContain('apps/x.ts');
    expect(files).toContain('docs/x.ts');
    expect(classify(files)).toEqual(allTrue);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
