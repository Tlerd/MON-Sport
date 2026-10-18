---
style: ste80
lang: vi
---

# F-011: Mở trận, xem phòng chờ và hủy trận

Status: accepted (bạn duyệt và Reviewer vòng 2 thông qua ngày 18/10/2026)
Source:

- Intake `docs/requirements/intake-monsport-v1.md`:
  - UC-7: "Mở trận trong phòng chờ trên một booking của mình".
  - UC-8 (bước 1–2): "Xem phòng chờ, lọc theo môn và ngày".
  - UC-9: "Hủy trận".
  - Mục "UC-7, UC-8: phòng chờ" (bước 1–3), mục "Trạng thái của trận", mục "Phân quyền", Acceptance UC-7 và UC-9, Assumptions.
- `docs/requirements/use-cases.md` UC-4 (4.1), UC-6 (bước 4), UC-7 (7.0, 7.0.E1), UC-8 (8.0 bước 1–2), UC-9 (9.0, 9.0.E1).
- `docs/requirements/business-rules.md` BR-8, BR-11, BR-12, BR-13, BR-14, BR-16, BR-17, BR-19, BR-20, BR-22, BR-25, BR-27.
- `docs/requirements/data-dictionary.md`: `Match`, `MatchPlayer`, `MatchStatus`, `MatchPlayerStatus`.
- `docs/requirements/models.md`: Figure 5, Figure 6, Figure 8.
- Brief `F-009-nguoi-dung-huy-booking-va-xem-lich-su.md`: non-goal "Hủy trận gắn với booking (UC-6 bước 4)".

## Goal

Host mở được trận trên một booking "Chờ xác nhận" hoặc "Đã xác nhận" của mình và hủy được trận đó, còn người dùng xem và lọc được các trận đang mở trong phòng chờ. Kiểm tra bằng ví dụ của intake: mở trận cầu lông 4 suất, giá 50.000đ mỗi suất trên booking 20:00–21:00 đang chờ xác nhận, phòng chờ hiện trận với nhãn "Chưa xác nhận", và khi host hủy trận thì cả trận lẫn booking chuyển sang "Đã hủy".

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Người ghép trận bấm vào trận, rời trận, xem chi tiết trận và danh sách trận đã vào (UC-8 bước 3–5, 8.1, 8.2, BR-15, BR-18) | Tách riêng để mỗi brief không quá 3 pull request. Schema `MatchPlayer` vẫn tạo ngay ở slice này để không phải sửa bảng lần hai | Brief F-012 |
| Phòng chờ tự cập nhật trong vòng 2 giây qua SSE (UC-7, UC-8) | Cần kết hợp với sự kiện vào trận và rời trận | Brief F-012 |
| Gửi thông báo Web Push và thông báo trong app khi trận bị hủy (UC-9 bước 3, UC-14) | UC-14 nằm sau UC-7..UC-9 trong thứ tự ra mắt của intake | Brief của UC-14 |
| Sửa số suất hoặc giá mỗi suất sau khi đã mở trận | Intake không có thao tác sửa trận. Host hủy trận rồi đặt lại nếu cần | Khi có yêu cầu |
| Mở lại trận mới trên cùng một booking sau khi trận cũ đã hủy | Mọi luồng làm trận hủy (BR-16, BR-17, UC-6 bước 4) đều làm booking hủy, bị từ chối hoặc hết hạn. `Match.bookingId` là duy nhất (BR-13) | Không có kế hoạch |
| Thu tiền mỗi suất trong app | Bản đầu host tự thu tiền tại sân (intake, Out of scope) | Bản sau |

## Acceptance criteria

Dữ liệu chung: mỗi test tạo lại dữ liệu này trước khi chạy, như `apps/api/src/modules/bookings/cancel-bookings.e2e.test.ts`.

- Admin (`0900000000`).
- Chủ sân "Bình" (`0912345678`) quản lý "Cầu lông A" (địa chỉ "10 Nguyễn Huệ", số `0911111111`, mở 06:00, đóng 23:00) có "Sân 1" (`BADMINTON`) và "Sân 2" (`FOOTBALL`).
- Chủ sân "Dũng" (`0912345679`) quản lý "Cầu lông B" với "Sân 1" (`BADMINTON`).
- Người dùng "An" (`0901234567`) và "Chi" (`0901234568`).
- Bây giờ là 20/11/2026 10:00 `Asia/Ho_Chi_Minh`, trừ khi dòng ghi giờ khác. Mọi giờ dưới đây là ngày 20/11/2026.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | An có booking "Chờ xác nhận" 20:00–21:00 trên "Sân 1" (`BADMINTON`) của "Cầu lông A" | An gọi `POST /api/matches` với `bookingId`, `capacity` = 4, `pricePerSlot` = 50000 | 201. Response có `status` = `OPEN`, `sport` = `BADMINTON`, `capacity` = 4, `joinedCount` = 1, `pricePerSlot` = 50000, `bookingStatus` = `PENDING`, `courtName` = "Sân 1", `venueName` = "Cầu lông A", `hostName` = "An". Bảng `MatchPlayer` có đúng 1 dòng của An với `status` = `ACTIVE` (BR-13, BR-14, ví dụ UC-7) |
| AC-2 | An có booking "Đã xác nhận" 18:00–19:00 trên "Sân 2" (`FOOTBALL`) | An gọi `POST /api/matches` với `capacity` = 10, `pricePerSlot` = 0 | 201. `sport` = `FOOTBALL`, `bookingStatus` = `CONFIRMED`, `joinedCount` = 1, `pricePerSlot` = 0 |
| AC-3 | An đã mở trận trên booking 20:00–21:00 (như AC-1) | 10 request của An gọi `POST /api/matches` trên cùng `bookingId` đó cùng lúc | Mọi request nhận 409 "Booking này đã có trận" (7.0.E1, BR-13). DB vẫn chỉ có 1 trận cho booking đó |
| AC-4 | An có các booking: "Bị từ chối", "Hết hạn", "Đã hủy", một booking "Đã xác nhận" 09:00–10:00 (đã bắt đầu), và một booking "Chờ xác nhận" 12:00–13:00 có hạn xác nhận 09:30 mà DB còn ghi `PENDING` | An mở trận trên từng booking | Mỗi booking nhận 409 "Chỉ mở được trận trên booking đang chờ xác nhận hoặc đã xác nhận". Booking cuối chuyển sang `EXPIRED` trong DB (BR-8). Không có trận nào được tạo |
| AC-5 | An có booking "Chờ xác nhận" 20:00–21:00. Bình có booking `PHONE` "Đã xác nhận" 19:00–20:00 | Chi mở trận trên booking của An. An mở trận trên booking `PHONE` của Bình. An mở trận với `bookingId` không có. An gửi `capacity` = 1, `capacity` = 31, `pricePerSlot` = -1, `bookingId` = `abc`. Bình, admin và request không cookie gọi `POST /api/matches` | Booking của An (khi Chi gọi), booking `PHONE`, và UUID không có nhận 404 "Không tìm thấy booking". `capacity` ngoài 2..30 trả 400 "Số suất từ 2 đến 30". `pricePerSlot` âm trả 400 "Giá mỗi suất không hợp lệ". `abc` trả 400 "Dữ liệu không hợp lệ". Bình 403, admin 403 (BR-22), không cookie 401 |
| AC-6 | An mở trận cầu lông trên booking "Chờ xác nhận" 20:00–21:00 ngày 20/11 ("Sân 1"). Chi mở trận bóng đá trên booking "Đã xác nhận" 18:00–19:00 ngày 20/11 ("Sân 2") và một trận cầu lông 06:00–07:00 ngày 21/11 (`2026-11-20T23:00:00.000Z` UTC, để kiểm ranh giới ngày `Asia/Ho_Chi_Minh`, BR-27) | Khách chưa đăng nhập gọi `GET /api/matches`, rồi lọc `?sport=BADMINTON&date=2026-11-20`, rồi `?date=2026-11-21`, rồi `?date=2026-11-19` và `?date=0000-01-01` | Lần đầu trả 3 trận theo giờ bắt đầu tăng dần (18:00 ngày 20/11, 20:00 ngày 20/11, 06:00 ngày 21/11). Lọc `sport=BADMINTON&date=2026-11-20` trả đúng 1 trận của An với `bookingStatus` = `PENDING` (không dính trận 06:00 ngày 21/11 của Chi dù giờ UTC là ngày 20/11). Lọc `date=2026-11-21` trả đúng 1 trận 06:00 ngày 21/11 của Chi. Ngày đã qua (`2026-11-19`, `0000-01-01`) trả `[]`. Không phần tử nào có số điện thoại của host hay người chơi (BR-20). Với `date=2026-13-45` hoặc `sport=TENNIS`, API trả 400 "Dữ liệu không hợp lệ" |
| AC-7 | An mở trận trên booking "Chờ xác nhận" 20:00–21:00. Chi mở trận trên booking "Chờ xác nhận" 19:00–20:00 | Bình gọi `POST /api/owner/bookings/<id>/confirm` cho booking của An, và `POST /api/owner/bookings/<id>/reject` cho booking của Chi | Trong `GET /api/matches`, trận của An có `bookingStatus` = `CONFIRMED`. Trận của Chi chuyển sang `status` = `CANCELLED` trong DB (BR-16) và không còn trong phòng chờ |
| AC-8 | An mở trận trên booking "Chờ xác nhận" 20:00–21:00, gửi lúc 10:00 nên hạn xác nhận là 12:00. Chi mở trận trên booking "Đã xác nhận" 10:30–11:30 | Đặt giờ là 12:01. Gọi `GET /api/matches`, rồi An và Chi gọi `GET /api/bookings/mine` | Booking của An chuyển sang `EXPIRED` và trận của An chuyển sang `CANCELLED` (BR-8, BR-16). Trận của Chi chuyển sang `FINISHED` vì đã qua 11:30 (BR-19). `GET /api/matches` trả `[]`. `GET /api/bookings/mine` của An trả `sport` = `BADMINTON` và `match.status` = `CANCELLED`; của Chi trả `match.status` = `FINISHED` |
| AC-9 | An có hai booking đã mở trận: một "Chờ xác nhận" 20:00–21:00, một "Đã xác nhận" 18:00–19:00 | An gọi `POST /api/bookings/<id>/cancel` ở booking đầu. Bình gọi `POST /api/owner/bookings/<id>/cancel` ở booking thứ hai. Rồi An gọi `GET /api/bookings/mine` | Cả hai lần hủy nhận 200. Cả hai booking và cả hai trận đều có `status` = `CANCELLED` trong DB và trong `GET /api/bookings/mine` (UC-6 bước 4, F-009) |
| AC-10 | An mở trận trên booking "Chờ xác nhận" 12:00–13:00 (hạn 11:00), và mở trận thứ hai trên booking "Đã xác nhận" 20:00–21:00. Bây giờ là 10:00 | An gọi `POST /api/matches/<id>/cancel` cho từng trận | Cả hai nhận 200 với `status` = `CANCELLED`. Cả hai booking chuyển sang `CANCELLED` với `cancelledAt` = 10:00 (UC-9, BR-17, BR-11, BR-12). Khung giờ trên sân trống lại |
| AC-11 | An mở trận trên booking "Đã xác nhận" 20:00–21:00 | Lúc 14:00:00.001 (còn dưới 6 giờ), An gọi `POST /api/matches/<id>/cancel` | 409 "Còn dưới 6 giờ nữa tới giờ bắt đầu. Hãy gọi chủ sân" (9.0.E1, BR-11). Trận vẫn `OPEN`, booking vẫn `CONFIRMED`. Sau đó Bình hủy booking qua `POST /api/owner/bookings/<id>/cancel` thì cả booking và trận chuyển sang `CANCELLED` |
| AC-12 | An có trận đã hủy (AC-10), một trận trên booking "Chờ xác nhận" có hạn 09:30 đã qua mà DB còn ghi `PENDING`, và một trận trên booking "Đã xác nhận" 08:00–09:00 đã kết thúc. Chi có một trận đang `OPEN` | An hủy từng trận của mình. An hủy trận của Chi và một UUID không có. Bình và admin gọi `POST /api/matches/<id>/cancel` | Ba trận của An nhận 409 "Trận này không hủy được nữa"; trận quá hạn chuyển sang `CANCELLED` kèm booking `EXPIRED` (BR-16), trận đã kết thúc chuyển sang `FINISHED` (BR-19). Trận của Chi và UUID không có nhận 404 "Không tìm thấy trận". Bình 403, admin 403 (BR-22) |
| AC-13 | An có booking "Chờ xác nhận" 20:00–21:00 (trường hợp 1), và một trận `OPEN` trên booking "Chờ xác nhận" 18:00–19:00 (trường hợp 2) | Trường hợp 1: An gọi `POST /api/matches` cùng lúc Bình gọi `POST /api/owner/bookings/<id>/reject`. Trường hợp 2: 10 request của An hủy trận cùng lúc 10 request của Bình xác nhận booking | Không request nào nhận 500. Ở trường hợp 1, nếu `reject` thắng thì không có trận `OPEN`; nếu mở trận thắng trước thì sau khi `reject` xong cả booking (`REJECTED`) và trận (`CANCELLED`) đều đã đóng (BR-13, BR-16). Ở trường hợp 2, đúng 1 bên thắng: hoặc trận và booking cùng `CANCELLED`, hoặc booking `CONFIRMED` và trận vẫn `OPEN` |
| AC-14 | Migration của F-011 đã chạy | Lệnh SQL chèn `Match` có `capacity` = 1, `capacity` = 31, `pricePerSlot` = -1, `joinedCount` = 5 khi `capacity` = 4, hoặc chèn dòng `Match` thứ hai có cùng `bookingId` | Bốn lệnh đầu nhận SQLSTATE `23514` (`CHECK`). Lệnh cuối nhận `23505` (`UNIQUE`) |
| AC-15 | Web: `MyBookings` của An nhận một booking "Chờ xác nhận" chưa có trận, và một booking "Đã xác nhận" (còn 8 giờ) đã có trận `OPEN` (4 suất, 1 người, 50.000đ/suất) | An bấm "Mở trận" ở booking đầu, nhập số suất `4` và giá mỗi suất `50000`, bấm "Tạo trận". Rồi ở booking thứ hai, An bấm "Hủy trận" rồi "Xác nhận hủy trận" | Khi mở trận: web gọi `POST /api/matches`, dòng booking đầu hiện "Trận đang mở · 1/4 suất · 50.000đ/suất" và nút "Hủy trận". Khi hủy trận: web gọi `POST /api/matches/<id>/cancel`, dòng thứ hai chuyển sang trạng thái booking "Đã hủy" và trận "Đã hủy" |
| AC-16 | Web: mở app với tư cách khách chưa đăng nhập và với tư cách `USER` | Xem mục "Phòng chờ", chọn môn "Cầu lông" và ngày `2026-11-20` | Mục "Phòng chờ" hiện danh sách trận từ `GET /api/matches`, gồm tên đơn vị, tên sân, giờ, môn, số suất (`1/4 suất`), giá mỗi suất (`50.000đ/suất`), tên host, và nhãn "Chưa xác nhận" hoặc "Đã xác nhận". Khi lọc môn và ngày, web gọi `GET /api/matches?sport=BADMINTON&date=2026-11-20`. Khi không có trận, vùng `role="status"` hiện "Chưa có trận nào đang mở" |

## Contract

Zod trong `packages/shared/src/match.ts` (mới) và `packages/shared/src/booking.ts` là nguồn duy nhất. Để tránh import vòng (`no-circular` trong `.dependency-cruiser.cjs`), `MatchStatus` và `MatchSummary` khai báo trong `booking.ts` và được `match.ts` re-export.

| Endpoint or schema | Change | Request | Response and errors |
|---|---|---|---|
| `MatchStatus` | new | — | `z.enum(['OPEN', 'FULL', 'CANCELLED', 'FINISHED'])` |
| `MatchPlayerStatus` | new | — | `z.enum(['ACTIVE', 'LEFT'])` |
| `CreateMatchRequest` | new | `{ bookingId: z.uuid(), capacity: z.int().min(2).max(30), pricePerSlot: z.int().min(0).max(10_000_000) }`. Strict | — |
| `MatchLobbyQuery` | new | `{ sport?: Sport, date?: z.iso.date() }`. Strict | — |
| `MatchSummary` | new | — | `{ id, status: MatchStatus, capacity, joinedCount, pricePerSlot }`. Bước 2 gắn vào `MyBookingView` (`sport: Sport`, `match: MatchSummary.nullable()`) |
| `MatchView` | new | — | `{ id, bookingId, hostId, hostName, sport, capacity, joinedCount, pricePerSlot, status: MatchStatus, bookingStatus: BookingStatus, startAt, endAt, courtName, venueName, venueAddress, createdAt }`. Không chứa số điện thoại (BR-20) |
| `POST /api/matches` | new | `CreateMatchRequest`. Vai trò `USER` | 201 `MatchView`. 400 câu lỗi tiếng Việt của AC-5. 401, 403 (BR-22). 404 "Không tìm thấy booking" khi booking không có, không thuộc người gọi, hoặc `source` = `PHONE`. 409 "Booking này đã có trận" (BR-13). 409 "Chỉ mở được trận trên booking đang chờ xác nhận hoặc đã xác nhận". 409 "Yêu cầu đang được xử lý, hãy thử lại" khi `40P01`/`P2034` |
| `GET /api/matches` | new, công khai | `MatchLobbyQuery` | 200 `MatchView[]` chỉ gồm các trận `status` = `OPEN` và `Booking.startAt` > bây giờ, sắp theo `Booking.startAt` tăng dần, rồi `id` tăng dần. Khi có `date`, lọc `Booking.startAt` trong `[startOfDayVN(date), startOfDayVN(date) + 24h)` theo `Asia/Ho_Chi_Minh` (BR-27); nếu `startOfDayVN(date) + 24h <= now` thì trả `[]` ngay mà không truy vấn DB (tránh lỗi driver với năm `0000`). Trước khi đọc, chạy `expire` (BR-8, BR-16) rồi `finish` (BR-19), thử lại 1 lần khi `isDeadlock` và trả 409 "Yêu cầu đang được xử lý, hãy thử lại" nếu lần hai vẫn `40P01`/`P2034`. 400 "Dữ liệu không hợp lệ" khi query sai |
| `POST /api/matches/:id/cancel` | new | — | 200 `MatchView` với `status` = `CANCELLED` và `bookingStatus` = `CANCELLED`. 400 khi `:id` không phải UUID. 401, 403 (không phải `USER`). 404 "Không tìm thấy trận" khi trận không có hoặc `hostId` khác người gọi. 409 `CALL_OWNER_MESSAGE` khi booking `CONFIRMED` còn dưới 6 giờ (BR-11). 409 "Trận này không hủy được nữa" ở mọi trường hợp không hủy được khác. 409 "Yêu cầu đang được xử lý, hãy thử lại" khi `40P01`/`P2034` |
| `GET /api/bookings/mine` | changed | — | `MyBookingView` thêm `sport: Sport` và `match: MatchSummary \| null`. Trước khi đọc, chạy `expire` (BR-8, BR-16) rồi `finish` (BR-19) cho các booking của người gọi, thử lại 1 lần khi `isDeadlock` và trả 409 nếu lần hai vẫn `40P01`/`P2034` |
| `POST /api/bookings/:id/cancel`, `POST /api/owner/bookings/:id/cancel`, `POST /api/owner/bookings/:id/reject` | changed | — | Trong cùng transaction sau khóa `Court`, chuyển trận gắn với booking (nếu đang `OPEN` hoặc `FULL`) sang `CANCELLED` (BR-16, UC-6 bước 4) |

Trong `POST /api/matches` và `POST /api/matches/:id/cancel`, kiểm tra quyền sở hữu (404 khi không thuộc người gọi) nằm **trước** bước `expire` và `finish`, để người lạ không ghi được trạng thái lên booking/trận của người khác. Các lỗi 409 (booking không còn `PENDING`/`CONFIRMED`, trận không còn `OPEN`/`FULL`, hoặc còn dưới 6 giờ) được ném **sau khi** transaction đã commit, để trạng thái `EXPIRED`, `CANCELLED` (do quá hạn) hoặc `FINISHED` đã ghi ở bước trước được giữ lại trong DB (AC-4, AC-12), giống `decide` và `cancelUnderLock` của `BookingsService`.

Thứ tự khóa của mọi route ghi `Match`:

| Route | Khóa |
|---|---|
| Host mở trận (`POST /api/matches`) | `Venue` (`FOR SHARE`), `Court` (`FOR UPDATE`), kiểm chủ booking (404), chạy `expire` cho booking, rồi chèn `Match` và `MatchPlayer` |
| Host hủy trận (`POST /api/matches/:id/cancel`) | `Venue` (`FOR SHARE`), `Court` (`FOR UPDATE`), kiểm `hostId` (404), chạy `expire` và `finish` cho trận, rồi cập nhật `Booking` và `Match` |
| Người dùng / chủ sân hủy booking, chủ sân từ chối booking | `Venue` (`FOR SHARE`), `Court` (`FOR UPDATE`), cập nhật `Booking`, rồi cập nhật `Match` |
| Lệnh `EXPIRE` (`BookingsService.expire`) | Khóa các dòng `Booking` theo thứ tự `id` (`ORDER BY id FOR UPDATE`), rồi khóa và cập nhật `Match` của các dòng vừa `EXPIRED` theo thứ tự `id` (`ORDER BY id FOR UPDATE`) trong cùng một câu SQL CTE |
| Lệnh `FINISH` (`finishPastMatches`) | Khóa và cập nhật các dòng `Match` đang `OPEN`/`FULL` có `Booking.status = 'CONFIRMED'` và `Booking.endAt <= now` theo thứ tự `Match.id` (`ORDER BY m.id FOR UPDATE`) |

Mọi route tác động đến một sân đều đi qua khóa `Venue` (`FOR SHARE`) rồi `Court` (`FOR UPDATE`) trước khi đụng tới `Booking` và `Match`. Không route nào khóa `Match` trước `Booking` hay `Court`, và các lệnh cập nhật nhiều dòng (`expire`, `finish`) luôn khóa theo thứ tự `id` tăng dần. Lỗi `40P01` hoặc `P2034` đổi thành 409 "Yêu cầu đang được xử lý, hãy thử lại" qua `isDeadlock`.

## Data

| Table | Change | Migration step |
|---|---|---|
| enum `MatchStatus`, `MatchPlayerStatus` | mới: `MatchStatus` (`OPEN`, `FULL`, `CANCELLED`, `FINISHED`), `MatchPlayerStatus` (`ACTIVE`, `LEFT`) theo data dictionary | expand |
| `Match` | mới: `id` uuid v7 PK, `bookingId` uuid unique FK -> `Booking(id)`, `hostId` uuid FK -> `User(id)`, `sport` `Sport`, `capacity` int, `pricePerSlot` int, `status` `MatchStatus` default `OPEN`, `joinedCount` int, `createdAt` timestamptz(3). `CHECK ("capacity" >= 2 AND "capacity" <= 30 AND "pricePerSlot" >= 0 AND "pricePerSlot" <= 10000000 AND "joinedCount" >= 0 AND "joinedCount" <= "capacity")`. Index `(status, sport)` và `(hostId)` | expand |
| `MatchPlayer` | mới: `matchId` uuid FK -> `Match(id)`, `userId` uuid FK -> `User(id)`, `status` `MatchPlayerStatus`, `joinedAt` timestamptz(3), `leftAt` timestamptz(3) null. PK `(matchId, userId)`, index `(userId, status)` | expand |

## Build order

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Hợp đồng và schema: `packages/shared/src/match.ts`, `MatchStatus` và `MatchSummary` trong `booking.ts`, Prisma `Match` và `MatchPlayer`, migration kèm `CHECK`, `PROGRESS.md` | `packages/shared/src/match.ts`, `packages/shared/src/match.test.ts`, `packages/shared/src/booking.ts`, `packages/shared/src/index.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `apps/api/prisma/migration.test.ts`, `PROGRESS.md`, file brief này | Test Zod cho `CreateMatchRequest`, `MatchLobbyQuery`, `MatchView`, `MatchSummary`. AC-14 trong `migration.test.ts` trên Postgres thật. Review bằng phiên mới và skill `rule-review` |
| 2 | Server: mở rộng `MyBookingView` (`sport`, `match`), module `matches` (`POST /api/matches`, `GET /api/matches`, `POST /api/matches/:id/cancel`), hủy dây chuyền và `finish` trong `BookingsService`, `PROGRESS.md` | `packages/shared/src/booking.ts`, `packages/shared/src/booking.test.ts`, `apps/api/src/modules/matches/` (mới), `apps/api/src/modules/bookings/`, `apps/api/src/app.module.ts`, `PROGRESS.md` | AC-1 tới AC-13 trong `matches.e2e.test.ts` và `cancel-bookings.e2e.test.ts`. Review bằng phiên mới và skill `rule-review` |
| 3 | Màn hình: mở và hủy trận trong `MyBookings`, mục "Phòng chờ" cho khách và người dùng, `PROGRESS.md` | `apps/web/src/features/matches/` (mới), `apps/web/src/features/bookings/`, `apps/web/src/app/App.tsx`, `apps/web/src/app/App.test.tsx`, `apps/web/src/app/styles.css`, `PROGRESS.md` | AC-15 trong `MyBookings.test.tsx`, AC-16 trong `Lobby.test.tsx` và `App.test.tsx` |

## Edit boundaries

- May edit: các path trong bảng Build order.
- Leave unchanged without approval: `AGENTS.md`, `.dependency-cruiser.cjs`, `scripts/check.mjs`, `.github/workflows/`, `apps/api/src/modules/auth/`, `apps/api/src/modules/admin/`, `apps/api/src/modules/venues/`, `apps/api/src/modules/database/`, `apps/web/src/features/admin/`, `apps/web/src/features/auth/`, `apps/web/src/features/venues/`, các file trong `docs/requirements/`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Đồng thời: mở trận cùng lúc chủ sân từ chối booking, hoặc host hủy trận cùng lúc chủ sân xác nhận | `MatchesService`, `BookingsService` | Cùng thứ tự khóa `Venue` (`FOR SHARE`) -> `Court` (`FOR UPDATE`) -> `Booking` -> `Match`. Kiểm 404 trước `expire`/`finish` và ném 409 sau commit. AC-13 chạy trên Postgres thật. Review bằng phiên mới và skill `rule-review` |
| Vòng chờ (`40P01`) khi `expire` và `finish` cập nhật nhiều dòng cùng lúc với một route giữ khóa `Court` | `BookingsService.expire`, `finishPastMatches`, `GET /api/matches`, `mine` | Khóa dòng theo thứ tự `id` tăng dần (`ORDER BY id FOR UPDATE`). Thử lại 1 lần khi `isDeadlock`, lần hai trả 409. AC-8, AC-13 |
| Trận mồ côi khi booking hết hạn, bị từ chối hoặc bị hủy | `BookingsService.expire`, `decide`, `cancelOwn`, `cancelAsOwner` | CTE trong `expire` và cập nhật `Match` trong cùng transaction của `decide` và `cancelUnderLock`. AC-7, AC-8, AC-9 |
| Trận trên booking chưa xác nhận bị đánh dấu `FINISHED` thay vì `CANCELLED` khi qua giờ kết thúc | `GET /api/matches`, `mine`, `cancel` | Luôn chạy `expire` trước bước chuyển `FINISHED`, và chỉ chuyển `FINISHED` khi `Booking.status` = `CONFIRMED`. AC-8 |
| Sai lệch múi giờ khi lọc ngày phòng chờ (BR-27) hoặc lỗi driver với ngày năm `0000` | `GET /api/matches` | Tính cửa sổ ngày bằng `startOfDayVN(date)` và trả `[]` ngay khi ngày đã qua. AC-6 kiểm trận lúc 06:00 sáng `Asia/Ho_Chi_Minh` (`23:00Z` hôm trước) |
| Lộ số điện thoại của host hoặc người chơi trong phòng chờ công khai (BR-20) | `GET /api/matches`, `MatchView` | `MatchView` không có trường số điện thoại; truy vấn chỉ chọn `User.name`. AC-6. Review bằng phiên mới và skill `rule-review` |
| Ràng buộc dữ liệu của `Match` và `MatchPlayer` | Migration SQL | Ràng buộc `CHECK` cho `capacity` (2..30), `pricePerSlot` (0..10.000.000), `joinedCount` (0..`capacity`), và `UNIQUE(bookingId)`. AC-14 |

## Assumptions

- Môn của trận (`Match.sport`) lấy trực tiếp từ `Court.sport` của sân thuộc booking (theo `data-dictionary.md`), nên host không phải chọn lại môn khi mở trận.
- Khách chưa đăng nhập cũng xem được danh sách phòng chờ (`GET /api/matches`), giống như xem giờ trống ở F-008. Khi bấm vào trận (ở F-012) thì mới cần đăng nhập.
- Giá mỗi suất (`pricePerSlot`) từ `0` đến `10.000.000` VND (cùng trần 10.000.000đ của giá sân ở F-003). Cho phép `0` để hỗ trợ trận giao lưu miễn phí.
- Khi booking `CONFIRMED` còn dưới 6 giờ, host không tự hủy trận trong app được (9.0.E1, BR-11) mà gọi chủ sân; khi chủ sân hủy booking qua route của F-009 thì trận tự hủy theo.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Khách chưa đăng nhập có xem được mục "Phòng chờ" không? Đã chốt ngày 18/10/2026: khách chưa đăng nhập xem được danh sách "Phòng chờ" (giống mục "Giờ trống" của F-008) | Bạn | không |
| Giá mỗi suất (`pricePerSlot`) có cho phép bằng `0` không? Đã chốt ngày 18/10/2026: theo `data-dictionary.md` ("0 trở lên", tối đa 10.000.000) | Bạn | không |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
