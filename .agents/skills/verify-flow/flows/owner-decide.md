# Flow owner-decide

UC-4 "Xác nhận hoặc từ chối booking", brief F-002. Script: `scripts/owner-decide.mjs`. Screens: "Yêu cầu đặt sân" (owner), "Booking của tôi" (player). The owner account must own the venue of the flow.

| Step | Asserts |
|---|---|
| player sends request A and request B | As the `player-request` flow |
| setup: log in as owner | `POST /api/auth/login` answers 200 with role `OWNER` |
| owner confirms A | After a reload, "Yêu cầu đặt sân" has one ticket with the player's phone, the day, and the start of A. "Xác nhận" calls `POST /api/owner/bookings/<A>/confirm`. The answer names A with status `CONFIRMED`. The ticket shows "Đã xác nhận" |
| owner rejects B | The same with "Từ chối", `/reject`, `REJECTED`, and "Bị từ chối" |
| player sees CONFIRMED and REJECTED | `GET /api/bookings/mine` has A `CONFIRMED` and B `REJECTED`. After a reload, "Booking của tôi" shows "Đã xác nhận" and "Bị từ chối" on the two tickets |

The answer must name the booking id, so a click on the wrong ticket fails the step. A ticket has no id in the DOM.

## When it fails

- No ticket in "Yêu cầu đặt sân": the owner does not own the venue (BR-23), or the list lost a filter. `GET /api/owner/bookings` lists `PENDING` by default.
- 409 "Yêu cầu đã hết hạn": the request passed its deadline (BR-7, BR-8). The slot picker keeps the start 30 days or more ahead, so check the clock of the API.
- The player still sees "Chờ xác nhận": `GET /api/bookings/mine` or the status labels in `apps/web/src/features/bookings/status.ts`.
