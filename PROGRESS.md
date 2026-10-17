# Progress

This file holds what git and the tests cannot show. Rewrite it in place when the next step or an open decision changes. History is in git. Updated: 2026-10-17 (fix: expire lock order).

## Current state

- `main` holds the intake (ADR 0002), the requirements documents (glossary, BR-1 to BR-32, UC-1 to UC-14, data dictionary, models), the agent roles, the workflow, and the issue and PR templates.
- F-002 is done (issue #5 closed): login with seed accounts, `GET /api/venues`, booking requests, owner confirm and reject, and the screens. AC-1 to AC-21 pass. PRs #6, #7, #8, #9, #10.
- F-003 is done (issue #20): sign-up with consent (`User.consentAt`, BR-29), the admin screen (owners, venues, courts, lock and unlock), and "Đơn vị của tôi" for owners. AC-1 to AC-30 pass. PRs #19 (brief), #21, #22, #23, #24, #25.
- F-006 is done (issue #29, PRs #28, #30, #31; brief `docs/briefs/F-006-gioi-han-dang-nhap-va-thu-hoi-phien.md`): login and sign-up limits per phone and per IP in the shared table `AuthThrottle` (BR-30), the weak-password check for new passwords (BR-31), and `User.sessionsValidFrom`, so an admin unlock revokes older sessions (BR-32). The IP is the last `X-Forwarded-For` entry (`trust proxy` = 1). A proxy in front of Cloud Run must change that. The live check on 2026-10-17 passed (comment on PR #31). AC-1 to AC-17 pass.
- F-005 is done (issue #35, PRs #34 (brief), #36, #37; brief `docs/briefs/F-005-chu-san-sua-gia-va-gio-mo-cua.md`): an owner edits the opening hours of own venues (`PATCH /api/owner/venues/:id`) and the prices of their courts (`PATCH /api/owner/courts/:id`) on "Đơn vị của tôi". A booking request reads the price and the hours after the `Court` lock (BR-6). AC-1 to AC-15 pass.
- F-007 is done (issue #39, PRs #38 (brief), #40, and step 2; brief `docs/briefs/F-007-chu-san-nhap-booking-khach-goi-dien.md`): an owner enters the booking of a customer who phoned (`POST /api/owner/bookings`, "Đã xác nhận" at once) and cancels it before its start (`POST /api/owner/bookings/:id/cancel`). The owner screen has the form "Nhập booking khách gọi điện" and the list "Booking đã xác nhận". AC-1 to AC-18 pass.
- Remove `minimumReleaseAgeExclude` from `pnpm-workspace.yaml` when Prisma 7.10.1 passes the release-age gate.
- Live at https://monsport-774323404592.asia-southeast1.run.app (Cloud Run + Cloud SQL, demo seed data). Each merge to `main` deploys through `.github/workflows/deploy.yml`.
- Local development uses its own Postgres 18 cluster on `localhost:55432` (`pnpm db:start`, data in `%LOCALAPPDATA%/monsport/pgdata`). Start it again after a reboot. The cluster runs `Asia/Bangkok`, so `PrismaService` sets `TimeZone=UTC` on each connection (Cloud SQL runs UTC). The local database `monsport_dev` needs `prisma migrate reset` before it takes the F-003 and F-006 migrations, because migration f003 changed after it ran there. The reset deletes its data, so the agent left it. `monsport_preview` holds the seed data and every migration.
- The usage guard (`D:/REPO_GITHUB_TRY/usage-guard`) pauses at 95% of the 5-hour window. At the reset, a scheduled `claude -p "tiếp tục làm"` continues the work, and it reschedules itself when it hits a limit. The desktop app does not write `state.json`, so the agent writes it from the app usage data.

## Decisions settled on 2026-10-16

- `docs/requirements/intake-monsport-v1.md` is the source of truth (ADR 0002).
- The stack: NestJS 12, React 19 + Vite 8, PostgreSQL (18 locally and in CI), Prisma 7 from pull request 1, Zod 4, SSE for real-time updates.
- The API is ESM and builds with SWC, because Nest needs decorator metadata. `packages/shared` ships TypeScript source.
- Agents work without asking, under "Autonomy" in `AGENTS.md`. Claude Code: Opus, `acceptEdits`, and `Explore` on Haiku. Antigravity: `.agents/rules/model-routing.md`.

## Open decisions

1. The number of courts at each venue, the football court size, and the city. Owner: the user.
2. The pilot date. Owner: the user.
3. Bookings per day after 6 months. Owner: the user.
4. Whether Luật 91/2025 requires more than the consent box and the notice that F-003 ships (`PRIVACY_NOTICE` in `packages/shared/src/account.ts`), and the final text of the notice. Owner: the user, with a legal adviser.
5. Whether the Google Cloud trial becomes production. It runs on Cloud Run and Cloud SQL (ADR 0003, `docs/deploy-gcp.md`). Owner: the user.
6. Whether owner data needs its own consent, or the contract with the venue covers it. Until account deletion ships, the admin handles deletion requests by hand. Owner: the user.
7. Whether to build Google sign-in (F-004, plan in `docs/briefs/F-004-dang-nhap-google.md`). Build it only when the user, in their own message, adds it to the intake or writes "chấp nhận F-004", and has done the console steps of that brief. "tiếp tục" is not acceptance. Agents never close this decision under "Autonomy". Record the date and a quote of that message here. F-004 `link-start` calls `ThrottleService.consumeLogin` with the phone of the signed-in user (brief F-006). Owner: the user.
8. Whether the limits of BR-30 suit venues where players share one Wi-Fi. Check after the first pilot week. Owner: the user.

## Next step

1. F-008: the rest of UC-2. F-002 shipped only the short booking form. Still open: the free hours of a day with "Gọi chủ sân" (2.0 step 5), the search by court name (2.1), and 2.0.E1. Write its brief with `feature-brief`.
2. F-009: UC-6, a user cancels a booking and sees the booking history. Write its brief with `feature-brief`.
3. Low findings to fix in the next pull request that edits the file: a failed cancel on "Booking đã xác nhận" leaves the focus on the page body (PR #41, `PhoneBookings.tsx`). A rare 40P01 stays between the owner list and an insert (PR #45, comment on `BookingsService.expire`). A retry of the expire in `forOwner` closes it.
