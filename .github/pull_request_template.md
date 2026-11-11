## Issue

<!-- "Refs #<issue>" on each step. "Closes #<issue>" on the last step only. No line for a fix, chore, or docs change without an issue. -->
Refs #

## Brief and step

<!-- Write the brief and the step on one line, for example: docs/briefs/F-002-<slug>.md, step 1 of 3. The check pr-gates reads the Paths cell of that step from the base branch. List the brief file itself under "Allowed paths" when this pull request edits it. -->

## Allowed paths

<!-- One backticked path per line: a file, a prefix that ends in "/", or a prefix that ends in "*". For a brief step, copy its Paths cell. The check pr-gates fails a pull request that changes any other path. -->
-

## Changes

-

## Acceptance criteria

<!-- One line for each AC that this pull request covers, with its test name. The check pr-gates needs a test named "AC-n: ..." in a changed test file for each line. Delete the line when the pull request covers no AC. -->
- [ ] AC-1:

## How tested

<!-- Evidence: the test names, the command output, or a screenshot for a screen change. -->

## Chạy thử local

<!-- The user runs these before the merge. Agents never merge. Keep the commands, set <n>, and list the screens and flows to check. A stacked pull request starts here with "Merge sau #<n>". Do not start a line here with "AC-n:": pr-gates reads it as an AC claim. -->

```
gh pr checkout <n>
pnpm install
pnpm db:start
pnpm --filter @monsport/api exec prisma migrate deploy
pnpm --filter @monsport/api exec prisma generate
pnpm dev:api
pnpm dev:web
```

- First time on a machine: copy `apps/api/.env.example` to `apps/api/.env`.
- Optional: `pnpm --filter @monsport/api db:seed` loads the demo data. It empties the local tables first.
- Run `pnpm dev:api` and `pnpm dev:web` in two terminals. Open http://localhost:5173 and check:

-

## Risk

<!-- low, medium, or high, and why. For example: medium, because it changes the booking lock order. -->

## How to revert

<!-- Revert the merge commit with a new pull request. When the live service is broken, first shift Cloud Run traffic to the previous revision: gcloud run services update-traffic monsport --region asia-southeast1 --to-revisions <previous-revision>=100. Say when a migration needs more than that. -->

## Checks

- [ ] `pnpm check` passes.
- [ ] `PROGRESS.md` is rewritten, when the next step changed. `HUMAN_DECISIONS.md` is updated, when a decision needs the user or the user answered one.
- [ ] Money, concurrency, or schema change: a fresh session reviewed it. Link:
