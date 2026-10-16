# Progress

This file holds what git and the tests cannot show. Rewrite it in place when the next step or an open decision changes. History is in git.

Updated: 2026-10-16

## Current state

- `main` holds the intake, ADR 0002, the agent roles, the workflow, and the issue and PR templates (PR #1).
- `main` also holds pull request 0 (PR #2): `packages/shared`, `apps/api` (NestJS, `GET /api/health`), `apps/web` (React + Vite), and Postgres 18 in CI.
- `main` also holds the requirements documents (PR #3): glossary, BR-1 to BR-28, UC-1 to UC-14, data dictionary, models.
- `main` holds the accepted brief F-002 (PR #4). Its issue is #5.
- `main` holds F-002 step 1 (PR #6). Prisma 7.10.1 still needs `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`; remove it when 7.10.1 passes the release-age gate.
- Branch `feat/5-2-booking-server` holds F-002 step 2: login, `GET /api/venues`, booking and owner endpoints. AC-1 to AC-3, AC-6, AC-7, AC-10 to AC-19 pass. It needs a fresh-session review (concurrency, personal data, sessions).
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

1. A fresh session reviews F-002 step 2 (its PR). Merge after the review and CI pass.
2. Build F-002 step 3 on `feat/5-3-booking-screen`: login, the request form, my bookings, and the owner list, with AC-20 and AC-21.
3. Usage: paused at 80% of the 5-hour window on 2026-10-16. Stop at 90% of the week.
