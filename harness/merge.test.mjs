// Proves the decisions of scripts/merge.mjs: the one way to merge a pull request.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { deleteBranchArgs, latestChecks, mergeArgs, mergeBlockers, mergeResult, reviewMarker, ttyBlocker } from '../scripts/merge.mjs';

const HEAD = 'abc1234def5678abc1234def5678abc1234def56';
const green = [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' }];
const marker = (head = HEAD, high = 0, medium = 0) => ({ body: `Review.\n<!-- review head=${head} high=${high} medium=${medium} -->` });
const pr = (more = {}) => ({ state: 'OPEN', isDraft: false, baseRefName: 'main', headRefName: 'feat/1-1-x', headRefOid: HEAD, statusCheckRollup: green, comments: [marker()], ...more });

test('a green open pull request with a clean marker for its head has no blocker', () => {
  expect(mergeBlockers(pr())).toEqual([]);
});

test('a stacked pull request whose base is not main blocks, and names the base to merge first', () => {
  const blockers = mergeBlockers(pr({ baseRefName: 'feat/1-1-x', headRefName: 'feat/1-2-y' }));
  expect(blockers).toHaveLength(1);
  expect(blockers[0]).toContain('feat/1-1-x');
  expect(mergeBlockers(pr({ baseRefName: undefined }))).toHaveLength(1);
});

test('a red or pending check blocks', () => {
  const red = [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' }];
  const pending = [{ __typename: 'CheckRun', status: 'IN_PROGRESS', conclusion: null }];
  expect(mergeBlockers(pr({ statusCheckRollup: red }))).toHaveLength(1);
  expect(mergeBlockers(pr({ statusCheckRollup: pending }))).toHaveLength(1);
  expect(mergeBlockers(pr({ statusCheckRollup: [] }))).toHaveLength(1);
});

test('no marker, a marker for an older head, or open findings block', () => {
  expect(mergeBlockers(pr({ comments: [] }))).toHaveLength(1);
  expect(mergeBlockers(pr({ comments: [marker('0000000aaaa')] }))).toHaveLength(1);
  expect(mergeBlockers(pr({ comments: [marker(HEAD, 0, 1)] }))).toHaveLength(1);
  expect(mergeBlockers(pr({ comments: [marker(HEAD, 1, 0)] }))).toHaveLength(1);
});

test('the latest marker of the current head decides', () => {
  expect(mergeBlockers(pr({ comments: [marker(HEAD, 0, 2), marker(HEAD, 0, 0)] }))).toEqual([]);
  expect(mergeBlockers(pr({ comments: [marker(HEAD, 0, 0), marker(HEAD, 0, 2)] }))).toHaveLength(1);
});

test('a short head in the marker matches the full head', () => {
  expect(mergeBlockers(pr({ comments: [marker(HEAD.slice(0, 7))] }))).toEqual([]);
});

test('a closed, draft, or main pull request blocks', () => {
  expect(mergeBlockers(pr({ state: 'MERGED' }))).toHaveLength(1);
  expect(mergeBlockers(pr({ isDraft: true }))).toHaveLength(1);
  expect(mergeBlockers(pr({ headRefName: 'main' }))).toHaveLength(1);
});

// AGENTS.md "Autonomy": after 2 review rounds an open finding is recorded and the work continues.
test('an accepted marker lets an open finding pass only after 2 review rounds', () => {
  const accepted = { body: `<!-- review-accepted head=${HEAD.slice(0, 7)} -->` };
  const round1 = marker('1111111111', 0, 1);
  const round2 = marker(HEAD, 0, 1);
  expect(mergeBlockers(pr({ comments: [round2, accepted] }))).toHaveLength(1);
  expect(mergeBlockers(pr({ comments: [round1, round2, accepted] }))).toEqual([]);
  expect(mergeBlockers(pr({ comments: [round1, round2, { body: '<!-- review-accepted head=0000000 -->' }] }))).toHaveLength(1);
});

test('two markers for one head are one round, so a retried comment does not accept a finding', () => {
  const accepted = { body: `<!-- review-accepted head=${HEAD.slice(0, 7)} -->` };
  expect(mergeBlockers(pr({ comments: [marker(HEAD, 0, 1), marker(HEAD, 0, 1), accepted] }))).toHaveLength(1);
});

test('only the newest run of a check counts, so an old red run of an edited check does not block', () => {
  const run = (conclusion, time) => ({ __typename: 'CheckRun', workflowName: 'pr-gates', name: 'gates', status: 'COMPLETED', conclusion, startedAt: time, completedAt: time });
  const old = run('FAILURE', '2026-10-22T01:00:00Z');
  const fresh = run('SUCCESS', '2026-10-22T02:00:00Z');
  expect(latestChecks([old, fresh])).toEqual([fresh]);
  // The order of the rollup does not decide: the time does.
  expect(latestChecks([fresh, old])).toEqual([fresh]);
  expect(mergeBlockers(pr({ statusCheckRollup: [fresh, old] }))).toEqual([]);
  expect(mergeBlockers(pr({ statusCheckRollup: [run('SUCCESS', '2026-10-22T01:00:00Z'), run('FAILURE', '2026-10-22T02:00:00Z')] }))).toHaveLength(1);
});

// A queued rerun has no usable start time. It must not lose to the old green run of the same check.
test('a queued or running rerun of a check blocks, whatever its time and its place in the rollup', () => {
  const done = { __typename: 'CheckRun', workflowName: 'pr-gates', name: 'gates', status: 'COMPLETED', conclusion: 'SUCCESS', startedAt: '2026-10-22T02:00:00Z', completedAt: '2026-10-22T02:01:00Z' };
  for (const startedAt of [null, '', '0001-01-01T00:00:00Z', '2026-10-22T01:00:00Z']) {
    const queued = { __typename: 'CheckRun', workflowName: 'pr-gates', name: 'gates', status: 'QUEUED', conclusion: null, startedAt };
    expect(mergeBlockers(pr({ statusCheckRollup: [done, queued] }))).toHaveLength(1);
    expect(mergeBlockers(pr({ statusCheckRollup: [queued, done] }))).toHaveLength(1);
  }
});

// --delete-branch also switches the local checkout to main. That fails when another worktree holds main,
// after the merge on GitHub already happened (2026-11-12, PR 227 and 228). The branch is deleted on the remote only.
test('the merge command pins the head that was checked and never touches the local checkout', () => {
  expect(mergeArgs('95', pr())).toEqual(['pr', 'merge', '95', '--merge', '--match-head-commit', HEAD]);
});

test('the remote head branch is deleted through the GitHub API, as gh did, and a fork branch is left alone', () => {
  expect(deleteBranchArgs(pr())).toEqual(['api', '-X', 'DELETE', 'repos/{owner}/{repo}/git/refs/heads/feat/1-1-x']);
  expect(deleteBranchArgs(pr({ isCrossRepository: true }))).toBeNull();
  // An unencoded "#" would end the URL at "feat/a" and delete that branch instead.
  expect(deleteBranchArgs(pr({ headRefName: 'feat/a#b%c' }))).toEqual(['api', '-X', 'DELETE', 'repos/{owner}/{repo}/git/refs/heads/feat/a%23b%25c']);
});

test('the state on GitHub after the merge decides the result, not the exit code of gh', () => {
  expect(mergeResult({ status: 0, state: 'MERGED' })).toEqual({ merged: true, unknown: false, warning: null });
  // gh merged on GitHub, then failed on a local step.
  const late = mergeResult({ status: 1, state: 'MERGED', stderr: "fatal: 'main' is already used by worktree" });
  expect(late.merged).toBe(true);
  expect(late.warning).toContain('already used by worktree');
  expect(mergeResult({ status: 1, state: 'OPEN', stderr: 'boom' })).toEqual({ merged: false, unknown: false, warning: null });
  // gh said yes, but GitHub did not merge (for example, the head moved).
  expect(mergeResult({ status: 0, state: 'OPEN' })).toEqual({ merged: false, unknown: false, warning: null });
});

test('a state that could not be read is unknown, never reported as not merged', () => {
  for (const state of ['', undefined, null]) {
    expect(mergeResult({ status: 0, state })).toEqual({ merged: false, unknown: true, warning: null });
  }
});

test('reviewMarker reads the numbers and ignores text that is not a marker', () => {
  expect(reviewMarker('<!-- review head=abc1234 high=0 medium=2 -->')).toEqual({ head: 'abc1234', high: 0, medium: 2 });
  expect(reviewMarker('review head=abc1234 high=0 medium=0')).toBeNull();
});

test('ttyBlocker returns null for a TTY', () => {
  expect(ttyBlocker(true, ['node', 'scripts/merge.mjs', '123'])).toBeNull();
});

test("ttyBlocker returns null for '--dry-run' without a TTY", () => {
  expect(ttyBlocker(false, ['node', 'scripts/merge.mjs', '123', '--dry-run'])).toBeNull();
});

test('ttyBlocker returns the message without a TTY', () => {
  expect(ttyBlocker(false, ['node', 'scripts/merge.mjs', '123'])).toBe(
    'merge.mjs needs a terminal: the user runs it by hand (HUMAN_DECISIONS.md row 49). Agents never merge. Use --dry-run to check the blockers.'
  );
});

test('spawning merge.mjs without a TTY exits 1 and needs a terminal before any gh call', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/merge.mjs', import.meta.url)), '999'], { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('needs a terminal');
});
