# Rule review rubric

The classifier, the verifiers, and the skeptic of `rule-review.workflow.js` read this file.

## Rule catalogue

Two sources give the rules:

- `docs/requirements/business-rules.md`: BR-1 to BR-32. Use the ID and the "Rule Definition" text.
- The repository rules below, from the "Never" list, the Coder role, and the risk list (money, concurrency, schema, personal data) in `AGENTS.md`.

| ID | Rule | Picks it when the diff |
|---|---|---|
| AG-SCOPE | The pull request changes only the paths that its brief or its description allows. | Always. |
| AG-SECRET | No secret or password appears in code, a log line, a fixture, a commit, or a comment. Test values from seed or example files are allowed. | Adds config, env handling, logging, seed data, or auth code. |
| AG-WEAKEN | No change weakens a check: `pnpm check`, `scripts/check.mjs`, CI workflows, git hooks, `.dependency-cruiser.cjs`, `AGENTS.md`, test assertions, or a skipped test. | Touches any of those files, or removes or skips a test. |
| AG-DELETE | No migration or script deletes data, a column, or a table that this work did not create. | Adds a migration, a seed change, or a script that runs SQL. |
| AG-LOCKS | Two transactions that write or lock the same rows take them in one order. Concurrent requests never end in a deadlock (Postgres 40P01), a serialization error, or a 500 where the API promises a 4xx. | Adds or changes a transaction, a `FOR UPDATE` or `FOR SHARE` lock, or an `updateMany` on rows that another route also writes. |

For AG-SCOPE, read the brief that the pull request description links (`docs/briefs/`). The allowed set is the "Paths" column of its "Build order" row for this step, plus the "May edit" line of "Edit boundaries". A `fix/`, `chore/`, or `docs/` pull request lists its paths in the description.

## Verdicts

- `clean`: no path through the code at the pull request head breaks the rule.
- `flag`: one concrete scenario breaks the rule. A scenario names the inputs, the order of requests, and the line where the rule breaks.
- `confirmed`: the skeptic walked the scenario against the real code, and nothing stops it.
- `false_positive`: a line stops the scenario, or the scenario needs a state that cannot occur. The skeptic names that line or that state.

A missing test is not a violation. Style is not a violation. A violation of a different rule belongs to the verifier of that rule.

## Evidence

- Give each finding a `file:line` at the pull request head.
- Quote at most 5 lines of code.
- Look past the hunk. A rule often breaks in a caller, in a lock that another service takes, in a Prisma query in another module, or in a constraint in `apps/api/prisma/schema.prisma` and its migrations.
- For concurrency, write the two transactions step by step: which rows each locks, in which order, and with which lock mode.

## Severity

| Severity | Meaning | Examples |
|---|---|---|
| high | The rule breaks in normal use, or data is lost, wrong, or shown to the wrong person. | Two bookings overlap (BR-1). A wrong price is stored (BR-5, BR-6). A phone number reaches a user who is not the owner or the host (BR-20). A secret is committed. A check is weakened. |
| medium | The rule breaks only under concurrent requests, at a boundary time, on a retry, or on an error path. | A race lets a booking pass its deadline (BR-8). A deadlock or a 500 replaces the correct 4xx. 22:00 is priced as peak (BR-4). |
| low | The rule holds today, but it depends on an unstated assumption, or the failure needs a state that only an operator can create. | The rule depends on the caller taking a lock first. A path exists only after a manual database edit. |

Set `introduced` to true when the diff adds or changes the lines that cause the violation. Set it to false when the cause is older code that the diff only calls or moves. A finding with `introduced: false` does not block the merge. Record it as a next step in `PROGRESS.md`.
