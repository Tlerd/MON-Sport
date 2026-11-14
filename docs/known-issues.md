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

## Local Postgres starts slowly after a crash

- Seen: 2026-11-10. After the local cluster stopped without a clean shutdown (a killed session, WSL or machine stopped), `pnpm db:start` printed `Postgres did not start`, and `pnpm check` failed with `prisma migrate deploy failed`. Recovery took about 7 minutes.
- Cause: Postgres fsyncs every data file (about 8,900) before it accepts connections. Windows with Defender is slow at this. The old script waited 15 s, and each retry started another server, so the work restarted.
- Fix: `scripts/db-local.mjs` starts the cluster with `fsync=off`, `synchronous_commit=off`, and `full_page_writes=off`. This skips that sync. A hard kill of the postmaster now recovers in about 5 s (measured on 2026-11-10). The script waits up to 120 s and starts the server with `Start-Process`, so `pnpm db:start | tail` returns.
- The flags apply to the dev and test cluster only. After an OS crash its files may be corrupt. Delete `%LOCALAPPDATA%/monsport/pgdata`, run `pnpm db:start`, then migrate and seed again. Cloud SQL keeps its own safe settings.
- If the server still does not come up, read `%LOCALAPPDATA%/monsport/pg.log`. Do not run `pnpm db:start` again while the log shows recovery in progress.

## `pnpm check` prints `WARN secrets` or `FAIL secrets`

- `WARN secrets: gitleaks is not installed`: `pnpm install` does not install gitleaks, because it is a Go binary. Install it once with `winget install Gitleaks.Gitleaks`. The check finds the winget folder without a new shell. CI still scans every pull request.
- `FAIL secrets`: gitleaks found a secret in the staged or the unstaged changes. Remove it and read the value from an environment variable. The output hides the value.
- A secret that reached a pushed commit must be rotated. Do not rewrite history: a force push is not allowed.
- Public test data that gitleaks flags: add an entry with a reason to `.gitleaks.toml`. Copy the entry that is there: `description`, `targetRules`, and `regexes = ['''^the-exact-value$''']`. `harness/gitleaks-config.test.mjs` fails any other form. A `gitleaks:allow` comment has no effect.

## agy cannot run `node`: "Access is denied", then a hook stops the run

- Seen: 2026-11-14, agy 1.5.8 on `gemini-4-hydrogen-high`, `--mode accept-edits`. A command in the terminal sandbox failed with `'node' is not recognized` and `C:/Program Files/nodejs/node.exe: Access is denied`. agy tried again with `BypassSandbox: true`, and a pre-tool hook stopped the whole run. The run ended with exit 0 and no file changed.
- Cause: `enableTerminalSandbox` is `true` in `~/.gemini/antigravity-cli/settings.json`, and the sandbox cannot read the Node folder.
- Fix: do not change that setting and do not bypass the sandbox. It is the owner's security setting. Start the task with: "Your terminal sandbox has no Node.js. Do not run any terminal command. Only read and write files. The Planner runs `pnpm map` and `pnpm check` and sends you each failure." Then run the checks yourself and send the failures back in a new run.
- agy has no tool to delete a file. Read its final report: it lists each file the Planner must delete.
- A run can also end with `The stream was interrupted` and a partial diff. Start a new run that says "CONTINUATION", lists the failing tests, and tells agy to read the working tree first.
