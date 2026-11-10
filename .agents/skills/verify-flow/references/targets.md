# Targets and accounts

- `local` (default): `http://localhost:5173` for web and `http://localhost:5180` for mobile. The seed accounts of `apps/api/prisma/seed.ts`: player An `0901234567`, owner Bình `0912345678`, venue "Cầu lông A", court "Sân 1".
- `live`: the "Live at" URL in `PROGRESS.md`. Live passwords are secrets, so the run takes every account from the shell: `VERIFY_OWNER_PHONE`, `VERIFY_OWNER_PASSWORD`, `VERIFY_PLAYER_PHONE`, `VERIFY_PLAYER_PASSWORD`. The player is one reused account named `test-verify`, signed up once in the app. Write these values only in the shell or a password manager.
- `owner-decide`, `phone-booking`, and `mobile-owner-schedule` on live also need `VERIFY_VENUE` and `VERIFY_COURT` set to a test court of that owner, because they leave or may leave a CONFIRMED booking there. Without them, these flows end with SKIP.
- `mobile-owner-revenue` is read-only. It leaves nothing and needs no `VERIFY_VENUE` (it uses it only to pick the venue chip when set).
- `mobile-account` never submits the register form, so it creates no account. Logout only clears its own cookie. `lobby-approval` registers one `test-` account for each run.
- Live screenshots mask the names and phones of customers and of the signed-in user, because the evidence goes to a public pull request. The report writes an account phone as `<role phone>`.
- The same env vars override the local defaults. `VERIFY_BROWSER` picks a Playwright channel.
- The run deletes nothing. Each run leaves its bookings: one PENDING per `player-request` run, one CONFIRMED and one REJECTED per `owner-decide` run, one CANCELLED phone booking per `phone-booking` run, and one CANCELLED phone booking per viewport (two per run: 390x812 and 360x800) in `mobile-owner-schedule` (CONFIRMED when the run stops before the cancel). A PENDING booking expires 2 hours later (BR-7, BR-8).
