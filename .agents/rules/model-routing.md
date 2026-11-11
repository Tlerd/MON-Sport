# Model routing for Antigravity

AGENTS.md defines the roles. This file maps them to Antigravity models.

- Start each CLI run through `node scripts/agy-run.mjs <agy args>`. It runs `claude-sonnet-5-5-medium` at medium effort, and when that model is out of quota it runs the same task on `claude-opus-5-5-high`, then `gemini-4-argon-high`, then `claude-sonnet-5-5-high`, then `gemini-3.8-flash-high`, each at high effort.
- Planner and Coder: the session model, `gemini-4-argon-high`. When the session model is out of quota, switch the session to the next model of that list and continue.
- A step that changes money, concurrency, the schema, or personal data: get the plan from `node scripts/agy-run.mjs --strong-only --mode plan -p "<task>. Plan only: list each file to change and each test to write. Do not edit."` before you code.
- Reader: `invoke_subagent` with TypeName `research` and Model `flash`.
- Tester: `invoke_subagent` with Model `flash` (`gemini-3.8-flash-high`). It runs `pnpm check` and verify-flow, and reports. It never writes code. Code always runs on the session model.
- Swarm: `/swarm` runs only on `gemini-3.8-flash-high`, for every worker and the verifier, and only as "Swarm step (agy 3.8)" in `.agents/skills/agent-workflow/SKILL.md` says.
- Coders: one coder does a step by default. Run a backend and a frontend subagent at the same time only when the contract in `packages/shared` is already on the branch and their paths do not overlap. Then the tester, then the Reviewer.
- Usage: run `node scripts/agy-run.mjs --check-usage` at the start of each task, and before each new branch. Exit 3 means the weekly Claude limit passed 94%: commit, write the next step in `PROGRESS.md`, and stop. `agy-run.mjs` refuses every other run past that line too.
- Reviewer: a fresh session on a strong model (`--strong-only`: Opus or Argon, never a weaker one), read only:
  `node scripts/agy-run.mjs --strong-only --mode plan -p "You are the Reviewer in AGENTS.md. Read REVIEW.md first. Read only: do not edit, commit, or push. Review <brief file or pull request #n> in this repository against docs/requirements/intake-monsport-v1.md and its brief. List findings as: severity (high, medium, low) | file:line | problem | fix. Start the summary with a count by severity. End with 'No blocking findings' when none is medium or higher."`
- Plan mode keeps the planner and the reviewer read only. Never give them `--dangerously-skip-permissions`.
- To wait for CI or a scheduled check, use the `schedule` tool, not a sleep loop.
- "Fix ladder" in `.agents/skills/agent-workflow/SKILL.md` is for Claude Code sessions. In Antigravity, when `pnpm check` fails after a coding step, retry once on the session model, then hand the step back to Claude Code with the failing lines. Exit 3 still stops the run.
- Claude Code is the Planner and the Reviewer, and it sends each coding step here through `node scripts/agy-run.mjs`. Exit 4 means every agy model is out of quota, and Claude Code then codes the step on Sonnet or Haiku.
- Keep the task list of the run, and mark each item done. At the end of each turn, read the list again, and do each open item that nothing blocks. Time matters: do not spend time that can be avoided.
