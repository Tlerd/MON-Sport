# MONSPORT

Web app to book sports courts and join matches. Venue owners confirm bookings by hand, and the first version takes no payment. One developer builds it with coding agents. This file is the map for every agent.

## Commands

- `pnpm install`: installs the tools and turns on the git hook.
- `pnpm check`: runs the tests, the type-check, the import rules, and the secret scan (gitleaks, `.gitleaks.toml`). One line when all pass, the failing lines when one fails.
- `pnpm dev:api` and `pnpm dev:web`: start the API on port 3000 and the web app, which sends `/api` to the API.
- `pnpm db:start`: starts the local Postgres on port 55432. Copy `apps/api/.env.example` to `apps/api/.env`. The API tests need it.
- `pnpm db:sql "<sql>" [--db <name>]` or `pnpm db:sql --file <path> [--db <name>]`: runs psql on the local Postgres of `pnpm db:start` (`DATABASE_URL` from `apps/api/.env`). It refuses any host that is not local, any port but 55432, and URL options. Use it to read or seed local data fast, for example `--db monsport_preview` before a `verify-flow` run. Never point it at Cloud SQL.
- `pnpm map`: rewrites `@map.md`, the list of code files with their exported names. Read it to find a file. `pnpm check` fails when it is stale.
- `pnpm maintain`: checks CI and live signals (`--dry-run`, `--once`), logs breaches, and opens or updates `maintain` issues.
- `pnpm graph`: rebuilds the code graph in `graphify-out/` (10 to 20 s, no LLM). It needs `uv tool install graphifyy` once, and it is optional. A session that may write runs it before it traces code. A read-only session queries the graph that is there. `graphify explain "<name>"` lists the callers and imports of a function, a class, or a hook, with file and line. `graphify path "<A>" "<B>"` shows how two names connect. Use `grep` for literal text. Skip free-text `graphify query`: its answers are long and noisy.

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

- Start each test name with its criterion label, for example `AC-1: ...`.
- Use the terms of the table "Tên gọi" in the intake. Take table, type, and field names from the data model in `docs/requirements/` when it exists.
- Other documents in `docs/requirements/` derive from the intake (`docs/adr/0002-nguon-su-that-intake.md`). Do not invent a rule that conflicts with it.
- Diagrams: skill `ba-diagrams` (Mermaid). An animated flow diagram outside requirements documents: 200Lab skill `diagram-director`, saved as `docs/diagrams/<name>.html` with `<name>.sheet.md` beside it. Without it, a Mermaid `sequenceDiagram`.

## Code

`pnpm check` enforces each rule marked (check), through `harness/code-rules.test.mjs` and `harness/source-size.test.mjs`.

- Write no code comment in a source file that is not a test (check). A name or a test carries the meaning. Lint and type directives are the only exception.
- Use no `any` and no `as unknown as` (check). Narrow an `unknown` value with a type guard or `instanceof`.
- Catch an error only to change the result: a message, a status, a retry, a fallback value, or a cleanup. An empty catch, or a catch that only rethrows, fails the check. Best-effort cleanup (closing a connection, a storage write) may end in `.catch(() => undefined)`.
- API: run a transaction that can deadlock through `retryOnDeadlock` or `conflictOnDeadlock` in `apps/api/src/modules/database/prisma.service.ts` (check). Do not copy the catch block.
- Web and mobile: call the API through `api()` in `packages/client`. Turn an error into text with `errorMessage` (check). Run a user action through the `useAction` hook of the app.
- Keep each source file that is not a test at 300 lines or fewer (check). Split a long file by hook, part, or service.
- `apps/web/src/app/` holds routes, providers, and thin wrappers. A page that loads data lives in a feature folder.

## Autonomy

The user starts work with "tiếp tục", "continue", or a goal. Take it to a pull request that is ready to merge: plan, build, review, checks green. The user is not there to answer, so a question stops the work. Decide, and let the user correct later.

An agent merges a ready pull request with `node scripts/merge.mjs <n>` only, in merge order (`HUMAN_DECISIONS.md`, row 50). The script refuses a red check or a missing review marker. The merge deploys. After a merge, check the deploy run and the live service. Fix a failure in a new pull request.

- Start with `git status`, `PROGRESS.md`, and `HUMAN_DECISIONS.md`. Finish work in progress first. Without a goal, do the steps in `PROGRESS.md` in order, then the next slice by the launch order in the intake.
- Keep a task list for the run and mark items done. Stop only when the next item needs the user, or a rule here stops you. A turn that ends with a summary, an offer to continue, or a list of decisions that block nothing leaves work undone. A step only the user can do goes in `PROGRESS.md`; go on with the other items.
- End each run with a short report: what is done, the pull requests merged, each one still open with the reason, the assumptions, the service URL, what is next.
- When the intake or a brief leaves a decision open, choose what the intake supports best, or else the safer option. Write it under "Assumptions" with the reason. Record a decision that is costly to reverse in `docs/adr/`.
- A finding of medium or higher still open after 2 review rounds: choose the safest fix, record the finding in the pull request and `PROGRESS.md`, post `<!-- review-accepted head=<sha> -->` on the pull request, and continue.
- Each step of a brief gets its own branch `feat/<issue>-<step>-<slug>` (for example `feat/12-1-booking-schema`), its own pull request, and a Reviewer. A step that needs an unmerged step branches from that step's branch and uses it as the pull request base. Wait for the checks in the background. A change to money, concurrency, the schema, or personal data gets the strongest model and also the skill `rule-review`. Load the skill `agent-workflow` (`.agents/skills/agent-workflow/SKILL.md`) for the roles, the review rounds, the coder fallback when quota runs out, and the deploy check.
- A pull request that changes only `docs/**/*.md`, `PROGRESS.md`, `COMPLETED.md`, `HUMAN_DECISIONS.md`, or `README.md` skips the agy Reviewer: the session model reads the diff and posts the marker (`HUMAN_DECISIONS.md`, row 74). Every other file still gets a Reviewer.
- Before a pull request that changes a screen, run the skill `verify-flow` locally. After a deploy, check the deploy run and `/api/health`; the owner runs `verify-flow` on live (`HUMAN_DECISIONS.md`).
- Spend time and tokens on the result: read the files a step needs, and run long commands in the background.

## Agent roles

The session model is the Planner, and it gives the last review of each pull request before the merge. agy on `gemini-4-neon-high` is the Reviewer, and agy codes, Hydrogen first. The skill `agent-workflow` holds the coder order, the review rounds, and the fallbacks.

| Role | Does | Never |
|---|---|---|
| Planner | Reads the brief and the code. Writes a plan that lists each file to change | Edits a file |
| Reader | Finds and reads files. Use the cheap read-only `Explore` agent for a search over several files | Edits a file, or changes state |
| Coder | Writes the tests first, then the code the plan lists. Runs `pnpm check` | Edits a path the brief does not list |
| Reviewer | A fresh agy session on `gemini-4-neon-high` (`node scripts/agy-run.mjs --strong-only --mode plan`). Reads `REVIEW.md` first. Rates each finding high, medium, or low | Edits, commits, or pushes |
| Last review | The session model. Reads the Reviewer output and the diff, decides each finding, posts the review with its marker, then merges | Writes the code |

## Never

These keep the work safe. Do not bend them to make work pass:

- Force push, push to `main`, and a merge by any way other than `node scripts/merge.mjs` (no `gh pr merge`, no `--admin`).
- Deleting data, a branch, or a cloud resource that this work did not create.
- Writing a secret or a password into code, a log, a commit, or a comment.
- Weakening `pnpm check`, CI, the hooks, or these rules.

## State

Git and the tests hold the state: read `git log --oneline -15` and run `pnpm check`. A criterion with a passing `AC-n` test is done.

`PROGRESS.md` holds the next step. Rewrite it in place when the next step changes, in the same pull request, before the merge. When a feature is done, move its record to `COMPLETED.md`.

`HUMAN_DECISIONS.md` holds each decision or step that only the user can do, with the default that agents follow. Add a row when work needs one. Move it to "Đã chốt" when the user answers, in the same pull request. Never delete a row.
