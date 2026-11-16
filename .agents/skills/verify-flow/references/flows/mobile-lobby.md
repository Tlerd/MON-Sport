# Flow mobile-lobby

Mobile "Mở trận" from "Lịch của tôi" and "Phòng chờ" tab (UC-7, UC-8, UC-9, UC-15, brief F-022, AC-13, AC-14, AC-17, brief F-035, AC-12). Script: `scripts/mobile-lobby.mjs`. Screens: `/app/lich-cua-toi` (sheet "Mở trận"), `/app/phong-cho` (sheets "Chi tiết trận" and "Hủy trận này?").

The flow makes its own data. It sends `POST /api/bookings` for a free 1-hour slot tomorrow on the target court (up to 5 slots on 409), opens a match on that booking, inspects the match in `/app/phong-cho`, and cancels only the match that it created.

| Step | Asserts |
|---|---|
| log in as player | Signed in as the player account (`role USER`) |
| create a booking for tomorrow (390x812) | `POST /api/bookings` answers 201 and the booking is `PENDING` |
| open a match from Lịch của tôi (390x812) | Finds `article[data-booking-id="<id>"]`, taps "Mở trận", fills "Số suất" 8 and "Giá mỗi suất" 30000, picks "Host duyệt", confirms. `POST /api/matches` answers 201. The booking card shows "Trận mở: 1/8 suất" |
| open Phòng chờ (390x812): no sideways scroll, targets 44px | Finds `article[data-match-id="<match id>"]` on `/app/phong-cho`. `document.documentElement.scrollWidth <= innerWidth`. Every visible button, link and chip is at least 44px high |
| open Chi tiết and cancel the match (390x812): card leaves the feed | Taps "Chi tiết" on the match card. "Chi tiết trận" sheet has "Hủy trận" and no "Rời trận" (host). Confirms "Hủy trận" in "Hủy trận này?". `POST /api/matches/:id/cancel` answers 200 and the card leaves the feed |
| second player is ready | Local: registers a `test-` player with a random phone (once for each run). Live: signs in with `VERIFY_PLAYER2_PHONE` and `VERIFY_PLAYER2_PASSWORD`. Without them on live the step is SKIP, the next four steps do not run, and the flow goes on to the cancel step |
| second player taps Xin vào (390x812) | In a new context at the same size, taps "Xin vào" on the match card. `POST /api/matches/:id/join` answers 200, `myRequest` is `PENDING`, `joinedCount` stays 1. The card shows "Đã gửi yêu cầu. Chờ host duyệt" |
| host sees Hàng chờ (1) in Chi tiết (390x812): no sideways scroll, targets 44px | The "Chi tiết trận" sheet shows "Hàng chờ (1)", the requester, "Duyệt" and "Từ chối". `scrollWidth <= innerWidth`. Both buttons are at least 44px high and inside the window. No button or link in the sheet is under 44px |
| host taps Duyệt (390x812): Hàng chờ (0), joinedCount 2 | `POST /api/matches/:id/requests/:userId/approve` answers 200 with `joinedCount` 2. The sheet shows "Hàng chờ (0)" and "2/8 suất" |
| second player sees the seat (390x812) | After a reload of `/app/phong-cho`, the card shows "Bạn đã vào" and "Rời trận" |
| create, open match, inspect, approve and cancel at 360x800 | The same steps at 360x800, with a new booking and match |

The match is opened with "Host duyệt" (`joinMode` `APPROVAL`) in the step "open a match from Lịch của tôi". The report prints the `test-` name on local only. On live it prints "the second player".

## When it fails

- Sideways scroll: a flex or grid ancestor is missing `min-width: 0`, or an element overflows 360px/390px.
- Target under 44px: the message names the element and its height. Add `minHeight: '44px'`.
- No free slot, or 5 times 409: check `GET /api/courts/:id/availability` for tomorrow.
- Open or cancel match fails: check `POST /api/matches` and `POST /api/matches/:id/cancel`.
