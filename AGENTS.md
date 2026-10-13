# MONSPORT: rules for agents

These rules apply to every coding agent in this repo (Claude Code, Codex, and others). Sections 1 to 4 are adapted from
`forrestchang/andrej-karpathy-skills` (MIT). For a very small task, use judgement instead of every step.

## 1. Think before you code

- State your assumptions. When a request has more than one reading, present the readings and let the user choose.
- When a simpler way exists, say so. Push back when you have a reason.
- A small unclear point: take the simplest reading, record the assumption, and continue.
- An unclear point that touches the data model or a business rule: stop and ask **before you start**.

## 2. Simple first

- Write the minimum code that solves the request. Add a feature, a setting, or an abstraction only when someone asked for it.
- Handle only the errors that can happen.
- When 200 lines can be 50 lines, rewrite them.

## 3. Change only what the task needs

- Every changed line traces back to the request. Leave nearby code, comments, and formatting as they are.
- Keep the existing style of the file.
- Remove only the imports, variables, and functions that your own change made unused. Report dead code that was already there, and leave it in place.
- For a small change, edit locally. Keep the rest of the file.

## 4. Work toward a goal you can verify

- Turn the request into criteria you can check. Bug fix: write a test that reproduces the bug, then make it pass. Refactor: tests are green before and after.
- Multi-step work: state a short plan, with a check for each step.

## 5. Verify for real before you report done

- After a change to runnable code, run the related tests, type-check, or build, then report done. A syntax check is not enough.
- When something cannot run, say what did not run and why.

## 6. Finish the work

- Once you start, complete the whole request before you stop. Stop to ask only when you are blocked, or before an action that is hard to undo.
- Put extra findings (nearby bugs, cleanup, documentation) at the end of your report. Leave them for the user to assign.

## 7. Follow the specification

Project specification: `D:\projectMONSPORT\Plan Project\Markdown\9. ke-hoach-web-app-dat-san-ghep-nguoi-thanh-toan.md`. It is written in Vietnamese.

- Before you code a feature, read its design section (§4), the data model (§5), and the API (§6). The acceptance criteria in §9 are the tests to write.
- A request that conflicts with the specification, or that touches an open decision in §2: stop and ask.
- Work larger than one session: split it into vertical slices (schema → API → UI → test), each one runnable on its own. Write the list to `docs/tien-do.md`, then do the first slice.
- At the start of a session, read `docs/tien-do.md`. After each slice, record which slice is done, which criteria are green, and what comes next.
