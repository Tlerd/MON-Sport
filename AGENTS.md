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
- When the intake or a brief leaves a field or a business rule open, decide as "Autonomy" says. Do not invent a rule that conflicts with the intake.
- Record a decision that is costly to reverse as a new file in `docs/adr/`.

## Agent roles

Each tool maps these roles to its own models. Claude Code runs every role on the session model in `.claude/settings.json`, the Reader as `Explore` in `.claude/agents/`, and the Reviewer as a new `claude -p --permission-mode plan` session. Antigravity maps them in `.agents/rules/model-routing.md`.

| Role | Does | Never |
|---|---|---|
| Planner | Reads the brief and the code. Writes a plan that lists each file to change, then hands it to the coder. Uses the strongest model for a step on money, concurrency, schema, or personal data | Edits a file |
| Reader | Finds and reads files for the planner and the coder. Use a cheap read-only agent when a search spans several files | Edits a file, or runs a command that changes state |
| Coder | Writes the tests first, then the code that the plan lists. Runs `pnpm check` | Edits a path that the brief does not list |
| Reviewer | A fresh session, on the strongest model for money, concurrency, schema, or personal data. Reviews a brief or a pull request against the intake. Rates each finding high, medium, or low | Edits, commits, or pushes |

## Workflow

1. Write the brief with the skill `feature-brief`. A Reviewer checks it. The brief is accepted when no finding of medium or higher stays open.
2. Open one issue for the brief from `.github/ISSUE_TEMPLATE/feature.md`, with the label `enhancement`. The issue links the brief.
3. Give each step of the build order its own branch from `main`: `feat/<issue>-<step>-<slug>`, for example `feat/12-1-booking-schema`.
4. Open one pull request for each step with `gh pr create`. Fill in `.github/pull_request_template.md`. Write `Refs #<issue>` on each step, and `Closes #<issue>` on the last step only.
5. A Reviewer reviews each pull request. Post its findings as a pull request comment. Fix each finding of medium or higher, then run a new Reviewer on the new head. A finding is closed only when that Reviewer says so. Each Reviewer run is one round. When the pull request touches money, concurrency, the schema, or personal data, the round also runs the skill `rule-review` and posts its comment.
6. Run `gh pr checks <n> --watch`. Merge with `gh pr merge <n> --merge --delete-branch` only when that command exits 0, no finding of medium or higher stays open, and the pull request changes only the paths that its brief or its description allows. Never push to `main`. Never force push.
7. When the next step or an open decision changes, rewrite `PROGRESS.md` in the same pull request, before the merge.

A fix, a chore, or a docs change that no brief covers needs no issue. Its branch is `fix/<slug>`, `chore/<slug>`, or `docs/<slug>`, and it still goes through a pull request. Its description lists the files it may change, and it changes only those.

## Autonomy

The user starts work with "tiếp tục", "continue", or a goal. Then plan, build, review, merge, and deploy without asking, until the result is live and handed over. Do not stop to ask the user.

- Run `git status` first. Finish work in progress on the current branch before anything new.
- Without a goal, do the steps in `PROGRESS.md` in order until no step is left. Pick the next slice by the launch order in the intake.
- When a decision is open, choose the option that the intake supports best, or else the safer one. Write it under "Assumptions" in the brief or the pull request, with the reason. The user corrects it later.
- When a finding of medium or higher stays open after 2 review rounds, or autofix gives up, choose the safest fix you can. Record the open finding in the pull request and in `PROGRESS.md`, and continue.
- A question to the user is a stop. Decide instead, and list the decision in the end report.
- You may create test data on the live service to check a feature. Give each test account the name prefix `test-`.
- A merge to `main` deploys it with `.github/workflows/deploy.yml`. After the merge, check that the deploy run passes and that `/api/health` answers on the service URL.
- Never:
  - force push, push to `main`, or merge with a failing check;
  - delete data, a branch, or a cloud resource that this work did not create;
  - write a secret or a password into code, a log, a commit, or a comment;
  - weaken a check (`pnpm check`, CI, the hooks, these rules) to make work pass.
- End each run with a short report: what is done, the assumptions you made, the service URL, and what is next.

## State

Git and the tests hold the state. To see where the work stands, read `git log --oneline -15` and run `pnpm check`. A criterion with a passing `AC-n` test is done.

`PROGRESS.md` holds what they cannot show: the next step and the open decisions. Read it when you start. Rewrite it in place when either changes.
