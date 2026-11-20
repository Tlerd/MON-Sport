# Progress

This file holds what git and the tests cannot show. Rewrite it in place when the next step changes. Done features are in `COMPLETED.md`. Decisions that need the user are in `HUMAN_DECISIONS.md`. History is in git. Updated: 2026-11-19 (checked against the code).

## Current state

- `main` holds the intake (ADR 0002), the requirements documents (glossary, BR-1 to BR-60, UC-1 to UC-17, UC-19, UC-20 (no UC-18), data dictionary, models), the agent roles, the workflow, and the issue and PR templates.
- The done features are in `COMPLETED.md`: F-002 to F-027 (V1 web and app), F-028 to F-032 (V2 web, W1 to W5), F-033 and F-034 (the new web UI), F-035 (app host approval), and F-036 to F-038 (MCP, W7). The owner connected claude.ai to the live MCP on 2026-11-19.
- Live at https://monsport-774323404592.asia-southeast1.run.app (Cloud Run + Cloud SQL, demo seed data). Cloud Run runs with `--no-cpu-throttling` since 2026-10-20 (brief F-014, ADR 0005). Since PR #184, a pull request runs `check` and `image` only when `scripts/ci-changes.mjs` says a changed file can change their result; every push to `main` runs every job. A deploy is skipped when only files outside the image changed since the commit label of the serving revision; a manual run always deploys. Each merge to `main` deploys through `.github/workflows/deploy.yml`, which sends the traffic back to the previous revision when `/api/health` fails. Cloud SQL `monsport-db` keeps 7 daily backups (02:00 Asia/Ho_Chi_Minh), point-in-time recovery for 7 days, and deletion protection, since 2026-10-18.
- CI runs on `ubuntu-latest` since 2026-11-19, because the repository is public. The owner removed the runner `monsport-wsl` and disabled the task `WSL-KeepAlive`. Set-up to bring it back: `docs/design/ke-hoach-runner-tu-host.md` (private repository only).
- Local development uses its own Postgres 18 cluster on `localhost:55432` (`pnpm db:start`, data in `%LOCALAPPDATA%/monsport/pgdata`). Start it again after a reboot. The cluster runs `Asia/Bangkok`, so `PrismaService` sets `TimeZone=UTC` on each connection (Cloud SQL runs UTC). `monsport_dev` needs `prisma migrate reset` before it takes the F-003 and F-006 migrations; the reset deletes its data, so the agent left it. `monsport_preview` holds the seed data and every migration.
- The usage guard (`D:/REPO_GITHUB_TRY/usage-guard`) pauses at 95% of the 5-hour window, stops new work at 90% of the week, and stops at 94%. At the reset, a scheduled `claude -p "tiếp tục làm"` continues the work. A desktop session writes `state.json` from `get_usage`.

## Decisions settled on 2026-10-16

- `docs/requirements/intake-monsport-v1.md` is the source of truth (ADR 0002).
- The stack: NestJS 12, React 19 + Vite 8, PostgreSQL (18 locally and in CI), Prisma 7 from pull request 1, Zod 4, SSE for real-time updates.
- The API is ESM and builds with SWC, because Nest needs decorator metadata. `packages/shared` ships TypeScript source.
- Agents work without asking, under "Autonomy" in `AGENTS.md`. Claude Code plans and gives the last review before the merge; agy on `gemini-4-neon-high` is the Reviewer (`--strong-only`: Neon, then Opus, then Argon) (`HUMAN_DECISIONS.md` row 73). Agents merge a ready pull request with `node scripts/merge.mjs <n>` (row 50). agy codes through `node scripts/agy-run.mjs`, Hydrogen then Argon, then Claude (`DEFAULT_MODELS`, rows 67 and 73). Exit 4 (agy out of quota) sends the step to `backend` or `frontend` on Sonnet, then Haiku. The agy sandbox has no Node, so an agy coder only writes files and the Planner runs `pnpm check`.

## Waiting for the owner

- F-004 step 4 (live): the Google sign-in code and the eSMS adapter (`apps/api/src/modules/otp/otp-sender.ts`) are built. Choose the SMS provider, register a brandname, do the Google console steps of the brief, then send the client ID. Then brief F-018 (Zalo, OTP over ZNS). Web Push (F-014) is not done until an Android phone passes.
- V2: the intake `docs/requirements/intake-monsport-v2.md` stays `proposed` until the owner accepts it (`HUMAN_DECISIONS.md` row 54). W6 (payment) does not start before that. Defaults that wait for the owner: rows 51 to 61, and 69 to 72.
- `verify-flow` on live: the owner runs it with the accounts in `D:/runenv/verify.env`; an agent never signs in to the live service with a password. Last live runs: web V2 on 2026-11-14 (`952c5f7`, 24 PASS), F-033 on 2026-11-14 (`60100fa`; `/` at 390px fixed in PR #251), `web-responsive` on `58d05c2` (15 PASS). The admin routes need `VERIFY_ADMIN_PHONE` and `VERIFY_ADMIN_PASSWORD`.

## Next step for agents

1. App port of W2 to W5: skill level is on the app (F-039). The app has no weekly booking (F-030) or reputation (F-032) yet. A STAFF user sees "Dùng web cho nhân viên" (F-031). Write a brief per feature, in the order of `docs/design/ke-hoach-v2.md`.
2. Open lows, checked in the code on 2026-11-19 (each still holds):
   - ADR 0008, Options item 1 (line 24), still says PAT runs over stdio; line 12 says Streamable HTTP.
   - `AccessTokensService.authenticate` repeats the rule of `validWhere` and loads the whole `User` row (PR #270).
   - `matches.service.ts` `detail` and `match-players.service.ts` `listRequests` hold the same `syncMatch` closure.
   - Web `useMatchActions.ts`: a failed request decision does not reload the request list. Web `useMatchDetail.ts`: the busy set resets when a match is closed and reopened.
   - `lobby-approval.mjs` puts the live requester name in the verify report. `stats.service.ts`: admin active users of the week drop a player who joined, left, and asked again (the request `upsert` sets `PENDING`).
   - Not checked again: deferred mobile lows F-022 D-8, F-023 D-1 (waits for question 2), F-025 D-8, F-026 D-6 to D-8.
3. Flaky under load, one rerun each (fix ladder): `harness/secret-scan.test.mjs`, `harness/boundaries.test.mjs` (5000 ms), and `VenueScreen.test.tsx` AC-9 (scrollTo called 4 times instead of 2).
4. Harness: maintain phase 1 (plan on branch `docs/ke-hoach-maintain`, no `chore/maintain-detect` branch yet) and the fix-ladder log. Swarm step: try a larger fan-out before you widen the rule (trials: 17.4 min against 13.2 min one coder; 11.8 min, no baseline).
5. Security follow-ups (baseline, audit run-1, branch protection, pinned Actions, and IDOR tests in `COMPLETED.md`): run audit run-2 on the 7 deferred units in `.security-audit/run-1/coverage-ledger.json`. Review the monthly Dependabot pull request for Actions like any other. Strix is not used (owner, 2026-11-20).
6. Web UI rules: `docs/design/web-ui-v3/` gives the look, `docs/design/web-responsive.md` the layout by width, and `DESIGN.md` is for `apps/mobile` only. A control with no feature shows "Sắp ra mắt" and needs an intake change and a brief. Source files stay at 300 lines or fewer (`harness/source-size.test.mjs`).
