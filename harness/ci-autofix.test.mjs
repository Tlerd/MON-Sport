// Proves the decisions of scripts/ci-autofix.mjs without GitHub, git, or an agent.

import { expect, test } from 'vitest';
import { attemptsLeft, ciState, diffProblems, failedRunIds, MARKER, pickPullRequest } from '../scripts/ci-autofix.mjs';

const run = (conclusion, status = 'COMPLETED', id = '101') => ({
  __typename: 'CheckRun',
  name: 'check',
  status,
  conclusion,
  detailsUrl: `https://github.com/Tlerd/MON-Sport/actions/runs/${id}/job/9${id}`,
});

const pr = (number, rollup, more = {}) => ({
  number,
  headRefName: `feat/${number}-x`,
  headRefOid: 'a'.repeat(40),
  isCrossRepository: false,
  author: { login: 'Tlerd' },
  statusCheckRollup: rollup,
  ...more,
});

test('CI is red when one check failed, even while another still runs', () => {
  expect(ciState([run('SUCCESS'), run('FAILURE')])).toBe('red');
  expect(ciState([run('FAILURE'), run(null, 'IN_PROGRESS')])).toBe('red');
  expect(ciState([run('TIMED_OUT')])).toBe('red');
  expect(ciState([{ __typename: 'StatusContext', state: 'ERROR' }])).toBe('red');
});

test('CI is pending, green, or none when no check failed', () => {
  expect(ciState([run('SUCCESS'), run(null, 'QUEUED')])).toBe('pending');
  expect(ciState([run('SUCCESS'), run('SKIPPED'), run('NEUTRAL')])).toBe('green');
  expect(ciState([])).toBe('none');
  expect(ciState(undefined)).toBe('none');
});

test('the failed run ids come from the Actions links, once each', () => {
  expect(failedRunIds([run('FAILURE', 'COMPLETED', '7'), run('FAILURE', 'COMPLETED', '7'), run('SUCCESS', 'COMPLETED', '8')])).toEqual(['7']);
  expect(failedRunIds([{ __typename: 'CheckRun', conclusion: 'FAILURE', detailsUrl: 'https://example.com/x' }])).toEqual([]);
});

test('each PR gets 2 attempts, and a give-up comment starts a new round', () => {
  const attempt = { body: `${MARKER} attempt` };
  const giveUp = { body: `${MARKER}:give-up` };
  expect(attemptsLeft([])).toBe(2);
  expect(attemptsLeft([attempt, { body: 'a human comment' }])).toBe(1);
  expect(attemptsLeft([attempt, attempt])).toBe(0);
  expect(attemptsLeft([attempt, attempt, giveUp])).toBe(2);
  expect(attemptsLeft([attempt, attempt, giveUp, attempt])).toBe(1);
});

test('only a red PR from this repo, by an allowed author, off main, is picked', () => {
  const red = [run('FAILURE')];
  const authors = ['Tlerd'];
  expect(pickPullRequest([pr(3, [run('SUCCESS')]), pr(5, red), pr(4, red)], authors).map((d) => [d.pr.number, d.action])).toEqual([
    [3, 'skip'],
    [4, 'fix'],
    [5, 'fix'],
  ]);
  expect(pickPullRequest([pr(6, red, { isCrossRepository: true })], authors)[0].action).toBe('skip');
  expect(pickPullRequest([pr(7, red, { author: { login: 'someone' } })], authors)[0].action).toBe('skip');
  expect(pickPullRequest([pr(8, red, { headRefName: 'main' })], authors)[0].action).toBe('skip');
  expect(pickPullRequest([pr(9, [run(null, 'IN_PROGRESS')])], authors)[0].reason).toMatch(/pending/);
});

test('a fix may not touch the harness, delete a test, or switch a check off', () => {
  expect(diffProblems([['M', 'apps/api/src/modules/bookings/bookings.service.ts']], ['+  return x;'])).toEqual([]);
  expect(diffProblems([['M', '.github/workflows/ci.yml']], [])).toHaveLength(1);
  expect(diffProblems([['M', 'scripts/check.mjs'], ['M', 'AGENTS.md']], [])).toHaveLength(2);
  expect(diffProblems([['D', 'apps/web/src/features/bookings/BookingForm.test.tsx']], [])).toHaveLength(1);
  expect(diffProblems([['M', 'a.ts']], ["+  it.skip('AC-1: x', () => {});"])).toHaveLength(1);
  expect(diffProblems([['M', 'a.ts']], ['+  // @ts-ignore'])).toHaveLength(1);
});
