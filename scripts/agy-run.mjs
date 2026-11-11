// Runs Antigravity (`agy`) with model fallback: `node scripts/agy-run.mjs [--strong-only] <agy args>`.
// Claude Code (Opus) plans and checks; the user merges. agy codes on every model of MODELS, flash included.
// It runs each model at the effort in its name (`-medium` or `-high`). When a model is out of quota, the same run
// starts again on the next model of MODELS. Any other result, pass or fail, ends the run.
// `--strong-only` keeps a Reviewer run on the STRONG models: it fails rather than review on a weaker one.
// AGY_MODELS (comma-separated) replaces the list.
// It also obeys the weekly stop line of the Claude usage guard (94%, USAGE_STOP_PERCENT), so agy and
// Claude stop together. `--check-usage` only checks that line: exit 0 to go on, exit 3 to stop.
// Exit 4 means every agy model is out of quota: Claude Code then codes the step on Sonnet, then Haiku.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MODELS = (process.env.AGY_MODELS || 'claude-sonnet-5-5-medium,claude-opus-5-5-high,gemini-4-argon-high,claude-sonnet-5-5-high,gemini-3.8-flash-high')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
export const STRONG = MODELS.filter((model) => /opus|argon/.test(model));

const QUOTA = /RESOURCE_EXHAUSTED|quota|\b429\b|rate.?limit|usage limit|too many requests|exhausted/i;
const TAIL_LINES = 20;

const STATE_FILE = join(process.env.USAGE_GUARD_DIR || join(homedir(), '.claude', 'usage-guard'), 'state.json');
const STOP_PERCENT = Number(process.env.USAGE_STOP_PERCENT || 94);
const STOPPED = 3;
export const OUT_OF_QUOTA = 4;

// Returns the reason to stop, or null. A window counts only while its reset time is in the future.
export function weeklyStop(state, now, stopPercent = STOP_PERCENT) {
  const week = state?.rate_limits?.seven_day;
  if (typeof week?.used_percentage !== 'number' || !(week.resets_at > now)) return null;
  if (week.used_percentage < stopPercent) return null;
  return `weekly usage ${Math.round(week.used_percentage)}% (stop line ${stopPercent}%). Work starts again after the reset at ${new Date(week.resets_at * 1000).toISOString()}`;
}

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

export function buildArgs(args, model) {
  const kept = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' || args[i] === '--effort') i++;
    else if (args[i] !== '--strong-only' && !/^--(model|effort)=/.test(args[i])) kept.push(args[i]);
  }
  return [...kept, '--model', model, '--effort', model.match(/-(low|medium|high)$/)?.[1] ?? 'high'];
}

// agy reports its own quota error on stderr, at the end. The task output on stdout can quote a 429
// from a test, so it never counts.
export const quotaText = ({ stderr }) => String(stderr ?? '').trimEnd().split(/\r?\n/).slice(-TAIL_LINES).join('\n');

export const hitQuota = ({ status, output }) => status !== 0 && QUOTA.test(output);

export function runWithFallback(args, run) {
  const models = args.includes('--strong-only') ? STRONG : MODELS;
  if (!models.length) return { status: 1, output: 'agy-run: no strong model (opus or argon) in AGY_MODELS' };
  for (const model of models) {
    const result = run(buildArgs(args, model));
    if (!hitQuota(result)) return { ...result, model };
    process.stderr.write(`agy-run: ${model} is out of quota. Next model.\n`);
  }
  return { status: OUT_OF_QUOTA, output: `agy-run: every model is out of quota: ${models.join(', ')}` };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const stop = weeklyStop(readState(), Math.floor(Date.now() / 1000));
  if (stop) {
    process.stderr.write(`agy-run: stopped: ${stop}. Commit the work, write the next step in PROGRESS.md, and stop.
`);
    process.exit(STOPPED);
  }
  if (process.argv.includes('--check-usage')) process.exit(0);
  const result = runWithFallback(process.argv.slice(2), (args) => {
    const r = spawnSync('agy', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    process.stdout.write(r.stdout ?? '');
    process.stderr.write(r.stderr ?? '');
    return { status: r.status ?? 1, output: quotaText(r) };
  });
  if (result.model) process.stderr.write(`agy-run: ran on ${result.model}\n`);
  else process.stderr.write(`${result.output}\n`);
  // Exit 4 means only "every model is out of quota". An exit 4 of agy itself becomes 1.
  process.exit(result.model && result.status === OUT_OF_QUOTA ? 1 : result.status);
}
