---
name: verify-flow
description: Drives the real MONSPORT app in a browser through the booking flows, asserts each state, and saves screenshots as evidence. Use to verify a change, check the flow, or smoke test the app before a pull request that changes a screen, and after a deploy.
---

# verify-flow

Drive the running app through a user flow. Each step asserts a state (an API answer or the DOM) and saves a screenshot. The run ends `PASSED` or `FAILED` and writes `verify-output/<stamp>-<target>/report.md`. Git ignores that folder.

## Run

1. Pick the flows from the table below. A screen change needs the flows that touch that screen. After a deploy, run all flows.
2. Local: run `pnpm db:start`, `pnpm dev:api`, and `pnpm dev:web`. Point `apps/api/.env` at a database with the seed data and every migration (`monsport_preview` locally).
3. Run `node .agents/skills/verify-flow/scripts/run.mjs [flow ...] [--target local|live] [--base-url URL] [--headed]`. No flow name runs all flows.
4. On `FAILED`, open the `-FAIL.png` screenshot and the flow file. Fix the app, or fix the flow when the screen changed on purpose. Run again until `PASSED`.
5. Attach `report.md` and the screenshots of the changed screen to the pull request, or to a comment on it after a deploy.

The run is done when the last line says `PASSED` and each flow you picked has PASS steps. `PASSED (n skipped)` means a flow did not run: a SKIP is not a pass.

## Flows

| Symptom or change | Flow | File |
|---|---|---|
| Login, booking form, price, "Booking của tôi" (UC-3, F-002) | `player-request` | [flows/player-request.md](flows/player-request.md) |
| "Yêu cầu đặt sân", confirm, reject, the player sees the new state (UC-4, F-002) | `owner-decide` | [flows/owner-decide.md](flows/owner-decide.md) |
| Phone booking, "Booking đã xác nhận" (UC-5, F-007) | `phone-booking` | [flows/phone-booking.md](flows/phone-booking.md) |

To add a flow: write `scripts/<flow>.mjs` with one `run.step(...)` for each state change, register it in `FLOWS` in `scripts/run.mjs`, and add a row and a flow file here.

## Targets and accounts

- `local` (default): `http://localhost:5173`. The seed accounts of `apps/api/prisma/seed.ts`: player An `0901234567`, owner Bình `0912345678`, venue "Cầu lông A", court "Sân 1".
- `live`: the "Live at" URL in `PROGRESS.md`. Live passwords are secrets, so the run takes every account from the shell: `VERIFY_OWNER_PHONE`, `VERIFY_OWNER_PASSWORD`, `VERIFY_PLAYER_PHONE`, `VERIFY_PLAYER_PASSWORD`. The player is one reused account named `test-verify`, signed up once in the app. Write these values only in the shell or a password manager.
- `owner-decide` and `phone-booking` on live also need `VERIFY_VENUE` and `VERIFY_COURT` set to a test court of that owner, because they leave or may leave a CONFIRMED booking there. Without them, these flows end with SKIP.
- Live screenshots mask the names and phones of customers and of the signed-in user, because the evidence goes to a public pull request. The report writes an account phone as `<role phone>`.
- The same env vars override the local defaults. `VERIFY_BROWSER` picks a Playwright channel.
- The run deletes nothing. Each run leaves its bookings: one PENDING per `player-request` run, one CONFIRMED and one REJECTED per `owner-decide` run, and one CANCELLED phone booking per `phone-booking` run (CONFIRMED when the run stops before the cancel). A PENDING booking expires 2 hours later (BR-7, BR-8).

## Gotchas

- Time zone: the API answers instants in UTC (`...Z`). The app shows `Asia/Ho_Chi_Minh` (BR-27), and the form sends `+07:00`. Compare instants, never date strings.
- BR-30: 10 logins for each phone and 30 for each IP in 15 minutes. A full run signs in twice (player and owner), and a good login clears only the phone counter. So about 15 full runs from one IP hit the limit. A 429 fails the login step, and the run does not sign in again for that role. Wait 15 minutes. Never clear `AuthThrottle` on the live database.
- Slots: a court holds one PENDING or CONFIRMED booking for each slot (BR-1). The scripts pick a random slot 30 to 365 days ahead, skip the starts the player already has, and take a new slot on a 409.
- Seed data: the seed empties the tables, so it runs only on localhost. Never seed to reset a live run.
- A full-page screenshot draws the sticky "Gửi yêu cầu" or "Lưu booking" bar over the form fields. That is the capture, not a layout bug.
- A select's accessible name ends with its chosen option ("Đơn vị Chọn đơn vị"). Match the label by prefix: `getByLabel(/^Đơn vị/)`.
- Windows: run the commands from the repository root. The scripts build paths with `node:path`, so `\` and `/` both work. The browser is the installed Edge or Chrome (`playwright-core`, no browser download).
