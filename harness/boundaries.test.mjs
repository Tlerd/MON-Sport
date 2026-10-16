// Proves that the import rules in .dependency-cruiser.cjs fire on the cases they name,
// and stay quiet on allowed imports. The fixtures mirror the repo layout.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const config = fileURLToPath(new URL('../.dependency-cruiser.cjs', import.meta.url));

function violatedRules(fixture) {
  const cwd = fileURLToPath(new URL(`./fixtures/${fixture}/`, import.meta.url));
  const result = spawnSync(`depcruise apps packages --config "${config}" --output-type json`, {
    cwd,
    shell: true,
    encoding: 'utf8',
  });
  const names = JSON.parse(result.stdout).summary.violations.map((violation) => violation.rule.name);
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
