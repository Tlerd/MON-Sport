# Known issues

Errors that happened before. When a new error looks the same, apply the fix first. Add a new entry when a new error costs more than 10 minutes.

## `pnpm check` runs for an hour with no output

- Seen: 2026-11-02, Windows, Claude Code background command `pnpm check 2>&1 | tail -30`. The run did not finish in 59 minutes. The same command passed in 100 s later, on `main`.
- Not proven: the cause. Tests (93 files), types, and boundaries each pass alone in under 100 s.
- Likely cause: lock contention. One checkout has one lock. The git hook, the Stop hook, and a manual `pnpm check` queue behind each other. A Stop hook then prints `Timeout waiting for check lock held by pid <n>`. Run one check at a time. Do not start a second one while a commit or push runs in the background.
- Other suspects: a stale lock in `%TEMP%/monsport-check-*.lock`, a cold local Postgres start, or a child process that keeps the output pipe open.
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

## `pnpm check` prints `WARN secrets` or `FAIL secrets`

- `WARN secrets: gitleaks is not installed`: `pnpm install` does not install gitleaks, because it is a Go binary. Install it once with `winget install Gitleaks.Gitleaks`. The check finds the winget folder without a new shell. CI still scans every pull request.
- `FAIL secrets`: gitleaks found a secret in the staged or the unstaged changes. Remove it and read the value from an environment variable. The output hides the value.
- A secret that reached a pushed commit must be rotated. Do not rewrite history: a force push is not allowed.
- Public test data that gitleaks flags: add an entry with a reason to `.gitleaks.toml`. Copy the entry that is there: `description`, `targetRules`, and `regexes = ['''^the-exact-value$''']`. `harness/gitleaks-config.test.mjs` fails any other form. A `gitleaks:allow` comment has no effect.
