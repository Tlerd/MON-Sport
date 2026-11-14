# Flow lobby-approval

UC-7 "Mở trận", UC-8 "Xem phòng chờ và xin vào trận", and UC-15 "Host duyệt hoặc từ chối người xin vào trận", brief F-028 (`docs/briefs/F-028-hang-cho-host-duyet-vao-tran.md`, AC-12, AC-13, AC-14, AC-17). Script: `scripts/lobby-approval.mjs`. Screens: "Lịch của tôi" (`/lich-cua-toi`) and "Phòng chờ" (`/phong-cho`).

Each run leaves one `CANCELLED` booking (with its `CANCELLED` match) in the database. A `local` run also leaves one `test-<stamp>` account. On `live`, the flow takes the second player from `VERIFY_PLAYER2_PHONE` and `VERIFY_PLAYER2_PASSWORD`, and ends with `SKIP` without them. Direct API cancel runs in `finally` if an earlier step fails.

| Step | Asserts |
|---|---|
| host sends a request | As the `player-request` flow (`PENDING` booking on the target court) |
| host opens a Host duyệt match | On `/lich-cua-toi`, "Booking của tôi" has the booking row. "Mở trận" opens the form with "Vào ngay" selected by default (AC-17). The host selects "Host duyệt" in "Cách vào trận" and clicks "Tạo trận". `POST /api/matches` answers 201 with `joinMode: "APPROVAL"` |
| register or sign in a second player | On `local`, a new browser context calls `POST /api/auth/register` with `name: "test-<stamp>"`, a random `09xxxxxxxx` phone, a random password that passes BR-31, and `consent: true` (201 or 200). On `live`, it calls `POST /api/auth/login` with `VERIFY_PLAYER2_PHONE` and `VERIFY_PLAYER2_PASSWORD` (200, role `USER`), or ends with `SKIP` when they are not set. On 429 (BR-30), the step ends with `SKIP`. The phone and password never appear in `report.md` |
| second player sees Host duyệt in Phòng chờ | `GET /api/matches` lists the match with `joinMode: "APPROVAL"`. On `/phong-cho`, the ticket for that venue, court, day, and time shows the badge "Host duyệt" (AC-12) |
| second player clicks Xin vào and sees Chờ host duyệt | Clicking "Xem chi tiết" shows "Xin vào" and no "Vào trận". Clicking "Xin vào" calls `POST /api/matches/<id>/join`, which answers 200 with `myRequest: "PENDING"` and `joinedCount: 1` (BR-50). The detail shows "Đã gửi yêu cầu. Chờ host duyệt" and "Hủy yêu cầu" (AC-12) |
| host opens Phòng chờ and sees Hàng chờ (1) | On `/phong-cho`, the host opens the match detail and within 2000 ms sees "Hàng chờ (1)", the second player's name, and the buttons "Duyệt" and "Từ chối" (AC-13) |
| host queue at 390px, 768px, 1024px, and 1440px | One step and one screenshot for each width, then the viewport returns to `1280x900`. `document.documentElement.scrollWidth <= window.innerWidth`, the largest `getBoundingClientRect().right` over `.lobby-page` and its descendants outside scroll containers (`overflow-x: auto` or `scroll`) is `<= window.innerWidth`, and "Duyệt" and "Từ chối" sit inside the window and are at least 44px high (AC-14) |
| host approves the request | Clicking "Duyệt" calls `POST /api/matches/<id>/requests/<userId>/approve`, which answers 200 with `joinedCount: 2`. The second player moves to "Người tham gia", and the queue shows "Hàng chờ (0)" and "Chưa có yêu cầu" (AC-13) |
| second player reloads detail and sees Rời trận | The second player reloads `/phong-cho` and opens the detail. `GET /api/matches/<id>` answers 200 with `viewerRole: "PLAYER"`, and the detail shows "Rời trận" |
| host cancels the match (cleanup) | `POST /api/matches/<id>/cancel` answers 200 with status `CANCELLED`, which also cancels the booking (BR-17) |

## When it fails

- No "Host duyệt" radio or badge: check `MyBookings.tsx` (`joinMode` fieldset) and `Lobby.tsx` (`StatusBadge` for `APPROVAL`).
- 429 on `POST /api/auth/register` or `POST /api/auth/login`: BR-30 throttled auth requests from this IP. Wait 15 minutes (see [references/gotchas.md](../gotchas.md)).
- Sideways scroll or button under 44px at 390px, 1024px, or 1440px: check `.queue-section`, `.queue-row`, and `.queue-actions button` in `apps/web/src/app/styles.css`.
- Queue or player list does not update after approve: check `POST /api/matches/:id/requests/:userId/approve` and `GET /api/matches/:id/requests` in `Lobby.tsx`.
