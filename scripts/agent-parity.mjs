// Parity test: Claude Code and Antigravity answer the same prompt in this repository, read only.
// Each answer must match the rule that AGENTS.md, REVIEW.md, PROGRESS.md, and model-routing.md set.
// Run: `node scripts/agent-parity.mjs [claude] [agy]`. No name runs both. It is not part of
// `pnpm check`, because each run uses model quota. Exit 0 when every answer of every CLI passes.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const prompt = readFileSync(new URL('../harness/parity/prompt.md', import.meta.url), 'utf8');
const TIMEOUT_MS = 10 * 60 * 1000;

// Each key holds the patterns that its answer must all match.
const EXPECT = {
  check: [/pnpm check/],
  branch: [/feat\/12-1-booking-schema/],
  merge: [/node scripts\/merge\.mjs 50/],
  next_step: [/PROGRESS\.md/],
  open_field: [/decide|choose|pick/i, /Assumptions/],
  rule_review: [/money/i, /concurren/i, /schema/i, /personal/i],
  reviewer_model: [/strongest|opus/i],
  lock_order: [/Venue[\s\S]*SHARE[\s\S]*Court[\s\S]*UPDATE/i],
  time_zone: [/Asia\/Ho_Chi_Minh/, /booking-time/],
  weekly_stop: [/94/],
  never_push: [/main/],
  ci_wait: [/background|schedul/i],
};

const CLIS = {
  claude: ['claude', ['-p', '--permission-mode', 'plan', prompt]],
  agy: [process.execPath, ['scripts/agy-run.mjs', '--mode', 'plan', '-p', prompt]],
};

function run(name) {
  const [command, args] = CLIS[name];
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
    child.on('error', (error) => resolve({ name, out: String(error.message) }));
    child.on('close', () => {
      clearTimeout(timer);
      resolve({ name, out });
    });
  });
}

export function grade(out) {
  const match = /<json>\s*([\s\S]*?)\s*<\/json>/.exec(out) ?? /(\{[\s\S]*\})/.exec(out);
  let answers;
  try {
    answers = JSON.parse(match?.[1] ?? '');
  } catch {
    return { error: 'no JSON object in the reply', rows: [] };
  }
  const rows = Object.entries(EXPECT).map(([key, patterns]) => {
    const value = String(answers[key] ?? '');
    return { key, pass: patterns.every((re) => re.test(value)), value };
  });
  return { rows };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const names = process.argv.slice(2).filter((n) => n in CLIS);
  const results = await Promise.all((names.length ? names : Object.keys(CLIS)).map(run));
  let failed = 0;
  for (const { name, out } of results) {
    const { error, rows } = grade(out);
    if (error) {
      failed++;
      console.log(`FAIL ${name}: ${error}\n${out.trim().split(/\r?\n/).slice(-15).join('\n')}`);
      continue;
    }
    for (const row of rows) {
      if (!row.pass) failed++;
      console.log(`${row.pass ? 'pass' : 'FAIL'} ${name.padEnd(6)} ${row.key.padEnd(14)} ${row.value.replace(/\s+/g, ' ').slice(0, 110)}`);
    }
  }
  console.log(failed ? `parity FAILED: ${failed} answer(s)` : 'parity ok: every answer of every CLI passes');
  process.exit(failed ? 1 : 0);
}
