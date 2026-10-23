# Flow phone-booking

UC-5 "Nhập booking của khách gọi điện" and its cancel, brief F-007 (`docs/briefs/F-007-chu-san-nhap-booking-khach-goi-dien.md`). Script: `scripts/phone-booking.mjs`. Screens: "Lịch sân" (`/chu-san/lich`) and the "Booking khách gọi" panel (owner). The owner account must own the venue of the flow.

| Step | Asserts |
|---|---|
| owner enters a phone booking | In the "Booking khách gọi" panel on "Lịch sân" (`/chu-san/lich`), the owner selects the court, date, start time, and duration, and enters customer name `test-verify-<stamp>` with no phone. "Lưu booking" calls `POST /api/owner/bookings`, which answers 201 with status `CONFIRMED`, source `PHONE` (BR-10), the chosen court and slot, and the BR-4 and BR-5 price. "Tạm tính" shows the same price |
| it shows in confirmed bookings for the owner | `GET /api/owner/bookings?status=CONFIRMED` has the booking with the customer name, source `PHONE`, status `CONFIRMED`, and the same price |
| the slot is taken for players | The player's `POST /api/bookings` for the same court and slot answers 409 "Khung giờ này vừa có người đặt" (BR-1) |
| owner cancels the phone booking | `POST /api/owner/bookings/<id>/cancel` answers 200 with status `CANCELLED` |

The cancel changes only the booking that this run created.

## When it fails

- No court option: `GET /api/owner/venues` lists only the venues of the owner (BR-23). Check `VERIFY_VENUE` and the owner account.
- Not in confirmed bookings: `GET /api/owner/bookings?status=CONFIRMED` did not list the booking.
- The player's request is not refused: the exclusion constraint of BR-1 or the `PHONE` insert in `BookingsService`.
