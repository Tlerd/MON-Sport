import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MODELS,
  DEFAULT_REVIEW_MODELS,
  OUT_OF_QUOTA,
  activeLists,
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
    const lists = resolveModels({});
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
      lists,
    );
    expect(tried).toEqual(lists.models.slice(0, 2));
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
    const lists = resolveModels({});
    const tried = [];
    const result = runWithFallback(
      ['--strong-only', '--mode', 'plan', '-p', 'review'],
      (args) => {
        expect(args).not.toContain('--strong-only');
        tried.push(args[args.indexOf('--model') + 1]);
        return { status: 1, output: 'quota exceeded' };
      },
      lists,
    );
    expect(tried).toEqual(lists.strong);
    expect(lists.strong[0]).toBe('gemini-4-neon-high');
    expect(lists.strong.some((model) => /hydrogen/i.test(model))).toBe(false);
    expect(result.status).toBe(OUT_OF_QUOTA);
  });

  it('picks strong only when --strong-only is set, and models otherwise', () => {
    const lists = { models: ['m1'], strong: ['s1'] };
    const triedStrong = [];
    runWithFallback(
      ['--strong-only', '-p', 'review'],
      (args) => {
        triedStrong.push(args[args.indexOf('--model') + 1]);
        return { status: 0, output: '' };
      },
      lists,
    );
    expect(triedStrong).toEqual(['s1']);

    const triedModels = [];
    runWithFallback(
      ['-p', 'task'],
      (args) => {
        triedModels.push(args[args.indexOf('--model') + 1]);
        return { status: 0, output: '' };
      },
      lists,
    );
    expect(triedModels).toEqual(['m1']);
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
    const lists = resolveModels({});
    const result = runWithFallback(['-p', 'task'], () => ({ status: 1, output: 'quota exceeded' }), lists);
    expect(OUT_OF_QUOTA).toBe(4);
    expect(result.status).toBe(OUT_OF_QUOTA);
    expect(result.output).toMatch(/every model is out of quota/);
  });

  it('reads the 94% line of the weekly Claude limit, as the usage guard does', () => {
    const now = 1_800_000_000;
    const week = (pct, resetIn = 3600) => ({ rate_limits: { seven_day: { used_percentage: pct, resets_at: now + resetIn } } });
    expect(weeklyStop(week(94), now)).toMatch(/weekly usage 94%/);
    expect(weeklyStop(week(93), now)).toBeNull();
    expect(weeklyStop(week(99, -60), now), 'a window that has reset no longer counts').toBeNull();
    expect(weeklyStop(null, now), 'no usage data').toBeNull();
    expect(weeklyStop(week(90), now, 90), 'USAGE_STOP_PERCENT moves the line').toMatch(/90%/);
  });

  it('past the Claude line, agy keeps running on the Gemini models only (owner, 2026-11-20)', () => {
    const lists = activeLists(resolveModels({}), 'weekly usage 95%');
    expect(lists.models.length).toBeGreaterThan(0);
    expect(lists.models.every((model) => !/^claude-/.test(model))).toBe(true);
    expect(lists.models).toEqual(['gemini-4-hydrogen-high', 'gemini-4-argon-high']);
    expect(lists.strong).toEqual(['gemini-4-neon-high', 'gemini-4-argon-high']);
    expect(activeLists(resolveModels({}), null), 'below the line every model stays').toEqual(resolveModels({}));
  });

  it('a Reviewer past the Claude line skips Opus and still never falls to a weaker model', () => {
    const tried = [];
    const result = runWithFallback(
      ['--strong-only', '-p', 'review'],
      (args) => {
        tried.push(args[args.indexOf('--model') + 1]);
        return { status: 1, output: 'quota exceeded' };
      },
      activeLists(resolveModels({}), 'weekly usage 99%'),
    );
    expect(tried).toEqual(['gemini-4-neon-high', 'gemini-4-argon-high']);
    expect(result.status).toBe(OUT_OF_QUOTA);
  });

  it('--check-usage past the Claude line exits 0 and says agy runs on Gemini only', () => {
    const dir = mkdtempSync(join(tmpdir(), 'usage-guard-'));
    const resetsAt = Math.floor(Date.now() / 1000) + 3600;
    writeFileSync(join(dir, 'state.json'), JSON.stringify({ rate_limits: { seven_day: { used_percentage: 97, resets_at: resetsAt } } }));
    const r = spawnSync(process.execPath, ['scripts/agy-run.mjs', '--check-usage'], {
      encoding: 'utf8',
      env: { ...process.env, USAGE_GUARD_DIR: dir },
    });
    rmSync(dir, { recursive: true, force: true });
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/Gemini models only/);
  });

  it('returns status 1 with the empty-list message without calling run when the model list is empty', () => {
    const lists = { models: [], strong: [] };
    const run = vi.fn();

    expect(runWithFallback(['-p', 'task'], run, lists)).toEqual({
      status: 1,
      output: 'agy-run: no model in AGY_MODELS',
    });
    expect(runWithFallback(['--strong-only', '-p', 'review'], run, lists)).toEqual({
      status: 1,
      output: 'agy-run: no model in AGY_REVIEW_MODELS',
    });
    expect(run).not.toHaveBeenCalled();
  });
});
