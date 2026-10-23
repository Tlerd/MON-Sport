#!/usr/bin/env node
// Gate: a pull request changes only the paths that its brief step or its description allows.
// The description lists them under "## Allowed paths". It may also name a brief and a step
// ("docs/briefs/F-014-x.md, step 2 of 3") under "## Brief and step", and then the Paths cell of that step,
// read from the base branch, counts too.
//
// CI: PR_BODY=<description> node scripts/scope.mjs --base origin/main

import { spawnSync } from 'node:child_process';

// A token is a path when it has a folder, or has no star. A bare "*.test.ts" would allow any folder, so it is dropped.
// A star in the first folder ("*/*", "**/x.ts") would allow .github/ and scripts/, so it is dropped too.
const starFirst = (token) => token.split('/')[0].includes('*');
const ticks = (text) =>
  [...text.matchAll(/`([^`\s]+)`/g)]
    .map((m) => m[1])
    .filter((t) => /[./]/.test(t) && (t.includes('/') || !t.includes('*')) && !starFirst(t));

/** The backticked paths in the Paths cell of one row of the step table, the table whose header holds "Paths". */
export function briefStepPaths(briefText, step) {
  const lines = briefText.split(/\r?\n/);
  const header = lines.findIndex((line) => line.startsWith('|') && line.split('|').some((cell) => cell.trim() === 'Paths'));
  if (header < 0) return [];
  const column = lines[header].split('|').findIndex((cell) => cell.trim() === 'Paths');
  for (const line of lines.slice(header + 2)) {
    if (!line.startsWith('|')) break;
    const cells = line.split('|');
    if (cells[1]?.trim() === String(step)) return ticks(cells[column] ?? '');
  }
  return [];
}

function section(body, heading) {
  const lines = body.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (start < 0) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

/**
 * Paths from "## Allowed paths", plus the Paths cell of the step that "## Brief and step" names.
 * Only those two sections count: the template comments and the other sections can hold example paths.
 * The caller reads the brief from the base branch, so a pull request cannot widen its own step.
 * The brief file itself is allowed only when "Allowed paths" lists it.
 */
export function allowedPaths(body = '', readBrief = () => '') {
  const paths = ticks(section(body, 'Allowed paths'));
  const named = section(body, 'Brief and step');
  const brief = /docs\/briefs\/[\w.-]+\.md/.exec(named)?.[0];
  const step = /step\s+(\d+)\s+of\s+\d+/i.exec(named)?.[1];
  if (brief && step) paths.push(...briefStepPaths(readBrief(brief), step));
  return paths;
}

const globToRegExp = (token) => new RegExp(`^${token.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
const allows = (token, file) => (token.includes('*') ? token.includes('/') && !starFirst(token) && globToRegExp(token).test(file) : token.endsWith('/') ? file.startsWith(token) : file === token);

export const outOfScope = (files, allowed) => files.filter((file) => !allowed.some((token) => allows(token, file)));

if (import.meta.main) {
  const base = process.argv[process.argv.indexOf('--base') + 1] || 'origin/main';
  // --no-renames lists the old path of a moved file too, so a move out of a protected folder is seen.
  const diff = spawnSync('git', ['diff', '--name-only', '--no-renames', `${base}...HEAD`], { encoding: 'utf8' });
  if (diff.status !== 0) {
    console.error(`FAIL scope: git diff ${base}...HEAD failed\n${diff.stderr}`);
    process.exit(1);
  }
  const files = diff.stdout.split('\n').filter(Boolean);
  const readBase = (file) => {
    const shown = spawnSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' });
    return shown.status === 0 ? shown.stdout : '';
  };
  const allowed = allowedPaths(process.env.PR_BODY ?? '', readBase);
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
