# Flow phone-booking

UC-5 "Nhập booking của khách gọi điện" and its cancel, brief F-007 (`docs/briefs/F-007-chu-san-nhap-booking-khach-goi-dien.md`). Script: `scripts/phone-booking.mjs`. Screens: "Nhập booking khách gọi điện" and "Booking đã xác nhận" (owner). The owner account must own the venue of the flow.

| Step | Asserts |
|---|---|
| owner enters a phone booking | The court option is "<venue> · <court>". The customer name is `test-verify-<stamp>`, with no phone. "Lưu booking" calls `POST /api/owner/bookings`, which answers 201 with status `CONFIRMED`, source `PHONE` (BR-10), the chosen court and slot, and the BR-4 and BR-5 price. "Giá" shows the same price. The form says "Đã lưu booking <slot>." |
| it shows in "Booking đã xác nhận" after a reload | One ticket has the customer name, the day, the start, "Qua điện thoại", and the price |
| the slot is taken for players | The player's `POST /api/bookings` for the same court and slot answers 409 "Khung giờ này vừa có người đặt" (BR-1) |
| owner cancels the phone booking | "Hủy" then "Xác nhận hủy" on that ticket call `POST /api/owner/bookings/<id>/cancel`, which answers 200 with status `CANCELLED`. The ticket shows "Đã hủy" (AC-18) |

The cancel changes only the booking that this run created.

## When it fails

- No court option: `GET /api/owner/venues` lists only the venues of the owner (BR-23). Check `VERIFY_VENUE` and the owner account.
- No ticket after the reload: the list loads `GET /api/owner/bookings?status=CONFIRMED` and hides bookings that have ended.
- The player's request is not refused: the exclusion constraint of BR-1 or the `PHONE` insert in `BookingsService`.
