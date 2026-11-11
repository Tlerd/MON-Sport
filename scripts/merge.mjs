#!/usr/bin/env node
// The one way to merge a pull request: node scripts/merge.mjs <number> [--dry-run]
// The user runs it. Agents never merge (HUMAN_DECISIONS.md row 49): `gh pr merge` and this script are
// denied in .claude/settings.json. This script merges only when
// - the pull request is open, not a draft, not from main, and its base is main
//   (a stacked step waits until the pull request of its base branch is merged);
// - every check is green (it does not wait: use `gh pr checks <n> --watch --fail-fast` first);
// - the latest Reviewer marker for the current head shows no high and no medium finding.
// The marker is the last line of the Reviewer comment, see REVIEW.md:
//   <!-- review head=<sha> high=<n> medium=<n> -->
// It guards against a forgotten review. It does not stop an agent that writes a marker without a review.
// After the merge it reads the state on GitHub, deletes the head branch on the remote, and leaves the local
// checkout as it is. Exit 0 means merged, even when a later step only warns. Exit 1 means not merged.
// Exit 3 means the state could not be read after the merge command.

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

// A queued run has no start time: GitHub sends null, an empty string, or the zero time 0001-01-01.
// A missing or zero time sorts as the newest, never as the oldest.
const timeOf = (check) => {
  const time = String(check.completedAt || check.startedAt || '');
  return time && !time.startsWith('0001') ? time : '9999';
};
const unfinished = (check) => check.__typename === 'CheckRun' && check.status !== 'COMPLETED';

/**
 * The newest run of each check. An edit of the description reruns pr-gates, and the old run stays in the rollup.
 * A run that has not finished always wins: the check is pending, and a green run of the same check must not hide that.
 */
export function latestChecks(rollup = []) {
  const newest = new Map();
  for (const check of rollup) {
    const key = check.__typename === 'CheckRun' ? `run:${check.workflowName}/${check.name}` : `status:${check.context}`;
    const seen = newest.get(key);
    const wins = !seen || (unfinished(check) !== unfinished(seen) ? unfinished(check) : timeOf(check) >= timeOf(seen));
    if (wins) newest.set(key, check);
  }
  return [...newest.values()];
}

/**
 * The merge command. `--match-head-commit` refuses a head that moved after the check.
 * No `--delete-branch`: it also switches the local checkout to main, which fails when another worktree holds main.
 */
export const mergeArgs = (number, pr) => ['pr', 'merge', number, '--merge', '--match-head-commit', pr.headRefOid];

/**
 * The gh command that deletes the head branch on GitHub: the same API, repository, and token as the merge,
 * and no git credential prompt. A branch of a fork is not ours to delete.
 */
export const deleteBranchArgs = (pr) => (pr.isCrossRepository ? null : ['api', '-X', 'DELETE', `repos/{owner}/{repo}/git/refs/heads/${pr.headRefName}`]);

/**
 * The state on GitHub after the merge decides. gh can merge and then fail on a later step.
 * A state that could not be read is unknown: the script then never says "not merged".
 */
export function mergeResult({ status, state, stderr = '' }) {
  const unknown = !state;
  const merged = state === 'MERGED';
  return { merged, unknown, warning: merged && status !== 0 ? `gh exited ${status} after the merge: ${stderr.trim()}` : null };
}

/** Reasons not to merge. An empty list means merge. */
export function mergeBlockers(pr) {
  const blockers = [];
  if (pr.state !== 'OPEN') blockers.push(`the pull request is ${pr.state}`);
  if (pr.isDraft) blockers.push('the pull request is a draft');
  if (pr.headRefName === 'main') blockers.push('the head branch is main');
  if (pr.baseRefName !== 'main') blockers.push(`the base is ${pr.baseRefName}, not main; merge the pull request of ${pr.baseRefName} first, then set the base with gh pr edit <n> --base main`);
  const checks = ciState(latestChecks(pr.statusCheckRollup));
  if (checks !== 'green') blockers.push(`checks are ${checks}; wait for green with gh pr checks <n> --watch --fail-fast`);

  const markers = (pr.comments ?? []).map((c) => reviewMarker(c.body)).filter(Boolean);
  const mine = markers.filter((m) => sameHead(pr.headRefOid, m.head));
  const latest = mine.at(-1);
  if (!latest) blockers.push(`no Reviewer marker for head ${pr.headRefOid.slice(0, 7)}; run a Reviewer round on this head`);
  else if ((latest.high || latest.medium) && !acceptedAfterTwoRounds(pr, new Set(markers.map((m) => m.head.slice(0, 7))).size)) blockers.push(`the Reviewer left ${latest.high} high and ${latest.medium} medium finding(s) open; fix them and run a new Reviewer round`);
  return blockers;
}

if (import.meta.main) {
  const number = process.argv[2];
  if (!/^\d+$/.test(number ?? '')) {
    console.error('Usage: node scripts/merge.mjs <pull request number> [--dry-run]');
    process.exit(2);
  }
  const view = spawnSync('gh', ['pr', 'view', number, '--json', 'state,isDraft,isCrossRepository,baseRefName,headRefName,headRefOid,statusCheckRollup,comments'], { encoding: 'utf8' });
  if (view.status !== 0) {
    console.error(`FAIL merge: gh pr view ${number} failed\n${view.stderr}`);
    process.exit(1);
  }
  const pr = JSON.parse(view.stdout);
  const blockers = mergeBlockers(pr);
  if (blockers.length) {
    console.error(`FAIL merge #${number}:\n${blockers.map((b) => `- ${b}`).join('\n')}`);
    process.exit(1);
  }
  if (process.argv.includes('--dry-run')) {
    console.log(`merge ok (dry run): #${number} has no blocker`);
    process.exit(0);
  }
  const merge = spawnSync('gh', mergeArgs(number, pr), { encoding: 'utf8' });
  process.stdout.write(merge.stdout ?? '');
  const after = spawnSync('gh', ['pr', 'view', number, '--json', 'state', '-q', '.state'], { encoding: 'utf8' });
  const state = after.status === 0 ? (after.stdout ?? '').trim() : '';
  const result = mergeResult({ status: merge.status ?? 1, state, stderr: merge.stderr ?? '' });
  if (result.unknown) {
    process.stderr.write(merge.stderr ?? '');
    console.error(`WARN merge #${number}: gh exited ${merge.status}, and the state on GitHub could not be read. Check it with: gh pr view ${number} --json state`);
    process.exit(3);
  }
  if (!result.merged) {
    process.stderr.write(merge.stderr ?? '');
    console.error(`FAIL merge #${number}: the pull request is ${state} on GitHub, not merged`);
    process.exit(1);
  }
  if (result.warning) console.warn(`WARN merge #${number}: ${result.warning}`);
  console.log(`merged #${number} into main`);
  const del = deleteBranchArgs(pr);
  if (del) {
    const out = spawnSync('gh', del, { encoding: 'utf8' });
    if (out.status === 0) console.log(`deleted the remote branch ${pr.headRefName}`);
    else console.warn(`WARN merge #${number}: the remote branch ${pr.headRefName} was not deleted: ${(out.stderr || '').trim()}`);
  }
  process.exit(0);
}
