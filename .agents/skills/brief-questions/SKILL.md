---
name: brief-questions
description: Ask the owner only the questions that need the owner, without stopping the work. Use before the skill feature-brief, after a feature is built, and when the owner says "brainstorm" or "bóc tách".
---

The owner changes their mind. So the agent never waits. It answers what it can, picks a default for the rest, records each default, and goes on.

## Steps

1. **List the unknowns.** Read the intake, the ADRs, `PROGRESS.md`, and the code. Write each unknown as a question in 5 groups: the problem, the user, the hard limits, the edge cases and exclusions, the measure of success.

2. **Answer from the sources.** When a document or the code answers a question, write the answer and its source. Do not ask the owner.

3. **Sort the rest by cost to change.**
   - Cheap (a label, an order, a screen detail): pick the safer option. Write it under `Assumptions` with the reason and the one line to change.
   - Costly (money, schema, personal data, legal text, a public rule): write it under `Open questions` with the default and the owner.

4. **Do not stop.** Build with the defaults. Build first the parts that do not depend on an open costly question. Stop only when one question blocks every acceptance criterion.

5. **Run the `qa` subagent after the build.** It compares the intent with the product and returns at most 8 questions. Send the questions to the owner in one list, in Vietnamese. Each question has a default. The owner answers when they want. Work continues on the defaults.

6. **Apply an answer as a one-line change.** Update the brief, the code, and the `Assumptions` entry in one pull request.

## Optional: six lenses

Run this only when the work touches money, concurrency, the schema, or personal data. Run six `reviewer` subagents in parallel with the lenses YAGNI, cost, UX, migration, observability, and maintenance. Each returns at most 5 findings with a file path. It costs about 240k tokens. Merge the findings into `Assumptions` and `Open questions`.

## Model

Only Opus asks. The `qa` subagent runs on Opus and has no fallback model. In a trial on F-020, Opus found 3 real defects that Sonnet and Haiku missed, and it asked no question that a document already answers. When Opus is out of quota, skip the step and say so in the end report.
