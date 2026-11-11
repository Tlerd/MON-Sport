// The allowlist policy of .gitleaks.toml: an agent can make a failing secret scan pass only by allowing
// one exact public test value, with a reason. scripts/secret-scan.mjs (allowlistProblems) holds the rules.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { allowlistProblems } from '../scripts/secret-scan.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

const good = `[extend]
useDefault = true

[[allowlists]]
description = "The public sample Web Push key of the push tests."
targetRules = ["generic-api-key"]
regexes = ['''^tBHItJI5svbpez7KI4CCXg$''']
`;

test('the .gitleaks.toml of this repository follows the policy', () => {
  expect(allowlistProblems(readFileSync(join(root, '.gitleaks.toml'), 'utf8'))).toEqual([]);
});

test('no .gitleaksignore file skips findings by fingerprint', () => {
  expect(existsSync(join(root, '.gitleaksignore'))).toBe(false);
});

test('an entry with one exact value, a reason, and one rule passes', () => {
  expect(allowlistProblems(good)).toEqual([]);
});

test('the default rules stay on', () => {
  expect(allowlistProblems(good.replace('useDefault = true', 'useDefault = false'))).toContain('[extend] must set useDefault = true');
  expect(allowlistProblems(`${good}\n[extend]\ndisabledRules = ["generic-api-key"]\n`)).toContain('disabledRules turns rules off');
});

test('an entry needs a reason', () => {
  expect(allowlistProblems(good.replace(/description = .*\n/, ''))).toContain('allowlist 1: no description');
  expect(allowlistProblems(good.replace(/description = .*\n/, 'description = ""\n'))).toContain('allowlist 1: no description');
});

test('a global entry names its rules', () => {
  expect(allowlistProblems(good.replace(/targetRules = .*\n/, ''))).toContain('allowlist 1: no targetRules');
});

test('an entry allows exact values only, not a pattern, a path, a commit, or a word', () => {
  // A function replacement, because "$'" in a replacement string means "the text after the match".
  const regex = (value) => good.replace("'''^tBHItJI5svbpez7KI4CCXg$'''", () => value);
  expect(allowlistProblems(regex("'''tBHItJI5svbpez7KI4CCXg'''"))).toContain('allowlist 1: regex 1 is not one exact value (^...$)');
  expect(allowlistProblems(regex("'''^.*$'''"))).toContain('allowlist 1: regex 1 is not one exact value (^...$)');
  expect(allowlistProblems(regex("'''^test-[a-z]+$'''"))).toContain('allowlist 1: regex 1 is not one exact value (^...$)');
  for (const key of ['paths', 'commits', 'stopwords']) {
    expect(allowlistProblems(`${good}${key} = ['''x''']\n`)).toContain(`allowlist 1: ${key} is not allowed`);
  }
  expect(allowlistProblems(`${good}regexTarget = "line"\n`)).toContain('allowlist 1: regexTarget is not allowed');
  expect(allowlistProblems(good.replace(/regexes = .*\n/, ''))).toContain('allowlist 1: no regexes');
});

test('the rule of an entry inside a [[rules]] table follows the same policy', () => {
  const rule = `${good}\n[[rules]]\nid = "github-pat"\n\n  [[rules.allowlists]]\n  paths = ['''docs/''']\n`;
  expect(allowlistProblems(rule)).toEqual(expect.arrayContaining(['allowlist 2: no description', 'allowlist 2: paths is not allowed']));
});
