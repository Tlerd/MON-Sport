# Flow mobile-owner-schedule

Mobile owner "Lịch sân" tab and phone booking sheet (UC-5, brief F-025, AC-12). Script: `scripts/mobile-owner-schedule.mjs`. Screen: `/app/chu-san/lich`.

The flow needs a test court (`requireTestCourt` in `scripts/lib.mjs`): on `live`, set `VERIFY_VENUE` and `VERIFY_COURT` or the flow ends with `SKIP`. At 390x812 and 360x800, the owner opens `/app/chu-san/lich`, selects the target venue (when the owner has more than one) and tomorrow's day chip, taps the first free cell of the target court, saves a phone booking with customer name `test-verify`, checks `CONFIRMED` and `PHONE` through the API, and cancels only that booking. If the run stops before the cancel, `finally` cancels the booking silently.

| Step | Asserts |
|---|---|
| log in as owner | Signed in with `role OWNER` |
| owner opens Lịch sân and picks a free cell | Tomorrow's day chip is selected. The row `[data-court-id]` of `VERIFY_COURT` has an enabled `button[data-minute]`. `document.documentElement.scrollWidth <= innerWidth`. Tapping the first enabled cell opens the sheet "Nhập booking khách gọi" |
| owner saves phone booking in the sheet | Entering `test-verify` in "Tên khách" and tapping "Lưu booking" sends `POST /api/owner/bookings` (201), shows status "Đã lưu booking", and adds a row with `test-verify` in "Booking trong ngày". `GET /api/owner/bookings?status=CONFIRMED` has the booking on that court and start time with `source: 'PHONE'` and `status: 'CONFIRMED'` |
| owner cancels the phone booking | `POST /api/owner/bookings/:id/cancel` answers 200 with `status: 'CANCELLED'` |

## When it fails

- `SKIP` on live: set `VERIFY_VENUE` and `VERIFY_COURT` to a test court owned by the live owner account.
- No venue or court: `GET /api/owner/venues` lists only the venues of the owner (BR-23). Check `VERIFY_VENUE` and `VERIFY_COURT`.
- No enabled `button[data-minute]`: check `GET /api/courts/:id/availability` for tomorrow and `ownerStartableMinutes`.
- Sideways scroll: a flex or grid ancestor is missing `min-width: 0`, or an element overflows 360px/390px.
- Not in "Booking trong ngày" or `GET /api/owner/bookings?status=CONFIRMED`: check `loadBookings` in `ScheduleScreen.tsx` and `bookingsOfDay`.
- Cancel fails: check `POST /api/owner/bookings/:id/cancel`. Direct API cancel cleans up in `finally`.
