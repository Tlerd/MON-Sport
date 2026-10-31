# Gotchas

Add a line here each time a run fails for a reason that only a person could fix.

- Time zone: the API answers instants in UTC (`...Z`). The app shows `Asia/Ho_Chi_Minh` (BR-27), and the form sends `+07:00`. Compare instants, never date strings.
- BR-30: 10 logins for each phone and 30 for each IP in 15 minutes. A full run signs in twice (player and owner), and a good login clears only the phone counter. So about 15 full runs from one IP hit the limit. A 429 fails the login step, and the run does not sign in again for that role. Wait 15 minutes. Never clear `AuthThrottle` on the live database.
- Slots: a court holds one PENDING or CONFIRMED booking for each slot (BR-1). The scripts pick a random slot 30 to 365 days ahead, skip the starts the player already has, and take a new slot on a 409.
- Seed data: the seed empties the tables, so it runs only on localhost. Never seed to reset a live run.
- A full-page screenshot draws the sticky "Gửi yêu cầu" or "Lưu booking" bar over the form fields. That is the capture, not a layout bug.
- A select's accessible name ends with its chosen option ("Đơn vị Chọn đơn vị"). Match the label by prefix: `getByLabel(/^Đơn vị/)`.
- Windows: run the commands from the repository root. The scripts build paths with `node:path`, so `\` and `/` both work. The browser is the installed Edge or Chrome (`playwright-core`, no browser download).
