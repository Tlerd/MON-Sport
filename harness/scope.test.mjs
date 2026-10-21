// Proves the decisions of scripts/scope.mjs: a pull request changes only the paths that its
// brief step or its description allows.

import { expect, test } from 'vitest';
import { allowedPaths, briefStepPaths, outOfScope } from '../scripts/scope.mjs';

const brief = [
  '| # | Decision |',
  '|---|---|',
  '| 1 | `AGENTS.md` |',
  '',
  '| # | Step | Branch | Paths | Tests |',
  '|---|---|---|---|---|',
  '| 1 | Schema | `feat/<issue>-1-x` | `packages/shared/src/push.ts`, `apps/api/src/modules/push/*` (only `max: 6`), `PROGRESS.md` | AC-1 |',
  '| 2 | Sender | `feat/<issue>-2-y` | `apps/api/src/modules/push/push-sender.ts`, `apps/api/prisma/migrations/*_f013_x/migration.sql`, `owner.e2e.test.ts`, `*.e2e.test.ts` | AC-6 |',
  '',
  '| 1 | later table | `docs/other.md` | `docs/other.md` | x |',
].join('\n');

test('a brief step gives the Paths cell of its own row in the build-order table only', () => {
  expect(briefStepPaths(brief, 1)).toEqual(['packages/shared/src/push.ts', 'apps/api/src/modules/push/*', 'PROGRESS.md']);
  expect(briefStepPaths(brief, 2)).toEqual([
    'apps/api/src/modules/push/push-sender.ts',
    'apps/api/prisma/migrations/*_f013_x/migration.sql',
    'owner.e2e.test.ts',
  ]);
  expect(briefStepPaths(brief, 3)).toEqual([]);
});

test('the brief and the step come from "Brief and step" only, not from template comments or other sections', () => {
  const body = [
    '## Brief and step',
    '<!-- For example: docs/briefs/F-002-<slug>.md, step 1 of 3 (schema). -->',
    'docs/briefs/F-014-x.md, step 2 of 3',
    '## Allowed paths',
    '<!-- one path or prefix per line -->',
    '- `scripts/scope.mjs`',
    '- `harness/`',
    '## Changes',
    '- `not/a/path.ts`, see docs/briefs/F-999-y.md, step 1 of 9',
  ].join('\n');
  const asked = [];
  const readBrief = (file) => (asked.push(file), brief);
  expect(allowedPaths(body, readBrief)).toEqual([
    'scripts/scope.mjs',
    'harness/',
    'apps/api/src/modules/push/push-sender.ts',
    'apps/api/prisma/migrations/*_f013_x/migration.sql',
    'owner.e2e.test.ts',
  ]);
  expect(asked).toEqual(['docs/briefs/F-014-x.md']);
});

test('the brief file is allowed only when the description lists it', () => {
  const body = '## Brief and step\ndocs/briefs/F-014-x.md, step 1 of 3\n## Allowed paths\n- `docs/briefs/F-014-x.md`';
  expect(allowedPaths(body, () => brief)).toContain('docs/briefs/F-014-x.md');
  expect(allowedPaths('## Brief and step\ndocs/briefs/F-014-x.md, step 1 of 3', () => brief)).not.toContain('docs/briefs/F-014-x.md');
});

test('a file outside the list is reported; a prefix, a star, a middle star, and an exact path allow files', () => {
  const allowed = ['harness/', 'apps/api/src/modules/push/*', 'PROGRESS.md', 'apps/api/prisma/migrations/*_f013_x/migration.sql'];
  const files = [
    'harness/a.test.mjs',
    'apps/api/src/modules/push/x.ts',
    'PROGRESS.md',
    'apps/api/prisma/migrations/20261020_f013_x/migration.sql',
    'apps/api/prisma/migrations/20261020_other/migration.sql',
    'scripts/check.mjs',
    'PROGRESS.md.bak',
  ];
  expect(outOfScope(files, allowed)).toEqual([
    'apps/api/prisma/migrations/20261020_other/migration.sql',
    'scripts/check.mjs',
    'PROGRESS.md.bak',
  ]);
});

test('a star without a folder never allows a file', () => {
  expect(outOfScope(['apps/api/a.e2e.test.ts'], ['*.e2e.test.ts'])).toEqual(['apps/api/a.e2e.test.ts']);
});

// "*/*" or "**/x" would allow .github/ and scripts/, so a star in the first folder is never a path.
test('a star in the first folder allows nothing, in a description and in a list', () => {
  for (const token of ['*/*', '**/x.ts', '*', '*/scripts/a.ts', 'ap*/api/a.ts']) {
    expect(outOfScope(['scripts/a.ts', 'apps/api/a.ts', 'x.ts'], [token])).toEqual(['scripts/a.ts', 'apps/api/a.ts', 'x.ts']);
    expect(allowedPaths(`## Allowed paths\n- \`${token}\``, () => '')).toEqual([]);
  }
  expect(outOfScope(['apps/api/a.ts'], ['apps/*/a.ts'])).toEqual([]);
});

test('a description without a list allows nothing', () => {
  expect(allowedPaths('## Changes\n- x', () => '')).toEqual([]);
  expect(outOfScope(['a.ts'], [])).toEqual(['a.ts']);
});
