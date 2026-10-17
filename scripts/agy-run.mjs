// Runs Antigravity (`agy`) with model fallback: `node scripts/agy-run.mjs <agy args>`.
// It always runs a high variant at high effort. When a model is out of quota, the same run
// starts again on the next model of MODELS. Any other result, pass or fail, ends the run.
// AGY_MODELS (comma-separated) replaces the list.

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const MODELS = (process.env.AGY_MODELS || 'claude-opus-5-5-high,gemini-4-argon-high,claude-sonnet-5-5-high,gemini-3.8-flash-high')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);

const QUOTA = /RESOURCE_EXHAUSTED|quota|\b429\b|rate.?limit|usage limit|too many requests|exhausted/i;

export function buildArgs(args, model) {
  const kept = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' || args[i] === '--effort') i++;
    else if (!/^--(model|effort)=/.test(args[i])) kept.push(args[i]);
  }
  return [...kept, '--model', model, '--effort', 'high'];
}

export const hitQuota = ({ status, output }) => status !== 0 && QUOTA.test(output);

export function runWithFallback(args, run) {
  for (const model of MODELS) {
    const result = run(buildArgs(args, model));
    if (!hitQuota(result)) return { ...result, model };
    process.stderr.write(`agy-run: ${model} is out of quota. Next model.\n`);
  }
  return { status: 1, output: `agy-run: every model is out of quota: ${MODELS.join(', ')}` };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = runWithFallback(process.argv.slice(2), (args) => {
    const r = spawnSync('agy', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    process.stdout.write(output);
    return { status: r.status ?? 1, output };
  });
  if (result.model) process.stderr.write(`agy-run: ran on ${result.model}\n`);
  else process.stderr.write(`${result.output}\n`);
  process.exit(result.status);
}
