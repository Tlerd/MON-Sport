# MONSPORT

Web app to book sports courts and join matches. Venue owners confirm bookings by hand, and the first version takes no payment. One developer builds it with coding agents. This file is the map for every agent.

## Commands

- `pnpm install`: installs the tools and turns on the git hook.
- `pnpm check`: runs the tests, the type-check, and the import rules. It prints one line when all pass, and the failing lines when one fails.

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
- A change to money, concurrency, or the schema gets a review from a fresh session before merge.
- Record a decision that is costly to reverse as a new file in `docs/adr/`.

## State

Git and the tests hold the state. To see where the work stands, read `git log --oneline -15` and run `pnpm check`. A criterion with a passing `AC-n` test is done.

`PROGRESS.md` holds what they cannot show: the next step and the open decisions. Read it when you start. Rewrite it in place when either changes.
