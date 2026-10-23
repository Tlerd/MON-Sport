import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acquire, lockPath } from '../scripts/check-lock.mjs';

describe('check-lock: single checkout lock for pnpm check', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'monsport-check-lock-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('lockPath generates a deterministic lock path in tmpdir', () => {
    const path1 = lockPath('D:/repo/monsport');
    const path2 = lockPath('d:/REPO/monsport');
    expect(path1).toBe(path2);
    expect(path1).toMatch(/monsport-check-[0-9a-f]{12}\.lock$/);
  });

  it('acquire on a free path returns release, and release removes the dir', async () => {
    const lock = join(tempDir, 'free.lock');
    const release = await acquire(lock);
    expect(typeof release).toBe('function');
    expect(existsSync(lock)).toBe(true);
    const owner = JSON.parse(readFileSync(join(lock, 'owner.json'), 'utf8'));
    expect(owner.pid).toBe(process.pid);
    expect(typeof owner.startedAt).toBe('number');

    release();
    expect(existsSync(lock)).toBe(false);
  });

  it('a second acquire waits while the first holds it, and gets it after release', async () => {
    const lock = join(tempDir, 'wait.lock');
    const release1 = await acquire(lock);

    let acquired2 = false;
    const waitedPids = [];
    const promise2 = acquire(lock, {
      waitMs: 10,
      onWait: (pid) => waitedPids.push(pid),
    }).then((rel) => {
      acquired2 = true;
      return rel;
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(acquired2).toBe(false);
    expect(waitedPids).toEqual([process.pid]);

    release1();
    const release2 = await promise2;
    expect(acquired2).toBe(true);
    expect(existsSync(lock)).toBe(true);

    release2();
    expect(existsSync(lock)).toBe(false);
  });

  it('a lock whose owner pid is not alive is taken at once', async () => {
    const lock = join(tempDir, 'dead.lock');
    mkdirSync(lock);
    writeFileSync(
      join(lock, 'owner.json'),
      JSON.stringify({ pid: 999999, startedAt: Date.now() }),
    );

    const release = await acquire(lock, {
      isAlive: (pid) => pid !== 999999,
    });
    expect(existsSync(lock)).toBe(true);
    const owner = JSON.parse(readFileSync(join(lock, 'owner.json'), 'utf8'));
    expect(owner.pid).toBe(process.pid);

    release();
    expect(existsSync(lock)).toBe(false);
  });

  it('a lock older than staleMs is taken', async () => {
    const lock = join(tempDir, 'stale.lock');
    mkdirSync(lock);
    const past = Date.now() - 100_000;
    writeFileSync(
      join(lock, 'owner.json'),
      JSON.stringify({ pid: process.pid, startedAt: past }),
    );

    const release = await acquire(lock, {
      staleMs: 50_000,
    });
    expect(existsSync(lock)).toBe(true);
    const owner = JSON.parse(readFileSync(join(lock, 'owner.json'), 'utf8'));
    expect(owner.pid).toBe(process.pid);
    expect(owner.startedAt).toBeGreaterThan(past);

    release();
    expect(existsSync(lock)).toBe(false);
  });

  it('timeout throws with the owner pid in the message', async () => {
    const lock = join(tempDir, 'timeout.lock');
    mkdirSync(lock);
    const foreignPid = 43210;
    writeFileSync(
      join(lock, 'owner.json'),
      JSON.stringify({ pid: foreignPid, startedAt: Date.now() }),
    );

    await expect(
      acquire(lock, {
        isAlive: () => true,
        waitMs: 10,
        timeoutMs: 25,
      }),
    ).rejects.toThrow(/43210/);
  });

  it('release does nothing when another pid owns the lock', async () => {
    const lock = join(tempDir, 'foreign.lock');
    const release = await acquire(lock, { pid: 11111 });
    expect(existsSync(lock)).toBe(true);

    writeFileSync(
      join(lock, 'owner.json'),
      JSON.stringify({ pid: 22222, startedAt: Date.now() }),
    );

    release();
    expect(existsSync(lock)).toBe(true);
    expect(existsSync(join(lock, 'owner.json'))).toBe(true);
    const owner = JSON.parse(readFileSync(join(lock, 'owner.json'), 'utf8'));
    expect(owner.pid).toBe(22222);
  });
});
