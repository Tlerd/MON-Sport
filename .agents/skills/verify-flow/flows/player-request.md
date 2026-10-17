# Flow player-request

UC-3 "Gửi yêu cầu đặt sân", brief F-002. Script: `scripts/player-request.mjs`. Screens: the login form, "Đặt sân", "Booking của tôi".

| Step | Asserts |
|---|---|
| setup: log in as player | `POST /api/auth/login` answers 200 with role `USER`. The heading "Chào <name>" shows |
| send a booking request | `POST /api/bookings` answers 201 with status `PENDING`. `startAt` and `endAt` are the chosen slot in Vietnam time. `priceTotal` and "Tạm tính" both equal the BR-4 and BR-5 price from `GET /api/venues`. The ticket shows "Chờ xác nhận" and the slot. "Booking của tôi" has one ticket for that slot, "Chờ xác nhận" |

## When it fails

- The price differs: compare `bookingPrice` in `packages/shared` with the API service. The court prices come from `GET /api/venues`, so an owner edit (F-005) is not a cause.
- 400 "Ngoài giờ mở cửa": the slot picker read `opensAt` and `closesAt` from `GET /api/venues`, so check that answer.
- No ticket in "Booking của tôi": `MyBookings` reloads on `onBooked`. Check that the form still calls it.
- 5 slots taken: the court is full of old test bookings. Set `VERIFY_COURT` to another court of the venue.
