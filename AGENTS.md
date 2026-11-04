# MONSPORT

Web app to book sports courts and join matches. Venue owners confirm bookings by hand, and the first version takes no payment. One developer builds it with coding agents. This file is the map for every agent.

## Commands

- `pnpm install`: installs the tools and turns on the git hook.
- `pnpm check`: runs the tests, the type-check, and the import rules. One line when all pass, the failing lines when one fails.
- `pnpm dev:api` and `pnpm dev:web`: start the API on port 3000 and the web app, which sends `/api` to the API.
- `pnpm db:start`: starts the local Postgres on port 55432. Copy `apps/api/.env.example` to `apps/api/.env`. The API tests need it.
- `pnpm map`: rewrites `@map.md`, the list of code files with their exported names. Read it to find a file. `pnpm check` fails when it is stale.

Work is done when `pnpm check` passes. The git hook and CI run the same command. When a command hangs or fails, read `docs/known-issues.md`.

## Layout

```
apps/api/src/modules/<name>/           one NestJS module for each domain
apps/web/src/features/<name>/          one folder for each feature
apps/web/src/app/                      routes and providers; composes the features
apps/web/src/{components,hooks,lib}/   code that every feature can use
packages/shared/src/                   Zod schemas: the one source of the API contract
```

A folder appears when its first feature needs it. `.dependency-cruiser.cjs` holds the import rules, and a violation prints its own fix.

## What to build

`docs/requirements/intake-monsport-v1.md` (Vietnamese) is the source of truth. Build a feature from its brief in `docs/briefs/`: the brief gives the acceptance criteria, the contract, the build order, and the paths you may edit. `docs/spec/` and `docs/briefs/F-001-tao-tran-kem-dat-san.md` are reference only.

- Name each test after its criterion, for example `AC-1`.
- Use the terms of the table "Tên gọi" in the intake.
- Diagrams: skill `ba-diagrams` (Mermaid). An animated flow diagram outside requirements documents: 200Lab skill `diagram-director`, saved as `docs/diagrams/<name>.html` with `<name>.sheet.md` beside it. Without it, a Mermaid `sequenceDiagram`.

## Autonomy

The user starts work with "tiếp tục", "continue", or a goal. Take it to a live result: plan, build, review, merge, deploy. The user is not there to answer, so a question stops the work. Decide, and let the user correct later.

- Start with `git status`, `PROGRESS.md`, and `HUMAN_DECISIONS.md`. Finish work in progress first.
- When the intake or a brief leaves a decision open, choose what the intake supports best, or else the safer option. Write it under "Assumptions" with the reason. Record a decision that is costly to reverse in `docs/adr/`.
- A finding of medium or higher still open after 2 review rounds: choose the safest fix, record the finding in the pull request and `PROGRESS.md`, post `<!-- review-accepted head=<sha> -->` on the pull request, and continue.
- Each step of a brief gets its own branch `feat/<issue>-<step>-<slug>` (for example `feat/12-1-booking-schema`), its own pull request, a Reviewer, and a merge with `node scripts/merge.mjs <n>`. Wait for the checks in the background. A change to money, concurrency, the schema, or personal data gets the strongest model and also the skill `rule-review`. Load the skill `agent-workflow` (`.agents/skills/agent-workflow/SKILL.md`) for the roles, the review rounds, the coder fallback when quota runs out, and the deploy check.
- Before a pull request that changes a screen, and after each deploy, run the skill `verify-flow`.
- Spend time and tokens on the result: read the files a step needs, and run long commands in the background.

## Never

These keep the work safe. Do not bend them to make work pass:

- Force push, push to `main`, and merging with a failing check.
- Deleting data, a branch, or a cloud resource that this work did not create.
- Writing a secret or a password into code, a log, a commit, or a comment.
- Weakening `pnpm check`, CI, the hooks, or these rules.

## State

Git and the tests hold the state: read `git log --oneline -15` and run `pnpm check`. A criterion with a passing `AC-n` test is done.

`PROGRESS.md` holds the next step. Rewrite it in the same pull request, before the merge.

`HUMAN_DECISIONS.md` holds each decision or step that only the user can do, with the default that agents follow. Add a row when work needs one. Move it to "Đã chốt" when the user answers. Never delete a row.
