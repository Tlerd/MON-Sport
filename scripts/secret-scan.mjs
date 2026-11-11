#!/usr/bin/env node
// Secret scan with gitleaks (https://github.com/gitleaks/gitleaks). The rules and the allowlist are in .gitleaks.toml.
// Local: `pnpm check` scans the staged and the unstaged changes. Without gitleaks it warns and passes.
// CI:    node scripts/secret-scan.mjs --range <base>..<head>   scans those commits. Without gitleaks it fails.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const INSTALL_HINT = 'Install gitleaks: `winget install Gitleaks.Gitleaks` (Windows) or see https://github.com/gitleaks/gitleaks#installing';

function pathLookup(platform) {
  const res = spawnSync(platform === 'win32' ? 'where' : 'which', ['gitleaks'], { encoding: 'utf8' });
  return res.status === 0 ? res.stdout.split(/\r?\n/)[0].trim() || null : null;
}

function wingetPackages(localAppData) {
  try {
    return readdirSync(join(localAppData, 'Microsoft', 'WinGet', 'Packages')).filter((name) => name.startsWith('Gitleaks.Gitleaks'));
  } catch {
    return [];
  }
}

/** The gitleaks binary: GITLEAKS_BIN, then the PATH, then (Windows) the winget package folder. Null when none. */
export function findGitleaks({
  env = process.env,
  platform = process.platform,
  onPath = pathLookup,
  wingetDirs = wingetPackages,
  exists = existsSync,
} = {}) {
  if (env.GITLEAKS_BIN) return env.GITLEAKS_BIN;
  const found = onPath(platform);
  if (found) return found;
  // winget adds gitleaks to the PATH of a new shell only, so a running agent session does not see it.
  if (platform === 'win32' && env.LOCALAPPDATA) {
    for (const dir of wingetDirs(env.LOCALAPPDATA)) {
      const file = join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages', dir, 'gitleaks.exe');
      if (exists(file)) return file;
    }
  }
  return null;
}

/** The gitleaks argument lists: a range scan reads commits, a local scan reads the staged and the unstaged diff. */
export function scanArgs({ config, range }) {
  // --verbose names the file and the line of each finding. --redact hides the value.
  const common = ['--config', config, '--redact', '--verbose', '--no-banner', '.'];
  if (range) return [['git', `--log-opts=${range}`, ...common]];
  return [
    ['git', '--pre-commit', '--staged', ...common],
    ['git', '--pre-commit', ...common],
  ];
}

/**
 * gitleaks 8.30 exits 0 with "no leaks found" when its git call fails, and logs each git stderr line at level ERR.
 * A git warning (for example CRLF in an unstaged file) is harmless. Any other ERR line means git failed.
 */
export const gitFailed = (output) =>
  /partial scan/.test(output) ||
  output
    .split(/\r?\n/)
    .some((line) => /^\S+ ERR /.test(line) && !/ ERR \[git\] warning:/.test(line) && !/stderr is not empty/.test(line));

/**
 * gitleaks stops reading the diff at the first git stderr line, so a CRLF warning on one unstaged file
 * hid the files after it ("partial scan"). core.safecrlf=false turns that warning off for gitleaks' git calls only.
 */
function withoutCrlfWarning(env) {
  const count = Number(env.GIT_CONFIG_COUNT) || 0;
  return { ...env, GIT_CONFIG_COUNT: String(count + 1), [`GIT_CONFIG_KEY_${count}`]: 'core.safecrlf', [`GIT_CONFIG_VALUE_${count}`]: 'false' };
}

/**
 * Runs the scan. status is "ok", "leak", "missing" (no binary), or "error" (gitleaks or git failed).
 * env is the environment of gitleaks and its git calls. A test passes one without GIT_* for its temporary repository.
 */
export function scan({ cwd, config, range, bin = findGitleaks(), env = process.env }) {
  if (!bin) return { status: 'missing', output: INSTALL_HINT };
  if (range) {
    // A pull request or a push always has a commit, so an empty range means a wrong range. Git counts the commits:
    // gitleaks does not count a commit without text lines, such as a deletion or a merge.
    const count = spawnSync('git', ['rev-list', '--count', range], { cwd, env, encoding: 'utf8' });
    if (count.status !== 0) return { status: 'error', output: `git rev-list ${range} failed: ${(count.stderr || count.error?.message || '').trim()}` };
    if (Number(count.stdout.trim()) === 0) return { status: 'error', output: `The range ${range} has no commits.` };
  }
  const outputs = [];
  for (const args of scanArgs({ config, range })) {
    // Exit 1 means leaks (the default --exit-code). Any other non-zero code is an error.
    const res = spawnSync(bin, args, { cwd, encoding: 'utf8', env: { ...withoutCrlfWarning(env), NO_COLOR: '1' } });
    // gitleaks colors REDACTED even with NO_COLOR, so strip the ANSI codes.
    const output = `${res.stdout ?? ''}${res.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '').trim();
    if (res.status === 1) return { status: 'leak', output };
    if (res.status !== 0) return { status: 'error', output: output || res.error?.message || `gitleaks exited ${res.status}` };
    if (gitFailed(output)) return { status: 'error', output };
    outputs.push(output);
  }
  return { status: 'ok', output: outputs.join('\n') };
}

if (import.meta.main) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const index = process.argv.indexOf('--range');
  const range = index === -1 ? undefined : process.argv[index + 1];
  if (index !== -1 && !range) {
    console.error('secret-scan: --range needs a value, for example origin/main..HEAD');
    process.exit(1);
  }
  const result = scan({ cwd: root, config: join(root, '.gitleaks.toml'), range });
  if (result.status === 'ok') {
    console.log('secret scan ok');
    process.exit(0);
  }
  console.error(result.output);
  if (result.status === 'leak') {
    console.error('Fix: remove the secret and read it from an environment variable. A secret that reached a pushed commit must be rotated.');
  }
  // Without a range this is a local run: a missing gitleaks warns only. CI passes a range and must fail.
  process.exit(result.status === 'missing' && !range ? 0 : 1);
}
