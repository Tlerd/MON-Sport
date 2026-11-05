// Proves the path filter of scripts/ci-changes.mjs without git or GitHub Actions.

import { expect, test } from 'vitest';
import { classify } from '../scripts/ci-changes.mjs';

const allTrue = { check: true, image: true, deploy: true };
const allFalse = { check: false, image: false, deploy: false };
const checkOnly = { check: true, image: false, deploy: false };
const imageOnly = { check: false, image: true, deploy: true };

test('an empty file list runs every job as the safe default', () => {
  expect(classify([])).toEqual(allTrue);
  expect(classify()).toEqual(allTrue);
});

test('docs, agent configs, and markdown outside AGENTS.md, PROGRESS.md, and @map.md skip all jobs', () => {
  expect(classify(['docs/briefs/F-1.md'])).toEqual(allFalse);
  expect(classify(['HUMAN_DECISIONS.md'])).toEqual(allFalse);
  expect(classify(['REVIEW.md', 'DESIGN.md'])).toEqual(allFalse);
  expect(classify(['.agents/skills/verify-flow/SKILL.md'])).toEqual(allFalse);
  expect(classify(['.claude/settings.json'])).toEqual(allFalse);
  expect(classify(['.gemini/settings.json'])).toEqual(allFalse);
});

test('AGENTS.md, PROGRESS.md, @map.md, and harness tests run check only', () => {
  expect(classify(['PROGRESS.md'])).toEqual(checkOnly);
  expect(classify(['@map.md'])).toEqual(checkOnly);
  expect(classify(['AGENTS.md'])).toEqual(checkOnly);
  expect(classify(['harness/x.test.mjs'])).toEqual(checkOnly);
});

test('verify-flow scripts run image and deploy without check', () => {
  expect(classify(['.agents/skills/verify-flow/scripts/lib.mjs'])).toEqual(imageOnly);
});

test('app code, scripts, and workflow files run every job, even alongside docs', () => {
  expect(classify(['scripts/merge.mjs'])).toEqual(allTrue);
  expect(classify(['apps/mobile/src/a.tsx'])).toEqual(allTrue);
  expect(classify(['.github/workflows/ci.yml'])).toEqual(allTrue);
  expect(classify(['docs/briefs/F-1.md', 'HUMAN_DECISIONS.md', 'apps/mobile/src/a.tsx'])).toEqual(allTrue);
});
