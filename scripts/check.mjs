// The one verification command: `pnpm check`.
// A passing step prints nothing. A failing step prints its last lines only.
// `--hook` is for an agent stop hook: it skips a clean tree and a plan-mode session, and exits 2 on failure.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { connect } from 'node:net';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, lockPath } from './check-lock.mjs';
import { hookSkips } from './hook-skip.mjs';
import { INSTALL_HINT, scan } from './secret-scan.mjs';

const MAX_LINES = 60;
const root = fileURLToPath(new URL('..', import.meta.url));
const hook = process.argv.includes('--hook');

const env = {
  ...process.env,
  PATH: join(root, 'node_modules', '.bin') + delimiter + process.env.PATH,
  NO_COLOR: '1',
};

// A hung step must fail with a message, not block for an hour. The slowest step (tests) takes about 100 s.
const STEP_TIMEOUT_MS = 8 * 60 * 1000;

function run(command) {
  const result = spawnSync(command, {
    cwd: root,
    env,
    shell: true,
    encoding: 'utf8',
    timeout: STEP_TIMEOUT_MS,
    killSignal: 'SIGKILL',
  });
  const timedOut = result.error?.code === 'ETIMEDOUT';
  const note = timedOut ? `\nTIMEOUT after ${STEP_TIMEOUT_MS / 1000} s. See docs/known-issues.md.` : '';
  return { ok: result.status === 0 && !timedOut, output: `${result.stdout ?? ''}${result.stderr ?? ''}${note}` };
}

if (hook) {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const treeIsClean = run('git status --porcelain').output.trim() === '';
  if (hookSkips(input, treeIsClean)) process.exit(0);
}

// The Stop hook has a 300 s timeout: a hook run waits 180 s at most, so the check still has time, and it blocks (exit 2) on a timeout.
// A lock is stale after 30 min, longer than any normal check, so a live slow run is never taken over.
let release;
try {
  release = await acquire(lockPath(root), {
    timeoutMs: hook ? 180_000 : 25 * 60 * 1000,
    onWait: (pid) => console.error(`Waiting for another pnpm check in this checkout (pid ${pid})`),
  });
} catch (error) {
  console.error(`check: ${error.message}. Run pnpm check again when that run ends.`);
  process.exit(hook ? 2 : 1);
}
process.on('exit', release);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => process.exit(130));

// Locally the API tests need the Postgres of `pnpm db:start`. A reboot stops it, so start it here.
// CI and a set DATABASE_URL bring their own database.
const portOpen = (port) =>
  new Promise((resolve) => {
    const socket = connect({ host: 'localhost', port }, () => resolve(socket.end() && true));
    socket.on('error', () => resolve(false));
  });
if (!process.env.CI && !process.env.DATABASE_URL && !(await portOpen(55432))) {
  const { ok, output } = run('node scripts/db-local.mjs');
  if (!ok) console.error(`The local database did not start:\n${output.trim()}`);
}

const sourceDirs = ['apps', 'packages'].filter((dir) => existsSync(join(root, dir)));
const steps = [
  ['tests', 'vitest run --reporter=dot'],
  ...(sourceDirs.length
    ? [
        ['types', 'pnpm -r --if-present run typecheck'],
        ['boundaries', `depcruise ${sourceDirs.join(' ')} --output-type err-long`],
      ]
    : []),
];

const failures = [];

{
  const { ok, output } = run('node scripts/gen-map.mjs --check');
  if (!ok) failures.push(output.trim());
}

// Every session reads these files, so they stay short.
for (const [file, limit] of [['AGENTS.md', 100], ['PROGRESS.md', 40]]) {
  if (!existsSync(join(root, file))) continue;
  const lines = readFileSync(join(root, file), 'utf8').trimEnd().split('\n').length;
  if (lines > limit) {
    failures.push(
      `FAIL size: ${file} has ${lines} lines and the limit is ${limit}\n` +
        'Fix: keep what the next session needs. Move the rest into code, a test, or a commit message.',
    );
  }
}

// Secrets in the staged and the unstaged changes. In GitHub Actions the job "secrets" scans the commits instead.
// The gate is GITHUB_ACTIONS, not CI: some agent shells set CI, and the scan must still run there.
const warnings = [];
let secretsScanned = false;
if (!process.env.GITHUB_ACTIONS) {
  const { status, output } = scan({ cwd: root, config: join(root, '.gitleaks.toml') });
  secretsScanned = status === 'ok';
  if (status === 'missing') {
    warnings.push(`WARN secrets: gitleaks is not installed, so no secret scan ran. CI still scans. ${INSTALL_HINT}`);
  } else if (status !== 'ok') {
    // Only a leak gets the secret hint. An error (a policy break, a git failure, a config gitleaks cannot load) says its own cause.
    const hint =
      status === 'leak'
        ? '\nFix: remove the secret and read it from an environment variable. For public test data, add an allowlist entry with a reason to .gitleaks.toml.'
        : '';
    failures.push(`FAIL secrets: gitleaks (${status})\n${output}${hint}`);
  }
}

// A package without a "typecheck" script would pass the types step unchecked.
const unchecked = sourceDirs
  .flatMap((dir) => readdirSync(join(root, dir)).map((name) => `${dir}/${name}/package.json`))
  .filter((file) => existsSync(join(root, file)))
  .filter((file) => !JSON.parse(readFileSync(join(root, file), 'utf8')).scripts?.typecheck);
if (unchecked.length) {
  failures.push(
    `FAIL types: no "typecheck" script in ${unchecked.join(', ')}\n` +
      'Fix: add a "typecheck" script to that package, for example "tsc --noEmit".',
  );
}

for (const [name, command] of steps) {
  const { ok, output } = run(command);
  if (ok) continue;
  const lines = output.trimEnd().split(/\r?\n/);
  const cut = lines.length > MAX_LINES ? [`... ${lines.length - MAX_LINES} earlier lines cut`] : [];
  failures.push([`FAIL ${name}: ${command}`, ...cut, ...lines.slice(-MAX_LINES)].join('\n'));
}

if (failures.length === 0) {
  if (!hook) {
    console.log(`check ok: ${[...steps.map(([name]) => name), ...(secretsScanned ? ['secrets'] : [])].join(', ')}`);
    for (const warning of warnings) console.error(warning);
  }
  release();
  process.exit(0);
}

console.error(failures.join('\n\n'));
release();
process.exit(hook ? 2 : 1);
