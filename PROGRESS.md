# Progress

This file holds what git and the tests cannot show. Rewrite it in place when the next step changes. Done features are in `COMPLETED.md`. Decisions that need the user are in `HUMAN_DECISIONS.md`. History is in git. Updated: 2026-11-13 (done features moved to `COMPLETED.md`).

## Current state

- `main` holds the intake (ADR 0002), the requirements documents (glossary, BR-1 to BR-32, UC-1 to UC-14, data dictionary, models), the agent roles, the workflow, and the issue and PR templates.
- The done features (F-002 to F-027) are in `COMPLETED.md`.
- Live at https://monsport-774323404592.asia-southeast1.run.app (Cloud Run + Cloud SQL, demo seed data). Cloud Run runs with `--no-cpu-throttling` since 2026-10-20 (brief F-014, ADR 0005). Since PR #184, a pull request runs `check` and `image` only when `scripts/ci-changes.mjs` says a changed file can change their result (skip sets in `scripts/ci-changes.mjs`; `AGENTS.md`, `PROGRESS.md`, `@map.md` still run `check`); every push to `main` runs every job. A deploy is skipped when only files outside the image changed since the commit label of the serving revision; a manual run always deploys. Each merge to `main` deploys through `.github/workflows/deploy.yml`, which sends the traffic back to the previous revision when `/api/health` fails. Cloud SQL `monsport-db` keeps 7 daily backups (02:00 Asia/Ho_Chi_Minh), point-in-time recovery for 7 days, and deletion protection, since 2026-10-18.
- Local development uses its own Postgres 18 cluster on `localhost:55432` (`pnpm db:start`, data in `%LOCALAPPDATA%/monsport/pgdata`). Start it again after a reboot. The cluster runs `Asia/Bangkok`, so `PrismaService` sets `TimeZone=UTC` on each connection (Cloud SQL runs UTC). The local database `monsport_dev` needs `prisma migrate reset` before it takes the F-003 and F-006 migrations, because migration f003 changed after it ran there. The reset deletes its data, so the agent left it. `monsport_preview` holds the seed data and every migration.
- The usage guard (`D:/REPO_GITHUB_TRY/usage-guard`) pauses at 95% of the 5-hour window, stops new work at 90% of the week, and stops at 94%. At the reset, a scheduled `claude -p "tiếp tục làm"` continues the work. A desktop session writes `state.json` from `get_usage`.

## Decisions settled on 2026-10-16

- `docs/requirements/intake-monsport-v1.md` is the source of truth (ADR 0002).
- The stack: NestJS 12, React 19 + Vite 8, PostgreSQL (18 locally and in CI), Prisma 7 from pull request 1, Zod 4, SSE for real-time updates.
- The API is ESM and builds with SWC, because Nest needs decorator metadata. `packages/shared` ships TypeScript source.
- Agents work without asking, under "Autonomy" in `AGENTS.md`. Since 2026-10-23 (PR #99): Opus in Claude Code plans, reviews, and checks. Since 2026-11-13 (`HUMAN_DECISIONS.md` row 50, which replaces row 49): agents merge a ready pull request with `node scripts/merge.mjs <n>`, in merge order. agy codes through `node scripts/agy-run.mjs` (every model, flash included). Exit 4 (agy out of quota) sends the step to `backend` or `frontend` on Sonnet, then Haiku. Antigravity: `.agents/rules/model-routing.md`.

## Open items after PR #227 (2026-11-12)

These items from PR #227 are still open:

1. Deferred lows of PR #227 round 2 (details in its comment): (a) dropped: row 50 lets agents run `scripts/merge.mjs`, so PR #232 must not add the `isTTY` refusal. (b) Step 10 of `agent-workflow`: give the Reviewer `git show --remerge-diff <merge sha>`, not the diff since the last reviewed head. (c) Step 10: for a `PROGRESS.md` conflict, keep the branch text, then add open items from `main`.
2. PR #209 (`fix/local-postgres-recovery`, local Postgres starts with `fsync=off`) is open. Update its branch from `main` (step 10). It has no review marker, so the first Reviewer round reads the whole diff (`gh pr diff 209`). Then merge it with `node scripts/merge.mjs 209`.
3. Flaky test: `apps/api/src/modules/auth/google-auth.e2e.test.ts` AC-31 (two "Hoàn tất đăng ký" requests at the same time) failed twice on 2026-11-12 in a full local `pnpm check`. It got `[201, 409]` instead of `[201, 400]`. It passes alone. Cause: `auth.controller.ts` (about line 525) looks up the phone before the code check, so when request 1 commits first, request 2 gets 409 "Số này đã có tài khoản...". The code is correct and the lookup must stay first (R4, AC-40). Fix the test and brief F-004 AC-31: accept `[201, 400]` or `[201, 409]` with the matching messages, and record the brief change as an assumption. Until then, this test and `harness/secret-scan.test.mjs` (timed out once at 5000 ms under load) each get one rerun (`agent-workflow`, fix ladder).

## Next step

- Waiting for the user: F-004 step 4 (live): choose the SMS provider and register a brandname, do the Google console steps of the brief, then send the client ID. Then brief F-018 (Zalo, OTP over ZNS). Web Push (F-014) is not done until an Android phone passes. Other items: `HUMAN_DECISIONS.md`.
- A plan for an MCP server (AI books courts; users connect a connector) is in `docs/design/ke-hoach-mcp.md`, with ADR 0008 (Proposed). It waits for `HUMAN_DECISIONS.md` item 26 and an intake change.
- Deferred mobile lows: F-022 D-8, F-023 D-1 (waits for question 2), F-025 D-8, F-026 D-6 to D-8. Flaky test: `VenueScreen.test.tsx` AC-9 (scrollTo called 4 times instead of 2).
- The self-hosted runner `monsport-wsl` (label `monsport-local`, WSL2 Ubuntu on drive D) has run since 2026-11-07. PR `chore/runner-tu-host` moves `changes`, `check`, `image`, and `gates` to it (`deploy` stays on `ubuntu-latest`). Plan: `docs/design/ke-hoach-runner-tu-host.md`. If a job fails there for an environment reason, read its log and fix the runner or go back to `ubuntu-latest`.
- When the agy Claude and GPT models are out of quota, code with `AGY_MODELS=gemini-4-argon-high,gemini-3.8-flash-high node scripts/agy-run.mjs ...`. Use the subagent `backend` or `frontend` (Sonnet) only on exit 4, as `agent-workflow` says.

Plan for V2 (web first) is a draft in `docs/design/ke-hoach-v2.md`, 2026-11-10; it waits for the Opus review and the owner. The deferred mobile lows (see "Next step") wait for the port of V2 features to the app. Until the owner accepts an intake V2, agents code nothing of V2. For V2 steps the owner asked to run every flow on the machine first and to open stacked pull requests without merging; CI runs once after the whole stack is up.
