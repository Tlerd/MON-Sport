#!/usr/bin/env node
// Gate: each AC that the pull request description lists has a test whose name starts with its label.
// A test file that the pull request changes may hold the test. An unfilled template line does not count.
//
// CI: PR_BODY=<description> node scripts/ac-check.mjs --base origin/main

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

/** Labels from lines such as "- [x] AC-3: BookingForm.test.tsx". A line with nothing after the colon is unfilled. */
export function listedAcs(body = '') {
  const labels = [...body.matchAll(/^\s*-\s*\[[ xX]\]\s*(AC-\d+)[ \t]*:[ \t]*\S/gm)].map((m) => m[1]);
  return [...new Set(labels)];
}

/** Labels at the start of a test title: right after "(" or alone on a line. */
export function testedAcs(text) {
  const found = [...text.matchAll(/(?:\(\s*|^\s*)(['"`])(AC-\d+)(?!\d)/gm)].map((m) => m[2]);
  return new Set(found);
}

export const missingAcs = (labels, tested) => labels.filter((label) => !tested.has(label));

if (import.meta.main) {
  const base = process.argv[process.argv.indexOf('--base') + 1] || 'origin/main';
  const labels = listedAcs(process.env.PR_BODY ?? '');
  if (!labels.length) {
    console.log('ac-check ok: the description lists no AC');
    process.exit(0);
  }
  const diff = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' });
  if (diff.status !== 0) {
    console.error(`FAIL ac-check: git diff ${base}...HEAD failed\n${diff.stderr}`);
    process.exit(1);
  }
  const tested = new Set();
  for (const file of diff.stdout.split('\n').filter((f) => /\.test\.[cm]?[jt]sx?$/.test(f) && existsSync(f))) {
    for (const label of testedAcs(readFileSync(file, 'utf8'))) tested.add(label);
  }
  const missing = missingAcs(labels, tested);
  if (missing.length) {
    console.error(
      `FAIL ac-check: no changed test file has a test named ${missing.join(', ')}\n` +
        'Fix: name the test "AC-n: ...", or remove the AC from the description when this pull request does not cover it.',
    );
    process.exit(1);
  }
  console.log(`ac-check ok: ${labels.join(', ')}`);
}
