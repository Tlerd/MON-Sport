#!/usr/bin/env node
// Maintain Phase 1: deterministic detector for CI and live signals (`docs/design/ke-hoach-maintain.md`).
// Usage: node scripts/maintain.mjs [--dry-run] [--once]
// Reads 4 signals (main_fail, flaky_test, live_5xx, live_health), compares them against
// scripts/maintain-bands.json, logs breaches to maintain.jsonl, and opens or updates `maintain` issues.
// Never calls an LLM, never edits repo files, and never passes arguments through cmd.exe on Windows.

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLogPath, parseVitestFailures } from './check-log.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, '..');
const DAY_MS = 24 * 60 * 60_000;
const HOUR_MS = 60 * 60_000;
const HEALTH_DELAY_MS = 30_000;
const CMD_TIMEOUT_MS = 30_000;
const REGION = process.env.MAINTAIN_REGION || 'asia-southeast1';
const SERVICE = process.env.MAINTAIN_SERVICE || 'monsport';

export const LABELS = [
  { name: 'maintain', color: 'D93F0B', description: 'Automated CI/live maintain finding' },
  { name: 'maintain-dismissed', color: 'CFD3D7', description: 'Maintain finding dismissed by owner' },
  { name: 'maintain-fix', color: '0E8A16', description: 'Maintain finding selected for autofix' },
];

export function maintainLogPath(env = process.env, fallbackRoot = ROOT) {
  if (env.MONSPORT_MAINTAIN_LOG) return env.MONSPORT_MAINTAIN_LOG;
  const base = env.LOCALAPPDATA ?? join(env.HOME ?? fallbackRoot, '.local');
  return join(base, 'monsport', 'maintain.jsonl');
}

export function loadBands(file = join(SCRIPT_DIR, 'maintain-bands.json')) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function classifyBand(metric, value, bands = loadBands()) {
  const band = bands[metric];
  if (!band || typeof value !== 'number' || value <= 0) return 'ok';
  if (band.propose !== null && value >= band.propose) return 'propose';
  if (band.diagnose !== null && value >= band.diagnose) return 'diagnose';
  if (band.log !== null && value >= band.log) return 'log';
  return 'ok';
}

export function sanitizeText(text = '') {
  return String(text)
    .replace(/((?:https?:\/\/[^\s?"'<>)]+|\/[^\s?"'<>)]+))\?[^\s"'<>)]+/g, '$1')
    .replace(/\b(?:Bearer\s+[A-Za-z0-9._~+/=-]+|ya29\.[A-Za-z0-9._-]+|gh[pousr]_[A-Za-z0-9_]+|mst_[A-Za-z0-9_-]+|mot_[A-Za-z0-9_-]+)\b/gi, '[redacted-token]')
    .replace(/(?<!\d)(?:\+84\d{9,10}|0\d{9,10})(?!\d)/g, '[redacted-phone]');
}

export function dedupKey(metric, target) {
  return `${metric}:${String(target).trim().replace(/\s+/g, ' ')}`;
}

export function findMatchingIssue(openIssues = [], key) {
  const marker = `<!-- maintain-key: ${key} -->`;
  return openIssues.find((issue) => String(issue.body ?? '').includes(marker)) ?? null;
}

export function formatIssueBody({
  key,
  metric,
  level,
  value,
  threshold,
  window,
  evidenceLines = [],
  affected = [],
  proposal = '',
  openQuestions = [],
}) {
  const evidence = evidenceLines.length ? evidenceLines.map((line) => `- ${line}`).join('\n') : '- Không có thêm chi tiết.';
  const affectedList = affected.length ? affected.map((item) => `- ${item}`).join('\n') : '- Cần kiểm tra thêm.';
  const questions = openQuestions.length
    ? openQuestions.map((q) => `- ${q}`).join('\n')
    : '- Chủ dự án chọn: sửa ngay, xếp lịch, hay đóng kèm nhãn `maintain-dismissed`?';

  const body = [
    '## Vấn đề',
    `Chỉ số \`${metric}\` đạt **${value}** trong cửa sổ \`${window}\` (mức \`${level}\`, ngưỡng ${threshold}).`,
    '',
    '## Bằng chứng',
    evidence,
    '',
    '## Kết quả đề xuất',
    proposal || 'Tìm nguyên nhân gốc, sửa trong nhánh `fix/<slug>` kèm test hồi quy có số issue trong tên.',
    '',
    '## Phần bị ảnh hưởng',
    affectedList,
    '',
    '## Ràng buộc',
    '- Không thêm `.skip`, `.only`, `.todo` hoặc làm yếu `pnpm check`.',
    '- Không sửa `.github/`, `scripts/`, `harness/` trong PR autofix.',
    '- Không đưa số điện thoại, tên, query string hoặc body của request vào issue hay log.',
    '- Sửa qua nhánh `fix/<slug>`, PR, Reviewer, và merge bằng `node scripts/merge.mjs <n>`.',
    '',
    '## Câu hỏi mở',
    questions,
    '',
    `<!-- maintain-key: ${key} -->`,
  ].join('\n');

  return sanitizeText(body);
}

export function formatCommentBody({ key, level, value, threshold, window, evidenceLines = [], now = new Date() }) {
  const evidence = evidenceLines.length ? evidenceLines.map((line) => `- ${line}`).join('\n') : '- Không có thêm chi tiết.';
  return sanitizeText(
    [
      `Cập nhật lúc \`${now.toISOString()}\`: giá trị **${value}** trong cửa sổ \`${window}\` (mức \`${level}\`, ngưỡng ${threshold}).`,
      '',
      evidence,
      '',
      `<!-- maintain-key: ${key} -->`,
    ].join('\n'),
  );
}

export function countMainFails(runs = [], now = new Date(), windowMs = 7 * DAY_MS) {
  const cutoff = now.getTime() - windowMs;
  return runs.filter((run) => run.conclusion === 'failure' && Date.parse(run.createdAt) >= cutoff).length;
}

export function collectLocalFlaky(entries = [], now = new Date(), windowMs = 7 * DAY_MS) {
  const cutoff = now.getTime() - windowMs;
  const byTree = new Map();
  for (const entry of entries) {
    if (!entry?.tree || !(Date.parse(entry.at) >= cutoff)) continue;
    let group = byTree.get(entry.tree);
    if (!group) {
      group = { hasPass: false, fails: [] };
      byTree.set(entry.tree, group);
    }
    if (entry.ok) group.hasPass = true;
    else group.fails.push(entry);
  }
  const counts = new Map();
  for (const group of byTree.values()) {
    if (!group.hasPass || group.fails.length === 0) continue;
    for (const fail of group.fails) {
      for (const testName of fail.failedTests ?? []) {
        counts.set(testName, (counts.get(testName) ?? 0) + 1);
      }
    }
  }
  return counts;
}

export function mergeFlakyCounts(ciCounts = new Map(), localCounts = new Map()) {
  const merged = new Map(ciCounts);
  for (const [name, count] of localCounts.entries()) {
    merged.set(name, (merged.get(name) ?? 0) + count);
  }
  return [...merged.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function stripPathQuery(rawUrl = '') {
  if (!rawUrl) return '/';
  try {
    return new URL(rawUrl, 'https://placeholder.local').pathname;
  } catch {
    return String(rawUrl).split('?')[0] || '/';
  }
}

export function summarizeFiveXxEntries(entries = []) {
  const grouped = new Map();
  let total = 0;
  for (const entry of entries) {
    const status = Number(entry?.httpRequest?.status);
    if (!Number.isInteger(status) || status < 500) continue;
    total += 1;
    const path = stripPathQuery(entry?.httpRequest?.requestUrl);
    const key = `${status} ${path}`;
    const prev = grouped.get(key);
    if (prev) prev.count += 1;
    else grouped.set(key, { status, path, count: 1 });
  }
  const byRoute = [...grouped.values()].sort((a, b) => b.count - a.count || a.status - b.status || a.path.localeCompare(b.path));
  return { total, byRoute };
}

export function resolveGcloud({
  platform = process.platform,
  env = process.env,
  whereFn = () => {
    const res = spawnSync('where', ['gcloud.cmd'], { encoding: 'utf8', timeout: CMD_TIMEOUT_MS });
    return res.status === 0 ? res.stdout.split(/\r?\n/)[0].trim() || null : null;
  },
  exists = existsSync,
} = {}) {
  if (platform !== 'win32') return { command: 'gcloud', prefixArgs: [] };
  const cmdPath = env.CLOUDSDK_ROOT_DIR ? join(env.CLOUDSDK_ROOT_DIR, 'bin', 'gcloud.cmd') : whereFn();
  if (!cmdPath) return null;
  const sdkRoot = env.CLOUDSDK_ROOT_DIR || dirname(dirname(cmdPath));
  const gcloudPy = join(sdkRoot, 'lib', 'gcloud.py');
  const pythonCandidates = [env.CLOUDSDK_PYTHON, join(sdkRoot, 'platform', 'bundledpython', 'python.exe')].filter(Boolean);
  const pythonExe = pythonCandidates.find((p) => exists(p));
  if (!pythonExe || !exists(gcloudPy)) return null;
  return { command: pythonExe, prefixArgs: [gcloudPy] };
}

export async function checkLiveHealth(
  serviceUrl,
  {
    fetchFn = fetch,
    sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    delayMs = HEALTH_DELAY_MS,
  } = {},
) {
  const probe = async () => {
    try {
      const res = await fetchFn(`${serviceUrl.replace(/\/+$/, '')}/api/health`, {
        signal: AbortSignal.timeout(10_000),
      });
      return { ok: res.ok && res.status === 200, status: res.status };
    } catch {
      return { ok: false, status: 0 };
    }
  };
  const first = await probe();
  if (first.ok) return { ok: true, statuses: [first.status] };
  await sleepFn(delayMs);
  const second = await probe();
  return { ok: second.ok, statuses: [first.status, second.status] };
}

export function evaluateAndAct({ findings = [], bands = loadBands(), openIssues = [], dryRun = false, now = new Date(), actions }) {
  let labelsEnsured = false;
  const results = [];
  for (const finding of findings) {
    const level = classifyBand(finding.metric, finding.value, bands);
    if (level === 'ok') continue;
    const band = bands[finding.metric];
    const threshold = band[level];
    const key = dedupKey(finding.metric, finding.target);
    const logEntry = {
      at: now.toISOString(),
      metric: finding.metric,
      key: sanitizeText(key),
      level,
      value: finding.value,
      threshold,
      window: band.window,
    };
    if (!dryRun) actions.appendLog(logEntry);

    if (level === 'log') {
      results.push({ key, level, action: dryRun ? 'dry-run:log' : 'logged' });
      continue;
    }

    const existing = findMatchingIssue(openIssues, key);
    if (dryRun) {
      results.push({ key, level, action: existing ? `dry-run:comment:#${existing.number}` : 'dry-run:create' });
      continue;
    }
    if (!labelsEnsured) {
      actions.ensureLabels();
      labelsEnsured = true;
    }
    if (existing) {
      const comment = formatCommentBody({
        key,
        level,
        value: finding.value,
        threshold,
        window: band.window,
        evidenceLines: finding.evidenceLines,
        now,
      });
      actions.commentIssue(existing.number, comment);
      results.push({ key, level, action: `commented:#${existing.number}` });
    } else {
      const title = sanitizeText(`[maintain] ${finding.metric}: ${finding.target}`);
      const body = formatIssueBody({
        key,
        metric: finding.metric,
        level,
        value: finding.value,
        threshold,
        window: band.window,
        evidenceLines: finding.evidenceLines,
        affected: finding.affected,
        proposal: finding.proposal,
        openQuestions: finding.openQuestions,
      });
      actions.createIssue(title, body);
      results.push({ key, level, action: 'created' });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------

function execNoShell(command, args) {
  const res = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', timeout: CMD_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 });
  return { ok: res.status === 0, out: (res.stdout ?? '').trim(), err: (res.stderr || res.error?.message || '').trim() };
}

function readLocalCheckEntries(env = process.env) {
  const file = checkLogPath(env, ROOT);
  if (!existsSync(file)) return [];
  const entries = [];
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      continue;
    }
  }
  return entries;
}

async function collectSignals(now) {
  const findings = [];
  const warnings = [];

  // 1. main_fail
  const mainRunsRes = execNoShell('gh', [
    'run', 'list', '--workflow', 'ci', '--branch', 'main', '--event', 'push', '--limit', '100',
    '--json', 'databaseId,conclusion,createdAt',
  ]);
  if (mainRunsRes.ok) {
    const runs = JSON.parse(mainRunsRes.out || '[]');
    const fails = countMainFails(runs, now);
    if (fails > 0) {
      findings.push({
        metric: 'main_fail',
        target: 'ci',
        value: fails,
        evidenceLines: [`${fails} lần chạy workflow ci bị fail trên nhánh main trong 7 ngày qua.`],
        affected: ['.github/workflows/ci.yml', 'nhánh `main`'],
        proposal: 'Xác định commit làm đỏ `main` và mở PR `fix/<slug>` sửa lỗi kèm test hồi quy.',
        openQuestions: ['Có lần fail nào do sự cố tạm thời của GitHub Actions không?'],
      });
    }
  } else {
    warnings.push(`gh run list (main_fail) failed: ${mainRunsRes.err}`);
  }

  // 2. flaky_test (CI reruns + local check.jsonl)
  const ciCounts = new Map();
  const rerunRes = execNoShell('gh', [
    'run', 'list', '--workflow', 'ci', '--limit', '100', '--json', 'databaseId,attempt,conclusion,createdAt',
  ]);
  if (rerunRes.ok) {
    const cutoff = now.getTime() - 7 * DAY_MS;
    const reruns = JSON.parse(rerunRes.out || '[]').filter(
      (r) => Number(r.attempt) > 1 && r.conclusion === 'success' && Date.parse(r.createdAt) >= cutoff,
    );
    for (const run of reruns) {
      const logRes = execNoShell('gh', ['run', 'view', String(run.databaseId), '--attempt', '1', '--log-failed']);
      if (!logRes.ok) continue;
      for (const testName of parseVitestFailures(logRes.out)) {
        ciCounts.set(testName, (ciCounts.get(testName) ?? 0) + 1);
      }
    }
  } else {
    warnings.push(`gh run list (flaky_test) failed: ${rerunRes.err}`);
  }
  const localCounts = collectLocalFlaky(readLocalCheckEntries(), now);
  for (const [testName, count] of mergeFlakyCounts(ciCounts, localCounts)) {
    findings.push({
      metric: 'flaky_test',
      target: testName,
      value: count,
      evidenceLines: [
        `Test \`${testName}\` fail rồi pass trên cùng nội dung code ${count} lần trong 7 ngày (CI: ${ciCounts.get(testName) ?? 0}, local: ${localCounts.get(testName) ?? 0}).`,
      ],
      affected: [testName.split(' > ')[0]],
      proposal: 'Tìm race condition hoặc timeout trong test/code nguồn và sửa dứt điểm; không dùng `.skip`.',
      openQuestions: ['Test này có bị ảnh hưởng bởi tải song song trên máy dev hay CI không?'],
    });
  }

  // 3 & 4. live_5xx & live_health via gcloud (no cmd.exe)
  const gcloud = resolveGcloud();
  if (!gcloud) {
    warnings.push('gcloud not found; skipped live_5xx and live_health');
    return { findings, warnings };
  }
  const runGcloud = (args) => execNoShell(gcloud.command, [...gcloud.prefixArgs, ...args]);

  const tokenRes = runGcloud(['auth', 'print-access-token']);
  const projectRes = runGcloud(['config', 'get-value', 'project']);
  if (tokenRes.ok && tokenRes.out && projectRes.ok && projectRes.out) {
    const since = new Date(now.getTime() - HOUR_MS).toISOString();
    const filter = `resource.type="cloud_run_revision" AND resource.labels.service_name="${SERVICE}" AND httpRequest.status>=500 AND timestamp>="${since}"`;
    try {
      const resp = await fetch('https://logging.googleapis.com/v2/entries:list', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenRes.out}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resourceNames: [`projects/${projectRes.out}`], filter, pageSize: 100 }),
        signal: AbortSignal.timeout(15_000),
      });
      if (resp.ok) {
        const data = await resp.json();
        const summary = summarizeFiveXxEntries(data.entries ?? []);
        if (summary.total > 0) {
          findings.push({
            metric: 'live_5xx',
            target: SERVICE,
            value: summary.total,
            evidenceLines: summary.byRoute.slice(0, 10).map((r) => `${r.status} ${r.path} (${r.count} lần)`),
            affected: [`service \`${SERVICE}\``, 'apps/api'],
            proposal: 'Kiểm tra nguyên nhân 5xx trên các đường dẫn bị ảnh hưởng và thêm test hồi quy.',
            openQuestions: ['Lỗi 5xx có liên quan đến lần deploy gần nhất không?'],
          });
        }
      } else {
        warnings.push(`Cloud Logging entries:list answered HTTP ${resp.status}`);
      }
    } catch {
      warnings.push('Cloud Logging entries:list request failed');
    }
  } else {
    warnings.push('gcloud auth/project unavailable; skipped live_5xx');
  }

  const urlRes = runGcloud([
    'run', 'services', 'describe', SERVICE, '--region', REGION, '--format=value(status.url)',
  ]);
  if (urlRes.ok && urlRes.out) {
    const health = await checkLiveHealth(urlRes.out);
    if (!health.ok) {
      findings.push({
        metric: 'live_health',
        target: 'api-health',
        value: 1,
        evidenceLines: [`GET /api/health trả mã ${health.statuses.join(', ')} trong 2 lần kiểm cách nhau 30 giây.`],
        affected: [`service \`${SERVICE}\``, 'apps/api/src/modules/health'],
        proposal: 'Kiểm tra trạng thái Cloud Run và Cloud SQL, khắc phục nguyên nhân `/api/health` lỗi.',
        openQuestions: ['Cloud SQL có đang bảo trì hay cạn kết nối không?'],
      });
    }
  } else {
    warnings.push('gcloud run services describe failed; skipped live_health');
  }

  return { findings, warnings };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const now = new Date();
  const bands = loadBands();
  const { findings, warnings } = await collectSignals(now);
  for (const w of warnings) console.error(`maintain warn: ${sanitizeText(w)}`);

  const issuesRes = execNoShell('gh', [
    'issue', 'list', '--state', 'open', '--label', 'maintain', '--limit', '100', '--json', 'number,title,body',
  ]);
  const openIssues = issuesRes.ok ? JSON.parse(issuesRes.out || '[]') : [];
  const logFile = maintainLogPath();

  const actions = {
    appendLog: (entry) => {
      mkdirSync(dirname(logFile), { recursive: true });
      appendFileSync(logFile, `${JSON.stringify(entry)}\n`, 'utf8');
    },
    ensureLabels: () => {
      for (const label of LABELS) {
        execNoShell('gh', ['label', 'create', label.name, '--color', label.color, '--description', label.description, '--force']);
      }
    },
    createIssue: (title, body) => {
      const res = execNoShell('gh', ['issue', 'create', '--title', title, '--label', 'maintain', '--body', body]);
      if (!res.ok) throw new Error(`gh issue create failed: ${res.err}`);
    },
    commentIssue: (number, body) => {
      const res = execNoShell('gh', ['issue', 'comment', String(number), '--body', body]);
      if (!res.ok) throw new Error(`gh issue comment #${number} failed: ${res.err}`);
    },
  };

  const results = evaluateAndAct({ findings, bands, openIssues, dryRun, now, actions });
  if (results.length === 0) {
    console.log(`maintain ok${dryRun ? ' (dry-run)' : ''}: no threshold breached`);
    return;
  }
  for (const item of results) {
    console.log(`maintain ${item.action} [${item.level}] ${sanitizeText(item.key)}`);
  }
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` || import.meta.main) {
  await main();
}
