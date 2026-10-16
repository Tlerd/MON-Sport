# Progress

This file holds what git and the tests cannot show. Rewrite it in place when the next step or an open decision changes. History is in git.

Updated: 2026-10-16

## Current state

- Branch `chore/harness` holds the harness, the technical specification in `docs/spec/`, ADR 0001, and the brief F-001. It is not committed. `pnpm check` passes.
- No application code exists. `apps/` and `packages/` appear with the first feature.
- Not run yet: the CI workflow on GitHub, the Gemini setting, and any Codex session.

## Decisions settled on 2026-10-16

- The technical specification lives in `docs/spec/dac-ta-ky-thuat.md` (ADR 0001).
- D2: the `Booking` table is split out in F-001.
- Prisma 7.10.1.
- `Match` has no court or time columns. They live on `Booking`.

## Open decisions

- None that blocks F-001.

## Next step

1. The user reviews the diff and asks for the commit.
2. Build F-001 (`docs/briefs/F-001-tao-tran-kem-dat-san.md`), starting with pull request 0: the project skeleton.
