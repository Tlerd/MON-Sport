# MONSPORT

Web and mobile app to book sports courts, join matches, and pay. One developer builds it with coding agents. This file is the map for every agent.

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

## Specification

`docs/spec/dac-ta-ky-thuat.md`, in Vietnamese, is the source of truth for the technical design (`docs/adr/0001-nguon-su-that-dac-ta.md`). Its table "Quyết định khác bản gốc" overrides the sections below it.

- Code a feature from its brief in `docs/briefs/`. The brief gives the acceptance criteria, the contract, the build order, and the paths you may edit.
- Before you code a feature, read its design (§4), the data model (§5), and the API (§6).
- Give each acceptance criterion a test whose name starts with its label, for example `AC-1`.
- Take the names of tables, types, and fields from §5.
- Ask before you start when a request conflicts with the specification or its brief, or leaves the data model or a business rule unclear.
- A change to money, concurrency, or the schema gets a review from a fresh session before merge.
- Record a decision that is costly to reverse as a new file in `docs/adr/`.

## State

Git and the tests hold the state. To see where the work stands, read `git log --oneline -15` and run `pnpm check`. A criterion with a passing `AC-n` test is done.

`PROGRESS.md` holds what they cannot show: the next step and the open decisions. Read it when you start. Rewrite it in place when either changes.
