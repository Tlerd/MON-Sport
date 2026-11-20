// Every third-party GitHub Action is pinned to a full commit SHA, with its version in a trailing comment.
// A tag can be moved to other code; a commit SHA cannot. Dependabot (.github/dependabot.yml) proposes updates.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const WORKFLOWS = join(ROOT, '.github', 'workflows');
const USES = /^\s*-?\s*uses:\s*(\S+)(.*)$/;
const PINNED = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/;

export function unpinned(text) {
  return text
    .split('\n')
    .map((line) => line.match(USES))
    .filter(Boolean)
    .filter(([, ref, rest]) => !ref.startsWith('./') && !ref.startsWith('docker://') && !(PINNED.test(ref) && /#\s*v\d/.test(rest)))
    .map(([, ref]) => ref);
}

test('each action in .github/workflows is pinned to a commit SHA with a version comment', () => {
  const files = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
  const found = files.flatMap((f) => unpinned(readFileSync(join(WORKFLOWS, f), 'utf8')).map((ref) => `${f}: ${ref}`));
  expect(found, 'pin with: uses: owner/repo@<40-char sha> # vX.Y.Z (git ls-remote https://github.com/owner/repo refs/tags/vX.Y.Z)').toEqual([]);
});

test('unpinned flags a tag, a short SHA, or a SHA without a version comment, and skips local actions', () => {
  const sha = 'a'.repeat(40);
  expect(unpinned('      - uses: actions/checkout@v7')).toEqual(['actions/checkout@v7']);
  expect(unpinned('      - uses: actions/checkout@abc1234 # v7')).toEqual(['actions/checkout@abc1234']);
  expect(unpinned(`      - uses: actions/checkout@${sha}`)).toEqual([`actions/checkout@${sha}`]);
  expect(unpinned(`      - uses: actions/checkout@${sha} # v7.0.1`)).toEqual([]);
  expect(unpinned(`        uses: google-github-actions/auth@${sha} # v3.0.0`)).toEqual([]);
  expect(unpinned('      - uses: ./.github/actions/setup')).toEqual([]);
});
