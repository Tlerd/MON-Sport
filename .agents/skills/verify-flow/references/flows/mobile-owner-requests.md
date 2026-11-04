# Flow mobile-owner-requests

Mobile owner "Yêu cầu" tab, confirm and reject (UC-4, brief F-024, AC-11). Script: `scripts/mobile-owner-requests.mjs`. Screen: `/app/chu-san/yeu-cau`.

The flow makes its own data. The seed player sends `POST /api/bookings` for a free 1-hour slot tomorrow on the target court (up to 5 slots on 409). The seed owner rejects that booking. The flow touches only the booking that it created. If the booking is still `PENDING` at the end, the player cancels it. It runs at 390x812 and 360x800, with a new booking for each size.

| Step | Asserts |
|---|---|
| log in as player, log in as owner | Signed in with `role USER` and `role OWNER` |
| player sends a booking request | `POST /api/bookings` answers 201 and the booking is `PENDING` |
| owner opens Yêu cầu: card, no sideways scroll, buttons 44px | The card `[data-booking-id]` shows the court name and a "Còn" deadline text. `document.documentElement.scrollWidth <= innerWidth`. Every button in the card is at least 44px high |
| owner rejects through the sheet | "Từ chối" in the card opens the sheet "Từ chối yêu cầu này?". "Từ chối" in the sheet removes the card and shows "Đã từ chối yêu cầu". `GET /api/owner/bookings?status=REJECTED` lists the booking as `REJECTED` |

## When it fails

- The card does not appear: the venue of `VERIFY_VENUE` must belong to the owner account. Check `GET /api/owner/bookings?status=PENDING`.
- No "Còn" text: the booking has no `confirmDeadline`, or `deadlineLeft` returns an empty string.
- Sideways scroll: a flex or grid ancestor is missing `min-width: 0`, or an element overflows 360px/390px.
- Button under 44px: the message names the button and its height. Add `minHeight: '44px'`.
- The card stays after the tap: check `POST /api/owner/bookings/:id/reject` and the notice in `RequestsScreen.tsx`.
- No free slot, or 5 times 409: check `GET /api/courts/:id/availability` for tomorrow.
