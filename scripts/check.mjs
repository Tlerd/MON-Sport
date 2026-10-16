// The one verification command: `pnpm check`.
// A passing step prints nothing. A failing step prints its last lines only.
// `--hook` is for an agent stop hook: it skips a clean tree and exits 2 on failure.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_LINES = 60;
const root = fileURLToPath(new URL('..', import.meta.url));
const hook = process.argv.includes('--hook');

const env = {
  ...process.env,
  PATH: join(root, 'node_modules', '.bin') + delimiter + process.env.PATH,
  NO_COLOR: '1',
};

function run(command) {
  const result = spawnSync(command, { cwd: root, env, shell: true, encoding: 'utf8' });
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

if (hook) {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const treeIsClean = run('git status --porcelain').output.trim() === '';
  if (input.stop_hook_active || treeIsClean) process.exit(0);
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
  if (!hook) console.log(`check ok: ${steps.map(([name]) => name).join(', ')}`);
  process.exit(0);
}

console.error(failures.join('\n\n'));
process.exit(hook ? 2 : 1);
