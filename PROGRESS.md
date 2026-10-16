# Progress

This file holds what git and the tests cannot show. Rewrite it in place when the next step or an open decision changes. History is in git.

Updated: 2026-10-16

## Current state

- `main` matches `origin/main` at `e1b0300`. `pnpm check` passes.
- Not committed yet: the model split in `.claude/settings.json` and `.claude/agents/Explore.md`, the intake, ADR 0002, and the edits that point `AGENTS.md`, the old spec, and the old brief F-001 to the intake.
- No application code exists. `apps/` and `packages/` appear with the first feature.
- Not run yet: the CI workflow on GitHub, the Gemini setting, any Codex session, and a fresh chat that checks the model split.

## Decisions settled on 2026-10-16

- Requirements restart from an interview. `docs/requirements/intake-monsport-v1.md` is the source of truth (ADR 0002). `docs/spec/` and the old brief F-001 are reference only.
- The first version: roles admin, venue owner (chủ sân), and user. Users book, owners confirm by hand, and the app takes no payment. Hosts open matches in a lichess-style lobby. A pilot at 3 venues becomes the real product.
- The stack stays: NestJS, React + Vite, PostgreSQL on Supabase, Prisma 7, Zod. Real-time updates use SSE.
- Claude Code model split: `opusplan` (Opus plans, Sonnet codes), every chat starts in plan mode, and the `Explore` subagent reads files on Haiku.

## Open decisions

These are the open items of the intake. None of them blocks the data model.

1. The number of courts at each venue, the football court size (5 or 7 players), and the city. Owner: the user.
2. The pilot date. Owner: the user.
3. Bookings per day after 6 months. Owner: the user.
4. Whether Luật 91/2025 requires consent at sign-up. Owner: the user, with a legal adviser.

## Next step

1. Commit the uncommitted work above.
2. Write the requirements documents from the intake with the skill `ba-docs`: use cases, business rules, data model, and API.
3. Write the first feature brief with the skill `feature-brief`, then build pull request 0: the project skeleton.
