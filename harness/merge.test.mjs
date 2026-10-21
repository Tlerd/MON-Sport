// Proves the decisions of scripts/merge.mjs: the one way to merge a pull request.

import { expect, test } from 'vitest';
import { mergeBlockers, reviewMarker } from '../scripts/merge.mjs';

const HEAD = 'abc1234def5678abc1234def5678abc1234def56';
const green = [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' }];
const marker = (head = HEAD, high = 0, medium = 0) => ({ body: `Review.\n<!-- review head=${head} high=${high} medium=${medium} -->` });
const pr = (more = {}) => ({ state: 'OPEN', isDraft: false, headRefName: 'feat/1-1-x', headRefOid: HEAD, statusCheckRollup: green, comments: [marker()], ...more });

test('a green open pull request with a clean marker for its head has no blocker', () => {
  expect(mergeBlockers(pr())).toEqual([]);
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
  const open = (n) => Array.from({ length: n }, () => marker(HEAD, 0, 1));
  expect(mergeBlockers(pr({ comments: [...open(1), accepted] }))).toHaveLength(1);
  expect(mergeBlockers(pr({ comments: [...open(2), accepted] }))).toEqual([]);
  expect(mergeBlockers(pr({ comments: [...open(2), { body: '<!-- review-accepted head=0000000 -->' }] }))).toHaveLength(1);
});

test('reviewMarker reads the numbers and ignores text that is not a marker', () => {
  expect(reviewMarker('<!-- review head=abc1234 high=0 medium=2 -->')).toEqual({ head: 'abc1234', high: 0, medium: 2 });
  expect(reviewMarker('review head=abc1234 high=0 medium=0')).toBeNull();
});
