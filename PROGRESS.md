# Progress

This file holds what git and the tests cannot show. Rewrite it in place when the next step or an open decision changes. History is in git. Updated: 2026-10-20 (F-016 step 3).

## Current state

- `main` holds the intake (ADR 0002), the requirements documents (glossary, BR-1 to BR-32, UC-1 to UC-14, data dictionary, models), the agent roles, the workflow, and the issue and PR templates.
- F-002 is done (issue #5 closed): login with seed accounts, `GET /api/venues`, booking requests, owner confirm and reject, and the screens. AC-1 to AC-21 pass. PRs #6, #7, #8, #9, #10.
- F-003 is done (issue #20): sign-up with consent (`User.consentAt`, BR-29), the admin screen (owners, venues, courts, lock and unlock), and "Đơn vị của tôi" for owners. AC-1 to AC-30 pass. PRs #19 (brief), #21, #22, #23, #24, #25.
- F-006 is done (issue #29, PRs #28, #30, #31; brief `docs/briefs/F-006-gioi-han-dang-nhap-va-thu-hoi-phien.md`): login and sign-up limits per phone and per IP in the shared table `AuthThrottle` (BR-30), the weak-password check for new passwords (BR-31), and `User.sessionsValidFrom`, so an admin unlock revokes older sessions (BR-32). The IP is the last `X-Forwarded-For` entry (`trust proxy` = 1). A proxy in front of Cloud Run must change that. The live check on 2026-10-17 passed (comment on PR #31). AC-1 to AC-17 pass.
- F-005 and F-007 are done. F-005 (issue #35, PRs #34, #36, #37, brief `docs/briefs/F-005-chu-san-sua-gia-va-gio-mo-cua.md`): an owner edits the opening hours and the court prices on "Đơn vị của tôi", and a booking request reads them after the `Court` lock (BR-6). F-007 (issue #39, PRs #38, #40, brief `docs/briefs/F-007-chu-san-nhap-booking-khach-goi-dien.md`): an owner enters and cancels the booking of a customer who phoned. AC-1 to AC-15 pass in F-005, AC-1 to AC-18 in F-007.
- F-008 is done (issue #51, PRs #50, #52, #53, #54; brief `docs/briefs/F-008-xem-gio-trong.md`): public `GET /api/courts/:id/availability?date=` and the section "Giờ trống" for guests and users. AC-1 to AC-15 pass. One call link for each range, not each hour: the user decides. F-010 is done too (issue #57, PRs #56, #58; brief `docs/briefs/F-010-tim-theo-ten-san.md`): search by court name in "Giờ trống", AC-1 to AC-8 pass. A result opens the venue and never preselects a court: the user decides. F-009 is done (issue #60, PRs #59, #61, #62; brief `docs/briefs/F-009-nguoi-dung-huy-booking-va-xem-lich-su.md`): a user cancels a booking (BR-11, BR-12) and sees "Booking của tôi" with the venue, the court, and the cancelled state. An owner cancels an `APP` booking too, until it starts. AC-1 to AC-19 pass. `GET /api/bookings/mine` is USER only now, and it expires overdue requests.
- F-011, F-012, F-013, F-015, and F-016 are done (issues #64, #68, #72, #77, #81; PRs #65-#67, #69-#71, #73-#75, #78-#80, #82-#84, and step 3 of F-016). F-011: matches/lobby. F-012: join/leave, SSE. F-013: in-app notifications. F-015: owner finance dashboard (UC-12). F-016: admin site-wide stats (UC-13), `GET /api/admin/stats` and the "Số liệu" tab, with week helpers in `packages/shared/src/booking-time.ts`. AC-1 to AC-12 pass in F-011 to F-015, AC-1 to AC-14 in F-016.
- Live at https://monsport-774323404592.asia-southeast1.run.app (Cloud Run + Cloud SQL, demo seed data). Each merge to `main` deploys through `.github/workflows/deploy.yml`, which sends the traffic back to the previous revision when `/api/health` fails. Cloud SQL `monsport-db` keeps 7 daily backups (02:00 Asia/Ho_Chi_Minh), point-in-time recovery for 7 days, and deletion protection, since 2026-10-18.
- Local development uses its own Postgres 18 cluster on `localhost:55432` (`pnpm db:start`, data in `%LOCALAPPDATA%/monsport/pgdata`). Start it again after a reboot. The cluster runs `Asia/Bangkok`, so `PrismaService` sets `TimeZone=UTC` on each connection (Cloud SQL runs UTC). The local database `monsport_dev` needs `prisma migrate reset` before it takes the F-003 and F-006 migrations, because migration f003 changed after it ran there. The reset deletes its data, so the agent left it. `monsport_preview` holds the seed data and every migration.
- The usage guard (`D:/REPO_GITHUB_TRY/usage-guard`) pauses at 95% of the 5-hour window, stops new work at 90% of the week, and stops at 94%. At the reset, a scheduled `claude -p "tiếp tục làm"` continues the work. A desktop session writes `state.json` from `get_usage`.

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
9. Whether a search result preselects the court when only one court matches (brief F-010). Whether a cancel notifies the other side (UC-14 has no cancel event), and whether an owner may cancel after the start (brief F-009). Whether non-host players need the host's phone (brief F-012). Owner: the user.
10. How to count an active user in the admin dashboard (brief F-016, UC-13). `use-cases.md` says "at least one login in the week", but the system records no login. F-016 counts a user who creates an `APP` booking, joins a match, or hosts a match in the week. A login count needs a new `User.lastLoginAt` column and a consent review (decision 4). Whether the expiry rate counts a booking cancelled after its confirmation (brief F-016, Assumption 7). Owner: the user.

## Next step

F-014 (UC-14 Web Push, planned in the non-goals of `docs/briefs/F-013-thong-bao-trong-app.md`): write the brief with `feature-brief`. It needs VAPID keys and a Service Worker.
