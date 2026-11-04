---
name: rule-review
description: Rule-by-rule review of a pull request diff against the business rules BR-1 to BR-32 and the AG-* rules of `references/rubric.md` (the "Never" list of AGENTS.md, path scope, lock order). A dynamic workflow runs one verifier agent per relevant rule, then one skeptic agent per flag, and returns a comment for `gh pr comment`. Use for a rule review, to check business rules, for a BR check, or in the Reviewer round of a pull request that touches money, concurrency, the schema, or personal data.
---

# Rule review

This skill checks a pull request one rule at a time. Each rule gets its own agent with a clean context. A skeptic agent then tries to refute each flag. Only confirmed violations reach the comment.

## Read first

- Run it only for money, concurrency, the schema, or personal data. It starts one agent per rule and one per flag. A 550-line diff with 21 rules ran 23 agents and used about 2 million subagent tokens, and took 3 minutes.
- It adds to the fresh Reviewer session. It does not replace it.
- A finding under "Older than this change" is pre-existing. It does not block the merge.

## When to use it

Use it in the Reviewer round (`AGENTS.md`, Workflow step 5) for a pull request that touches one of these:

- money: prices, revenue, `bookingPrice`;
- concurrency: row locks, transactions, status changes that two requests can race;
- the schema: `apps/api/prisma/`, migrations;
- personal data: phone numbers, names, consent, sessions.

Do not run it on a screen-only or docs-only pull request. The cost and the Reviewer-session rule are in "Read first".

## Steps

1. Pick the input:
   - a pull request: `{ "pr": <n> }`;
   - a local range: `{ "range": "origin/main..HEAD" }`.
   Add `"rules": ["BR-1", "BR-8"]` to check only those rules. Add `"head": "<sha>"` when the working tree is not at the pull request head. Get the sha with `gh pr view <n> --json headRefOid`, then run `git fetch origin pull/<n>/head`.
2. Call the Workflow tool with `scriptPath` set to `.claude/skills/rule-review/scripts/rule-review.workflow.js` and `args` set to the input. Calling this skill is the opt-in that the Workflow tool asks for.
3. Read the result. `comment` holds the markdown. `counts`, `confirmed`, and `dismissed` hold the data.
4. Write `comment` to a file in the scratchpad, then post it with `gh pr comment <n> --body-file <file>`.
5. Treat each confirmed finding that this change introduced as a Reviewer finding of its severity, under the merge rule in `AGENTS.md` Workflow step 6.
6. A finding under "Older than this change" is pre-existing. As `REVIEW.md` says, it does not block the merge. Record each one of medium or higher in `PROGRESS.md` as a next step, in the same pull request. Add `PROGRESS.md` to the paths in the pull request description when it is not there.

## Adapt the template

The workflow file is a template. Change a copy of it when the task needs a different shape:

- Many rules on a small diff: pass `rules` to skip the classifier.
- A large diff: split the rules into groups, or set `model: 'sonnet'` on the verifiers.
- A hard concurrency finding: run 3 skeptics on it and keep the majority.

Pass the changed copy as `script`, or write it to the scratchpad and pass its path as `scriptPath`. Keep `references/rubric.md` as the one source of the verdicts and the severity scale.

## Files

- `scripts/rule-review.workflow.js`: the workflow. Classify (Haiku), verify (session model), skeptic (Opus).
- `references/rubric.md`: the AG-* rules, the verdicts, the evidence standard, and the severity scale.
