# MONSPORT

Web app to book sports courts and join matches. Venue owners confirm bookings by hand, and the first version takes no payment. One developer builds it with coding agents. This file is the map for every agent.

## Commands

- `pnpm install`: installs the tools and turns on the git hook.
- `pnpm check`: runs the tests, the type-check, and the import rules. It prints one line when all pass, and the failing lines when one fails.
- `pnpm dev:api` and `pnpm dev:web`: start the API on port 3000 and the web app, which sends `/api` to the API.
- `pnpm db:start`: starts the local Postgres on port 55432, and creates it on the first run. Copy `apps/api/.env.example` to `apps/api/.env`. The API tests need this database.

Work is done when `pnpm check` passes. The git hook and CI run the same command.

## Layout

A folder appears when its first feature needs it.

```
apps/api/src/modules/<name>/           one NestJS module for each domain
apps/web/src/features/<name>/          one folder for each feature
apps/web/src/app/                      routes and providers; composes the features
apps/web/src/{components,hooks,lib}/   code that every feature can use
packages/shared/src/                   Zod schemas: the one source of the API contract
```

`.dependency-cruiser.cjs` holds the import rules. A violation prints its own fix.

## Requirements

`docs/requirements/intake-monsport-v1.md`, in Vietnamese, is the source of truth for what to build (`docs/adr/0002-nguon-su-that-intake.md`). Other requirements documents in `docs/requirements/` derive from it.

- `docs/spec/` and `docs/briefs/F-001-tao-tran-kem-dat-san.md` are reference only. Do not code from them.
- Code a feature from its brief in `docs/briefs/`. The brief traces to the intake, and gives the acceptance criteria, the contract, the build order, and the paths you may edit.
- Give each acceptance criterion a test whose name starts with its label, for example `AC-1`.
- Use the terms of the table "Tên gọi" in the intake. Take the names of tables, types, and fields from the data model in `docs/requirements/` when it exists.
- Ask before you start when a request conflicts with the intake or its brief, or leaves the data model or a business rule unclear.
- Record a decision that is costly to reverse as a new file in `docs/adr/`.

## Agent roles

Each tool maps these roles to its own models. Claude Code maps them in `.claude/settings.json` and `.claude/agents/`.

| Role | Does | Never |
|---|---|---|
| Planner | Reads the brief and the code. Writes a plan that lists each file to change. Waits until the user approves the plan | Edits a file |
| Reader | Finds and reads files for the planner and the coder. Use a cheap read-only agent when a search spans several files | Edits a file, or runs a command that changes state |
| Coder | Writes the tests first, then the code, after the user approves the plan. Runs `pnpm check` | Edits a path that the brief does not list |
| Reviewer | A fresh session. Reviews a pull request against its brief and the intake | Pushes to the branch it reviews |

## Workflow

1. Write the brief with the skill `feature-brief`. The user accepts it.
2. Open one issue for the brief from `.github/ISSUE_TEMPLATE/feature.md`, with the label `enhancement`. The issue links the brief.
3. Give each step of the build order its own branch from `main`: `feat/<issue>-<step>-<slug>`, for example `feat/12-1-booking-schema`.
4. Open one pull request for each step with `gh pr create`. Fill in `.github/pull_request_template.md`. Write `Refs #<issue>` on each step, and `Closes #<issue>` on the last step only.
5. Merge a pull request only when CI passes. Ask the user before you merge.
6. A change to money, concurrency, or the schema gets a review from a fresh session before merge. The pull request links that review.
7. When the next step or an open decision changes, rewrite `PROGRESS.md` in the same pull request, before the merge.

A fix, a chore, or a docs change that no brief covers needs no issue. Its branch is `fix/<slug>`, `chore/<slug>`, or `docs/<slug>`, and it still goes through a pull request.

## State

Git and the tests hold the state. To see where the work stands, read `git log --oneline -15` and run `pnpm check`. A criterion with a passing `AC-n` test is done.

`PROGRESS.md` holds what they cannot show: the next step and the open decisions. Read it when you start. Rewrite it in place when either changes.
