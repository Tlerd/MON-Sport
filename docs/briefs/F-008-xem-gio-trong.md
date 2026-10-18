---
style: ste80
lang: vi
---

# F-008: Xem giờ trống của sân

Status: draft
Source: intake `docs/requirements/intake-monsport-v1.md`: UC-2 (mục "UC-2: chọn sân", ví dụ UC-2), Thứ tự ra mắt. `docs/requirements/use-cases.md` UC-2 (2.0 bước 5, 2.0.E1, Assumptions: người dùng chưa đăng nhập xem được giờ trống). `docs/requirements/business-rules.md` BR-1, BR-2, BR-3, BR-8, BR-20, BR-27. F-002 đã làm form đặt sân ngắn (chọn đơn vị, sân, giờ).

## Goal

Người dùng, kể cả người chưa đăng nhập, chọn một sân và một ngày, rồi thấy các khoảng giờ còn trống với nút "Gọi chủ sân". Kiểm tra bằng ví dụ của intake: booking 19:00–20:00 đã có, nên giờ đó không hiện là còn trống. Giờ 20:00–21:00 hiện là còn trống.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Tìm theo tên sân (UC-2 2.1) | Là phần web, không cần API mới. Tách ra để mỗi brief nhỏ hơn 3 pull request | Brief F-010 |
| Bấm một khoảng trống để điền sẵn form đặt sân | Gộp hai form là việc thiết kế riêng. Slice này chỉ thêm phần xem | Khi form đặt sân được làm lại |
| Giới hạn số ngày đặt trước | Intake không nêu quy tắc này. Không bịa quy tắc | Khi chủ sân yêu cầu |
| Hiện tên người đã đặt | Dữ liệu cá nhân (BR-20). Chỉ chủ sân thấy | Không có kế hoạch |
| Cập nhật tức thì khi có người đặt | Thuộc UC-14. Người dùng tải lại để thấy giờ mới | Brief của UC-14 |
| Chặn quá nhiều request từ một IP | BR-30 chỉ áp cho đăng nhập và đăng ký. Mức 200 lần xem mỗi ngày chưa cần | Khi log cho thấy lạm dụng |

## Assumptions

| Assumption | Reason |
|---|---|
| Mỗi khoảng trống có một nút "Gọi chủ sân", không phải mỗi giờ một nút | Intake viết "Mỗi giờ còn trống có nút Gọi chủ sân". Một khoảng 20:00–23:00 gồm ba giờ trống, và cả ba cùng một số điện thoại. Một nút cho mỗi khoảng giữ màn hình gọn. Ví dụ UC-2 của intake vẫn đúng: 20:00–21:00 nằm trong một khoảng có nút. Người dùng sửa sau nếu muốn khác |
| Không giới hạn số ngày xem trước | Intake không có quy tắc này |
| `USER` chọn đơn vị và sân hai lần: một lần ở mục giờ trống, một lần ở form "Đặt sân" | Gộp hai form nằm ngoài slice này (xem Non-goals) |

## Acceptance criteria

Dữ liệu chung: mỗi test tạo lại dữ liệu này trước khi chạy, như `apps/api/src/modules/bookings/phone-bookings.e2e.test.ts`. Chủ sân "Bình" (`0912345678`) quản lý "Cầu lông A": mở 06:00, đóng 23:00, có "Sân 1" và "Sân 2". Chủ sân "Dũng" quản lý "Cầu lông B" với "Sân 1": mở 08:00, đóng 24:00. Người dùng "An". Bây giờ là 20/11/2026 10:00 `Asia/Ho_Chi_Minh`.

Giờ trong cột "Then" là giờ `Asia/Ho_Chi_Minh`. Response trả `startAt` và `endAt` dạng UTC, ví dụ 06:00 ngày 21/11 là `2026-11-20T23:00:00.000Z`.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Sân 1 không có booking. Không có cookie | Gọi `GET /api/courts/<Sân 1>/availability?date=2026-11-21` | 200. Body có đúng các khóa `courtId`, `date`, `opensAt`, `closesAt`, `free`. `opensAt` = 360, `closesAt` = 1380. `free` = một khoảng 06:00–23:00 ngày 21/11: `startAt` `2026-11-20T23:00:00.000Z`, `endAt` `2026-11-21T16:00:00.000Z` |
| AC-2 | Sân 1 có booking "Đã xác nhận" 19:00–20:00 ngày 20/11 | Gọi availability cho ngày 2026-11-20 | `free` = 10:30–19:00 và 20:00–23:00. Giờ bắt đầu sớm nhất là mốc 30 phút đầu tiên sau bây giờ, vì booking phải bắt đầu sau bây giờ |
| AC-3 | Sân 1 có booking "Chờ xác nhận" 20:00–21:00 ngày 20/11, hạn xác nhận 12:00 | Gọi availability lúc 10:00, lúc 12:00 đúng, và lúc 12:01 | Lúc 10:00 `free` = 10:30–20:00 và 21:00–23:00 (BR-1). Lúc 12:00 đúng booking vẫn giữ giờ, vì hạn chỉ qua khi `now` > hạn (BR-8): `free` = 12:30–20:00 và 21:00–23:00. Lúc 12:01 `free` = 12:30–23:00, nên 20:00–21:00 trống lại. Booking trong DB vẫn "Chờ xác nhận": API không ghi gì |
| AC-4 | Sân 1 có ba booking 20:00–21:00 ngày 20/11 ở trạng thái "Bị từ chối", "Hết hạn", "Đã hủy" | Gọi availability cho ngày 2026-11-20 | `free` = 10:30–23:00. Ba trạng thái này không giữ giờ |
| AC-5 | Sân 1 có booking "Đã xác nhận" 19:00–20:00 và 20:00–21:00 ngày 20/11 | Gọi availability cho ngày 2026-11-20 | `free` = 10:30–19:00 và 21:00–23:00. Hai khung liền kề không để lại khoảng trống giữa chúng (BR-1) |
| AC-6 | Sân 1 có booking "Đã xác nhận" 06:00–09:30 và 10:00–23:00 ngày 21/11 | Gọi availability cho ngày 2026-11-21 | `free` = rỗng. Khoảng 09:30–10:00 dài 30 phút, ngắn hơn 1 giờ, nên bị bỏ (BR-3) |
| AC-7 | Bây giờ là 20/11/2026 10:00 | Gọi availability cho ngày 2026-11-19. Rồi đặt giờ là 23:10 ngày 20/11 và gọi cho ngày 2026-11-20 | Cả hai nhận 200 với `free` rỗng. Mốc bắt đầu sớm nhất nằm sau giờ đóng cửa của ngày đó |
| AC-8 | Sân 2 "Cầu lông A" có booking "Đã xác nhận" 19:00–20:00 ngày 21/11 | Gọi availability của Sân 1 "Cầu lông A" và của Sân 1 "Cầu lông B" cho ngày 2026-11-21 | Sân 1 "Cầu lông A": một khoảng 06:00–23:00. Sân 1 "Cầu lông B": một khoảng 08:00–24:00, `opensAt` = 480, `closesAt` = 1440, `endAt` `2026-11-21T17:00:00.000Z` |
| AC-9 | Không có điều kiện đặc biệt | Gọi availability với `courtId` không có trong DB. Rồi gọi với `:id` = `abc`. Rồi với ngày `2026-13-45`, `21-11-2026`, thiếu `date`, và thêm khóa `x=1` | Sân không có: 404 "Không tìm thấy sân". `abc` và mọi query sai: 400 "Dữ liệu không hợp lệ" |
| AC-10 | Sân 1 có booking "Đã xác nhận" nhập cho khách "Chú Tư" `0987654321` | Gọi availability không có cookie | Body không có `customer`, `createdById`, `status`, `priceTotal` hay số điện thoại của khách. Server đọc từ DB chỉ `startAt` và `endAt` của booking |
| AC-11 | Người chưa đăng nhập mở app. `GET /api/venues` trả "Cầu lông A" (`0912345678`) với "Sân 1" và "Sân 2". API availability của ngày 20/11/2026 trả hai khoảng: 10:30–19:00 và 20:00–23:00 | Người dùng chọn "Cầu lông A", "Sân 1", ngày 20/11/2026 | Mục giờ trống hiện thông báo "App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt." Web gọi `GET /api/courts/<Sân 1>/availability?date=2026-11-20`. Danh sách có hai mục "10:30–19:00" và "20:00–23:00", và không có mục nào chứa 19:00–20:00. Mỗi mục có link "Gọi chủ sân 0912345678" với `href` `tel:0912345678` |
| AC-12 | Như AC-11. API trả `free` rỗng | Người dùng chọn một sân và một ngày | Trang hiện "Hết giờ trống trong ngày này. Hãy chọn ngày khác." trong vùng `role="status"`. Không có link "Gọi chủ sân" cho khoảng giờ |
| AC-13 | Như AC-11. Lần chọn đầu trả hai khoảng của AC-11 | Người dùng đổi sang ngày khác, và API trả 500 | Trang hiện "Không tải được giờ trống" với `role="alert"`. Danh sách giờ cũ bị xóa |
| AC-14 | App có người dùng vai trò `USER` đã đăng nhập, rồi một người chưa đăng nhập, rồi chủ sân, rồi admin | Mở app ở từng trạng thái | Người chưa đăng nhập và `USER` thấy mục giờ trống. Thông báo "App mới ra mắt..." hiện đúng một lần cho mỗi vai trò: mục giờ trống chỉ hiện nó cho người chưa đăng nhập, vì form "Đặt sân" của `USER` đã có thông báo đó. `USER` vẫn thấy form "Đặt sân" như cũ. Chủ sân và admin không thấy mục này |
| AC-15 | Như AC-11. API của "Cầu lông B" trả một khoảng 08:00–24:00 (`endAt` `2026-11-21T17:00:00.000Z`) | Người dùng chọn "Cầu lông B", "Sân 1", ngày 21/11/2026 | Danh sách có một mục "08:00–24:00" |

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

1. `windowStart` là `opensAt` của `date`, `windowEnd` là `closesAt` của `date`, giờ `Asia/Ho_Chi_Minh` (BR-27). `closesAt` = 1440 là 00:00 ngày sau.
2. `earliest` là mốc 30 phút đầu tiên lớn hơn `now` (BR-2). Điểm bắt đầu là giá trị lớn hơn trong `windowStart` và `earliest`. Khi điểm bắt đầu ≥ `windowEnd`, kết quả rỗng.
3. Trừ các khoảng `busy` khỏi cửa sổ từ điểm bắt đầu tới `windowEnd`. Hai khung liền kề không để lại khoảng trống.
4. Bỏ khoảng ngắn hơn 1 giờ (BR-3).

Màn hình tính phút từ 00:00 của `date`, nên giờ đóng cửa 1440 hiện là "24:00" bằng `hhmm`. Màn hình bỏ response của lần chọn cũ khi `courtId` hoặc `date` không còn khớp lần chọn hiện tại.

Server chỉ đọc. Truy vấn lấy `select: { startAt: true, endAt: true }` của booking có `courtId` này, `status` = `CONFIRMED` hoặc (`status` = `PENDING` và `confirmDeadline` ≥ bây giờ), `startAt` < `windowEnd` và `endAt` > `windowStart`. Server không gọi `expire` và không khóa dòng nào (BR-8). Đọc không cần khóa, vì đặt sân vẫn chặn trùng bằng EXCLUDE (BR-1).

## Data

Không đổi schema. Không có migration. Truy vấn dùng index `Booking(courtId, status)` có sẵn.

## Build order

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Contract: Zod, `freeRanges` | `packages/shared/src/availability.ts`, `packages/shared/src/availability.test.ts`, `packages/shared/src/index.ts` | Test hàm `freeRanges` với giá trị của AC-2 tới AC-8, và `AvailabilityQuery` |
| 2 | Server: route công khai | `apps/api/src/modules/venues/availability.controller.ts`, `apps/api/src/modules/venues/availability.e2e.test.ts`, `apps/api/src/modules/venues/venues.module.ts` | AC-1 tới AC-10 |
| 3 | Screen: giờ trống | `apps/web/src/features/venues/VenueBrowser.tsx`, `apps/web/src/features/venues/VenueBrowser.test.tsx`, `apps/web/src/app/App.tsx`, `apps/web/src/app/App.test.tsx`, `apps/web/src/app/styles.css`, `PROGRESS.md` | AC-11 tới AC-15 |

## Edit boundaries

- May edit: các path trong "Build order", và `PROGRESS.md` ở pull request cuối.
- Leave unchanged without approval: `apps/api/prisma/`, `apps/api/src/modules/bookings/`, `apps/web/src/features/bookings/`, `packages/shared/src/booking.ts`, `packages/shared/src/booking-time.ts`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Route công khai đọc bảng `Booking`, có dữ liệu cá nhân của khách (BR-20) | Step 2 | Truy vấn chỉ `select` `startAt` và `endAt`. AC-10 kiểm body. Review trong phiên mới, và `rule-review` vì pull request chạm dữ liệu cá nhân |
| Giờ trống sai làm người dùng gọi chủ sân vô ích | `freeRanges` | AC-2 tới AC-8. Test hàm thuần có nhiều giá trị biên, kể cả `now` bằng hạn và `closesAt` = 1440 |
| Lệch múi giờ ở ranh giới ngày | `freeRanges` | AC-1 và AC-8 so sánh `startAt` UTC với giờ `Asia/Ho_Chi_Minh` |
| Route đọc trong lúc có đặt sân song song | Step 2 | Route chỉ đọc. Đặt sân vẫn do EXCLUDE chặn (BR-1). Giờ trống chỉ là gợi ý, không phải lời hứa |

Step 1 và step 3 cần một Reviewer trong phiên mới. Step 2 cần Reviewer và `rule-review`.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Nút "Gọi chủ sân" cho mỗi khoảng hay mỗi giờ? Xem "Assumptions" | Người dùng | Không |
| Có cần giới hạn số ngày xem trước không? | Người dùng | Không |

## Done when

- Every AC has a passing test with its label in the name.
- `pnpm check` passes on the last pull request.
- A Reviewer in a fresh session reviewed each pull request.
