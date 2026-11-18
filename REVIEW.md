# Review rules

The Reviewer in `AGENTS.md` reads this file first. Review against `docs/requirements/intake-monsport-v1.md`, the brief, and `docs/requirements/business-rules.md`.

Run the Reviewer in plan mode. The Stop hook skips a plan-mode session, so the review never runs `pnpm check` on the shared test database.

## What failure looks like

Rate a finding high or medium when the change can cause one of these:

- Two bookings of one court overlap in time, or concurrent writes deadlock (Postgres `40P01`). Check the transaction and the lock order: an owner path locks the `Venue` row `FOR SHARE`, then the `Court` row `FOR UPDATE`, then inserts the booking (`insertUnderLock` in `apps/api/src/modules/bookings/booking-sync.ts`). The `EXCLUDE` constraint is the last guard: `23P01` must become 409.
- A business rule from BR-1 to BR-58 breaks.
- Personal data leaks. A phone number, a name, or a consent field (BR-20, BR-29, Luật 91/2025) appears in an API response, a log, or an error to a user who must not see it.
- A date or a time uses the time zone of the machine. The database stores UTC. Opening hours and slots use `Asia/Ho_Chi_Minh` through `packages/shared/src/booking-time.ts` (BR-27).
- Auth fails: a missing role check, a session that stays valid after an admin unlock (BR-32), or a broken login limit (BR-30) or password rule (BR-31).
- The pull request changes a path that its brief or its description does not list.
- A change to `.gitleaks.toml` hides a real secret. `harness/gitleaks-config.test.mjs` checks the form: one exact value, a reason, named rules. You check the value: find where it occurs, and confirm that it is public test data (a published sample or a fake), not a credential that works anywhere. Rate an allowed real secret high.

Other problems are low: names, style, small duplication, comments.

## Rules for each finding

- Give `file:line` evidence and a way to show that it fails: a request, a test, or a sequence of steps. Do not guess from a name.
- Write each finding as: severity | `file:line` | problem | fix.
- Name the class of bug, for example "unlocked read before write". The author then fixes every instance.
- Report 3 low findings at most. Pick the 3 that matter most.
- Tag a finding as "pre-existing" when the code is older than the pull request. A pre-existing finding does not block the merge. Record each one of medium or higher in `PROGRESS.md` as a next step.

## Skip

Do not review these paths:

- `apps/api/src/generated/`
- `dist/`
- `pnpm-lock.yaml`

## Re-review (round 2 and later)

- Review only the diff since the last reviewed head: `git diff <old-head>..<new-head>`. For a merge commit, review `git show --remerge-diff <merge sha>`.
- Never repeat a finding that a comment on the pull request already holds.
- For each open finding of medium or higher, say "closed" or "open", with the evidence.

## Summary

- Start with a count by severity, for example `0 high, 1 medium, 2 low`.
- When no finding is medium or higher, write "No blocking findings" on its own line.
- List what you could not confirm, and where you looked.
- End with the marker line, and nothing after it: `<!-- review head=<sha> high=<n> medium=<n> -->`. `<sha>` is the head you reviewed (`gh pr view <n> --json headRefOid`). The counts are the findings of that rating that are not pre-existing. `scripts/merge.mjs` merges only when the latest marker for the current head shows 0 and 0.
