import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODELS,
  DEFAULT_REVIEW_MODELS,
  OUT_OF_QUOTA,
  buildArgs,
  hitQuota,
  quotaText,
  resolveModels,
  runWithFallback,
  weeklyStop,
} from '../scripts/agy-run.mjs';

describe('agy-run: an agy model that runs out of quota hands over to the next one', () => {
  it('the first model is Hydrogen, before Argon, and every model carries its effort', () => {
    const { models } = resolveModels({});
    expect(models.length).toBeGreaterThan(1);
    expect(models[0]).toBe('gemini-4-hydrogen-high');
    expect(models).toContain('gemini-4-argon-high');
    expect(models.indexOf('gemini-4-hydrogen-high')).toBeLessThan(models.indexOf('gemini-4-argon-high'));
    for (const model of models) expect(model).toMatch(/-(medium|high)$/);
  });

  it('drops the model and effort of the caller, and sets the effort of the model', () => {
    const args = buildArgs(['--model', 'gemini-3.8-flash-low', '--effort=low', '--mode', 'plan', '-p', 'task'], 'claude-opus-5-5-high');
    expect(args).toEqual(['--mode', 'plan', '-p', 'task', '--model', 'claude-opus-5-5-high', '--effort', 'high']);
    expect(buildArgs(['-p', 'task'], 'claude-sonnet-5-5-medium')).toEqual(['-p', 'task', '--model', 'claude-sonnet-5-5-medium', '--effort', 'medium']);
  });

  it('reads a quota failure only from a failed run', () => {
    expect(hitQuota({ status: 1, output: 'Error: RESOURCE_EXHAUSTED: quota exceeded for model' })).toBe(true);
    expect(hitQuota({ status: 1, output: '429 Too Many Requests' })).toBe(true);
    expect(hitQuota({ status: 1, output: 'You have reached your usage limit' })).toBe(true);
    expect(hitQuota({ status: 1, output: 'TypeError: x is undefined' })).toBe(false);
    expect(hitQuota({ status: 0, output: 'The quota table is done' })).toBe(false);
  });

  it('tries the next model after a quota failure, and stops at the first other result', () => {
    const { models } = resolveModels({});
    const tried = [];
    const answers = [
      { status: 1, output: 'RESOURCE_EXHAUSTED' },
      { status: 2, output: 'test failed' },
    ];
    const result = runWithFallback(
      ['-p', 'task'],
      (args) => {
        tried.push(args[args.indexOf('--model') + 1]);
        return answers.shift();
      },
      models,
    );
    expect(tried).toEqual(models.slice(0, 2));
    expect(result.status).toBe(2);
  });

  it('reads the quota error only from the tail of stderr, not from the task output', () => {
    const testRun = 'FAIL throttle.e2e.test.ts\nexpected 401 to be 429\n'.repeat(3);
    expect(quotaText({ stdout: testRun, stderr: '' })).toBe('');
    expect(hitQuota({ status: 1, output: quotaText({ stdout: testRun, stderr: '' }) })).toBe(false);
    const stderr = `${'log line\n'.repeat(40)}Error: RESOURCE_EXHAUSTED`;
    expect(hitQuota({ status: 1, output: quotaText({ stdout: '', stderr }) })).toBe(true);
  });

  it('a strong-only run, such as a Reviewer, starts on Neon and never falls back to a weaker model', () => {
    const { strong } = resolveModels({});
    const tried = [];
    const result = runWithFallback(
      ['--strong-only', '--mode', 'plan', '-p', 'review'],
      (args) => {
        expect(args).not.toContain('--strong-only');
        tried.push(args[args.indexOf('--model') + 1]);
        return { status: 1, output: 'quota exceeded' };
      },
      strong,
    );
    expect(tried).toEqual(strong);
    expect(strong[0]).toBe('gemini-4-neon-high');
    expect(strong.some((model) => /hydrogen/i.test(model))).toBe(false);
    expect(result.status).toBe(OUT_OF_QUOTA);
  });

  it('AGY_MODELS and AGY_REVIEW_MODELS override the defaults in resolveModels', () => {
    expect(DEFAULT_MODELS).toContain('gemini-4-hydrogen-high');
    expect(DEFAULT_REVIEW_MODELS).toContain('gemini-4-neon-high');
    expect(
      resolveModels({
        AGY_MODELS: 'gemini-4-argon-high, gemini-4-hydrogen-high',
        AGY_REVIEW_MODELS: 'claude-opus-5-5-high, gemini-4-argon-high',
      }),
    ).toEqual({
      models: ['gemini-4-argon-high', 'gemini-4-hydrogen-high'],
      strong: ['claude-opus-5-5-high', 'gemini-4-argon-high'],
    });
  });

  it('exits 4 with a clear message when every model is out of quota, so Claude Code codes on Sonnet or Haiku', () => {
    const { models } = resolveModels({});
    const result = runWithFallback(['-p', 'task'], () => ({ status: 1, output: 'quota exceeded' }), models);
    expect(OUT_OF_QUOTA).toBe(4);
    expect(result.status).toBe(OUT_OF_QUOTA);
    expect(result.output).toMatch(/every model is out of quota/);
  });

  it('stops every agy run at 94% of the weekly Claude limit, as the usage guard does', () => {
    const now = 1_800_000_000;
    const week = (pct, resetIn = 3600) => ({ rate_limits: { seven_day: { used_percentage: pct, resets_at: now + resetIn } } });
    expect(weeklyStop(week(94), now)).toMatch(/weekly usage 94%/);
    expect(weeklyStop(week(93), now)).toBeNull();
    expect(weeklyStop(week(99, -60), now), 'a window that has reset no longer counts').toBeNull();
    expect(weeklyStop(null, now), 'no usage data').toBeNull();
    expect(weeklyStop(week(90), now, 90), 'USAGE_STOP_PERCENT moves the line').toMatch(/90%/);
  });
});
