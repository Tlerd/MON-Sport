// Runs Antigravity (`agy`) with model fallback: `node scripts/agy-run.mjs [--strong-only] <agy args>`.
// It always runs a high variant at high effort. When a model is out of quota, the same run
// starts again on the next model of MODELS. Any other result, pass or fail, ends the run.
// `--strong-only` keeps a Reviewer run on the STRONG models: it fails rather than review on a weaker one.
// AGY_MODELS (comma-separated) replaces the list.

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const MODELS = (process.env.AGY_MODELS || 'claude-opus-5-5-high,gemini-4-argon-high,claude-sonnet-5-5-high,gemini-3.8-flash-high')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
export const STRONG = MODELS.filter((model) => /opus|argon/.test(model));

const QUOTA = /RESOURCE_EXHAUSTED|quota|\b429\b|rate.?limit|usage limit|too many requests|exhausted/i;
const TAIL_LINES = 20;

export function buildArgs(args, model) {
  const kept = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' || args[i] === '--effort') i++;
    else if (args[i] !== '--strong-only' && !/^--(model|effort)=/.test(args[i])) kept.push(args[i]);
  }
  return [...kept, '--model', model, '--effort', 'high'];
}

// agy reports its own quota error on stderr, at the end. The task output on stdout can quote a 429
// from a test, so it never counts.
export const quotaText = ({ stderr }) => String(stderr ?? '').trimEnd().split(/\r?\n/).slice(-TAIL_LINES).join('\n');

export const hitQuota = ({ status, output }) => status !== 0 && QUOTA.test(output);

export function runWithFallback(args, run) {
  const models = args.includes('--strong-only') ? STRONG : MODELS;
  for (const model of models) {
    const result = run(buildArgs(args, model));
    if (!hitQuota(result)) return { ...result, model };
    process.stderr.write(`agy-run: ${model} is out of quota. Next model.\n`);
  }
  return { status: 1, output: `agy-run: every model is out of quota: ${models.join(', ')}` };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = runWithFallback(process.argv.slice(2), (args) => {
    const r = spawnSync('agy', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    process.stdout.write(r.stdout ?? '');
    process.stderr.write(r.stderr ?? '');
    return { status: r.status ?? 1, output: quotaText(r) };
  });
  if (result.model) process.stderr.write(`agy-run: ran on ${result.model}\n`);
  else process.stderr.write(`${result.output}\n`);
  process.exit(result.status);
}
