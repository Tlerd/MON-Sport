// Proves that the import rules in .dependency-cruiser.cjs fire on the cases they name,
// and stay quiet on allowed imports. The fixtures mirror the repo layout.

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const config = fileURLToPath(new URL('../.dependency-cruiser.cjs', import.meta.url));

function violations(fixture) {
  const cwd = fileURLToPath(new URL(`./fixtures/${fixture}/`, import.meta.url));
  const result = spawnSync(`depcruise apps packages --config "${config}" --output-type json`, {
    cwd,
    shell: true,
    encoding: 'utf8',
  });
  return JSON.parse(result.stdout).summary.violations;
}

function violatedRules(fixture) {
  const names = violations(fixture).map((violation) => violation.rule.name);
  return [...new Set(names)].sort();
}

test('every import rule fires on its fixture', () => {
  expect(violatedRules('bad')).toEqual([
    'app-imports-app',
    'feature-imports-app',
    'feature-imports-feature',
    'no-circular',
    'package-imports-app',
    'shared-imports-feature',
    'tournaments-imports-booking',
  ]);
});

test('allowed imports pass', () => {
  expect(violatedRules('good')).toEqual([]);
});

test('AC-2 mobile, web and client imports break app-imports-app and package-imports-app', () => {
  const list = violations('bad');
  const rulesOf = (from) => list.filter((v) => v.from === from).map((v) => v.rule.name);

  expect(rulesOf('apps/mobile/src/x.ts')).toContain('app-imports-app');
  expect(rulesOf('packages/client/src/x.ts')).toContain('package-imports-app');

  const rule = createRequire(import.meta.url)('../.dependency-cruiser.cjs').forbidden.find((r) => r.name === 'app-imports-app');
  expect(rule.comment).toMatch(/Fix:.*packages\/client/);
});
