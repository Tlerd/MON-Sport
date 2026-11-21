import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import {
  checkLiveHealth,
  classifyBand,
  collectLocalFlaky,
  countMainFails,
  dedupKey,
  evaluateAndAct,
  findMatchingIssue,
  formatIssueBody,
  loadBands,
  resolveGcloud,
  sanitizeText,
  summarizeFiveXxEntries,
} from '../scripts/maintain.mjs';

const bands = loadBands();
const NOW = new Date('2026-11-21T12:00:00.000Z');

describe('maintain phase 1', () => {
  test('classifies values against maintain-bands.json for all 4 metrics', () => {
    expect(classifyBand('main_fail', 0, bands)).toBe('ok');
    expect(classifyBand('main_fail', 1, bands)).toBe('log');
    expect(classifyBand('main_fail', 2, bands)).toBe('diagnose');
    expect(classifyBand('main_fail', 5, bands)).toBe('diagnose');

    expect(classifyBand('flaky_test', 0, bands)).toBe('ok');
    expect(classifyBand('flaky_test', 1, bands)).toBe('log');
    expect(classifyBand('flaky_test', 2, bands)).toBe('diagnose');
    expect(classifyBand('flaky_test', 3, bands)).toBe('propose');

    expect(classifyBand('live_5xx', 0, bands)).toBe('ok');
    expect(classifyBand('live_5xx', 1, bands)).toBe('log');
    expect(classifyBand('live_5xx', 4, bands)).toBe('log');
    expect(classifyBand('live_5xx', 5, bands)).toBe('diagnose');

    expect(classifyBand('live_health', 0, bands)).toBe('ok');
    expect(classifyBand('live_health', 1, bands)).toBe('diagnose');
  });

  test('deduplicates open issues by maintain-key marker', () => {
    const key = dedupKey('flaky_test', 'VenueScreen.test.tsx > AC-9');
    const openIssues = [
      { number: 401, title: 'other', body: '<!-- maintain-key: main_fail:ci -->' },
      { number: 402, title: 'flaky', body: `text\n\n<!-- maintain-key: ${key} -->` },
    ];
    expect(findMatchingIssue(openIssues, key)?.number).toBe(402);
    expect(findMatchingIssue(openIssues, 'live_5xx:monsport')).toBeNull();
  });

  test('issue body contains all 6 sections and strips phones, query strings, and tokens', () => {
    const body = formatIssueBody({
      key: 'live_5xx:monsport',
      metric: 'live_5xx',
      level: 'diagnose',
      value: 6,
      threshold: 5,
      window: '1h',
      evidenceLines: [
        '500 /api/bookings?phone=0901234567&token=secret123 (4 lần)',
        'User +84901234567 failed with Bearer ya29.super-secret-token',
      ],
      affected: ['`apps/api` (service `monsport`)'],
      proposal: 'Kiểm tra log Cloud Run và thêm test hồi quy cho đường dẫn gây 5xx.',
      openQuestions: ['Ngưỡng hiện tại có cần điều chỉnh không?'],
    });

    for (const heading of [
      '## Vấn đề',
      '## Bằng chứng',
      '## Kết quả đề xuất',
      '## Phần bị ảnh hưởng',
      '## Ràng buộc',
      '## Câu hỏi mở',
    ]) {
      expect(body).toContain(heading);
    }
    expect(body).toContain('<!-- maintain-key: live_5xx:monsport -->');
    expect(body).not.toContain('0901234567');
    expect(body).not.toContain('+84901234567');
    expect(body).not.toContain('?phone=');
    expect(body).not.toContain('secret123');
    expect(body).not.toContain('ya29.super-secret-token');
    expect(body).toContain('500 /api/bookings (4 lần)');
    expect(body).toContain('Ngưỡng hiện tại có cần điều chỉnh không?');
  });

  test('dry-run never calls gh label create, gh issue create, or gh issue comment', () => {
    const ensureLabels = vi.fn();
    const createIssue = vi.fn();
    const commentIssue = vi.fn();
    const appendLog = vi.fn();

    const results = evaluateAndAct({
      findings: [
        {
          metric: 'main_fail',
          target: 'ci',
          value: 3,
          evidenceLines: ['3 lần fail trên main trong 7 ngày'],
          affected: ['.github/workflows/ci.yml'],
          proposal: 'Tìm commit làm đỏ main và mở PR sửa.',
          openQuestions: ['Có phải lỗi hạ tầng CI không?'],
        },
      ],
      bands,
      openIssues: [],
      dryRun: true,
      now: NOW,
      actions: { ensureLabels, createIssue, commentIssue, appendLog },
    });

    expect(results).toHaveLength(1);
    expect(results[0].action).toBe('dry-run:create');
    expect(ensureLabels).not.toHaveBeenCalled();
    expect(createIssue).not.toHaveBeenCalled();
    expect(commentIssue).not.toHaveBeenCalled();
    expect(appendLog).not.toHaveBeenCalled();
  });

  test('comments on existing open issue instead of creating a duplicate', () => {
    const ensureLabels = vi.fn();
    const createIssue = vi.fn();
    const commentIssue = vi.fn();
    const appendLog = vi.fn();

    const key = dedupKey('main_fail', 'ci');
    const results = evaluateAndAct({
      findings: [
        {
          metric: 'main_fail',
          target: 'ci',
          value: 2,
          evidenceLines: ['2 lần fail trên main'],
          affected: ['.github/workflows/ci.yml'],
          proposal: 'Sửa nguyên nhân fail trên main.',
          openQuestions: [],
        },
      ],
      bands,
      openIssues: [{ number: 500, title: 'existing', body: `old\n<!-- maintain-key: ${key} -->` }],
      dryRun: false,
      now: NOW,
      actions: { ensureLabels, createIssue, commentIssue, appendLog },
    });

    expect(results[0].action).toBe('commented:#500');
    expect(ensureLabels).toHaveBeenCalledTimes(1);
    expect(createIssue).not.toHaveBeenCalled();
    expect(commentIssue).toHaveBeenCalledWith(500, expect.stringContaining(`<!-- maintain-key: ${key} -->`));
    expect(appendLog).toHaveBeenCalledTimes(1);
  });

  test('counts main_fail within 7 days and ignores cancelled or older runs', () => {
    const runs = [
      { databaseId: 1, conclusion: 'failure', createdAt: '2026-11-20T00:00:00Z' },
      { databaseId: 2, conclusion: 'cancelled', createdAt: '2026-11-20T01:00:00Z' },
      { databaseId: 3, conclusion: 'failure', createdAt: '2026-11-10T00:00:00Z' },
      { databaseId: 4, conclusion: 'failure', createdAt: '2026-11-21T01:00:00Z' },
      { databaseId: 5, conclusion: 'success', createdAt: '2026-11-21T02:00:00Z' },
    ];
    expect(countMainFails(runs, NOW)).toBe(2);
  });

  test('counts local flaky tests only when fail and pass share the same tree hash within 7 days', () => {
    const entries = [
      { at: '2026-11-20T10:00:00Z', tree: 'aaa', ok: false, failedTests: ['t1'] },
      { at: '2026-11-20T10:05:00Z', tree: 'aaa', ok: true, failedTests: [] },
      { at: '2026-11-20T11:00:00Z', tree: 'bbb', ok: false, failedTests: ['t2'] },
      { at: '2026-11-20T11:05:00Z', tree: 'ccc', ok: true, failedTests: [] },
      { at: '2026-11-01T10:00:00Z', tree: 'old', ok: false, failedTests: ['t1'] },
      { at: '2026-11-01T10:05:00Z', tree: 'old', ok: true, failedTests: [] },
    ];
    const counts = collectLocalFlaky(entries, NOW);
    expect([...counts.entries()]).toEqual([['t1', 1]]);
  });

  test('summarizes Cloud Logging 5xx entries without query strings or jsonPayload', () => {
    const entries = [
      {
        httpRequest: { status: 500, requestUrl: 'https://monsport.run.app/api/bookings?phone=0901234567' },
        jsonPayload: { customerName: 'An', phone: '0901234567' },
      },
      {
        httpRequest: { status: 500, requestUrl: 'https://monsport.run.app/api/bookings?date=2026-11-21' },
      },
      {
        httpRequest: { status: 503, requestUrl: 'https://monsport.run.app/api/health' },
      },
    ];
    const summary = summarizeFiveXxEntries(entries);
    expect(summary.total).toBe(3);
    expect(summary.byRoute).toEqual([
      { status: 500, path: '/api/bookings', count: 2 },
      { status: 503, path: '/api/health', count: 1 },
    ]);
    expect(JSON.stringify(summary)).not.toContain('0901234567');
  });

  test('live_health fails only when 2 consecutive checks fail', async () => {
    const sleep = vi.fn(async () => undefined);
    const failThenOk = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    expect(await checkLiveHealth('https://example.test', { fetchFn: failThenOk, sleepFn: sleep, delayMs: 30_000 })).toEqual({
      ok: true,
      statuses: [503, 200],
    });
    expect(sleep).toHaveBeenCalledWith(30_000);

    const failTwice = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    expect(await checkLiveHealth('https://example.test', { fetchFn: failTwice, sleepFn: sleep, delayMs: 30_000 })).toEqual({
      ok: false,
      statuses: [503, 503],
    });
  });

  test('on Windows, gcloud resolves to bundled python + gcloud.py and scripts/maintain.mjs never uses shell: true', () => {
    const resolved = resolveGcloud({
      platform: 'win32',
      env: { CLOUDSDK_ROOT_DIR: 'C:\\sdk' },
      exists: (p) => p === join('C:\\sdk', 'platform', 'bundledpython', 'python.exe') || p === join('C:\\sdk', 'lib', 'gcloud.py'),
    });
    expect(resolved).toEqual({
      command: join('C:\\sdk', 'platform', 'bundledpython', 'python.exe'),
      prefixArgs: [join('C:\\sdk', 'lib', 'gcloud.py')],
    });

    const source = readFileSync(new URL('../scripts/maintain.mjs', import.meta.url), 'utf8');
    const codeOnly = source
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n');
    expect(codeOnly).not.toMatch(/shell\s*:\s*true/);
    expect(codeOnly).not.toMatch(/cmd\.exe/i);
    expect(sanitizeText('call 0901234567 at `/api/x?a=1` with Bearer abc==')).toBe(
      'call [redacted-phone] at `/api/x` with [redacted-token]',
    );
  });

  test('deduplicates findings whose target contains a phone number or query string, and skips unchanged comments', () => {
    const created = [];
    const commented = [];
    const actions = {
      ensureLabels: vi.fn(),
      appendLog: vi.fn(),
      createIssue: (title, body) => created.push({ number: 600 + created.length, title, body, comments: [] }),
      commentIssue: (number, body) => commented.push({ number, body }),
    };
    const finding = {
      metric: 'flaky_test',
      target: 'google-auth.e2e.test.ts > AC-36: Số 0901112233 at /api/matches?level=EXPERT',
      value: 2,
      evidenceLines: ['fail 2 times'],
      affected: ['google-auth.e2e.test.ts'],
      proposal: 'Fix flake.',
      openQuestions: [],
    };

    const r1 = evaluateAndAct({ findings: [finding], bands, openIssues: [], dryRun: false, now: NOW, actions });
    expect(r1[0].action).toBe('created');
    expect(created).toHaveLength(1);
    expect(created[0].body).not.toContain('0901112233');
    expect(created[0].body).not.toContain('?level=EXPERT');

    // Second run with same finding matches the created issue and skips duplicate comment.
    const r2 = evaluateAndAct({ findings: [finding], bands, openIssues: created, dryRun: false, now: NOW, actions });
    expect(r2[0].action).toBe('unchanged:#600');
    expect(created).toHaveLength(1);
    expect(commented).toHaveLength(0);

    // Third run with a higher count comments on #600 instead of creating a duplicate.
    const r3 = evaluateAndAct({
      findings: [{ ...finding, value: 3, evidenceLines: ['fail 3 times'] }],
      bands,
      openIssues: created,
      dryRun: false,
      now: NOW,
      actions,
    });
    expect(r3[0].action).toBe('commented:#600');
    expect(created).toHaveLength(1);
    expect(commented).toHaveLength(1);
  });

  test('skips issue creation and comments when openIssues is null (gh issue list failed)', () => {
    const actions = {
      ensureLabels: vi.fn(),
      appendLog: vi.fn(),
      createIssue: vi.fn(),
      commentIssue: vi.fn(),
    };
    const res = evaluateAndAct({
      findings: [{ metric: 'main_fail', target: 'ci', value: 2, evidenceLines: ['2 fails'] }],
      bands,
      openIssues: null,
      dryRun: false,
      now: NOW,
      actions,
    });
    expect(res).toEqual([{ key: 'main_fail:ci', level: 'diagnose', action: 'skipped:issues-unavailable' }]);
    expect(actions.appendLog).toHaveBeenCalledTimes(1);
    expect(actions.createIssue).not.toHaveBeenCalled();
    expect(actions.commentIssue).not.toHaveBeenCalled();
  });
});
