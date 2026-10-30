# Flow mobile-book

Mobile booking tab and request sheet (UC-2, UC-3, brief F-020). Script: `scripts/mobile-book.mjs`. Screens: venue list (`/app/`), venue screen (`/app/don-vi/:id`), booking request sheet.

| Step | Asserts |
|---|---|
| log in as player | Signed in as the player account (`role USER`) |
| open 390x812: venue list, no sideways scroll | `document.documentElement.scrollWidth <= innerWidth` on `/app/`. Tapping the venue card opens `/app/don-vi/:id` with its `h1` heading |
| book tomorrow (390x812): no sideways scroll, request sent | Picks tomorrow's date chip, asserts `document.documentElement.scrollWidth <= innerWidth` on the venue screen, taps a free `button.slot-cell` on the target court (retrying another cell on 409 up to 5 times), opens the booking sheet from the `ActionBar`, submits `POST /api/bookings`, and sees "Đã gửi yêu cầu" and "Chờ xác nhận" |
| open 360x800: venue list, no sideways scroll | `document.documentElement.scrollWidth <= innerWidth` on `/app/` at 360x800, opens the venue screen |
| book tomorrow (360x800): no sideways scroll, request sent | `document.documentElement.scrollWidth <= innerWidth` on the venue screen at 360x800, books a free slot for tomorrow, and sees "Đã gửi yêu cầu" and "Chờ xác nhận" |

## When it fails

- Sideways scroll: a flex or grid ancestor is missing `min-width: 0`, or an element overflows 360px/390px.
- No free `button.slot-cell`: check `GET /api/courts/:id/availability` for tomorrow and `startableMinutes`.
- `POST /api/bookings` fails: check `BookingSheet` payload (`courtId`, `startAt`, `endAt`) or server logs.
