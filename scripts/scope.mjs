#!/usr/bin/env node
// Gate: a pull request changes only the paths that its brief step or its description allows.
// The description lists them under "## Allowed paths". It may also name a brief and a step
// ("docs/briefs/F-014-x.md, step 2 of 3"), and then the Paths cell of that step counts too.
//
// CI: PR_BODY=<description> node scripts/scope.mjs --base origin/main

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const ticks = (text) => [...text.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]).filter((t) => /[./]/.test(t));

/** The backticked paths in the Paths cell of one row of a brief's step table. */
export function briefStepPaths(briefText, step) {
  const rows = briefText.split(/\r?\n/).filter((line) => line.startsWith('|'));
  const column = rows.find((row) => /\|\s*Paths\s*\|/.test(row))?.split('|').findIndex((cell) => cell.trim() === 'Paths');
  const row = rows.find((line) => line.split('|')[1]?.trim() === String(step));
  return column > 0 && row ? ticks(row.split('|')[column] ?? '') : [];
}

function section(body, heading) {
  const lines = body.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (start < 0) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

/** Paths from "## Allowed paths", plus the brief file and the step row that the description names. */
export function allowedPaths(body = '', readBrief = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '')) {
  const paths = ticks(section(body, 'Allowed paths'));
  const brief = /docs\/briefs\/[\w.-]+\.md/.exec(body)?.[0];
  const step = /step\s+(\d+)\s+of\s+\d+/i.exec(body)?.[1];
  if (brief) {
    paths.push(brief);
    if (step) paths.push(...briefStepPaths(readBrief(brief), step));
  }
  return paths;
}

const allows = (token, file) =>
  token.endsWith('*') ? file.startsWith(token.slice(0, -1)) : token.endsWith('/') ? file.startsWith(token) : file === token;

export const outOfScope = (files, allowed) => files.filter((file) => !allowed.some((token) => allows(token, file)));

if (import.meta.main) {
  const base = process.argv[process.argv.indexOf('--base') + 1] || 'origin/main';
  const diff = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' });
  if (diff.status !== 0) {
    console.error(`FAIL scope: git diff ${base}...HEAD failed\n${diff.stderr}`);
    process.exit(1);
  }
  const files = diff.stdout.split('\n').filter(Boolean);
  const allowed = allowedPaths(process.env.PR_BODY ?? '');
  const outside = outOfScope(files, allowed);
  if (files.length && !allowed.length) {
    console.error('FAIL scope: the pull request description lists no allowed path\nFix: list the paths under "## Allowed paths", one backticked path or prefix per line.');
    process.exit(1);
  }
  if (outside.length) {
    console.error(
      `FAIL scope: ${outside.length} changed path(s) are not allowed:\n${outside.map((f) => `- ${f}`).join('\n')}\n` +
        'Fix: remove the change, or add the path to "## Allowed paths" when the brief allows it.',
    );
    process.exit(1);
  }
  console.log(`scope ok: ${files.length} file(s) inside ${allowed.length} allowed path(s)`);
}
