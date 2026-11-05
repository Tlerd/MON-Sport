#!/usr/bin/env node
// Decides which CI and deploy jobs must run for a list of changed files.
// A job runs when any file is outside its skip set, or when the file list is empty or unknown.

import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const CHECK_MD = new Set(['AGENTS.md', 'PROGRESS.md', '@map.md']);

function skipCheck(file) {
  if (CHECK_MD.has(file)) return false;
  if (/^(docs|\.claude|\.gemini|\.agents)\//.test(file)) return true;
  if (file.endsWith('.md')) return true;
  return false;
}

function skipImage(file) {
  if (file.endsWith('.md')) return true;
  if (/^(docs|\.claude|\.gemini|harness)\//.test(file)) return true;
  if (file.startsWith('.agents/')) return !file.startsWith('.agents/skills/verify-flow/scripts/');
  return false;
}

export function classify(files = []) {
  const list = files.map((f) => f.trim().replaceAll('\\', '/')).filter(Boolean);
  if (list.length === 0) return { check: true, image: true, deploy: true };
  const check = list.some((f) => !skipCheck(f));
  const image = list.some((f) => !skipImage(f));
  return { check, image, deploy: image };
}

function arg(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : undefined;
}

function changedFiles(args) {
  const range = arg(args, '--range');
  const base = arg(args, '--base');
  const head = arg(args, '--head') || 'HEAD';
  const spec = range || (base ? `${base}...${head}` : '');
  if (!spec) return [];
  const res = spawnSync('git', ['diff', '--name-only', spec], { encoding: 'utf8' });
  if (res.status !== 0 || res.error) {
    console.error(`ci-changes: git diff ${spec} failed, running all jobs: ${(res.stderr || res.error?.message || '').trim()}`);
    return [];
  }
  return res.stdout.split(/\r?\n/).filter(Boolean);
}

if (import.meta.main) {
  const result = classify(changedFiles(process.argv.slice(2)));
  const lines = `check=${result.check}\nimage=${result.image}\ndeploy=${result.deploy}\n`;
  process.stdout.write(lines);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines);
}
