// BR-58: one fixed window of 60 seconds for each user. 60 calls in all, and 10 of them may be writes.
// The count lives in the memory of the instance. A refused call still counts.
export const WINDOW_MS = 60_000;
export const MAX_CALLS = 60;
export const MAX_WRITES = 10;
const PRUNE_ABOVE = 10_000;

interface Window {
  startedAt: number;
  calls: number;
  writes: number;
}

export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  /** Counts one call and says whether it may run. */
  allow(userId: string, write: boolean, now: Date): boolean {
    const at = now.getTime();
    if (this.windows.size > PRUNE_ABOVE) this.prune(at);
    let w = this.windows.get(userId);
    if (!w || at - w.startedAt >= WINDOW_MS || at < w.startedAt) {
      w = { startedAt: at, calls: 0, writes: 0 };
      this.windows.set(userId, w);
    }
    w.calls += 1;
    if (write) w.writes += 1;
    return w.calls <= MAX_CALLS && w.writes <= MAX_WRITES;
  }

  private prune(at: number): void {
    for (const [userId, w] of this.windows) if (at - w.startedAt >= WINDOW_MS) this.windows.delete(userId);
  }
}
