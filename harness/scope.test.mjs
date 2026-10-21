// Proves the decisions of scripts/scope.mjs: a pull request changes only the paths that its
// brief step or its description allows.

import { expect, test } from 'vitest';
import { allowedPaths, briefStepPaths, outOfScope } from '../scripts/scope.mjs';

const brief = [
  '| # | Step | Branch | Paths | Tests |',
  '|---|---|---|---|---|',
  '| 1 | Schema | `feat/<issue>-1-x` | `packages/shared/src/push.ts`, `apps/api/src/modules/push/*` (only `max: 6`), `PROGRESS.md` | AC-1 |',
  '| 2 | Sender | `feat/<issue>-2-y` | `apps/api/src/modules/push/push-sender.ts` | AC-6 |',
].join('\n');

test('a brief step gives the paths of its own row only', () => {
  expect(briefStepPaths(brief, 1)).toEqual(['packages/shared/src/push.ts', 'apps/api/src/modules/push/*', 'PROGRESS.md']);
  expect(briefStepPaths(brief, 2)).toEqual(['apps/api/src/modules/push/push-sender.ts']);
  expect(briefStepPaths(brief, 3)).toEqual([]);
});

test('the description lists paths under "Allowed paths", and the brief file it names is allowed', () => {
  const body = [
    '## Brief and step',
    'docs/briefs/F-014-x.md, step 2 of 3',
    '## Allowed paths',
    '<!-- one path or prefix per line -->',
    '- `scripts/scope.mjs`',
    '- `harness/`',
    '## Changes',
    '- `not/a/path.ts`',
  ].join('\n');
  const readBrief = () => brief;
  expect(allowedPaths(body, readBrief)).toEqual([
    'scripts/scope.mjs',
    'harness/',
    'docs/briefs/F-014-x.md',
    'apps/api/src/modules/push/push-sender.ts',
  ]);
});

test('a file outside the list is reported; a prefix, a star, and an exact path allow files', () => {
  const allowed = ['harness/', 'apps/api/src/modules/push/*', 'PROGRESS.md'];
  const files = ['harness/a.test.mjs', 'apps/api/src/modules/push/x.ts', 'PROGRESS.md', 'scripts/check.mjs', 'PROGRESS.md.bak'];
  expect(outOfScope(files, allowed)).toEqual(['scripts/check.mjs', 'PROGRESS.md.bak']);
});

test('a description without a list allows nothing', () => {
  expect(allowedPaths('## Changes\n- x', () => '')).toEqual([]);
  expect(outOfScope(['a.ts'], [])).toEqual(['a.ts']);
});
