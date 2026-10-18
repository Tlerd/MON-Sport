---
style: ste80
lang: vi
---

# F-009: Người dùng hủy booking và xem lịch sử

Status: accepted (review round 2, pull request #59)
Source:

- Intake `docs/requirements/intake-monsport-v1.md`:
  - UC-6 trong bảng use case: "Xem trạng thái yêu cầu, hủy booking, xem lịch sử đặt sân".
  - Mục Trạng thái của booking: "Người dùng tự hủy booking đã xác nhận tới 6 giờ trước giờ đá. Muộn hơn thì phải gọi chủ sân".
  - Mục Phân quyền: "Admin không xác nhận và không hủy booking".
  - Acceptance UC-6, và Assumptions: "Người dùng hủy được yêu cầu 'Chờ xác nhận' vào bất kỳ lúc nào".
- `docs/requirements/use-cases.md` UC-6 (6.0, 6.0.E1).
- `docs/requirements/business-rules.md` BR-1, BR-8, BR-11, BR-12, BR-22, BR-23.
- `docs/requirements/models.md` Figure 7 và Figure 9 (cây quyết định hủy booking).
- Brief `F-007-chu-san-nhap-booking-khach-goi-dien.md`: non-goal "chủ sân hủy booking `APP`".

## Goal

Người dùng xem lịch sử booking của mình, kể cả booking đã hủy, và tự hủy một booking khi quy tắc cho phép. Khi quy tắc không cho phép, người dùng gọi chủ sân, và chủ sân hủy được booking `APP`. Kiểm tra bằng ví dụ của intake: booking 20:00–21:00 hủy được lúc 13:00, và app báo phải gọi chủ sân khi hủy lúc 15:00.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Hủy trận gắn với booking (UC-6 bước 4, models.md Figure 8) | Bảng `Match` chưa có. UC-7 tới UC-9 chưa làm | Brief của UC-7. Brief đó thêm việc hủy trận vào cả hai route hủy của slice này, trong cùng transaction |
| Thông báo cho chủ sân khi người dùng hủy, và cho người dùng khi chủ sân hủy | UC-14 chưa làm, và danh sách sự kiện của UC-14 không có sự kiện hủy | Khi bạn thêm sự kiện hủy vào UC-14 (xem Open questions) |
| Phân trang lịch sử | Mức chạy thử: một người dùng có vài chục booking | Khi một người dùng có hơn 100 booking |
| Lọc hoặc tìm trong lịch sử | Danh sách ngắn, xếp mới nhất trước | Khi có yêu cầu |
| Ghi ai hủy (người đặt hay chủ sân) | `Booking` chưa có cột này, và intake không cần | Khi UC-12 cần tỉ lệ hủy theo người hủy |
| Chủ sân hủy yêu cầu "Chờ xác nhận" | Chủ sân đã có nút "Từ chối" (UC-4) | — |
| Hoàn tiền | Bản đầu không thu tiền | — |

## Acceptance criteria

Dữ liệu chung: mỗi test tạo lại dữ liệu này trước khi chạy, như `apps/api/src/modules/bookings/phone-bookings.e2e.test.ts`.

Dữ liệu:

- Admin (`0900000000`).
- Chủ sân "Bình" (`0912345678`) quản lý "Cầu lông A" (số điện thoại `0911111111`): mở 06:00, đóng 23:00, có "Sân 1" và "Sân 2".
- Chủ sân "Dũng" (`0912345679`) quản lý "Cầu lông B" với "Sân 1".
- Người dùng "An" (`0901234567`) và "Chi" (`0901234568`).
- Bây giờ là 20/11/2026 10:00 `Asia/Ho_Chi_Minh`, trừ khi dòng ghi giờ khác. Mọi giờ dưới đây là ngày 20/11/2026.
- Test dùng `Clock` giả để đổi giờ.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | An có booking "Chờ xác nhận" 20:00–21:00 trên "Sân 1" | An gọi `POST /api/bookings/<id>/cancel`. Rồi Chi gửi yêu cầu "Sân 1", 20:00–21:00 | Lần hủy: 200. `status` = `CANCELLED`, `cancelledAt` = 20/11/2026 10:00, `courtName` = "Sân 1", `venueName` = "Cầu lông A", `venuePhone` = `0911111111`. Yêu cầu của Chi nhận 201: giờ đó trống lại (POST-6, BR-12) |
| AC-2 | An có booking "Chờ xác nhận" 12:00–13:00, gửi lúc 09:30, nên hạn xác nhận là 11:00 | An hủy booking đó lúc 10:00, 2 giờ trước giờ bắt đầu | 200. `status` = `CANCELLED`. Booking "Chờ xác nhận" hủy được ở mọi lúc trước giờ bắt đầu, không có mốc 6 giờ (BR-12) |
| AC-3 | An có booking "Đã xác nhận" 20:00–21:00. Bây giờ là 13:00 | An hủy booking đó | 200. `status` = `CANCELLED`, `cancelledAt` = 13:00. Còn 7 giờ, nên hủy được (BR-11, ví dụ của intake) |
| AC-4 | An có booking "Đã xác nhận" 20:00–21:00. Bây giờ là 15:00 | An hủy booking đó | 409 "Còn dưới 6 giờ nữa tới giờ bắt đầu. Hãy gọi chủ sân" (6.0.E1, ví dụ của intake). `status` vẫn `CONFIRMED`, `cancelledAt` = null |
| AC-5 | An có hai booking "Đã xác nhận" 20:00–21:00: một trên "Sân 1", một trên "Sân 2" | Lúc 14:00:00.000 An hủy booking "Sân 1". Lúc 14:00:00.001 An hủy booking "Sân 2" | Booking "Sân 1" nhận 200: còn đúng 6 giờ thì hủy được. Booking "Sân 2" nhận 409 "Còn dưới 6 giờ nữa tới giờ bắt đầu. Hãy gọi chủ sân" (BR-11). Hàm `userCancelDecision` của `packages/shared` cho cùng kết quả ở hai mốc đó |
| AC-6 | An có các booking: "Bị từ chối", "Hết hạn", "Đã hủy", một booking "Đã xác nhận" 09:00–10:30 (giờ bắt đầu đã qua), và một booking "Chờ xác nhận" 12:00–13:00 có hạn xác nhận 09:30 mà DB còn ghi `PENDING` | An hủy từng booking | Mỗi booking nhận 409 "Booking này không hủy được nữa". Booking cuối chuyển sang `EXPIRED` trong DB (BR-8). Không booking nào đổi, trừ booking cuối. Hủy booking "Đã hủy" lần hai nhận cùng câu lỗi |
| AC-7 | An có booking "Chờ xác nhận". Bình có booking `PHONE` "Đã xác nhận". Còn Chi, Bình, admin, và một request không có cookie | Chi hủy booking của An. An hủy booking `PHONE` của Bình. An hủy một UUID không có. An hủy `abc`. Bình, admin và request không cookie gọi `POST /api/bookings/<id>/cancel` | Chi nhận 404 "Không tìm thấy booking". An hủy booking `PHONE` nhận 404 "Không tìm thấy booking". UUID không có nhận 404. `abc` nhận 400 "Dữ liệu không hợp lệ". Bình 403, admin 403 (BR-22), không cookie 401. Không booking nào đổi |
| AC-8 | An có hai booking "Đã xác nhận" trên "Sân 1" của Bình: 15:00–16:00 và 20:00–21:00. Bây giờ là 10:00 | Bình gọi `POST /api/owner/bookings/<id>/cancel` với từng booking | Cả hai nhận 200. `status` = `CANCELLED`, `cancelledAt` = 10:00. Chủ sân hủy được booking `APP` tới giờ bắt đầu, không có mốc 6 giờ: người dùng gọi chủ sân để hủy muộn (6.0.E1) |
| AC-9 | Năm booking `APP`. Bốn booking trên sân của Bình: "Chờ xác nhận" còn hạn, "Chờ xác nhận" có hạn xác nhận 09:30 đã qua mà DB còn ghi `PENDING`, "Bị từ chối", và "Đã xác nhận" 09:00–10:30. Booking thứ năm "Đã xác nhận" nằm trên sân của Dũng | Bình hủy từng booking | Booking "Chờ xác nhận" còn hạn nhận 409 "Yêu cầu đang chờ xác nhận. Hãy từ chối yêu cầu này". Booking quá hạn, "Bị từ chối" và "Đã xác nhận" đã bắt đầu nhận 409 "Booking này không hủy được nữa". Booking quá hạn là `EXPIRED` trong DB. Booking của Dũng nhận 404 "Không tìm thấy booking" (BR-23), và không đổi. Admin gọi route này nhận 403 (BR-22). Không booking nào khác đổi |
| AC-10 | An có 4 booking, tạo lần lượt lúc 08:00, 08:10, 08:20, 08:30. Trạng thái: "Đã hủy", "Chờ xác nhận" có hạn 09:30 đã qua mà DB còn ghi `PENDING`, "Đã xác nhận", "Bị từ chối". Chi có 1 booking. Bình có 1 booking `PHONE` | An gọi `GET /api/bookings/mine`. Rồi Bình, admin và request không cookie gọi route đó | An nhận đúng 4 booking, mới nhất trước (tạo lúc 08:30 đầu tiên). Mỗi booking có `courtName`, `venueName`, `venuePhone`, `status`, `cancelledAt`. Booking quá hạn hiện `EXPIRED`, và DB ghi `EXPIRED`. Không có booking của Chi hay của Bình. Bình 403, admin 403, không cookie 401 |
| AC-11 | An có booking "Đã xác nhận" 20:00–21:00 | 20 request của An hủy booking đó, gửi cùng lúc | Đúng 1 request nhận 200. 19 request nhận 409 "Booking này không hủy được nữa". Không request nào nhận 500. `cancelledAt` có đúng một giá trị |
| AC-12 | An có booking "Chờ xác nhận" 12:00–13:00 với hạn xác nhận 11:00. Bây giờ là 10:00 | 10 request của An hủy và 10 request của Bình xác nhận, gửi cùng lúc | Đúng 1 request nhận 200. Mọi request khác nhận 409. Không request nào nhận 500. Nếu một lần xác nhận thắng, booking là `CONFIRMED` và các lần hủy nhận 409 "Còn dưới 6 giờ nữa tới giờ bắt đầu. Hãy gọi chủ sân". Nếu một lần hủy thắng, booking là `CANCELLED` |
| AC-13 | An có booking "Đã xác nhận" 20:00–21:00 trên "Sân 1" | An hủy booking đó, và cùng lúc 10 request của Chi và 10 request của Bình (nhập booking `PHONE`) đặt "Sân 1", 20:00–21:00 | Không request nào nhận 500. Booking của An là `CANCELLED`. DB có nhiều nhất 1 booking "Chờ xác nhận" hoặc "Đã xác nhận" trên 20:00–21:00 (BR-1). Request đặt sân nhận 201 hoặc 409 "Khung giờ này vừa có người đặt" |
| AC-14 | Service nhận một transaction bị Postgres ngắt bằng `40P01` (hoặc `P2034`) ở route hủy của người dùng, ở route hủy của chủ sân, và ở `mine` | Gọi từng route | Hai route hủy trả 409 "Yêu cầu đang được xử lý, hãy thử lại", không phải 500, và đi qua `isDeadlock`. `mine` chạy lại lệnh `EXPIRE` một lần, rồi trả 409 cùng câu khi lần hai cũng bị ngắt |
| AC-15 | Web: `MyBookings` nhận từ API 5 booking: "Chờ xác nhận", "Đã xác nhận", "Bị từ chối", "Hết hạn", "Đã hủy" | Mở trang người dùng | Mỗi dòng hiện "Cầu lông A · Sân 1", ngày, giờ, giá, và nhãn trạng thái (`STATUS_LABEL`). Thứ tự giữ như API. Dòng "Đã hủy" có `data-status="CANCELLED"`. Khi API trả danh sách rỗng, trang hiện "Bạn chưa có booking nào" |
| AC-16 | Web: danh sách có booking "Chờ xác nhận" chưa tới giờ và booking "Đã xác nhận" còn 7 giờ | Người dùng bấm "Hủy" ở booking "Đã xác nhận", rồi bấm "Xác nhận hủy" | Bấm "Hủy" hiện "Xác nhận hủy" và "Giữ booking", và chưa gọi API. Bấm "Xác nhận hủy" gọi `POST /api/bookings/<id>/cancel`. Dòng đó ở lại trong danh sách với nhãn "Đã hủy", không còn nút. Focus chuyển tới nhãn mới. Bấm "Giữ booking" đưa focus về nút "Hủy" và không gọi API |
| AC-17 | Web: danh sách có booking "Đã xác nhận" còn 5 giờ, và booking "Bị từ chối", "Hết hạn", "Đã hủy", và "Đã xác nhận" đã bắt đầu | Mở trang người dùng | Booking còn 5 giờ không có nút "Hủy". Dòng đó hiện "Còn dưới 6 giờ nữa tới giờ bắt đầu. Hãy gọi chủ sân" (hằng số `CALL_OWNER_MESSAGE` của `packages/shared`, cùng câu với API) và một link "Gọi chủ sân" với `href` `tel:0911111111` (6.0.E1). Bốn booking kia không có nút "Hủy" và không có link gọi |
| AC-18 | Web: API trả 409 "Booking này không hủy được nữa" khi người dùng xác nhận hủy | Người dùng bấm "Xác nhận hủy" | Trang hiện câu lỗi đó với `role="alert"`. Web tải lại danh sách từ `GET /api/bookings/mine` và dòng hiện trạng thái mới của server |
| AC-19 | Web: danh sách "Booking đã xác nhận" của chủ sân nhận một booking `APP` chưa tới giờ (còn 3 giờ) và một booking `PHONE` chưa tới giờ | Chủ sân bấm "Hủy" ở booking `APP`, rồi bấm "Xác nhận hủy" | Cả hai booking có nút "Hủy". Web gọi `POST /api/owner/bookings/<id>/cancel`. Dòng `APP` ở lại với nhãn "Đã hủy". Dòng `PHONE` không đổi. Test F-007 AC-18 đổi theo: booking `APP` chưa tới giờ giờ có nút "Hủy" |

## Contract

Zod trong `packages/shared/src/booking.ts` là nguồn duy nhất. Hàm thuần nằm trong `packages/shared/src/booking-time.ts`, cạnh `confirmDeadline`.

| Endpoint or schema | Change | Request | Response and errors |
|---|---|---|---|
| `MyBookingView` | new | — | `BookingView` thêm `courtName` (chuỗi), `venueName` (chuỗi), `venuePhone` (`Phone`). `venuePhone` là số công khai của đơn vị, như `VenueView.phone`. Chỉ người đặt thấy view này |
| `CALL_OWNER_MESSAGE` | new | — | Hằng số chuỗi "Còn dưới 6 giờ nữa tới giờ bắt đầu. Hãy gọi chủ sân". API và web cùng dùng |
| `userCancelDecision(booking, now)` | new | `booking`: `{ status, startAt }`. `now`: thời điểm | `'ALLOW'` khi `status` = `PENDING` và `startAt` > `now` (BR-12), hoặc khi `status` = `CONFIRMED` và `startAt` − `now` ≥ 6 giờ (BR-11). `'CALL_OWNER'` khi `status` = `CONFIRMED`, `startAt` > `now`, và còn dưới 6 giờ. `'NONE'` ở mọi trường hợp khác. Server và web cùng dùng hàm này để chọn câu lỗi và nút |
| `GET /api/bookings/mine` | changed | — | 200 `MyBookingView[]`, xếp theo `createdAt` giảm dần, rồi `id` giảm dần. Chỉ booking có `createdById` là người gọi. Chạy lệnh `EXPIRE` cho các yêu cầu quá hạn của người gọi trước khi đọc (BR-8). Thêm `@Roles('USER')`: 403 cho `OWNER` và `ADMIN`, 401 khi không có phiên |
| `POST /api/bookings/:id/cancel` | new | — | 200 `MyBookingView` với `status` = `CANCELLED`. 400 "Dữ liệu không hợp lệ" khi `:id` không phải UUID (pipe `Id`). 401. 403 khi không phải `USER` (BR-22). 404 "Không tìm thấy booking" khi booking không có, không phải của người gọi, hoặc `source` = `PHONE`. 409 "Còn dưới 6 giờ nữa tới giờ bắt đầu. Hãy gọi chủ sân" khi quyết định là `CALL_OWNER`. 409 "Booking này không hủy được nữa" khi quyết định là `NONE`. 409 "Yêu cầu đang được xử lý, hãy thử lại" khi `40P01` hoặc `P2034` |
| `POST /api/owner/bookings/:id/cancel` | changed | — | 200 `BookingView` với `status` = `CANCELLED` cho booking "Đã xác nhận" của đơn vị của người gọi, mọi `source`, khi `startAt` > bây giờ. Bỏ lỗi "Chỉ hủy được booking bạn nhập cho khách gọi điện". 409 "Yêu cầu đang chờ xác nhận. Hãy từ chối yêu cầu này" khi `status` = `PENDING` sau `EXPIRE`. 409 "Booking này không hủy được nữa" ở mọi trường hợp khác. 409 "Yêu cầu đang được xử lý, hãy thử lại" khi `40P01` hoặc `P2034`. Mã 400, 401, 403, 404 như F-007 |

Thứ tự ở `POST /api/bookings/:id/cancel`. Bước 2 tới 7 chạy trong một transaction. Transaction không ném lỗi 409, vì lỗi làm rollback bước `EXPIRE`:

1. Kiểm UUID. Đọc `courtId` của booking. Không có: 404.
2. Khóa dòng `Venue` của sân (`FOR SHARE`), như `lockVenueOf`.
3. Khóa dòng `Court` (`FOR UPDATE`).
4. Đọc booking. Booking không thuộc người gọi (`createdById`), hoặc `source` = `PHONE`: 404. Bước này ở trước `EXPIRE`, nên một người lạ không ghi được gì lên booking của người khác, như `decide`.
5. Chuyển booking này sang `EXPIRED` khi nó `PENDING` và quá hạn (BR-8).
6. Một lệnh `updateMany` có điều kiện: `id`, `createdById` = người gọi, `source` = `APP`, `startAt` > bây giờ, và (`status` = `PENDING`, hoặc `status` = `CONFIRMED` và `startAt` ≥ bây giờ + 6 giờ). Lệnh đặt `status` = `CANCELLED` và `cancelledAt` = bây giờ. Một lệnh quyết định, nên hai lần hủy song song không cùng thắng.
7. Transaction trả `{ count, booking }`: số dòng đổi và booking đọc lại.

Sau khi transaction commit, khi `count` = 0, `userCancelDecision` chọn 409 `CALL_OWNER` hay 409 `NONE`. Cách này giữ `EXPIRED` mà bước 5 đã ghi, như `decide` ("The answer comes after the commit").

Bọc cả transaction bằng `try/catch`. Lỗi `40P01` hoặc `P2034` làm transaction bị ngắt và không commit. `catch` đổi lỗi đó thành 409 "Yêu cầu đang được xử lý, hãy thử lại", qua `isDeadlock`, như `decide`.

`POST /api/owner/bookings/:id/cancel` đổi như sau:

- Thêm khóa `Court` (`FOR UPDATE`) sau khóa `Venue`.
- Kiểm chủ đơn vị (404) trước bước `EXPIRE`, rồi thêm bước `EXPIRE` của booking.
- Đổi điều kiện `updateMany` từ `source` = `PHONE` thành mọi `source`.
- Chọn mã 409 sau commit, như route của người dùng. Lệnh `EXPIRE` ở lại khi route trả 409 (AC-9).
- Phần còn lại giữ như F-007.

Thứ tự khóa của mọi route sau slice này:

| Route | Khóa |
|---|---|
| Người dùng hủy booking (mới) | `Venue` (`FOR SHARE`), `Court` (`FOR UPDATE`), rồi dòng `Booking` (`UPDATE`) |
| Chủ sân hủy booking (đổi) | `Venue` (`FOR SHARE`), `Court` (`FOR UPDATE`), rồi dòng `Booking` (`UPDATE`) |
| Chủ sân xác nhận hoặc từ chối | `Venue` (`FOR SHARE`), `Court` (`FOR UPDATE`), rồi dòng `Booking` (`UPDATE`) |
| Chủ sân nhập booking | `Venue` (`FOR SHARE`), rồi `Court` (`FOR UPDATE`) |
| Người dùng gửi yêu cầu | `Court` (`FOR UPDATE`). Đọc `Venue` không khóa |
| `mine` và danh sách của chủ sân (lệnh `EXPIRE`) | Các dòng `Booking` theo thứ tự `id` (`FOR UPDATE`) |
| Chủ sân sửa giá (F-005) | `Venue` (`FOR SHARE`), rồi `Court` (`UPDATE`) |
| Chủ sân sửa giờ (F-005) | `Venue` (`FOR UPDATE`) |
| Admin sửa đơn vị | `Venue` (`FOR UPDATE`), rồi `User` (`FOR SHARE`) khi đổi chủ sân |
| Admin sửa sân | `Court` (`UPDATE`) |

Không route nào khóa `Court` hoặc `Booking` rồi mới khóa `Venue`, nên không có vòng chờ giữa các route có thứ tự này. Một vòng hiếm còn lại: lệnh `EXPIRE` của `mine` hoặc của danh sách khóa nhiều dòng `Booking`, trong khi một route khác giữ khóa `Court` và chờ dòng đó. Mã `40P01` của vòng này đổi thành 409, hoặc `EXPIRE` chạy lại một lần (AC-14). AC-11, AC-12 và AC-13 chạy trên Postgres thật.

## Data

| Table | Change | Migration step |
|---|---|---|
| — | Không đổi schema. `Booking.cancelledAt`, `source`, `createdById` đã có từ F-002 và F-007. `Court.name`, `Venue.name`, `Venue.phone` đã có | — |

## Build order

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Hợp đồng và API: `MyBookingView`, `userCancelDecision`, `mine` có `@Roles('USER')` và lệnh `EXPIRE`, `POST /api/bookings/:id/cancel`, đổi route hủy của chủ sân, `PROGRESS.md`, brief này với Status: accepted | `packages/shared/src/booking.ts`, `packages/shared/src/booking-time.ts`, `packages/shared/src/booking-time.test.ts`, `packages/shared/src/booking.test.ts`, `apps/api/src/modules/bookings/` (gồm file test mới `cancel-bookings.e2e.test.ts`), `PROGRESS.md`, file brief này | AC-1 tới AC-14. Test AC-10 của F-007 (`phone-bookings.e2e.test.ts`) đổi để booking `APP` "Chờ xác nhận" nhận câu lỗi mới. Test cũ khác vẫn đạt. Review bằng phiên mới và skill `rule-review` |
| 2 | Màn hình: `MyBookings` có tên đơn vị, tên sân, nút hủy, và dòng "Gọi chủ sân". "Booking đã xác nhận" của chủ sân có nút "Hủy" cho booking `APP` chưa tới giờ. `PROGRESS.md` | `apps/web/src/features/bookings/`, `apps/web/src/app/styles.css`, `PROGRESS.md` | AC-15 tới AC-19 |

Màn hình web:

- `MyBookings` đổi kiểu dữ liệu thành `MyBookingView`. Mỗi dòng hiện "Tên đơn vị · Tên sân" ngoài ngày, giờ, giá và trạng thái.
- Nút "Hủy" của người dùng chỉ hiện khi `userCancelDecision` trả `ALLOW`. Khi `CALL_OWNER`, dòng hiện câu hướng dẫn và link `tel:`. Khi `NONE`, dòng không có gì thêm.
- Nút "Hủy" hỏi lại bằng "Xác nhận hủy" và "Giữ booking", như `PhoneBookings`. Mã của hai danh sách có thể dùng chung một component nhỏ trong `apps/web/src/features/bookings/`.
- Sau khi hủy, dòng đổi tại chỗ. Khi API trả 409, trang tải lại danh sách.
- Chủ sân thấy nút "Hủy" cho mọi booking "Đã xác nhận" chưa tới giờ, kể cả `APP`. Dòng `APP` hiện tên và số điện thoại của người đặt, như hiện nay (BR-20).
- Màn hình rộng 390px vẫn dùng được.

## Edit boundaries

- May edit: các path trong bảng Build order, `pnpm-lock.yaml` khi cần.
- Leave unchanged without approval: `AGENTS.md`, `.dependency-cruiser.cjs`, `scripts/check.mjs`, `.github/workflows/`, `apps/api/prisma/`, `apps/api/src/modules/auth/`, `apps/api/src/modules/admin/`, `apps/api/src/modules/venues/`, `apps/api/src/modules/database/`, `apps/web/src/features/venues/`, `apps/web/src/features/admin/`, `apps/web/src/components/`, các file trong `docs/requirements/`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Đồng thời: hủy song song, hủy cùng xác nhận, hủy cùng đặt lại giờ đó | Hai route hủy, `decide`, `insertUnderLock` | Thứ tự khóa `Venue`, `Court`, `Booking` ở mọi route. Một `updateMany` có điều kiện quyết định. EXCLUDE là chốt cuối cho BR-1. AC-11, AC-12, AC-13. Review bằng phiên mới và skill `rule-review` |
| Vòng chờ: `EXPIRE` của `mine` với một route giữ khóa `Court` | `mine`, `forOwner`, `insertUnderLock` | `EXPIRE` khóa dòng theo thứ tự `id`. `40P01` hoặc `P2034` đổi thành 409 qua `isDeadlock`, hoặc chạy lại một lần. AC-14. Review bằng phiên mới |
| Quy tắc 6 giờ: sai một mốc cho người dùng hủy muộn hoặc chặn hủy sớm | `updateMany`, `userCancelDecision` | Một hàm thuần cho server và web. Test mốc 14:00:00.000 và 14:00:00.001 (AC-5). Review bằng phiên mới |
| Phân quyền: người dùng hủy booking của người khác hoặc booking `PHONE`, chủ sân hủy booking của đơn vị khác, admin hủy (BR-22, BR-23) | Hai route hủy, `mine` | Điều kiện `createdById`, `source`, và chủ đơn vị nằm trong `updateMany`. 404 che việc id có tồn tại. `@Roles`. AC-7, AC-9, AC-10 |
| Dữ liệu cá nhân: `venuePhone` trong `MyBookingView` | `mine`, hủy | Số công khai của đơn vị. View không có số của người dùng khác. AC-10 |

## Assumptions

- Chủ sân hủy được booking `APP` "Đã xác nhận" tới đúng giờ bắt đầu, không có mốc 6 giờ. Intake bắt người hủy muộn "gọi chủ sân" (6.0.E1), nên chủ sân phải hủy được. Bảng Phân quyền của intake không có dòng "hủy booking" cho chủ sân. Brief F-007 đã cho chủ sân hủy booking `PHONE` theo cùng quy tắc.
- Chủ sân không hủy yêu cầu "Chờ xác nhận". Chủ sân từ chối yêu cầu đó (UC-4).
- Người dùng hủy booking "Chờ xác nhận" tới đúng giờ bắt đầu. Hạn xác nhận (BR-7) luôn qua trước giờ bắt đầu, nên một yêu cầu quá hạn đã thành "Hết hạn" và không hủy được.
- Route hủy chạy bước `EXPIRE` trước, như `decide`. Người dùng không hủy được yêu cầu mà server đã coi là "Hết hạn".
- Booking "Đã xác nhận" đã bắt đầu có quyết định `NONE`: không hiện link gọi. Figure 9 của models.md gửi cả trường hợp này tới "gọi điện cho chủ sân". Brief khác Figure 9 vì chủ sân cũng không hủy được sau giờ bắt đầu.
- Mốc 6 giờ gồm cả mốc: còn đúng 6 giờ thì hủy được. BR-11 viết "từ 6 giờ trở lên".
- `GET /api/bookings/mine` chỉ cho vai trò `USER`. Chủ sân không còn gọi được route này, nên booking `PHONE` mà chủ sân nhập không hiện ở đó. Câu hỏi này mở từ brief F-007. Chủ sân xem booking `PHONE` ở "Booking đã xác nhận".
- Lịch sử xếp theo `createdAt` giảm dần, rồi `id` giảm dần. Đó là "mới nhất trước" của 6.0 bước 2. Lịch sử không giới hạn số dòng.
- Route `mine` ghi dữ liệu (lệnh `EXPIRE`) như danh sách của chủ sân. Cách này giữ một nguồn sự thật cho trạng thái "Hết hạn" mà không cần job nền.
- Link "Gọi chủ sân" dùng `Venue.phone`. Chủ sân của sân là người nhận cuộc gọi (UC-2).

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Chủ sân có cần nhận thông báo khi người dùng hủy, và người dùng có cần nhận thông báo khi chủ sân hủy? Danh sách sự kiện của UC-14 chưa có sự kiện hủy | Bạn, khi làm UC-14 | không |
| Chủ sân có hủy booking `APP` "Đã xác nhận" sau giờ bắt đầu được không, để số liệu UC-12 đủ? Brief này không cho | Bạn, khi làm UC-12 | không |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
