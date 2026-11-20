# Model routing for Antigravity

AGENTS.md defines the roles. This file maps them to Antigravity models.

- Start each CLI run through `node scripts/agy-run.mjs <agy args>`. It runs `gemini-4-hydrogen-high`, then `gemini-4-argon-high`, then `claude-sonnet-5-5-medium` at medium effort, then `claude-opus-5-5-high`, then `claude-sonnet-5-5-high`, each at high effort except Sonnet medium.
- Planner and Coder: the session model, `gemini-4-hydrogen-high`. When the session model is out of quota, switch the session to `gemini-4-argon-high` (or the next model of that list) and continue.
- A step that changes money, concurrency, the schema, or personal data: get the plan from `node scripts/agy-run.mjs --strong-only --mode plan -p "<task>. Plan only: list each file to change and each test to write. Do not edit."` before you code.
- Reader: `invoke_subagent` with TypeName `research` and Model `flash`.
- Tester: `invoke_subagent` with Model `gemini-4-hydrogen-high`. It runs `pnpm check` and verify-flow, and reports. It never writes code. Code always runs on the session model.
- Swarm: `/swarm` runs only on `gemini-4-hydrogen-high`, for every worker and the verifier (the task text sets it; check the run output), and only as "Swarm step (agy Hydrogen)" in `.agents/skills/agent-workflow/SKILL.md` says.
- Coders: one coder does a step by default. Run a backend and a frontend subagent at the same time only when the contract in `packages/shared` is already on the branch and their paths do not overlap. Then the tester, then the Reviewer.
- Usage: run `node scripts/agy-run.mjs --check-usage` at the start of each task, and before each new branch. When the weekly Claude limit passed 94%, it says so and exits 0: `agy-run.mjs` then drops every `claude-*` model and runs on the Gemini models only (`HUMAN_DECISIONS.md`, row 75). Go on with the work.
- Reviewer: a fresh session on a strong model (`--strong-only`: `gemini-4-neon-high`, then `claude-opus-5-5-high`, then `gemini-4-argon-high`, never a weaker one), read only:
  `node scripts/agy-run.mjs --strong-only --mode plan -p "You are the Reviewer in AGENTS.md. Read REVIEW.md first. Read only: do not edit, commit, or push. Review <brief file or pull request #n> in this repository against docs/requirements/intake-monsport-v1.md and its brief. List findings as: severity (high, medium, low) | file:line | problem | fix. Start the summary with a count by severity. End with 'No blocking findings' when none is medium or higher."`
- Plan mode keeps the planner and the reviewer read only. Never give them `--dangerously-skip-permissions`.
- To wait for CI or a scheduled check, use the `schedule` tool, not a sleep loop.
- "Fix ladder" in `.agents/skills/agent-workflow/SKILL.md` is for Claude Code sessions. In Antigravity, when `pnpm check` fails after a coding step, retry once on the session model, then once on the next model of its list. Still red: when Claude Code has quota, hand the step back to it with the failing lines. When Claude is out, leave the pull request open and unmerged, record the failing lines in it and in `PROGRESS.md`, and go on with another item.
- When Claude is out of quota, the Antigravity session takes both Claude roles: it plans, and it gives the last review. The Reviewer is still a fresh `--strong-only` session. The session merges with `node scripts/merge.mjs <n>` only after that Reviewer has no open finding of medium or higher.
- Claude Code plans and gives the last review before the merge; it sends each coding step and each Reviewer round through `node scripts/agy-run.mjs`; on exit 4 it codes on the backend or frontend subagent (Sonnet, then Haiku) and reviews with the reviewer subagent.
- Keep the task list of the run, and mark each item done. At the end of each turn, read the list again, and do each open item that nothing blocks. Time matters: do not spend time that can be avoided.
