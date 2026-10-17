import { describe, expect, it } from 'vitest';
import { MODELS, buildArgs, hitQuota, runWithFallback } from '../scripts/agy-run.mjs';

describe('agy-run: an agy model that runs out of quota hands over to the next one', () => {
  it('every model in the list is a high variant', () => {
    expect(MODELS.length).toBeGreaterThan(1);
    for (const model of MODELS) expect(model).toMatch(/-high$/);
  });

  it('drops the model and effort of the caller, and sets high effort', () => {
    const args = buildArgs(['--model', 'gemini-3.8-flash-low', '--effort=low', '--mode', 'plan', '-p', 'task'], 'claude-opus-5-5-high');
    expect(args).toEqual(['--mode', 'plan', '-p', 'task', '--model', 'claude-opus-5-5-high', '--effort', 'high']);
  });

  it('reads a quota failure only from a failed run', () => {
    expect(hitQuota({ status: 1, output: 'Error: RESOURCE_EXHAUSTED: quota exceeded for model' })).toBe(true);
    expect(hitQuota({ status: 1, output: '429 Too Many Requests' })).toBe(true);
    expect(hitQuota({ status: 1, output: 'You have reached your usage limit' })).toBe(true);
    expect(hitQuota({ status: 1, output: 'TypeError: x is undefined' })).toBe(false);
    expect(hitQuota({ status: 0, output: 'The quota table is done' })).toBe(false);
  });

  it('tries the next model after a quota failure, and stops at the first other result', () => {
    const tried = [];
    const answers = [
      { status: 1, output: 'RESOURCE_EXHAUSTED' },
      { status: 2, output: 'test failed' },
    ];
    const result = runWithFallback(['-p', 'task'], (args) => {
      tried.push(args[args.indexOf('--model') + 1]);
      return answers.shift();
    });
    expect(tried).toEqual(MODELS.slice(0, 2));
    expect(result.status).toBe(2);
  });

  it('fails with a clear message when every model is out of quota', () => {
    const result = runWithFallback(['-p', 'task'], () => ({ status: 1, output: 'quota exceeded' }));
    expect(result.status).toBe(1);
    expect(result.output).toMatch(/every model is out of quota/);
  });
});
