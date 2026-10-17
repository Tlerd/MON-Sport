# Flow phone-booking

UC-5 "Nhập booking của khách gọi điện", brief F-007 (`docs/briefs/F-007-chu-san-nhap-booking-khach-goi-dien.md`). Script: `scripts/phone-booking.mjs`.

Status: a stub. The script ends with SKIP while the owner page has no heading "Nhập booking khách gọi điện". It fails when that heading shows, so the pull request of F-007 step 2 writes these steps.

## Steps to write with F-007 step 2

Take the labels and texts from the brief (AC-15 to AC-18) and the screen it ships.

| Step | Asserts |
|---|---|
| owner enters a phone booking | Pick a slot with `randomSlot`. The form calls `POST /api/owner/bookings` and gets 201 with status `CONFIRMED` and source `PHONE` (BR-10). The price equals BR-4 and BR-5 |
| it shows in "Booking đã xác nhận" | The list has one ticket for that slot, with the customer name and phone that the owner typed |
| the slot is taken for players | `POST /api/bookings` from the player for the same court and slot answers 409 "Khung giờ này vừa có người đặt" (BR-1) |

The run deletes nothing, so leave the phone booking in place. Name the customer `test-verify-<stamp>`.
