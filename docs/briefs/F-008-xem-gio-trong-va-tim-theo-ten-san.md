---
style: ste80
lang: vi
---

# F-008: Xem giờ trống của sân và tìm theo tên sân

Status: draft
Source: intake `docs/requirements/intake-monsport-v1.md`: UC-2 (mục "UC-2: chọn sân", ví dụ UC-2), Assumptions (người dùng chưa đăng nhập xem được giờ trống), Thứ tự ra mắt. `docs/requirements/use-cases.md` UC-2 (2.0 bước 5, 2.1, 2.0.E1). `docs/requirements/business-rules.md` BR-1, BR-2, BR-3, BR-8, BR-27. F-002 đã làm form đặt sân ngắn (chọn đơn vị, sân, giờ).

## Goal

Người dùng, kể cả người chưa đăng nhập, chọn một sân và một ngày, rồi thấy các khoảng giờ còn trống với nút "Gọi chủ sân". Kiểm tra bằng ví dụ của intake: booking 19:00–20:00 đã có, nên giờ đó không hiện là còn trống. Giờ 20:00–21:00 hiện là còn trống.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Bấm một khoảng trống để điền sẵn form đặt sân | Gộp hai form là việc thiết kế riêng. Slice này chỉ thêm phần xem | Khi form đặt sân được làm lại |
| Giới hạn số ngày đặt trước | Intake không nêu quy tắc này. Không bịa quy tắc | Khi chủ sân yêu cầu |
| Tìm theo tên đơn vị, địa chỉ, hay môn thể thao | Intake chỉ cho tìm theo tên sân (2.1) | Khi danh sách đơn vị dài hơn 10 |
| Hiện tên người đã đặt | Dữ liệu cá nhân (BR-20). Chỉ chủ sân thấy | Không có kế hoạch |
| Cập nhật tức thì khi có người đặt | Thuộc UC-14. Người dùng tải lại để thấy giờ mới | Brief của UC-14 |
| Chặn quá nhiều request từ một IP | BR-30 chỉ áp cho đăng nhập và đăng ký. Mức 200 lần xem mỗi ngày chưa cần | Khi log cho thấy lạm dụng |

## Acceptance criteria

Dữ liệu chung: mỗi test tạo lại dữ liệu này trước khi chạy, như `apps/api/src/modules/bookings/phone-bookings.e2e.test.ts`. Chủ sân "Bình" (`0912345678`) quản lý "Cầu lông A": mở 06:00, đóng 23:00, có "Sân 1" và "Sân 2". Chủ sân "Dũng" quản lý "Cầu lông B" với "Sân 1". Người dùng "An". Bây giờ là 20/11/2026 10:00 `Asia/Ho_Chi_Minh`.

Giờ trong cột "Then" là giờ `Asia/Ho_Chi_Minh`. Response trả `startAt` và `endAt` dạng UTC, ví dụ 06:00 ngày 21/11 là `2026-11-20T23:00:00.000Z`.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Sân 1 không có booking. Không có cookie | Gọi `GET /api/courts/<Sân 1>/availability?date=2026-11-21` | 200. Body có đúng các khóa `courtId`, `date`, `opensAt`, `closesAt`, `free`. `opensAt` = 360, `closesAt` = 1380. `free` = một khoảng 06:00–23:00 ngày 21/11 |
| AC-2 | Sân 1 có booking "Đã xác nhận" 19:00–20:00 ngày 20/11 | Gọi availability cho ngày 2026-11-20 | `free` = 10:30–19:00 và 20:00–23:00. Giờ bắt đầu sớm nhất là mốc 30 phút đầu tiên sau bây giờ, vì booking phải bắt đầu sau bây giờ |
| AC-3 | Sân 1 có booking "Chờ xác nhận" 20:00–21:00 ngày 20/11, hạn xác nhận 12:00 | Gọi availability lúc 10:00. Rồi đặt giờ là 12:01 và gọi lại | Lúc 10:00 `free` = 10:30–20:00 và 21:00–23:00 (BR-1). Lúc 12:01 `free` = 12:30–23:00, nên 20:00–21:00 trống lại (BR-8). Booking trong DB vẫn "Chờ xác nhận": API không ghi gì |
| AC-4 | Sân 1 có ba booking 20:00–21:00 ngày 20/11 ở trạng thái "Bị từ chối", "Hết hạn", "Đã hủy" | Gọi availability cho ngày 2026-11-20 | `free` = 10:30–23:00. Ba trạng thái này không giữ giờ |
| AC-5 | Sân 1 có booking "Đã xác nhận" 19:00–20:00 và 20:00–21:00 ngày 20/11 | Gọi availability cho ngày 2026-11-20 | `free` = 10:30–19:00 và 21:00–23:00. Hai khung liền kề không để lại khoảng trống giữa chúng (BR-1) |
| AC-6 | Sân 1 có booking "Đã xác nhận" 06:00–09:30 và 10:00–23:00 ngày 21/11 | Gọi availability cho ngày 2026-11-21 | `free` = rỗng. Khoảng 09:30–10:00 dài 30 phút, ngắn hơn 1 giờ, nên bị bỏ (BR-3) |
| AC-7 | Bây giờ là 20/11/2026 10:00 | Gọi availability cho ngày 2026-11-19. Rồi đặt giờ là 23:10 ngày 20/11 và gọi cho ngày 2026-11-20 | Cả hai nhận 200 với `free` rỗng |
| AC-8 | Sân 2 có booking "Đã xác nhận" 19:00–20:00 ngày 21/11. "Cầu lông B" mở 08:00–22:00 | Gọi availability của Sân 1 "Cầu lông A" và của Sân 1 "Cầu lông B" cho ngày 2026-11-21 | Sân 1 "Cầu lông A": một khoảng 06:00–23:00. Sân 1 "Cầu lông B": một khoảng 08:00–22:00, `opensAt` = 480, `closesAt` = 1320 |
| AC-9 | Không có điều kiện đặc biệt | Gọi availability với `courtId` không có trong DB. Rồi gọi với `:id` = `abc`. Rồi với ngày `2026-13-45`, `21-11-2026`, thiếu `date`, và thêm khóa `x=1` | Sân không có: 404 "Không tìm thấy sân". `abc` và mọi query sai: 400 "Dữ liệu không hợp lệ" |
| AC-10 | Sân 1 có booking "Đã xác nhận" của An | Gọi availability không có cookie | Body không có `customer`, `createdById`, `status`, `priceTotal` hay số điện thoại của khách |
| AC-11 | Người chưa đăng nhập mở app. `GET /api/venues` trả "Cầu lông A" (`0912345678`) với "Sân 1" và "Sân 2" | Người dùng chọn "Cầu lông A", "Sân 1", ngày 21/11/2026. API trả hai khoảng: 06:00–09:00 và 20:00–23:00 | Trang hiện thông báo "App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt." Web gọi `GET /api/courts/<Sân 1>/availability?date=2026-11-21`. Danh sách có hai mục "06:00–09:00" và "20:00–23:00". Mỗi mục có link "Gọi chủ sân 0912345678" với `href` `tel:0912345678` |
| AC-12 | Như AC-11, chưa chọn đơn vị | Người dùng gõ "san 1" vào ô "Tìm theo tên sân". Rồi bấm "Cầu lông A" trong kết quả | Ô tìm không phân biệt hoa thường và dấu. Kết quả hiện đơn vị có sân khớp. Sau khi bấm, ô chọn đơn vị là "Cầu lông A" và ô chọn sân có "Sân 1", "Sân 2". Gõ "xyz" hiện "Không có sân nào tên như vậy" |
| AC-13 | Như AC-11. API trả `free` rỗng | Người dùng chọn một sân và một ngày | Trang hiện "Hết giờ trống trong ngày này. Hãy chọn ngày khác." trong vùng `role="status"`. Không có link "Gọi chủ sân" cho khoảng giờ |
| AC-14 | Như AC-11. API trả 500 | Người dùng chọn một sân và một ngày | Trang hiện "Không tải được giờ trống" với `role="alert"`. Danh sách giờ cũ bị xóa |
| AC-15 | App có người dùng vai trò `USER` đã đăng nhập, rồi một người chưa đăng nhập | Mở app ở từng trạng thái | Cả hai thấy mục giờ trống. Người dùng `USER` vẫn thấy form "Đặt sân" như cũ. Chủ sân và admin không thấy mục này |

## Contract

Zod trong `packages/shared/src/availability.ts` là nguồn duy nhất. Hàm thuần `freeRanges` cũng nằm ở đây, để server và test dùng chung.

| Endpoint or schema | Change | Request | Response and errors |
|---|---|---|---|
| `AvailabilityQuery` | new | `{ date }`. `date`: chuỗi `YYYY-MM-DD` hợp lệ. Strict | — |
| `FreeRange` | new | — | `{ startAt, endAt }`, mỗi trường là thời điểm ISO UTC |
| `Availability` | new | — | `{ courtId, date, opensAt, closesAt, free: FreeRange[] }` |
| `freeRanges(input)` | new | `{ date, opensAt, closesAt, now, busy: { startAt, endAt }[] }` | `FreeRange[]` đã sắp theo giờ |
| `GET /api/courts/:id/availability?date=` | new, công khai (không cần cookie) | `AvailabilityQuery` | 200 `Availability`. 400 "Dữ liệu không hợp lệ" khi `:id` không phải UUID hoặc query sai. 404 "Không tìm thấy sân" |

Quy tắc của `freeRanges`, theo thứ tự:

1. Cửa sổ là từ `opensAt` tới `closesAt` của `date`, giờ `Asia/Ho_Chi_Minh` (BR-27).
2. Mốc bắt đầu sớm nhất là mốc 30 phút đầu tiên lớn hơn `now` (BR-2). Mốc này chỉ cắt cửa sổ khi nó nằm trong cửa sổ.
3. Trừ các khoảng `busy` khỏi cửa sổ. Hai khung liền kề không để lại khoảng trống.
4. Bỏ khoảng ngắn hơn 1 giờ (BR-3).

Server tạo `busy` từ booking của sân đó có `status` = `CONFIRMED`, hoặc `status` = `PENDING` với `confirmDeadline` ≥ bây giờ. Server chỉ đọc. Server không gọi `expire`, không khóa dòng nào (BR-8, đọc không cần khóa vì đặt sân vẫn chặn trùng bằng EXCLUDE ở BR-1).

## Data

Không đổi schema. Không có migration. Truy vấn dùng index `Booking(courtId, status)` có sẵn.

## Build order

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Contract: Zod, `freeRanges` | `packages/shared/src/availability.ts`, `packages/shared/src/availability.test.ts`, `packages/shared/src/index.ts` | AC-2 tới AC-7 ở mức hàm `freeRanges`, và `AvailabilityQuery` |
| 2 | Server: route công khai | `apps/api/src/modules/venues/availability.controller.ts`, `apps/api/src/modules/venues/availability.e2e.test.ts`, `apps/api/src/modules/venues/venues.module.ts` | AC-1 tới AC-10 |
| 3 | Screen: tìm tên sân, giờ trống | `apps/web/src/features/venues/VenueBrowser.tsx`, `apps/web/src/features/venues/VenueBrowser.test.tsx`, `apps/web/src/app/App.tsx`, `apps/web/src/app/App.test.tsx`, `apps/web/src/app/styles.css`, `PROGRESS.md` | AC-11 tới AC-15 |

## Edit boundaries

- May edit: các path trong "Build order", và `PROGRESS.md` ở pull request cuối.
- Leave unchanged without approval: `apps/api/prisma/`, `apps/api/src/modules/bookings/`, `apps/web/src/features/bookings/`, `packages/shared/src/booking.ts`, `packages/shared/src/booking-time.ts`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Route công khai lộ dữ liệu cá nhân (BR-20) | Step 2 | AC-10 kiểm các khóa của body. Review trong phiên mới |
| Giờ trống sai làm người dùng gọi chủ sân vô ích | `freeRanges` | AC-2 tới AC-7. Test hàm thuần có nhiều giá trị biên |
| Lệch múi giờ ở ranh giới ngày | `freeRanges` | AC-1 và AC-8 so sánh `startAt` UTC với giờ `Asia/Ho_Chi_Minh` |
| Route đọc trong lúc có đặt sân song song | Step 2 | Route chỉ đọc. Đặt sân vẫn do EXCLUDE chặn (BR-1). Giờ trống chỉ là gợi ý, không phải lời hứa |

Slice này không đổi tiền, khóa, schema hay dữ liệu cá nhân. Nó cần một Reviewer trong phiên mới. Nó không cần `rule-review`.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Mỗi khoảng trống có một nút "Gọi chủ sân", hay mỗi giờ có một nút? Slice này chọn mỗi khoảng, vì nhiều nút trùng số điện thoại làm rối màn hình | Người dùng | Không (giả định ghi ở đây) |
| Có cần giới hạn số ngày xem trước không? Slice này không giới hạn | Người dùng | Không |

## Done when

- Every AC has a passing test with its label in the name.
- `pnpm check` passes on the last pull request.
- A Reviewer in a fresh session reviewed each pull request.
