---
style: ste80
lang: vi
---

# F-007: Chủ sân nhập booking của khách gọi điện

Status: draft
Source: intake `docs/requirements/intake-monsport-v1.md`: UC-5, mục Trạng thái của booking ("Booking chủ sân nhập cho khách gọi điện ở trạng thái 'Đã xác nhận' ngay"), mục Chặn trùng giờ, Acceptance UC-5, Assumptions (tên và số điện thoại của khách không bắt buộc, thứ tự ra mắt UC-2 đến UC-6). `docs/requirements/use-cases.md` UC-5 (5.0, 5.0.E1). `docs/requirements/business-rules.md` BR-1, BR-2, BR-3, BR-5, BR-10, BR-20, BR-22, BR-23. Step 1 bắt đầu sau khi F-005 step 2 (pull request #37) merge, vì cả hai viết lại `PROGRESS.md`.

## Goal

Chủ sân nhập khung giờ mà khách đặt qua điện thoại, để lịch trong app khớp với lịch thật. Kiểm tra bằng ví dụ của intake: khách gọi điện đặt 17:00–18:00. Chủ sân nhập booking đó, và booking ở trạng thái "Đã xác nhận" ngay.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Người dùng hủy booking và xem lịch sử (UC-6) | Brief riêng, để mỗi brief nhỏ hơn 3 pull request | Brief F-009 |
| Chủ sân hủy booking `APP` của người dùng (người dùng gọi chủ sân để hủy muộn, UC-6 6.0.E1) | Intake cho chủ sân việc này: người hủy muộn "phải gọi chủ sân". Việc này thuộc UC-6, nên làm cùng UC-6 | Brief F-009. Tới lúc đó, route hủy của slice này trả 409 cho booking `APP` |
| Sửa booking đã nhập (đổi giờ, đổi sân, đổi tên khách) | Chủ sân hủy rồi nhập lại. Ít thao tác hơn và ít trạng thái hơn | Khi chủ sân chạy thử cần |
| Đặt cố định hằng tuần | Intake, Out of scope (cắt B3) | — |
| Lịch dạng lưới của cả ngày cho chủ sân | Danh sách "Đã xác nhận" theo giờ là đủ cho 50 booking mỗi ngày | Khi có yêu cầu |
| Ô "đã thu tiền tại sân" | Thuộc UC-12 | Brief của UC-12 |
| API lọc booking theo ngày cho chủ sân | Web lọc booking đã qua. Đủ cho mức chạy thử | Khi danh sách chậm hơn mục tiêu 300 ms |

## Acceptance criteria

Dữ liệu chung: mỗi test tạo lại dữ liệu này trước khi chạy, như `apps/api/src/modules/bookings/bookings.e2e.test.ts`. Admin (`0900000000`). Chủ sân "Bình" (`0912345678`) quản lý "Cầu lông A": mở 06:00, đóng 23:00, có "Sân 1" và "Sân 2", 80.000đ giờ thường và 120.000đ giờ cao điểm.

Chủ sân "Dũng" (`0912345679`) quản lý "Cầu lông B" với "Sân 1". Người dùng "An" (`0901234567`). Bây giờ là 20/11/2026 10:00 `Asia/Ho_Chi_Minh`. Mọi giờ dưới đây là ngày 20/11/2026.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Bình đã đăng nhập | Bình gọi `POST /api/owner/bookings` với "Sân 1", 17:00–18:00, `customerName` "Chú Tư", `customerPhone` `0987654321` | 201. `status` = `CONFIRMED`, `source` = `PHONE`, `priceTotal` = 120000, `confirmedAt` = 20/11/2026 10:00, `confirmDeadline` = null, `cancelledAt` = null, `customer` = `{ name: "Chú Tư", phone: "0987654321" }`. `createdById` trong DB là Bình (BR-10) |
| AC-2 | Bình đã đăng nhập | Bình nhập "Sân 1", 18:00–19:00, không có tên và số điện thoại. Rồi Bình nhập 19:00–20:00 với `customerName` "   " và `customerPhone` "" | Cả hai nhận 201. `customer` = `{ name: "", phone: null }`. DB lưu `customerName` = null và `customerPhone` = null |
| AC-3 | An có booking "Chờ xác nhận" 20:00–21:00 trên "Sân 1" | Bình nhập "Sân 1", 20:30–21:30. Rồi Bình nhập "Sân 1", 21:00–22:00 | Lần đầu nhận 409 "Khung giờ này vừa có người đặt" (BR-1, 5.0.E1). Lần sau nhận 201 |
| AC-4 | Bình đã đăng nhập | 20 request của Bình nhập "Sân 1", 17:00–18:00, gửi cùng lúc | Đúng 1 request nhận 201. 19 request nhận 409 "Khung giờ này vừa có người đặt". DB có đúng 1 booking 17:00–18:00 |
| AC-5 | An gửi yêu cầu "Sân 1", 17:00–18:00 lúc 14:00, nên hạn xác nhận là 16:00 (BR-7) | Bây giờ là 16:30. Bình nhập "Sân 1", 17:00–18:00 | 201. Booking của An chuyển sang "Hết hạn" (BR-8). Booking mới "Đã xác nhận" |
| AC-6 | Bình đã đăng nhập | Bình gửi 9 request. Request 1 tới 6 có giờ: 17:15–18:15, 17:00–17:30, 05:00–06:00, 22:30–23:30, 09:30–10:30, 10:00–11:00. Request 7 có `customerPhone` `12345`. Request 8 có `customerName` dài 101 ký tự. Request 9 có thêm khóa `status` | Mỗi request nhận 400. Câu lỗi: (1) "Giờ phải theo bước 30 phút". (2) "Mỗi booking dài ít nhất 1 giờ". (3), (4) "Ngoài giờ mở cửa". (5), (6) "Giờ bắt đầu đã qua". (7) "Số điện thoại có 10 chữ số và bắt đầu bằng 0". (8), (9) "Dữ liệu đặt sân không hợp lệ". Không có booking mới |
| AC-7 | Bình đã đăng nhập | Bình nhập "Sân 1" của "Cầu lông B". Rồi Bình nhập một `courtId` không có | Cả hai nhận 404 "Không tìm thấy sân" (BR-23). Không có booking mới |
| AC-8 | An, admin đã đăng nhập. Một request khác không có cookie | Mỗi người gọi `POST /api/owner/bookings` và `POST /api/owner/bookings/:id/cancel` | An 403, admin 403 (BR-22), không có cookie 401. Không có booking mới, không booking nào đổi |
| AC-9 | Bình đã nhập booking 17:00–18:00 (AC-1) | Bình gọi `POST /api/owner/bookings/<id>/cancel` | 200. `status` = `CANCELLED`, `cancelledAt` = 20/11/2026 10:00. Rồi Bình nhập lại 17:00–18:00 và nhận 201 |
| AC-10 | Bình đã nhập booking 17:00–18:00. An có booking "Chờ xác nhận" 20:00–21:00 trên "Sân 1". Dũng nhập booking 17:00–18:00 trên sân của Dũng | Bình hủy booking của An. Bình hủy booking của Dũng. Bình hủy một UUID không có. Bình hủy `abc` | Booking của An nhận 409 "Chỉ hủy được booking bạn nhập cho khách gọi điện". Booking của Dũng và UUID không có nhận 404 "Không tìm thấy booking". `abc` nhận 400 "Dữ liệu không hợp lệ". Không booking nào đổi |
| AC-11 | Bình đã nhập booking 11:00–12:00. Bình đã hủy booking 17:00–18:00 như AC-9 | Bây giờ là 11:00. Bình hủy booking 11:00–12:00. Rồi Bình hủy booking 17:00–18:00 lần thứ hai | Cả hai nhận 409 "Booking này không hủy được nữa". Booking 11:00–12:00 vẫn "Đã xác nhận" |
| AC-12 | Bình đã nhập booking 17:00–18:00 cho "Chú Tư" | Bình gọi `GET /api/owner/bookings?status=CONFIRMED` | Danh sách có booking đó với `source` = `PHONE` và `customer` = `{ name: "Chú Tư", phone: "0987654321" }` |
| AC-13 | Bình đã đăng nhập | An gửi 10 `POST /api/bookings` và Bình gửi 10 `POST /api/owner/bookings`, cùng "Sân 1", 20:00–21:00, tất cả cùng lúc | Đúng 1 request nhận 201. 19 request nhận 409 "Khung giờ này vừa có người đặt". Không request nào nhận 500. DB có đúng 1 booking 20:00–21:00 |
| AC-14 | Bình đã đăng nhập | Bình nhập "Sân 1", 10:30–11:30 | 201. Chủ sân nhập được booking trong vòng 1 giờ trước giờ đá. Đây là luồng của intake: người dùng không đặt được trong app thì gọi chủ sân |
| AC-15 | Bình đã đăng nhập trên web, mục "Nhập booking khách gọi điện" đã tải "Cầu lông A" | Bình chọn "Sân 1", ngày 20/11/2026, giờ bắt đầu 17:00, thời lượng 1 giờ, nhập tên "Chú Tư" và số `0987654321`, bấm "Lưu booking" | Form hiện giá xem trước "120.000đ" trước khi lưu. Web gọi `POST /api/owner/bookings` với `courtId` của "Sân 1", `startAt` `2026-11-20T17:00:00+07:00`, `endAt` `2026-11-20T18:00:00+07:00`, `customerName` "Chú Tư", `customerPhone` `0987654321`. Danh sách "Booking đã xác nhận" hiện booking mới với "Chú Tư" |
| AC-16 | Như AC-15 | Bình để trống ô tên và ô số điện thoại, rồi bấm "Lưu booking" | Body không có khóa `customerName` và `customerPhone`. Danh sách hiện booking mới với "Khách gọi điện" và không có link `tel:` |
| AC-17 | Như AC-15. API trả 409 "Khung giờ này vừa có người đặt" | Bình bấm "Lưu booking" | Form hiện câu lỗi đó với `role="alert"`. Các ô giữ giá trị đã nhập |
| AC-18 | Danh sách "Booking đã xác nhận" nhận từ API một booking `PHONE` và một booking `APP` chưa tới giờ, và một booking `PHONE` đã kết thúc lúc 09:00 | Bình bấm "Hủy" ở booking `PHONE` chưa tới giờ, rồi bấm "Xác nhận hủy" | Booking đã kết thúc không hiện. Chỉ booking `PHONE` chưa tới giờ có nút "Hủy". Web gọi `POST /api/owner/bookings/<id>/cancel`. Booking đó ở lại trong danh sách với nhãn "Đã hủy" tới khi tải lại trang |

## Contract

Zod trong `packages/shared/src/booking.ts` là nguồn duy nhất.

| Endpoint or schema | Change | Request | Response and errors |
|---|---|---|---|
| `CreatePhoneBookingRequest` | new | `{ courtId, startAt, endAt, customerName?, customerPhone? }`. `customerName`: chuỗi, cắt khoảng trắng, tối đa 100 ký tự. Chuỗi rỗng sau khi cắt là không có tên. `customerPhone`: `Phone`. Chuỗi rỗng là không có số. Strict | — |
| `BookingView` | changed | — | Thêm `cancelledAt`: thời điểm hoặc null. `toView` điền trường này |
| `POST /api/owner/bookings` | new | `CreatePhoneBookingRequest` | 201 `OwnerBookingView`. 400 "Dữ liệu đặt sân không hợp lệ" khi Zod sai, trừ số điện thoại sai: câu của `Phone`. 400 giờ: các câu của AC-6. 401, 403 (không phải `OWNER`). 404 "Không tìm thấy sân" khi sân không có hoặc thuộc đơn vị của người khác. 409 "Khung giờ này vừa có người đặt" |
| `POST /api/owner/bookings/:id/cancel` | new | — | 200 `BookingView` với `status` = `CANCELLED`. 400 "Dữ liệu không hợp lệ" khi `:id` không phải UUID: pipe `Id` với `Messages.invalid`, như `apps/api/src/modules/venues/venues.controller.ts`. 404 "Không tìm thấy booking" khi booking không có hoặc thuộc đơn vị của người khác. 409 "Chỉ hủy được booking bạn nhập cho khách gọi điện" khi `source` = `APP`, tới F-009. 409 "Booking này không hủy được nữa" khi booking không còn "Đã xác nhận", hoặc giờ bắt đầu đã tới |
| `GET /api/owner/bookings?status=CONFIRMED` | unchanged | — | Đã trả booking `PHONE` với `customer` từ F-002 |

Thứ tự ở `POST /api/owner/bookings`:

1. Kiểm Zod. Kiểm lưới 30 phút (BR-2) và độ dài (BR-3), như `BookingsService.request`.
2. Đọc sân và đơn vị. Không có, hoặc `Venue.ownerId` khác người gọi: 404.
3. Kiểm giờ mở cửa. Kiểm `startAt` > bây giờ, nếu không thì "Giờ bắt đầu đã qua".
4. Trong một transaction, làm các việc sau theo thứ tự:
   - Khóa dòng `Venue` của sân (`FOR SHARE`). Kiểm lại chủ sân.
   - Khóa dòng `Court` (`FOR UPDATE`).
   - Đọc lại sân và đơn vị. Kiểm lại giờ mở cửa.
   - Chuyển yêu cầu quá hạn của sân sang "Hết hạn" (BR-8).
   - Tính `priceTotal` theo BR-5 với giá đọc sau khóa.
   - Tạo booking: `status` = `CONFIRMED`, `source` = `PHONE`, `createdById` = người gọi, `confirmedAt` = bây giờ, `confirmDeadline` = null, `createdAt` = bây giờ theo `Clock`.
5. EXCLUDE của Postgres là chốt cuối cho BR-1: lỗi `23P01` đổi thành 409.

`POST /api/owner/bookings/:id/cancel` chạy trong một transaction:

1. Đọc `courtId` của booking và `venueId` của sân. Không có: 404.
2. Khóa dòng `Venue` (`FOR SHARE`).
3. Một lệnh `updateMany` có điều kiện: `id`, `source` = `PHONE`, `status` = `CONFIRMED`, `startAt` > bây giờ, và sân thuộc đơn vị của người gọi. Lệnh đặt `status` = `CANCELLED` và `cancelledAt` = bây giờ.
4. Khi lệnh không đổi dòng nào, route đọc booking để chọn mã lỗi. Thứ tự: 404 cho đơn vị của người khác, 409 nguồn `APP`, 409 không hủy được.

Thứ tự khóa của mọi route sau slice này:

| Route | Khóa |
|---|---|
| Chủ sân nhập booking | `Venue` (`FOR SHARE`), rồi `Court` (`FOR UPDATE`) |
| Chủ sân hủy booking | `Venue` (`FOR SHARE`), rồi dòng `Booking` (`UPDATE`) |
| Người dùng gửi yêu cầu | `Court` (`FOR UPDATE`). Đọc `Venue` không khóa |
| Chủ sân sửa giá (F-005) | `Venue` (`FOR SHARE`), rồi `Court` (`UPDATE`) |
| Chủ sân sửa giờ (F-005) | `Venue` (`FOR UPDATE`) |
| Admin sửa đơn vị | `Venue` (`FOR UPDATE`), rồi `User` (`FOR SHARE`) khi đổi chủ sân |
| Admin sửa sân | `Court` (`UPDATE`) |
| Chủ sân xác nhận hoặc từ chối | Dòng `Booking` (`UPDATE`) |

Không route nào khóa `Court` hoặc `Booking` rồi mới khóa `Venue`, nên không có vòng chờ. AC-13 chạy hai đường nhập cùng lúc trên Postgres thật.

## Data

| Table | Change | Migration step |
|---|---|---|
| — | Không đổi schema. `Booking.source`, `customerName`, `customerPhone`, `confirmedAt`, `cancelledAt` đã có từ F-002 | — |

## Build order

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Hợp đồng và API: `CreatePhoneBookingRequest`, `BookingView.cancelledAt`, hai route của chủ sân, `PROGRESS.md`, brief này với Status: accepted | `packages/shared/src/booking.ts`, `packages/shared/src/booking.test.ts`, `apps/api/src/modules/bookings/` (gồm file test mới `phone-bookings.e2e.test.ts`), `PROGRESS.md`, file brief này | Test Zod cho AC-2 và AC-6. AC-1 tới AC-14 trong `phone-bookings.e2e.test.ts`. Test cũ của `bookings.e2e.test.ts` vẫn đạt |
| 2 | Màn hình: form "Nhập booking khách gọi điện" và danh sách "Booking đã xác nhận" có nút "Hủy" cho booking `PHONE`. `OwnerRequests` không hiện link `tel:` khi không có số. `PROGRESS.md` | `apps/web/src/features/bookings/`, `apps/web/src/app/App.tsx` (chỉ thêm hai mục vào màn hình chủ sân), `apps/web/src/app/styles.css`, `PROGRESS.md` | AC-15 tới AC-18 |

Form web:

- Ô chọn sân liệt kê các sân của mọi đơn vị của chủ sân, dạng "Cầu lông A · Sân 1", từ `GET /api/owner/venues` qua `lib/api.ts`. Form không import từ `features/venues`.
- Ô ngày là `input type="date"`, mặc định hôm nay theo `Asia/Ho_Chi_Minh`.
- Ô giờ bắt đầu liệt kê các mốc 30 phút trong giờ mở cửa của đơn vị, trừ mốc mà 1 giờ sau đó vượt giờ đóng cửa.
- Ô thời lượng: 1 giờ, 1 giờ 30, 2 giờ, 2 giờ 30, 3 giờ. Chỉ hiện thời lượng không vượt giờ đóng cửa.
- Ô tên và ô số điện thoại không bắt buộc. Ô để trống thì body không có khóa đó.
- Giá xem trước dùng `bookingPrice` của `packages/shared` với giá của sân đã tải.
- Danh sách "Booking đã xác nhận" lấy `GET /api/owner/bookings?status=CONFIRMED`, chỉ hiện booking có `endAt` sau bây giờ, xếp theo giờ bắt đầu. Booking không có tên hiện "Khách gọi điện". Không có số thì không có link `tel:`.
- Nút "Hủy" hỏi lại bằng nút "Xác nhận hủy" trước khi gọi API.
- Màn hình rộng 390px vẫn dùng được.

## Edit boundaries

- May edit: các path trong bảng Build order, `pnpm-lock.yaml` khi cần.
- Leave unchanged without approval: `AGENTS.md`, `.dependency-cruiser.cjs`, `scripts/check.mjs`, `.github/workflows/`, `apps/api/prisma/`, `apps/api/src/modules/auth/`, `apps/api/src/modules/admin/`, `apps/api/src/modules/venues/`, `apps/api/src/modules/database/`, `apps/web/src/features/venues/`, `apps/web/src/features/admin/`, `apps/web/src/components/`, các file trong `docs/requirements/`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Đồng thời: chủ sân nhập và người dùng gửi yêu cầu cùng một giờ | `POST /api/owner/bookings`, `POST /api/bookings` | Cả hai khóa dòng `Court`. EXCLUDE là chốt cuối. AC-13 chạy hai đường cùng lúc. AC-4 chạy 20 lần nhập cùng lúc. Review bằng phiên mới |
| Đồng thời: admin chuyển đơn vị trong lúc chủ sân cũ nhập hoặc hủy | Hai route của chủ sân | `Venue` (`FOR SHARE`) trước mọi khóa khác, như F-005 sửa giá. Review bằng phiên mới |
| Tiền: giá của booking điện thoại | `priceTotal` | BR-5 với giá đọc sau khóa, như F-005. AC-1. Review bằng phiên mới |
| Dữ liệu cá nhân: tên và số điện thoại của khách | `Booking.customerName`, `customerPhone` | Chỉ chủ sân của đơn vị thấy, qua `GET /api/owner/bookings` (BR-20). Không bắt buộc. Không có trong `GET /api/venues`. `BookingView` không có hai trường này. Review bằng phiên mới |
| Phân quyền: chủ sân nhập hoặc hủy trên sân của người khác (BR-23) | Hai route | Kiểm `ownerId` sau khóa `Venue`, và trong điều kiện của `updateMany`. AC-7, AC-10 |
| Chủ sân hủy booking của người dùng trước F-009 | Route hủy | Điều kiện `source` = `PHONE`. AC-10 |

## Assumptions

- Chủ sân không nhập được booking có giờ bắt đầu đã qua. Lịch trong app dùng để chặn trùng giờ, và giờ đã qua không còn ai đặt được. Intake không nói về booking nhập sau giờ đá.
- Chủ sân hủy được booking `PHONE` "Đã xác nhận" tới đúng giờ bắt đầu. Quy tắc 6 giờ của BR-11 chỉ áp dụng cho người đặt trong app. Chủ sân là người nhận cuộc gọi hủy.
- Route hủy trả 409 cho booking `APP` tới F-009. F-009 thêm việc chủ sân hủy booking `APP` khi người dùng gọi để hủy muộn.
- Khi chủ sân nhập booking, yêu cầu quá hạn trên sân đó chuyển sang "Hết hạn" trước, như yêu cầu của người dùng (BR-8).
- Booking `PHONE` không có hạn xác nhận, nên `confirmDeadline` = null.
- `customer.name` là chuỗi rỗng khi không có tên, như `OwnerBookingView` của F-002. Web hiện "Khách gọi điện".
- `GET /api/bookings/mine` của chủ sân trả cả booking `PHONE` mà chủ sân đã nhập, vì `createdById` là chủ sân. Màn hình chủ sân không hiện danh sách đó. F-009 quyết định có giữ cách này không.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Chủ sân có cần nhập booking sau giờ đá, để số liệu UC-12 đủ không? | Bạn, khi làm UC-12 | không |
| Giữ tên và số điện thoại của khách gọi điện bao lâu, và xóa thế nào khi khách yêu cầu (Luật 91/2025)? Khách không có tài khoản, nên BR-26 không áp dụng | Bạn, với người tư vấn luật | không |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
