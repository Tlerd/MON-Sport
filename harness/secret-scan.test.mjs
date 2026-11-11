// Proves scripts/secret-scan.mjs: where it finds gitleaks, what it scans, and that it stops a staged secret.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { findGitleaks, scan, scanArgs } from '../scripts/secret-scan.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const config = join(root, '.gitleaks.toml');

test('GITLEAKS_BIN wins over the PATH and the winget folder', () => {
  const found = findGitleaks({ env: { GITLEAKS_BIN: '/opt/gitleaks' }, platform: 'linux', onPath: () => '/usr/bin/gitleaks' });
  expect(found).toBe('/opt/gitleaks');
});

test('a gitleaks on the PATH is used', () => {
  expect(findGitleaks({ env: {}, platform: 'linux', onPath: () => '/usr/bin/gitleaks' })).toBe('/usr/bin/gitleaks');
});

test('on Windows, the winget package folder is the fallback, because winget changes the PATH only for a new shell', () => {
  const found = findGitleaks({
    env: { LOCALAPPDATA: 'C:/Users/u/AppData/Local' },
    platform: 'win32',
    onPath: () => null,
    wingetDirs: () => ['Gitleaks.Gitleaks_Microsoft.Winget.Source_8wekyb3d8bbwe'],
    exists: () => true,
  });
  expect(found.replaceAll('\\', '/')).toBe(
    'C:/Users/u/AppData/Local/Microsoft/WinGet/Packages/Gitleaks.Gitleaks_Microsoft.Winget.Source_8wekyb3d8bbwe/gitleaks.exe',
  );
});

test('no gitleaks gives null', () => {
  expect(findGitleaks({ env: {}, platform: 'linux', onPath: () => null })).toBeNull();
});

test('a local scan covers the staged and the unstaged changes, with the repository config and redaction', () => {
  const runs = scanArgs({ config: 'C:/r/.gitleaks.toml' });
  expect(runs).toEqual([
    ['git', '--pre-commit', '--staged', '--config', 'C:/r/.gitleaks.toml', '--redact', '--verbose', '--no-banner', '.'],
    ['git', '--pre-commit', '--config', 'C:/r/.gitleaks.toml', '--redact', '--verbose', '--no-banner', '.'],
  ]);
});

test('a range scan reads the commits of that range', () => {
  expect(scanArgs({ config: '.gitleaks.toml', range: 'origin/main..HEAD' })).toEqual([
    ['git', '--log-opts=origin/main..HEAD', '--config', '.gitleaks.toml', '--redact', '--verbose', '--no-banner', '.'],
  ]);
});

test('a missing gitleaks reports "missing" and runs nothing', () => {
  expect(scan({ cwd: root, config, bin: null }).status).toBe('missing');
});

// The real binary runs only where it is installed. CI runs the scan in its own job.
const bin = findGitleaks();

function repoWith(file, text) {
  const dir = mkdtempSync(join(tmpdir(), 'secret-scan-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args) => execFileSync('git', args, { cwd: dir, env, stdio: 'pipe' });
  git('init', '--quiet');
  writeFileSync(join(dir, file), text);
  git('add', file);
  return dir;
}

test.skipIf(!bin)('a staged GitHub token stops the scan, and the output does not show it', () => {
  // The token is built at run time, so this file holds no secret for gitleaks to find.
  const token = ['ghp', 'R8x2Lq9VtZ4mK7bN1wC5yH3jD6fG0sPeUaXo'].join('_');
  const dir = repoWith('config.ts', `export const token = '${token}';\n`);
  try {
    const result = scan({ cwd: dir, config, bin });
    expect(result.status).toBe('leak');
    expect(result.output).not.toContain(token);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test.skipIf(!bin)('the public Web Push sample keys of the push tests pass', () => {
  const keys = "const KEYS = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };\n";
  const dir = repoWith('push.test.ts', keys);
  try {
    expect(scan({ cwd: dir, config, bin }).status).toBe('ok');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
