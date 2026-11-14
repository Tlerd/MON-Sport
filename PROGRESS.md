# Progress

This file holds what git and the tests cannot show. Rewrite it in place when the next step changes. Done features are in `COMPLETED.md`. Decisions that need the user are in `HUMAN_DECISIONS.md`. History is in git. Updated: 2026-11-14 (the web has the new UI of F-033, ADR 0009).

## Current state

- `main` holds the intake (ADR 0002), the requirements documents (glossary, BR-1 to BR-32, UC-1 to UC-14, data dictionary, models), the agent roles, the workflow, and the issue and PR templates.
- The done features are in `COMPLETED.md`: F-002 to F-027 (V1 web and app) and F-028 to F-032 (V2 web), and F-033 (the new web UI).
- Live at https://monsport-774323404592.asia-southeast1.run.app (Cloud Run + Cloud SQL, demo seed data). Cloud Run runs with `--no-cpu-throttling` since 2026-10-20 (brief F-014, ADR 0005). Since PR #184, a pull request runs `check` and `image` only when `scripts/ci-changes.mjs` says a changed file can change their result (skip sets in `scripts/ci-changes.mjs`; `AGENTS.md`, `PROGRESS.md`, `@map.md` still run `check`); every push to `main` runs every job. A deploy is skipped when only files outside the image changed since the commit label of the serving revision; a manual run always deploys. Each merge to `main` deploys through `.github/workflows/deploy.yml`, which sends the traffic back to the previous revision when `/api/health` fails. Cloud SQL `monsport-db` keeps 7 daily backups (02:00 Asia/Ho_Chi_Minh), point-in-time recovery for 7 days, and deletion protection, since 2026-10-18.
- Local development uses its own Postgres 18 cluster on `localhost:55432` (`pnpm db:start`, data in `%LOCALAPPDATA%/monsport/pgdata`). Start it again after a reboot. The cluster runs `Asia/Bangkok`, so `PrismaService` sets `TimeZone=UTC` on each connection (Cloud SQL runs UTC). The local database `monsport_dev` needs `prisma migrate reset` before it takes the F-003 and F-006 migrations, because migration f003 changed after it ran there. The reset deletes its data, so the agent left it. `monsport_preview` holds the seed data and every migration.
- The usage guard (`D:/REPO_GITHUB_TRY/usage-guard`) pauses at 95% of the 5-hour window, stops new work at 90% of the week, and stops at 94%. At the reset, a scheduled `claude -p "tiếp tục làm"` continues the work. A desktop session writes `state.json` from `get_usage`.

## Decisions settled on 2026-10-16

- `docs/requirements/intake-monsport-v1.md` is the source of truth (ADR 0002).
- The stack: NestJS 12, React 19 + Vite 8, PostgreSQL (18 locally and in CI), Prisma 7 from pull request 1, Zod 4, SSE for real-time updates.
- The API is ESM and builds with SWC, because Nest needs decorator metadata. `packages/shared` ships TypeScript source.
- Agents work without asking, under "Autonomy" in `AGENTS.md`. Since 2026-10-23 (PR #99): Opus in Claude Code plans, reviews, and checks. Since 2026-11-13 (`HUMAN_DECISIONS.md` row 50, which replaces row 49): agents merge a ready pull request with `node scripts/merge.mjs <n>`, in merge order. agy codes through `node scripts/agy-run.mjs` (every model, flash included). Exit 4 (agy out of quota) sends the step to `backend` or `frontend` on Sonnet, then Haiku. Antigravity: `.agents/rules/model-routing.md`.

## Open items (2026-11-14)

1. `harness/secret-scan.test.mjs` and `harness/boundaries.test.mjs` each timed out once at 5000 ms under load, and `VenueScreen.test.tsx` AC-9 fails under load: each gets one rerun (fix ladder). The AC-31 flake of `google-auth.e2e.test.ts` is fixed (PR #232).
2. `agent-workflow` has a "Swarm step (agy Hydrogen)" since `chore/agent-workflow-swarm-step`: the shared part first, then `/swarm` on `gemini-4-hydrogen-high` (on 3.8 until 2026-11-14) only when 3 or more feature folders need more than import changes. The trial on `chore/client-helpers-dedupe` (9 files, mostly import changes) was slower with the swarm (17.4 min) than with one coder (13.2 min). A second swarm on 2026-11-12 (`fix/progress-open-items`; 3 workers, 5 files, independent changes) ran in 11.8 min with `pnpm check` green. No one-coder baseline ran for it, so the rule stays as it is. Try it again on a larger fan-out before you widen the rule.

## Next step

- Waiting for the user: F-004 step 4 (live): choose the SMS provider and register a brandname, do the Google console steps of the brief, then send the client ID. Then brief F-018 (Zalo, OTP over ZNS). Web Push (F-014) is not done until an Android phone passes. Other items: `HUMAN_DECISIONS.md`.
- A plan for an MCP server (AI books courts; users connect a connector) is in `docs/design/ke-hoach-mcp.md`, with ADR 0008 (Proposed). It waits for `HUMAN_DECISIONS.md` item 26 and an intake change.
- Deferred mobile lows: F-022 D-8, F-023 D-1 (waits for question 2), F-025 D-8, F-026 D-6 to D-8. Flaky test: `VenueScreen.test.tsx` AC-9 (scrollTo called 4 times instead of 2).
- The self-hosted runner `monsport-wsl` (label `monsport-local`, WSL2 Ubuntu on drive D) has run since 2026-11-07. PR `chore/runner-tu-host` moves `changes`, `check`, `image`, and `gates` to it (`deploy` stays on `ubuntu-latest`). Plan: `docs/design/ke-hoach-runner-tu-host.md`. If a job fails there for an environment reason, read its log and fix the runner or go back to `ubuntu-latest`.
- When the agy Claude and GPT models are out of quota, code with `AGY_MODELS=gemini-4-argon-high,gemini-4-hydrogen-high node scripts/agy-run.mjs ...`. Use the subagent `backend` or `frontend` (Sonnet) only on exit 4, as `agent-workflow` says.

## V2 on the web

- W1 to W5 (F-028 to F-032) are on `main` and live since 2026-11-13 (PR #244, see `COMPLETED.md`). The intake `docs/requirements/intake-monsport-v2.md` stays `proposed` until the owner accepts it (`HUMAN_DECISIONS.md` row 54).
- `verify-flow` web on live passed on 2026-11-14 (commit `952c5f7`, 24 PASS, 0 SKIP; comment on PR #244). The owner runs a live run: the accounts are in `D:/runenv/verify.env` (PR #246), and an agent never signs in to the live service with a password.
- Open V2 lows, all accepted (`Lobby.tsx`: the request list is not reloaded after a failed decision, and the busy set resets when a match is closed and reopened; `lobby-approval.mjs`: the live requester name can reach the verify report; `matches.service.ts`: the sync closure is duplicated in `detail` and `listRequests`; a player who joined, left, and asked again drops out of the admin active users of the week). `REVIEW.md` still says "BR-1 to BR-32": fix it in a `chore`.
- Web UI (F-033): the mock `docs/design/web-ui-v3/` gives the look, `docs/design/web-responsive.md` gives the layout by width, and `DESIGN.md` is for `apps/mobile` only. A control with no feature shows "Sắp ra mắt" (list: brief F-033, "Non-goals"): each needs an intake change and a brief. `verify-flow` on live passed on 2026-11-14 (owner; every web flow on `13e7537` except `/` at 390px, fixed in PR #251; `web-responsive` on `58d05c2`: 15 PASS, 0 FAIL). The admin routes were SKIP on live: they need `VERIFY_ADMIN_PHONE` and `VERIFY_ADMIN_PASSWORD` in `D:/runenv/verify.env`. The local database has no open match on `/`, so check a card change on `/` with a stubbed match at 390px. The agy terminal sandbox has no Node, so an agy coder only writes files and the Planner runs `pnpm check`. Owner, 2026-11-14: `gemini-4-hydrogen-high` replaces 3.8 in `scripts/agy-run.mjs` and the swarm step (`HUMAN_DECISIONS.md`, rows 67 and 68). F-033 ran with it first in `AGY_MODELS`.
- Not started (plan `docs/design/ke-hoach-v2.md`): W6 (payment) and W7 (MCP) need the owner's approval; the app port of W1 to W5. Defaults that wait for the owner: `HUMAN_DECISIONS.md` rows 51 to 61. Still open from 2026-11-11: maintain phase 1 (`chore/maintain-detect`), the fix-ladder log, and the Stop-hook note in `docs/known-issues.md`.
