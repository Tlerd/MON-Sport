# Flow mobile-history

Mobile "Lịch của tôi" tab and booking cancel (UC-6, UC-8, brief F-021, AC-13 and AC-14). Script: `scripts/mobile-history.mjs`. Screen: `/app/lich-cua-toi` (tabs "Sắp tới", "Trận đã vào", "Lịch sử"), sheet "Hủy booking này?".

The flow makes its own data. It sends `POST /api/bookings` for a free 1-hour slot tomorrow on the target court (up to 5 slots on 409), so a re-run after each deploy works. It cancels only the booking that it created.

| Step | Asserts |
|---|---|
| log in as player | Signed in as the player account (`role USER`) |
| create a booking for tomorrow (390x812) | `POST /api/bookings` answers 201 and the booking is `PENDING` |
| open Lịch của tôi (390x812): no sideways scroll, targets 44px | The card of the booking shows under "Sắp tới". `document.documentElement.scrollWidth <= innerWidth`. Every visible button, link and tab chip is at least 44px high |
| cancel the booking (390x812): card moves to Lịch sử as Đã hủy | Tap "Hủy", confirm "Hủy booking" in the sheet. `POST /api/bookings/:id/cancel` answers 2xx. The card leaves "Sắp tới". Under "Lịch sử" a card shows "Đã hủy" |
| create, open and cancel at 360x800 | The same three steps at 360x800, with a new booking |

## When it fails

- Sideways scroll: a flex or grid ancestor is missing `min-width: 0`, or an element overflows 360px/390px.
- Target under 44px: the message names the element and its height. Add `minHeight: '44px'`.
- No free slot, or 5 times 409: check `GET /api/courts/:id/availability` for tomorrow.
- Cancel fails: check `POST /api/bookings/:id/cancel` and the `userCancelDecision` rule (a booking near its start shows "Gọi chủ sân để hủy", not "Hủy").
