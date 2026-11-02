# Flow mobile-notifications

Mobile "Thông báo" tab for the owner (UC-14, BR-27, brief F-023, AC-13). Script: `scripts/mobile-notifications.mjs`. Screens: `/app/chu-san/yeu-cau`, `/app/thong-bao`.

The flow makes its own data. The seed player sends `POST /api/bookings` for a free 1-hour slot tomorrow on the target court (up to 5 slots on 409). The seed owner reads the notification. The flow cancels only the booking that it created. It runs at 390x812 and 360x800, with a new booking for each size.

| Step | Asserts |
|---|---|
| log in as player, log in as owner | Signed in with `role USER` and `role OWNER` |
| owner opens Yêu cầu and reads the badge | The tab "Thông báo" badge equals `unreadCount` of `GET /api/notifications` |
| player sends a booking request | `POST /api/bookings` answers 201 and the booking is `PENDING` |
| badge increases without opening Thông báo | The badge grows by 1 within 25 s (the shell reloads every 15 s) |
| open Thông báo: card, no sideways scroll, targets 44px | The card of the booking shows the title "Yêu cầu đặt sân mới". `document.documentElement.scrollWidth <= innerWidth`. Every visible button, link and tab chip is at least 44px high |
| tap the card: lands on /app/chu-san/yeu-cau | `POST /api/notifications/:id/read` answers 200. The URL is `/app/chu-san/yeu-cau` |

## When it fails

- The badge does not grow: check `GET /api/notifications` for the owner, and the shell fetch in `App.tsx` (paused on `/thong-bao`, hidden tab).
- No item for the booking: the venue of `VERIFY_VENUE` must belong to the owner account.
- Sideways scroll: a flex or grid ancestor is missing `min-width: 0`, or an element overflows 360px/390px.
- Target under 44px: the message names the element and its height. Add `minHeight: '44px'`.
- No free slot, or 5 times 409: check `GET /api/courts/:id/availability` for tomorrow.
