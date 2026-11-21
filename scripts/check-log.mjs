// Appends one JSON line per local `pnpm check` run so `scripts/maintain.mjs` can detect flaky tests
// (a fail and a pass on the same working-tree hash). Never writes in CI and never changes `check.mjs` exit code.

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GIT_TIMEOUT_MS = 15_000;
const ANSI = /\x1b\[[0-9;]*m/g;

export function checkLogPath(env = process.env, fallbackRoot = ROOT) {
  if (env.MONSPORT_CHECK_LOG) return env.MONSPORT_CHECK_LOG;
  const base = env.LOCALAPPDATA ?? join(env.HOME ?? fallbackRoot, '.local');
  return join(base, 'monsport', 'check.jsonl');
}

const GH_LOG_PREFIX = /^[^\t\r\n]+\t[^\t\r\n]+\t\uFEFF?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s*/;

export function parseVitestFailures(output = '') {
  const clean = String(output).replace(ANSI, '');
  const lines = clean.split(/\r?\n/).map((line) => line.replace(GH_LOG_PREFIX, ''));
  const seen = new Set();
  const detailed = [];
  for (const line of lines) {
    const match = /^\s*FAIL\s+(?:\|[^|\r\n]+\|\s+)?(.+?\s+>\s+.+?)\s*$/.exec(line);
    if (!match) continue;
    const name = match[1].trim();
    if (!seen.has(name)) {
      seen.add(name);
      detailed.push(name);
    }
  }
  if (detailed.length > 0) return detailed;
  const files = [];
  for (const line of lines) {
    const match = /^\s*FAIL\s+(?:\|[^|\r\n]+\|\s+)?([^\s>]+(?:\.[cm]?[jt]sx?))\s*$/.exec(line);
    if (!match) continue;
    const file = match[1].trim();
    if (!seen.has(file)) {
      seen.add(file);
      files.push(file);
    }
  }
  return files;
}

export function computeTreeHash(cwd = ROOT, env = process.env) {
  const tempIndex = join(tmpdir(), `monsport-idx-${process.pid}-${randomUUID()}`);
  const gitEnv = { ...env, GIT_INDEX_FILE: tempIndex };
  try {
    const add = spawnSync('git', ['add', '-A'], { cwd, env: gitEnv, encoding: 'utf8', timeout: GIT_TIMEOUT_MS });
    if (add.status !== 0) return null;
    const tree = spawnSync('git', ['write-tree'], { cwd, env: gitEnv, encoding: 'utf8', timeout: GIT_TIMEOUT_MS });
    if (tree.status !== 0) return null;
    const hash = (tree.stdout ?? '').trim();
    return /^[0-9a-f]{40}$/.test(hash) ? hash : null;
  } catch {
    return null;
  } finally {
    rmSync(tempIndex, { force: true });
  }
}

export function buildCheckEntry({ ok, failedSteps = [], testOutput = '', tree = null, now = new Date() }) {
  return {
    at: now.toISOString(),
    tree,
    ok: Boolean(ok),
    failedSteps: [...failedSteps],
    failedTests: ok ? [] : parseVitestFailures(testOutput),
  };
}

export function recordCheckResult({
  root = ROOT,
  ok,
  failedSteps = [],
  testOutput = '',
  env = process.env,
  now = new Date(),
  tree,
} = {}) {
  if (env.CI) return { written: false, reason: 'ci' };
  try {
    const file = checkLogPath(env, root);
    const resolvedTree = tree === undefined ? computeTreeHash(root, env) : tree;
    const entry = buildCheckEntry({ ok, failedSteps, testOutput, tree: resolvedTree, now });
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify(entry)}\n`, 'utf8');
    return { written: true, path: file, entry };
  } catch {
    return { written: false, reason: 'error' };
  }
}
