// Proves the decisions of scripts/ci-autofix.mjs without GitHub, git, or an agent.

import { expect, test } from 'vitest';
import { agentEnv, attemptsLeft, emptyConfigDir, ciState, diffProblems, failedRunIds, MARKER, pickPullRequest } from '../scripts/ci-autofix.mjs';

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

// The description gate (pr-gates) fails for a reason that code cannot fix, so autofix does not start on it.
test('a failed pr-gates run does not start an autofix, and a failed ci run still does', () => {
  const gates = { ...run('FAILURE'), workflowName: 'pr-gates' };
  const ci = { ...run('SUCCESS'), workflowName: 'ci' };
  const authors = ['Tlerd'];
  expect(pickPullRequest([pr(1, [ci, gates])], authors)[0].action).toBe('skip');
  expect(pickPullRequest([pr(1, [{ ...run('FAILURE'), workflowName: 'ci' }, gates])], authors)[0].action).toBe('fix');
});

// The agent runs with --dangerously-skip-permissions, so "do not push" in the prompt is not a control.
// Its environment carries no GitHub, Google Cloud, or git credential.
test('the agent environment drops credentials and points gh, gcloud, and git at empty config', () => {
  const env = agentEnv({ PATH: '/bin', GH_TOKEN: 'x', GITHUB_TOKEN: 'y', GOOGLE_APPLICATION_CREDENTIALS: 'z', DATABASE_URL: 'db' }, '/work/pr-7');
  expect(env.PATH).toBe('/bin');
  expect(env.DATABASE_URL).toBe('db');
  for (const key of ['GH_TOKEN', 'GITHUB_TOKEN', 'GOOGLE_APPLICATION_CREDENTIALS']) expect(env).not.toHaveProperty(key);
  // The empty config sits outside the worktree, so `git add -A` never commits it.
  for (const key of ['GH_CONFIG_DIR', 'CLOUDSDK_CONFIG', 'GIT_CONFIG_GLOBAL']) {
    expect(env[key]).toMatch(/pr-7/);
    expect(env[key].startsWith('/work/pr-7')).toBe(false);
  }
  // One directory holds all three, so one rmSync before and after an attempt clears what the agent wrote.
  for (const key of ['GH_CONFIG_DIR', 'CLOUDSDK_CONFIG', 'GIT_CONFIG_GLOBAL']) expect(env[key].startsWith(emptyConfigDir('/work/pr-7'))).toBe(true);
  expect(emptyConfigDir('/work/pr-7')).not.toBe(emptyConfigDir('/work/pr-8'));
  expect(env.GIT_CONFIG_NOSYSTEM).toBe('1');
  expect(env.GIT_TERMINAL_PROMPT).toBe('0');
  expect(env.GIT_AUTHOR_NAME).toBeTruthy();
});
