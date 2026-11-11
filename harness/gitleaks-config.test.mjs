// The allowlist policy of .gitleaks.toml: an agent can make a failing secret scan pass only by allowing
// one exact public test value, with a reason. scripts/secret-scan.mjs (allowlistProblems) holds the rules.
// The policy is an allow-list of exact lines, so a TOML form it does not know fails instead of passing.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { allowlistProblems } from '../scripts/secret-scan.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

const good = `# A comment line is fine.
[extend]
useDefault = true

[[allowlists]]
description = "The public sample Web Push key of the push tests."
targetRules = ["generic-api-key"]
regexes = ['''^tBHItJI5svbpez7KI4CCXg$''']
`;

// A function replacement, because "$'" in a replacement string means "the text after the match".
const swap = (from, to) => good.replace(from, () => to);
const fails = (toml) => expect(allowlistProblems(toml), toml).not.toEqual([]);

test('the .gitleaks.toml of this repository follows the policy', () => {
  expect(allowlistProblems(readFileSync(join(root, '.gitleaks.toml'), 'utf8'))).toEqual([]);
});

test('no .gitleaksignore file skips findings by fingerprint', () => {
  expect(existsSync(join(root, '.gitleaksignore'))).toBe(false);
});

test('an entry with one exact value, a reason, and named rules passes, with CRLF line ends too', () => {
  expect(allowlistProblems(good)).toEqual([]);
  expect(allowlistProblems(good.replaceAll('\n', '\r\n'))).toEqual([]);
  expect(allowlistProblems(swap('["generic-api-key"]', '["generic-api-key", "github-pat"]'))).toEqual([]);
  expect(allowlistProblems(swap("'''^tBHItJI5svbpez7KI4CCXg$'''", "'''^a$''', '''^b\\.c$'''"))).toEqual([]);
});

test('the default rules stay on: [extend] once, with useDefault = true', () => {
  expect(allowlistProblems(swap('useDefault = true', 'useDefault = false'))).toContain('[extend] must set useDefault = true');
  expect(allowlistProblems(swap('[extend]\nuseDefault = true\n', ''))).toContain('[extend] must appear once');
  fails(`${good}\n[extend]\nuseDefault = true\n`);
  fails(swap('useDefault = true', 'useDefault = true\ndisabledRules = ["github-pat"]'));
  fails(swap('useDefault = true', 'useDefault = true\n"disabledRules" = ["github-pat"]'));
  fails(swap('useDefault = true', 'useDefault = true\nDisabledRules = ["github-pat"]'));
  fails(swap('useDefault = true', 'useDefault = true\npath = "other.toml"'));
});

test('an entry needs a reason, named rules, and regexes, each once', () => {
  expect(allowlistProblems(swap(/description = .*\n/, ''))).toContain('allowlist 1: needs one description');
  fails(swap(/description = .*\n/, 'description = ""\n'));
  expect(allowlistProblems(swap(/targetRules = .*\n/, ''))).toContain('allowlist 1: needs one targetRules');
  expect(allowlistProblems(swap(/regexes = .*\n/, ''))).toContain('allowlist 1: needs one regexes');
});

test('an entry allows exact values only', () => {
  for (const value of ["'''tBH'''", "'''^.*$'''", "'''^test-[a-z]+$'''", "'''^\\d+$'''", "'''^a$''', '.*'", "'''^a$''', \".*\""]) {
    expect(allowlistProblems(swap("'''^tBHItJI5svbpez7KI4CCXg$'''", value)), value).not.toEqual([]);
  }
});

test('paths, commits, stopwords, regexTarget, and condition are not allowed, in any spelling', () => {
  for (const line of [
    "paths = ['''.*''']",
    "Paths = ['''.*''']",
    "\"paths\" = ['''.*''']",
    "commits = ['abc']",
    "stopwords = ['''x''']",
    'regexTarget = "line"',
    'condition = "AND"',
  ]) {
    fails(`${good}${line}\n`);
  }
});

test('a header in another spelling, or with a comment after it, fails', () => {
  for (const header of ['[[allowlists]] # reason', '[[ allowlists ]]', '[["allowlists"]]', '[[AllowLists]]', '[allowlist]', '[allowlist] # x']) {
    fails(swap('[[allowlists]]', header));
  }
});

test('an inline allowlist before [extend], or a regexes array over two lines, fails', () => {
  fails(`allowlists = [{ description = "x", targetRules = ["github-pat"], paths = ['''.*'''] }]\n${good}`);
  fails(swap("regexes = ['''^tBHItJI5svbpez7KI4CCXg$''']", "regexes = ['''^tBHItJI5svbpez7KI4CCXg$''', # \n'''.*''']"));
});

test('a [[rules]] table, which would change a default rule, fails in every form', () => {
  for (const block of [
    "[[rules]]\nid = \"github-pat\"\nregex = '''zzzz-never'''",
    '[[rules]]\nid = "github-pat"\nentropy = 9.0',
    "[[rules]]\nid = \"github-pat\"\npath = '''^nowhere$'''",
    "[[rules]]\nid = \"github-pat\"\nallowlists = [{ paths = ['''.*'''] }]",
    "[[rules]]\nid = \"github-pat\"\nallowlist.paths = ['''.*''']",
    "[[rules]]\nid = \"github-pat\"\n\n  [[rules.allowlists]]\n  description = \"x\"\n  regexes = ['''^a$''']",
  ]) {
    fails(`${good}\n${block}\n`);
  }
});
