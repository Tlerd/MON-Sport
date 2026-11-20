// Every third-party GitHub Action is pinned to a full commit SHA, with its version in a trailing comment.
// A tag can be moved to other code; a commit SHA cannot. Dependabot (.github/dependabot.yml) proposes updates.
// The check fails closed: any line with a `uses` key that is not in the one accepted form is flagged.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const USES_KEY = /(?:^|[\s{,[-])['"]?uses['"]?\s*:/;
const PINNED_LINE = /^\s*(?:-\s+)?uses:\s+(?:[\w.-]+\/[\w./-]+@[0-9a-f]{40}\s+#\s*v\d\S*|\.\/\S+|docker:\/\/\S+@sha256:[0-9a-f]{64})\s*$/;

export function unpinned(text) {
  return text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .filter((line) => USES_KEY.test(line.split(' #')[0]) && !PINNED_LINE.test(line))
    .map((line) => line.trim());
}

function yamlFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? yamlFiles(join(dir, e.name)) : /\.ya?ml$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

test('each action in .github/workflows and .github/actions is pinned to a commit SHA with a version comment', () => {
  const files = [...yamlFiles(join(ROOT, '.github', 'workflows')), ...yamlFiles(join(ROOT, '.github', 'actions'))];
  const found = files.flatMap((f) => unpinned(readFileSync(f, 'utf8')).map((line) => `${relative(ROOT, f)}: ${line}`));
  expect(
    found,
    'pin with: uses: owner/repo@<40-char commit sha> # vX.Y.Z. Get the commit with git ls-remote https://github.com/owner/repo "refs/tags/vX.Y.Z^{}" (an empty answer means a lightweight tag: drop ^{})',
  ).toEqual([]);
});

test('unpinned accepts only a commit SHA with a version comment, a local action, or a docker digest', () => {
  const sha = 'a'.repeat(40);
  const digest = 'b'.repeat(64);
  for (const ok of [
    `      - uses: actions/checkout@${sha} # v7.0.1`,
    `        uses: google-github-actions/auth@${sha} # v3.0.0`,
    '      - uses: ./.github/actions/setup',
    `      - uses: docker://alpine@sha256:${digest}`,
    '      # uses: actions/checkout@v7',
    '        run: echo "no uses here"',
  ]) expect(unpinned(ok), ok).toEqual([]);
});

test('unpinned flags a tag, a short or bare SHA, a docker tag, and every other YAML form of the uses key', () => {
  const sha = 'a'.repeat(40);
  for (const bad of [
    '      - uses: actions/checkout@v7',
    '      - uses: actions/checkout@abc1234 # v7',
    `      - uses: actions/checkout@${sha}`,
    '      - uses: docker://alpine:latest',
    '      - { uses: actions/checkout@v7 }',
    '      - "uses": actions/checkout@v7',
    "      - 'uses': actions/checkout@v7",
    '      - uses : actions/checkout@v7',
    '      - uses:',
  ]) expect(unpinned(bad), bad).toHaveLength(1);
});
