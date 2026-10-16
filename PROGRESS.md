# Progress

This file holds what git and the tests cannot show. Rewrite it in place when the next step or an open decision changes. History is in git.

Updated: 2026-10-17

## Current state

- `main` holds the intake (ADR 0002), the requirements documents (glossary, BR-1 to BR-28, UC-1 to UC-14, data dictionary, models), the agent roles, the workflow, and the issue and PR templates.
- F-002 is done (issue #5 closed): login with seed accounts, `GET /api/venues`, booking requests, owner confirm and reject, and the screens. AC-1 to AC-21 pass. PRs #6, #7, #8, #9, #10.
- PR #7 merged before its concurrency fix. PR #10 carried the fix (row lock `FOR UPDATE` on `Court`), the `SESSION_SECRET` start-up check, and the security tests.
- The full flow ran in the browser on 2026-10-16 with the real API.
- Remove `minimumReleaseAgeExclude` from `pnpm-workspace.yaml` when Prisma 7.10.1 passes the release-age gate.
- `docs/deploy-gcp.md` deploys `main` to Cloud Run and Cloud SQL. CI builds the image and starts it on each pull request.
- Local development uses its own Postgres 18 cluster on `localhost:55432` (`pnpm db:start`, data in `%LOCALAPPDATA%/monsport/pgdata`). Start it again after a reboot.
- The usage guard (`D:/REPO_GITHUB_TRY/usage-guard`) has both lines at 100%. The desktop app does not write its `state.json`, so the agent writes it from the app's usage data.

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
5. Whether the Google Cloud trial becomes production. It runs on Cloud Run and Cloud SQL (ADR 0003, `docs/deploy-gcp.md`). Owner: the user.

## Next step

1. The user picks the next slice. The intake order suggests UC-1 sign-up with UC-10 admin screens, or UC-2 the free-slot grid.
2. Write its brief with `feature-brief`, open its issue, and build it.
