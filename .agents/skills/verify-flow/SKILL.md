---
name: verify-flow
description: Drives the real MONSPORT app in a browser through the booking flows, asserts each state, and saves screenshots as evidence. Use to verify a change, check the flow, or smoke test the app before a pull request that changes a screen, and after a deploy.
---

# verify-flow

Drive the running app through a user flow. Each step asserts a state (an API answer or the DOM) and saves a screenshot. The run ends `PASSED` or `FAILED` and writes `verify-output/<stamp>-<target>/report.md`. Git ignores that folder.

## Read first

- On `live`, the run deletes nothing and leaves test bookings. Never seed or clear `AuthThrottle` on the live database.
- On `live`, take every account from the shell variables in [references/targets.md](references/targets.md). Never write a password in a file.
- `PASSED (n skipped)` means a flow did not run. A SKIP is not a pass.
- A 429 on login is BR-30. Wait 15 minutes. See [references/gotchas.md](references/gotchas.md).
- More failures that need a person: [references/gotchas.md](references/gotchas.md).

## Run

1. Pick the flows from the table below. A screen change needs the flows that touch that screen. After a deploy, run all flows.
2. Local: run `pnpm db:start`, `pnpm dev:api`, and `pnpm dev:web`. Point `apps/api/.env` at a database with the seed data and every migration (`monsport_preview` locally).
3. Run `node .agents/skills/verify-flow/scripts/run.mjs [flow ...] [--app web|mobile] [--target local|live] [--base-url URL] [--headed]`. No flow name runs all flows for that app (`web` flows by default, `mobile-shell` for `mobile`).
4. On `FAILED`, open the `-FAIL.png` screenshot and the flow file. Fix the app, or fix the flow when the screen changed on purpose. Run again until `PASSED`.
5. Attach `report.md` and the screenshots of the changed screen to the pull request, or to a comment on it after a deploy.

The run is done when the last line says `PASSED` and each flow you picked has PASS steps.

## Flows

| Symptom or change | Flow | File |
|---|---|---|
| Login, booking form, price, "Booking của tôi" (UC-3, F-002) | `player-request` | [references/flows/player-request.md](references/flows/player-request.md) |
| "Yêu cầu đặt sân", confirm, reject, the player sees the new state (UC-4, F-002) | `owner-decide` | [references/flows/owner-decide.md](references/flows/owner-decide.md) |
| Phone booking, schedule grid (UC-5, F-007) | `phone-booking` | [references/flows/phone-booking.md](references/flows/phone-booking.md) |
| Mobile shell, tab bar scroll and hide/show (F-019) | `mobile-shell` | [references/flows/mobile-shell.md](references/flows/mobile-shell.md) |
| Mobile booking tab, venue slot rows, request sheet (UC-2, UC-3, F-020) | `mobile-book` | [references/flows/mobile-book.md](references/flows/mobile-book.md) |
| Mobile "Lịch của tôi" tabs, booking cancel (UC-6, UC-8, F-021) | `mobile-history` | [references/flows/mobile-history.md](references/flows/mobile-history.md) |
| Mobile "Mở trận", "Phòng chờ" tab (UC-7, UC-8, UC-9, F-022) | `mobile-lobby` | [references/flows/mobile-lobby.md](references/flows/mobile-lobby.md) |
| Mobile owner "Thông báo" tab (UC-14, F-023) | `mobile-notifications` | [references/flows/mobile-notifications.md](references/flows/mobile-notifications.md) |
| Mobile owner "Yêu cầu" tab, confirm and reject (UC-4, F-024) | `mobile-owner-requests` | [references/flows/mobile-owner-requests.md](references/flows/mobile-owner-requests.md) |

To add a flow: write `scripts/<flow>.mjs` with one `run.step(...)` for each state change, register it in `FLOWS` in `scripts/run.mjs`, and add a row to this table and a flow file in `references/flows/`.

## Files

- `scripts/`: `run.mjs` starts a run. `lib.mjs` holds the shared steps. One `<flow>.mjs` for each flow.
- `references/flows/`: what each flow checks.
- `references/targets.md`: targets, accounts, environment variables, and what a run leaves behind.
- `references/gotchas.md`: known failures and their fixes.
