#!/usr/bin/env node
// The one way to merge a pull request: node scripts/merge.mjs <number> [--dry-run]
// `gh pr merge` is denied in .claude/settings.json. This script merges only when
// - the pull request is open, not a draft, and not from main;
// - every check is green (it does not wait: use `gh pr checks <n> --watch --fail-fast` first);
// - the latest Reviewer marker for the current head shows no high and no medium finding.
// The marker is the last line of the Reviewer comment, see REVIEW.md:
//   <!-- review head=<sha> high=<n> medium=<n> -->
// It guards against a forgotten review. It does not stop an agent that writes a marker without a review.

import { spawnSync } from 'node:child_process';
import { ciState } from './ci-autofix.mjs';

const MARKER = /<!--\s*review\s+head=([0-9a-f]{7,40})\s+high=(\d+)\s+medium=(\d+)\s*-->/g;

export function reviewMarker(text = '') {
  const last = [...text.matchAll(MARKER)].at(-1);
  return last ? { head: last[1], high: Number(last[2]), medium: Number(last[3]) } : null;
}

// "Autonomy" in AGENTS.md: a finding still open after 2 review rounds is recorded, and the work continues.
// The agent then posts `<!-- review-accepted head=<sha> -->` and writes the finding in PROGRESS.md.
const sameHead = (a, b) => a.startsWith(b) || b.startsWith(a);

function acceptedAfterTwoRounds(pr, rounds) {
  if (rounds < 2) return false;
  const accepted = (pr.comments ?? []).flatMap((c) => [...(c.body ?? '').matchAll(/<!--\s*review-accepted\s+head=([0-9a-f]{7,40})\s*-->/g)].map((m) => m[1]));
  return accepted.some((head) => sameHead(pr.headRefOid, head));
}

/** Reasons not to merge. An empty list means merge. */
export function mergeBlockers(pr) {
  const blockers = [];
  if (pr.state !== 'OPEN') blockers.push(`the pull request is ${pr.state}`);
  if (pr.isDraft) blockers.push('the pull request is a draft');
  if (pr.headRefName === 'main') blockers.push('the head branch is main');
  const checks = ciState(pr.statusCheckRollup);
  if (checks !== 'green') blockers.push(`checks are ${checks}; wait for green with gh pr checks <n> --watch --fail-fast`);

  const markers = (pr.comments ?? []).map((c) => reviewMarker(c.body)).filter(Boolean);
  const mine = markers.filter((m) => sameHead(pr.headRefOid, m.head));
  const latest = mine.at(-1);
  if (!latest) blockers.push(`no Reviewer marker for head ${pr.headRefOid.slice(0, 7)}; run a Reviewer round on this head`);
  else if ((latest.high || latest.medium) && !acceptedAfterTwoRounds(pr, markers.length)) blockers.push(`the Reviewer left ${latest.high} high and ${latest.medium} medium finding(s) open; fix them and run a new Reviewer round`);
  return blockers;
}

if (import.meta.main) {
  const number = process.argv[2];
  if (!/^\d+$/.test(number ?? '')) {
    console.error('Usage: node scripts/merge.mjs <pull request number> [--dry-run]');
    process.exit(2);
  }
  const view = spawnSync('gh', ['pr', 'view', number, '--json', 'state,isDraft,headRefName,headRefOid,statusCheckRollup,comments'], { encoding: 'utf8' });
  if (view.status !== 0) {
    console.error(`FAIL merge: gh pr view ${number} failed\n${view.stderr}`);
    process.exit(1);
  }
  const blockers = mergeBlockers(JSON.parse(view.stdout));
  if (blockers.length) {
    console.error(`FAIL merge #${number}:\n${blockers.map((b) => `- ${b}`).join('\n')}`);
    process.exit(1);
  }
  if (process.argv.includes('--dry-run')) {
    console.log(`merge ok (dry run): #${number} has no blocker`);
    process.exit(0);
  }
  const merge = spawnSync('gh', ['pr', 'merge', number, '--merge', '--delete-branch'], { encoding: 'utf8' });
  process.stdout.write(merge.stdout ?? '');
  process.stderr.write(merge.stderr ?? '');
  process.exit(merge.status ?? 1);
}
