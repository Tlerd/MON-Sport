---
name: agent-workflow
description: Roles, branch names, review rounds, the hand-off to the user for the merge, and the deploy check of the MONSPORT agent workflow. Use before you plan a brief step, pick a coder, open or review a pull request, handle a finding still open after 2 rounds, hand a pull request to the user, or check a deploy.
---

Read this before you plan a step, open a pull request, review, or hand a pull request to the user.

## Roles

Each tool maps these roles to its own models. In Claude Code, the session model (Opus) is the Planner and the Reviewer. It reads each coder diff and runs `pnpm check`.

| Role | Does | Never |
|---|---|---|
| Planner | Reads the brief and the code. Writes a plan that lists each file to change. Uses the strongest model for money, concurrency, schema, or personal data | Edits a file |
| Reader | Finds and reads files. Use the cheap read-only `Explore` agent for a search over several files | Edits a file, or changes state |
| Coder | Writes the tests first, then the code the plan lists. Runs `pnpm check` | Edits a path the brief does not list |
| Reviewer | A fresh session. Reads `REVIEW.md` first. Reviews a brief or pull request against the intake. Rates each finding high, medium, or low | Edits, commits, or pushes |

Coder order: run `node scripts/agy-run.mjs --check-usage`, then `node scripts/agy-run.mjs --mode accept-edits -p "<plan>"`. Exit code 4 means every agy model is out of quota. Then use the subagent `backend` or `frontend` (Sonnet). When Sonnet is out of quota, run it with `model: haiku`.

## Swarm step (agy 3.8)

Use it when a change to a shared part (`packages/shared`, `packages/client`, a shared component or hook) needs edits at many call sites. A swarm runs only on agy with `gemini-3.8-flash-high`, never on another model.

1. One coder changes the shared part and its tests first, by the coder order above. Commit it on the step branch.
2. List the call sites: the plan names them, or run `pnpm -r --if-present run typecheck` and read the failing files.
3. Choose the coder for the call sites:
   - 3 or more feature folders or modules, and each needs more than an import change (new logic, new tests): run a swarm.
   - Otherwise: one coder, by the coder order above.
4. Run the swarm: `AGY_MODELS=gemini-3.8-flash-high node scripts/agy-run.mjs --mode accept-edits -p "/swarm <task>"`. The task says:
   - Every worker and the verifier run on `gemini-3.8-flash-high`.
   - One worker for each feature folder or module, with the files it owns. No two workers own one file.
   - A worker checks its own files with `pnpm --filter <package> typecheck` and its tests only.
   - Only the `@verifier` runs `pnpm map` and `pnpm check`, once all workers report done. It sends each failure to the worker that owns the file.
   - No member commits, pushes, or merges. The allowed paths of the step.
5. Read the diff, commit, and go on with the tester and the Reviewer as usual.

- Exit 4 (3.8 out of quota): one coder does the call sites. Never start a swarm on another model.
- A swarm costs about 8 to 10 minutes of coordination and the quota of every worker. In the trial of 2026-11-12, 8 call sites with import changes only took 13.2 minutes with one coder, and 4.5 + 12.9 = 17.4 minutes with the shared step and a swarm. The diffs were the same.

## Fix ladder

This section is for Claude Code sessions. Use it when `pnpm check` fails after the coder says the step is done. The Planner and the Reviewer stay on the session model.

| Rung | Coder | Attempts | Climb when |
|---|---|---|---|
| 0 | The model that coded the step (agy, or Sonnet after exit 4) | 1 | The check still fails |
| 1 | Subagent `backend` or `frontend` (Sonnet) | 2 | The check still fails |
| 2 | The same subagent with `model: opus` | 2 | The check still fails, or the failure is hard |
| 3 | The same subagent with `model: fable` | 1 | Stop: see the last rule |

- One attempt is one fix and one run of `pnpm check`.
- `agy-run.mjs` exit 3 is the weekly stop line: commit, write the next step in `PROGRESS.md`, and stop. Never climb past it. Exit 4 (agy out of quota) skips rung 0.
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

Claude Code runs a subagent on the `model` in its `.claude/agents/` file, unless the call sets `model`, or on the session model when neither sets one. One coder does a step. Run `backend` and `frontend` together only when the contract in `packages/shared` is on the branch and their paths do not overlap. Then run `tester`, then `reviewer`. The `qa` agent lists questions for the owner after the last step. `deployer` checks a deploy.

A Reviewer round is a `reviewer` subagent, or `claude -p --permission-mode plan "You are the Reviewer in AGENTS.md. Read REVIEW.md first. Review <brief file or pull request #n>."`.

## Steps

1. Run skill `brief-questions` on the concept. Write the brief with skill `feature-brief`. A Reviewer checks it. It is accepted when no finding of medium or higher is open.
2. Open one issue from `.github/ISSUE_TEMPLATE/feature.md`, label `enhancement`, linking the brief.
3. One branch per step from `main`: `feat/<issue>-<step>-<slug>`, for example `feat/12-1-booking-schema`. When the step needs an earlier step that is not merged yet, branch from that step's branch instead.
4. One pull request per step with `gh pr create`, using `.github/pull_request_template.md` and the step paths under "Allowed paths". Write `Refs #<issue>`. Write `Closes #<issue>` on the last step only. A step branched from an earlier step uses that branch as `--base`, so the diff and `pr-gates` show this step only. When the earlier pull request merges, set the base to `main` with `gh pr edit <n> --base main`, if GitHub did not do it.
5. After the last step, run `qa`. Put its questions in the end report and in `docs/qa/`.
6. A Reviewer reviews each pull request. Post findings as a pull request comment that ends with the marker line of `REVIEW.md`. Fix each finding of medium or higher. Run a new Reviewer on the new head, on the diff since the last reviewed head. A finding is closed only when that Reviewer says so. Each run is one round. A pull request on money, concurrency, schema, or personal data also runs skill `rule-review` and posts its comment.
7. Wait for checks in the background: `gh pr checks <n> --watch --fail-fast`. The pull request is ready when all checks pass and the latest marker for the current head shows no finding of medium or higher. A finding tagged pre-existing does not count. The check `pr-gates` fails a pull request that changes a path outside its allowed list, or lists an AC with no test.
8. Stop at the ready pull request. Agents never merge: no `node scripts/merge.mjs`, no `gh pr merge` (`HUMAN_DECISIONS.md`, row 49). `.claude/settings.json` denies both in Claude Code. Antigravity has no deny list, so there the rule holds only while agents follow it. Fill the section "Chạy thử local" of the pull request body (see below). A stacked pull request starts that section with "Merge sau #<n của bước trước>". Put the pull request in the end report, in merge order. Go on with the next step.
9. The user runs the branch locally and merges with `node scripts/merge.mjs <n>`. The script refuses a base other than `main`. Then `.github/workflows/deploy.yml` deploys. In the next run, check that the deploy run passed and `/api/health` answers on the service URL. Run `verify-flow` on the live service. Fix a failure in a new pull request.
10. At the start of each run, update each open pull request of the agents:
    - When its base branch was merged, set the base to `main` with `gh pr edit <n> --base main`, if GitHub did not do it.
    - When its branch is behind its base, or it conflicts, merge the base into the branch with `git merge`. Never rebase and force push. Run `pnpm map` when `@map.md` conflicts.
    - Push, wait for the checks, then run a Reviewer round on the diff since the last reviewed head. The head changed, so `merge.mjs` needs a new marker.
    - Every pull request rewrites `PROGRESS.md`, so two open pull requests often conflict there. Keep the newer text.

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
- End each run with a short report: what is done, the pull requests ready to merge in merge order, the assumptions, the service URL, what is next.

## Other

- Antigravity maps the roles in `.agents/rules/model-routing.md` and runs CLI tasks through `node scripts/agy-run.mjs`.
- A step may always commit `@map.md`.
- When the next step changes, rewrite `PROGRESS.md` in the same pull request. When a decision needs the user, update `HUMAN_DECISIONS.md` the same way.
