# Model routing for Antigravity

AGENTS.md defines the roles. This file maps them to Antigravity models.

- Use only high variants at high effort. Start each CLI run through `node scripts/agy-run.mjs <agy args>`. It runs `claude-opus-5-5-high`, and when that model is out of quota it runs the same task on `gemini-4-argon-high`, then `claude-sonnet-5-5-high`, then `gemini-3.8-flash-high`.
- Planner and Coder: the session model, `gemini-4-argon-high`. When the session model is out of quota, switch the session to the next model of that list and continue.
- A step that changes money, concurrency, the schema, or personal data: get the plan from `node scripts/agy-run.mjs --mode plan -p "<task>. Plan only: list each file to change and each test to write. Do not edit."` before you code.
- Reader: `invoke_subagent` with TypeName `research` and Model `flash`.
- Reviewer: a fresh session, read only:
  `node scripts/agy-run.mjs --mode plan -p "You are the Reviewer in AGENTS.md. Read REVIEW.md first. Read only: do not edit, commit, or push. Review <brief file or pull request #n> in this repository against docs/requirements/intake-monsport-v1.md and its brief. List findings as: severity (high, medium, low) | file:line | problem | fix. Start the summary with a count by severity. End with 'No blocking findings' when none is medium or higher."`
- Plan mode keeps the planner and the reviewer read only. Never give them `--dangerously-skip-permissions`.
- To wait for CI or a scheduled check, use the `schedule` tool, not a sleep loop.
