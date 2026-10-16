# Progress

This file holds what git and the tests cannot show. Rewrite it in place when the next step or an open decision changes. History is in git.

Updated: 2026-10-16

## Current state

- `main` holds the intake, ADR 0002, the agent roles, the workflow, and the issue and PR templates (PR #1).
- `main` also holds pull request 0 (PR #2): `packages/shared`, `apps/api` (NestJS, `GET /api/health`), `apps/web` (React + Vite), and Postgres 18 in CI.
- `main` also holds the requirements documents (PR #3): glossary, BR-1 to BR-28, UC-1 to UC-14, data dictionary, models.
- `main` holds the accepted brief F-002 (PR #4). Its issue is #5.
- `main` holds F-002 step 1 (PR #6). Remove `minimumReleaseAgeExclude` from `pnpm-workspace.yaml` when Prisma 7.10.1 passes the release-age gate.
- PR #7 (`feat/5-2-booking-server`) holds F-002 step 2, the server. A fresh session reviews it.
- Branch `feat/5-3-booking-screen` holds F-002 step 3, the screens: login, booking form, my bookings, owner requests. AC-20 and AC-21 pass.
- Local development uses its own Postgres 18 cluster on `localhost:55432` (`pnpm db:start`, data in `%LOCALAPPDATA%/monsport/pgdata`). It needs no password of the system Postgres on 5432. Start it again after a reboot.
- The usage guard in `D:\REPO_GITHUB_TRY\usage-guard` reads `~/.claude/usage-guard/state.json`. The desktop app does not write it, so the agent writes it from the app's usage data. Headless runs fail until `claude /login`.

## Decisions settled on 2026-10-16

- `docs/requirements/intake-monsport-v1.md` is the source of truth (ADR 0002).
- The stack: NestJS 12, React 19 + Vite 8, PostgreSQL (18 locally and in CI), Prisma 7 from pull request 1, Zod 4, SSE for real-time updates.
- The API is ESM and builds with SWC, because Nest needs decorator metadata. `packages/shared` ships TypeScript source.
- Claude Code: `opusplan`, plan mode by default, and `Explore` on Haiku.

## Open decisions

1. The number of courts at each venue, the football court size, and the city. Owner: the user.
2. The pilot date. Owner: the user.
3. Bookings per day after 6 months. Owner: the user.
4. Whether Luật 91/2025 requires consent at sign-up. Owner: the user, with a legal adviser.
5. Which Postgres version Supabase gives the production project. Check it when the project is created.

## Next step

1. Merge PR #7 after its review and CI pass, then merge step 3. Step 3 closes issue #5.
2. Try the full flow in the browser: `pnpm db:start`, seed, `pnpm dev:api`, `pnpm dev:web`.
3. Usage guard: pause at 95% of the 5-hour window, stop at 95% of the week (`D:/REPO_GITHUB_TRY/usage-guard/config.json`).
