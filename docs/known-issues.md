# Known issues

Errors that happened before. When a new error looks the same, apply the fix first. Add a new entry when a new error costs more than 10 minutes.

## `pnpm check` runs for an hour with no output

- Seen: 2026-11-02, Windows, Claude Code background command `pnpm check 2>&1 | tail -30`. The run did not finish in 59 minutes. The same command passed in 100 s later, on `main`.
- Not proven: the cause. Tests (93 files), types, and boundaries each pass alone in under 100 s.
- Suspects: a stale lock in `%TEMP%/monsport-check-*.lock`, a cold local Postgres start, or a child process that keeps the output pipe open.
- Fix: `scripts/check.mjs` now stops a step after 8 minutes and prints `TIMEOUT`. On a timeout, do these in order:
  1. Delete `%TEMP%/monsport-check-*.lock` when no `pnpm check` runs.
  2. Run `pnpm db:start`, then run `pnpm check` again.
  3. Run the steps alone to find the stuck one: `pnpm exec vitest run`, `pnpm -r --if-present run typecheck`, `pnpm exec depcruise apps packages --output-type err-long`.
- Do not wait for a silent run. Stop it after 5 minutes, then do the steps above.

## A Bash call is denied in a Claude Code session

- Seen: 2026-11-02. A long `&&` chain with `mkdir`, `node -e`, and a write to `~/.claude/usage-guard/state.json` was denied, and so were some later chains.
- Fix: split the chain into single commands. Write a file with the Write tool, not with `node -e`.

## `git commit` or `git push` takes more than 60 s

- Seen: 2026-11-02. The git hook runs checks, so the call moved to the background and still finished with exit code 0.
- Fix: run `git commit` and `git push` with `run_in_background`. Read the result when the notification arrives.
