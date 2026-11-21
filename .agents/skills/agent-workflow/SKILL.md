---
name: agent-workflow
description: Roles, branch names, review rounds, the merge, and the deploy check of the MONSPORT agent workflow. Use before you plan a brief step, pick a coder, open or review a pull request, handle a finding still open after 2 rounds, merge a pull request, or check a deploy.
---

Read this before you plan a step, open a pull request, review, or merge a pull request.

## Roles

Each tool maps these roles to its own models. In Claude Code, the session model (Opus) is the Planner and gives the last review before the merge; it reads each coder diff and runs `pnpm check`. agy on `gemini-4-neon-high` is the Reviewer.

| Role | Does | Never |
|---|---|---|
| Planner | Reads the brief and the code. Writes a plan that lists each file to change. Uses the strongest model for money, concurrency, schema, or personal data | Edits a file |
| Reader | Finds and reads files. Use the cheap read-only `Explore` agent for a search over several files | Edits a file, or changes state |
| Coder | Writes the tests first, then the code the plan lists. Runs `pnpm check` | Edits a path the brief does not list |
| Reviewer | A fresh agy session on `gemini-4-neon-high` (`node scripts/agy-run.mjs --strong-only --mode plan`). Reads `REVIEW.md` first. Rates each finding high, medium, or low | Edits, commits, or pushes |
| Last review | The session model. Reads the Reviewer output and the diff, decides each finding, posts the review with its marker, then merges | Writes the code |

Coder order: run `node scripts/agy-run.mjs --check-usage`, then `node scripts/agy-run.mjs --mode accept-edits -p "<plan>"` (the default agy list starts with `gemini-4-hydrogen-high`, then `gemini-4-argon-high`). Exit code 4 means every agy model is out of quota. Then use the subagent `backend` or `frontend` (Sonnet). When Sonnet is out of quota, run it with `model: haiku`.

The agy terminal sandbox can have no Node (`docs/known-issues.md`, "agy cannot run `node`"). Then agy is a file-only coder: tell it in the task to run no command, and run `pnpm map`, `pnpm check`, and `verify-flow` yourself after each run. Send each failure back in a new run. Never turn the sandbox off and never tell agy to bypass it.

## Swarm step (agy Hydrogen)

Use it when a change to a shared part (`packages/shared`, `packages/client`, a shared component or hook) needs edits at many call sites. A swarm runs only on agy with `gemini-4-hydrogen-high`, never on another model.

1. One coder changes the shared part and its tests first, by the coder order above. Commit it on the step branch.
2. List the call sites: the plan names them, or run `pnpm -r --no-bail --if-present run typecheck` and read the failing files.
3. Choose the coder for the call sites:
   - 3 or more feature folders or modules, and each needs more than an import change (new logic, new tests): run a swarm.
   - Otherwise: one coder, by the coder order above.
4. Run the swarm in one command, so `AGY_MODELS` holds for this run only. Bash: `AGY_MODELS=gemini-4-hydrogen-high node scripts/agy-run.mjs --mode accept-edits --output-format json --print-timeout 45m -p "/swarm <task>"`. PowerShell: `$env:AGY_MODELS='gemini-4-hydrogen-high'; node scripts/agy-run.mjs <same args>; $c=$LASTEXITCODE; Remove-Item Env:AGY_MODELS; exit $c`, so exit 4 reaches you. Confirm the stderr line `agy-run: ran on gemini-4-hydrogen-high`. The task says:
   - Every worker and the verifier run on `gemini-4-hydrogen-high`.
   - One worker for each feature folder or module, with the files it owns. No two workers own one file.
   - A worker runs `pnpm --filter <package> typecheck`, and the tests of its own files only in `apps/web`, `apps/mobile`, or `packages/*`. API tests share one database per checkout, so they run only in the verifier's `pnpm check`.
   - Only the `@verifier` runs `pnpm map` and `pnpm check`, once all workers report done. It sends each failure to the worker that owns the file.
   - Each member edits only the allowed paths of the step: list them.
   - Never skip, delete, or weaken a test or a check.
   - No member commits, pushes, or merges.
5. Read the diff, commit, and go on with the tester and the Reviewer as usual.

- The model of each worker is set by the task text only: the coordinator picks it. When the output names a member on another model, the run failed: one coder redoes the call sites.
- Exit 4 (Hydrogen out of quota): one coder does the call sites. Never start a swarm on another model.
- A worker that runs out of quota pauses and does not exit. Any nonzero exit after agy started, a timeout or exit 4 included, can leave a partial diff: one coder finishes the call sites from the diff in the working tree.
- A swarm costs the quota of every worker and extra minutes of coordination. In the trial of 2026-11-12 on `gemini-3.8-flash-high`, the swarm model until 2026-11-14 (7 files changed their imports, 2 dropped their own copy of a helper), one coder took 13.2 minutes, and the shared step plus a swarm took 4.5 + 12.9 = 17.4 minutes. The diffs were the same.

## Fix ladder

This section is for Claude Code sessions. Use it when `pnpm check` fails after the coder says the step is done. The Planner and the last review stay on the session model. The Reviewer stays on agy Neon.

| Rung | Coder | Attempts | Climb when |
|---|---|---|---|
| 0 | The model that coded the step (agy, or Sonnet after exit 4) | 1 | The check still fails |
| 1 | Subagent `backend` or `frontend` (Sonnet) | 2 | The check still fails |
| 2 | The same subagent with `model: opus` | 2 | The check still fails, or the failure is hard |
| 3 | The same subagent with `model: fable` | 1 | Stop: see the last rule |

- One attempt is one fix and one run of `pnpm check`.
- Past the weekly Claude line, `agy-run.mjs` runs on the Gemini models only (`HUMAN_DECISIONS.md`, row 75). Exit 4 (every agy model out of quota) skips rung 0.
- A hard failure is a deadlock (`40P01`), a race, a flaky test with no known cause, or a failure across several modules. It climbs to rung 3 after one attempt on rung 2.
- A step on money, concurrency, the schema, or personal data skips rung 1.
- A failure only in a test known to be flaky (`PROGRESS.md`) gets one rerun before rung 0.
- When a rung's model is out of quota, go to the next rung. Rung 1 uses `model: haiku` only when no higher rung has quota.
- Each rung continues on the same branch. Give it the plan, the failing lines, the diff, and one line on each earlier attempt.
- A coder that finds the plan wrong (a test that conflicts with the brief) stops. The Planner rewrites the plan. The ladder does not climb.
- An Opus or Fable coder is a Coder. The Reviewer is still a fresh session.
- After rung 3, the check still fails: leave the pull request open and unmerged. Record the failure in the pull request and `PROGRESS.md`, and go on with other work. Never skip or weaken a test, and never post `review-accepted` for a red check.
- Log each attempt in the pull request: rung, model, result, tokens, and minutes.

Findings of medium or higher from a Reviewer round use the same rungs. One attempt there is one fix, `pnpm check`, and a new Reviewer round on the new head. Start at rung 0, or at rung 2 for money, concurrency, the schema, or personal data. The 2-round rule of "Autonomy details" still caps it: after 2 rounds, follow that rule.

Claude Code runs a subagent on the `model` in its `.claude/agents/` file, unless the call sets `model`, or on the session model when neither sets one. One coder does a step. Run `backend` and `frontend` together only when the contract in `packages/shared` is on the branch and their paths do not overlap. Then run `tester`, then a Reviewer round (below). The `qa` agent lists questions for the owner after the last step. `deployer` checks a deploy.

A Reviewer round runs `node scripts/agy-run.mjs --strong-only --mode plan --print-timeout 30m -p "You are the Reviewer in AGENTS.md. Read REVIEW.md first. Read only: do not edit, commit, or push. Review <pull request #n, or git diff <base>..<head>>. List findings as: severity | file:line | problem | fix. Start with a count by severity. End with the REVIEW.md marker line for <head sha>."` in the background. It tries Neon, then Opus, then Argon. Exit 4: use the `reviewer` subagent. The session model then gives the last review: it checks each finding against the code, drops a wrong one with the reason, and posts the review comment with the marker.

## Steps

1. Run skill `brief-questions` on the concept. Write the brief with skill `feature-brief`. A Reviewer checks it. It is accepted when no finding of medium or higher is open.
2. Open one issue from `.github/ISSUE_TEMPLATE/feature.md`, label `enhancement`, linking the brief.
3. One branch per step from `main`: `feat/<issue>-<step>-<slug>`, for example `feat/12-1-booking-schema`. When the step needs an earlier step that is not merged yet, branch from that step's branch instead.
4. One pull request per step with `gh pr create`, using `.github/pull_request_template.md` and the step paths under "Allowed paths". Write `Refs #<issue>`. Write `Closes #<issue>` on the last step only. A step branched from an earlier step uses that branch as `--base`, so the diff and `pr-gates` show this step only. When the earlier pull request merges, set the base to `main` with `gh pr edit <n> --base main`, if GitHub did not do it.
5. After the last step, run `qa`. Put its questions in the end report and in `docs/qa/`.
6. A Reviewer reviews each pull request. Post findings as a pull request comment that ends with the marker line of `REVIEW.md`. Fix each finding of medium or higher. Run a new Reviewer on the new head, on the diff since the last reviewed head. A finding is closed only when that Reviewer says so. Each run is one round. A pull request on money, concurrency, schema, or personal data also runs skill `rule-review` and posts its comment.
7. Wait for checks in the background: `gh pr checks <n> --watch --fail-fast`. The pull request is ready when all checks pass and the latest marker for the current head shows no finding of medium or higher. A finding tagged pre-existing does not count. The check `pr-gates` fails a pull request that changes a path outside its allowed list, or lists an AC with no test.
8. Fill the section "Chạy thử local" of the pull request body (see below). A stacked pull request starts that section with "Merge sau #<n của bước trước>". Then merge the ready pull request with `node scripts/merge.mjs <n>`, in merge order (`HUMAN_DECISIONS.md`, row 50). A stacked pull request merges only after its base pull request is merged and its base is `main`. Never use `gh pr merge`: `.claude/settings.json` denies it in Claude Code. Antigravity has no deny list, so there the rule holds only while agents follow it. Put the pull request in the end report. Go on with the next step.
9. The script refuses a base other than `main`, a red check, and a head with no clean review marker. Then `.github/workflows/deploy.yml` deploys. In the next run, check that the deploy run passed and `/api/health` answers on the service URL. The owner runs `verify-flow` on the live service (`HUMAN_DECISIONS.md`): write the command in `PROGRESS.md` as a step for the owner, and go on. In a later run, read its `report.md` and fix a failure in a new pull request.
10. At the start of each run, update each open pull request of the agents:
    - When its base branch was merged, set the base to `main` with `gh pr edit <n> --base main`, if GitHub did not do it.
    - When its branch is behind its base, or it conflicts, merge the base into the branch with `git merge`. Never rebase and force push. Run `pnpm map` when `@map.md` conflicts.
    - Push, wait for the checks, then run a Reviewer round. Give the Reviewer `git show --remerge-diff <merge sha>` for the merge commit, which shows only what the merge resolved, plus the diff of any other commit since the last reviewed head. The head changed, so `merge.mjs` needs a new marker.
    - Every pull request rewrites `PROGRESS.md`, so two open pull requests often conflict there. Keep the branch text, drop each item that `main` closed, then add each open item from `main` that the branch text lacks.

The section "Chạy thử local" of a pull request body. Do not start a line there with `AC-n:`: `pr-gates` reads every such line as an AC claim.

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
- Run `pnpm dev:api` and `pnpm dev:web` in two terminals, then open http://localhost:5173.
- Add the screens and flows to check, one per line.

A fix, chore, or docs change with no brief needs no issue. Branch: `fix/<slug>`, `chore/<slug>`, or `docs/<slug>`. It still gets a pull request and changes only the files its description lists.

After a merge, if `@map.md` on `main` is stale, open `chore/map-refresh` with `pnpm map`.

## Autonomy details

- Without a goal, do the steps in `PROGRESS.md` in order. Pick the next slice by the launch order in the intake.
- A finding of medium or higher still open after 2 review rounds, or autofix giving up: choose the safest fix. Record the finding in the pull request and `PROGRESS.md`. Post `<!-- review-accepted head=<sha> -->` on the pull request and continue.
- Keep a task list for the run, in the tool or in a file. Mark items done. Before you end a turn, read it again. While an item is open and not blocked, do it. A step only the user can do (a real device check) goes in the end report and `PROGRESS.md`. Go on with the other items.
- You may create test data on the live service. Give each test account the name prefix `test-`.
- End each run with a short report: what is done, the pull requests merged, each one still open with the reason, the assumptions, the service URL, what is next.

## Maintain

- `pnpm maintain --once` reads CI and live signals (`scripts/maintain-bands.json`) and opens or updates issues labelled `maintain`.
- Triage: the owner decides whether to fix now, schedule, or close with the label `maintain-dismissed` (review that metric's band on the next maintain edit).
- Fix an accepted `maintain` issue on `fix/<slug>` through the normal PR, Reviewer, and `node scripts/merge.mjs <n>` flow. Never add `.skip`, `.only`, or `.todo`.
- Add at least one regression test whose name includes the issue number, for example `#402: ...`.

## Other

- Antigravity maps the roles in `.agents/rules/model-routing.md` and runs CLI tasks through `node scripts/agy-run.mjs`.
- A step may always commit `@map.md`.
- When the next step changes, rewrite `PROGRESS.md` in the same pull request. When a decision needs the user, update `HUMAN_DECISIONS.md` the same way.
