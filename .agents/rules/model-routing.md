# Model routing for Antigravity

AGENTS.md defines the roles. This file maps them to Antigravity models.

- Planner and Coder: the session model, `gemini-4-argon-medium`.
- A step that changes money, concurrency, the schema, or personal data: get the plan from `agy --model gemini-4-argon-high --dangerously-skip-permissions -p "<task>. Plan only: list each file to change and each test to write. Do not edit."` before you code.
- Reader: `invoke_subagent` with TypeName `research` and Model `flash`.
- Reviewer: a fresh session on the strongest model. Read only:
  `agy --model claude-opus-5-5-high --dangerously-skip-permissions -p "You are the Reviewer in AGENTS.md. Read only: do not edit, commit, or push. Review <brief file or pull request #n> in D:\MON-Sport against docs/requirements/intake-monsport-v1.md and its brief. List findings as: severity (high, medium, low) | file:line | problem | fix. End with 'No blocking findings' when none is medium or higher."`
- To wait for CI or a scheduled check, use the `schedule` tool, not a sleep loop.
