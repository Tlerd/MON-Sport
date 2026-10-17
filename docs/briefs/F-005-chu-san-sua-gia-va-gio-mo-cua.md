---
style: ste80
lang: vi
---

# F-005: Chủ sân sửa giá và giờ mở cửa

Status: accepted (review round 2, pull request #34)
Source: intake `docs/requirements/intake-monsport-v1.md`: UC-11, mục Phân quyền ("Sửa giá và giờ mở cửa": chủ sân chỉ đơn vị của mình), mục Lưới giờ và giá, Acceptance UC-11, Assumptions (thứ tự ra mắt UC-1, UC-10, UC-11). `docs/requirements/use-cases.md` UC-11 (11.0, 11.0.E1, Assumptions). `docs/requirements/business-rules.md` BR-4, BR-5, BR-6, BR-23, BR-25. `PROGRESS.md`, Next step 1.

## Goal

Chủ sân tự sửa giá giờ thường và giá giờ cao điểm của từng sân, và giờ mở cửa của đơn vị mình, mà không cần admin. Kiểm tra bằng ví dụ của intake: Bình đổi giá cao điểm của "Sân 1" từ 120.000đ thành 150.000đ. Booking mới dùng giá mới. Booking cũ giữ giá cũ.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Chủ sân sửa tên, địa chỉ, số điện thoại của đơn vị, hoặc tên sân, môn, thêm sân | Intake, mục Phân quyền: chỉ admin "Tạo và sửa đơn vị và sân" | Khi bạn đổi bảng Phân quyền |
| Giờ mở cửa khác nhau theo thứ, ngày nghỉ, ngày lễ | Data dictionary: một giờ mở cửa và một giờ đóng cửa chung cho mọi ngày | Khi một đơn vị chạy thử cần |
| Giá theo ngày hoặc đổi khung cao điểm (17:00–22:00) | BR-4 cố định khung cao điểm. Intake chỉ có 2 mức giá | Khi bạn đổi BR-4 |
| Hẹn ngày giá mới có hiệu lực | UC-11 chỉ cần "booking mới dùng giá mới". Giá mới có hiệu lực ngay | Khi có yêu cầu |
| Lịch sử đổi giá | Booking đã lưu `priceTotal` (BR-6). UC-12 tính doanh thu từ booking, không từ giá của sân | Khi cần kiểm tra ai đổi giá |
| Hủy hoặc báo cho người có booking ngoài giờ mở cửa mới | UC-11, Assumptions: giờ mở cửa mới không hủy booking đã có | Khi có UC-14 (thông báo) và bạn muốn báo |
| Sửa route của admin (`PATCH /api/admin/venues/:id`, `PATCH /api/admin/courts/:id`) | Admin đã sửa được giá và giờ từ F-003 | — |

## Acceptance criteria

Dữ liệu chung: mỗi test tạo lại dữ liệu này trước khi chạy, như `apps/api/src/modules/admin/venues.e2e.test.ts`. Admin (`0900000000`). Chủ sân "Bình" (`0912345678`) quản lý "Cầu lông A": mở 06:00 (`opensAt` = 360), đóng 23:00 (`closesAt` = 1380), có "Sân 1" và "Sân 2", cầu lông, 80.000đ giờ thường và 120.000đ giờ cao điểm.

Chủ sân "Dũng" (`0912345679`) quản lý "Cầu lông B" với "Sân 1" (80.000đ và 120.000đ). Người dùng "An" (`0901234567`). Bây giờ là 17/10/2026 10:00 `Asia/Ho_Chi_Minh`. Ngày của booking là 20/11/2026.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Bình đã đăng nhập | Bình gọi `PATCH /api/owner/courts/<Sân 1 của Cầu lông A>` với `{ pricePeak: 150000 }` | 200 và `{ id, name: "Sân 1", sport: "BADMINTON", priceNormal: 80000, pricePeak: 150000 }`. `GET /api/venues` hiện giá mới cho "Sân 1" và giá cũ cho "Sân 2" |
| AC-2 | An có booking "Chờ xác nhận" 20:00–21:00 trên "Sân 1", `priceTotal` = 120000. An tạo booking này trước khi Bình đổi giá | Bình đổi `pricePeak` thành 150000. Rồi An gửi yêu cầu đặt 21:00–22:00 trên "Sân 1" | Booking cũ vẫn có `priceTotal` = 120000. Booking mới có `priceTotal` = 150000 (BR-6) |
| AC-3 | Bình đã đăng nhập | Bình gọi `PATCH` sân "Sân 1" với `{ priceNormal: 90000, pricePeak: 150000 }`. Rồi An gửi yêu cầu đặt 16:30–17:30 | 200. Booking mới có `priceTotal` = 120000: 45.000đ cho 16:30–17:00 và 75.000đ cho 17:00–17:30 (BR-5) |
| AC-4 | Một transaction của test giữ khóa dòng `Court` của "Sân 1" (`SELECT ... FOR UPDATE`) | An gửi yêu cầu đặt 20:00–21:00 trên "Sân 1". Test đọc `pg_locks` từ một kết nối khác cho tới khi có một khóa chưa được cấp (`granted` = false), tối đa 2 giây. Rồi transaction của test đổi `pricePeak` thành 150000 và commit | Test thấy khóa chưa được cấp trong 2 giây. Yêu cầu của An nhận 201 với `priceTotal` = 150000. Với code trước F-005, test này nhận 120000, vì server đọc giá trước khi khóa sân |
| AC-5 | Bình đã đăng nhập | Bình gọi `PATCH /api/owner/venues/<Cầu lông A>` với `{ opensAt: 420, closesAt: 1320 }`. Rồi An gửi yêu cầu đặt 06:00–07:00, rồi 21:00–22:00 | 200 và `VenueView` của "Cầu lông A" với `opensAt` = 420, `closesAt` = 1320 và 2 sân. Yêu cầu 06:00–07:00 nhận 400 "Ngoài giờ mở cửa". Yêu cầu 21:00–22:00 nhận 201 |
| AC-6 | An có booking "Đã xác nhận" 06:00–07:00 trên "Sân 1", `priceTotal` = 80000 | Bình đổi giờ mở cửa thành 07:00–22:00 | 200. Booking 06:00–07:00 vẫn "Đã xác nhận", `priceTotal` = 80000 (UC-11, Assumptions) |
| AC-7 | Bình đã đăng nhập | Bình gửi lần lượt `{ opensAt: 1320, closesAt: 1320 }`, rồi `{ closesAt: 300 }` | Mỗi request nhận 400 "Giờ đóng cửa phải sau giờ mở cửa" (11.0.E1). Request thứ hai so `closesAt` mới với `opensAt` đã lưu (360). Đơn vị vẫn 06:00–23:00 |
| AC-8 | Bình đã đăng nhập | Bình gửi giờ `{ opensAt: 375 }`, `{ closesAt: 1470 }`. Bình gửi giá `{ pricePeak: 0 }`, `{ pricePeak: 10000001 }`, `{ pricePeak: 150000.5 }` | 400 với lần lượt "Giờ phải theo bước 30 phút", "Giờ phải trong khoảng 00:00–24:00", "Giá phải lớn hơn 0", "Giá tối đa 10.000.000đ một giờ", "Dữ liệu không hợp lệ". Không giá trị nào đổi |
| AC-9 | Bình đã đăng nhập | Bình gửi tới đơn vị `{ name: "Cầu lông Z" }`, `{ ownerId: <id của Dũng> }`, `{ opensAt: 420, phone: "0999999999" }` và `{}`. Bình gửi tới sân `{ name: "Sân 9" }`, `{ sport: "FOOTBALL" }` và `{}` | Mỗi request nhận 400 "Dữ liệu không hợp lệ". Đơn vị và sân không đổi |
| AC-10 | Bình đã đăng nhập | Bình gọi `PATCH` tới "Cầu lông B" và tới "Sân 1" của "Cầu lông B" với giá trị hợp lệ. Bình gọi `PATCH` tới một UUID không có ở mỗi route. Bình gọi `PATCH /api/owner/venues/abc` và `PATCH /api/owner/courts/abc` | Đơn vị của Dũng và UUID không có nhận 404 "Không tìm thấy đơn vị". Sân của Dũng và sân không có nhận 404 "Không tìm thấy sân". `abc` nhận 400 "Dữ liệu không hợp lệ". Dữ liệu của Dũng không đổi (BR-23) |
| AC-11 | Admin chuyển "Cầu lông A" sang Dũng bằng `PATCH /api/admin/venues/:id` | Bình gọi `PATCH` tới "Cầu lông A" và tới "Sân 1" của nó. Dũng gọi `PATCH` tới "Sân 1" của "Cầu lông A" với `{ pricePeak: 150000 }` | Bình nhận 404 ở cả hai route. Dũng nhận 200 |
| AC-12 | An và admin đã đăng nhập. Một request khác không có cookie | Mỗi người gọi `PATCH /api/owner/venues/:id` và `PATCH /api/owner/courts/:id` của "Cầu lông A" | An 403, admin 403, không có cookie 401, ở mỗi route. Không giá trị nào đổi |
| AC-13 | Bình đã đăng nhập trên web, mục "Đơn vị của tôi" hiện "Cầu lông A" | Bình bấm "Sửa giờ mở cửa", chọn 07:00 và 22:00, bấm "Lưu" | Web gọi `PATCH /api/owner/venues/<id>` với `{ opensAt: 420, closesAt: 1320 }`. Thẻ đơn vị hiện "07:00–22:00" |
| AC-14 | Như AC-13 | Bình bấm "Sửa giá" ở "Sân 1", nhập 150000 vào ô "Giá cao điểm", bấm "Lưu" | Web gọi `PATCH /api/owner/courts/<id>` với `{ priceNormal: 80000, pricePeak: 150000 }`. Dòng "Sân 1" hiện "150.000đ" |
| AC-15 | Như AC-13. API trả 400 "Giờ đóng cửa phải sau giờ mở cửa" | Bình lưu giờ mở cửa | Form hiện câu lỗi đó với `role="alert"`. Thẻ đơn vị vẫn hiện "06:00–23:00" |

## Contract

Zod trong `packages/shared/src/account.ts` là nguồn duy nhất. Các câu lỗi đã có trong `Messages` của F-003.

| Endpoint or schema | Change | Request | Response and errors |
|---|---|---|---|
| `OwnerVenueUpdate` | new | `{ opensAt?, closesAt? }`, cùng luật với `VenueInput` (bội của 30, `opensAt` 0–1410, `closesAt` 30–1440). Strict: một khóa khác nhận "Dữ liệu không hợp lệ". Phải có ít nhất một khóa | — |
| `OwnerCourtUpdate` | new | `{ priceNormal?, pricePeak? }`, cùng luật `Price` với `CourtInput`. Strict. Phải có ít nhất một khóa | — |
| `PATCH /api/owner/venues/:id` | new | `OwnerVenueUpdate` | 200 `VenueView`, sân xếp theo tên. 400 khi Zod sai, hoặc khi giờ sau khi gộp với giá trị đã lưu sai `VenueInput` (câu "Giờ đóng cửa phải sau giờ mở cửa"). 401, 403 (không phải `OWNER`). 404 "Không tìm thấy đơn vị" khi đơn vị không có hoặc không thuộc người gọi |
| `PATCH /api/owner/courts/:id` | new | `OwnerCourtUpdate` | 200 `CourtView`. 400, 401, 403 như trên. 404 "Không tìm thấy sân" khi sân không có hoặc đơn vị của sân không thuộc người gọi |
| `POST /api/bookings` | changed | — | Không đổi hợp đồng. Server đọc giá của sân và giờ mở cửa của đơn vị trong transaction, sau khóa dòng `Court` (AC-4) |

Thứ tự ở `PATCH /api/owner/venues/:id`, trong một transaction:

1. Kiểm Zod `OwnerVenueUpdate`. Kiểm `:id` bằng `ParseUUIDPipe` như route admin.
2. `SELECT ... FROM "Venue" WHERE id = $id FOR UPDATE`. Không có dòng, hoặc `ownerId` khác người gọi: 404.
3. Gộp body vào dòng đã lưu và kiểm bằng `VenueInput`. Sai: 400.
4. Ghi chỉ `opensAt` và `closesAt` có trong body. CHECK `Venue_hours_check` vẫn là chốt cuối: lỗi của nó đổi thành câu giờ, như `isHoursViolation` của route admin.

Thứ tự ở `PATCH /api/owner/courts/:id`, trong một transaction:

1. Kiểm Zod `OwnerCourtUpdate` và `:id`.
2. Đọc `venueId` của sân. Không có: 404.
3. `SELECT ... FROM "Venue" WHERE id = $venueId FOR SHARE`. Route admin đổi chủ sân bằng `FOR UPDATE`, nên chủ sân cũ không ghi được sau khi đơn vị đã sang người khác. `ownerId` khác người gọi: 404.
4. Ghi chỉ `priceNormal` và `pricePeak` có trong body. Lệnh `UPDATE` khóa dòng `Court`, nên nó xếp hàng với yêu cầu đặt sân (AC-4).

Ở `BookingsService.request`: transaction khóa dòng `Court` bằng `FOR UPDATE` như hiện nay, rồi đọc lại sân và đơn vị trong transaction đó. Giá (BR-5) và kiểm giờ mở cửa dùng dữ liệu đọc lại. Câu lỗi và mã lỗi không đổi. Đọc lại giờ mở cửa không chặn được lệnh đổi giờ chạy cùng lúc. Xem dòng rủi ro về giờ mở cửa.

## Data

| Table | Change | Migration step |
|---|---|---|
| — | Không đổi schema. `Venue.opensAt`, `Venue.closesAt`, `Court.priceNormal`, `Court.pricePeak` và các CHECK đã có từ F-002 và F-003 | — |
| `docs/requirements/data-dictionary.md` | Không đổi | — |

## Build order

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Hợp đồng và API: `OwnerVenueUpdate`, `OwnerCourtUpdate`, hai route `PATCH` của chủ sân, đọc giá sau khóa trong `BookingsService.request`. Brief này với Status: accepted | `packages/shared/src/account.ts`, `packages/shared/src/account.test.ts`, `apps/api/src/modules/venues/` (gồm file test mới `owner-venues.e2e.test.ts`), `apps/api/src/modules/bookings/bookings.service.ts`, `PROGRESS.md`, file brief này. Route của chủ sân import `isHoursViolation` từ `apps/api/src/modules/admin/db-errors.ts` mà không đổi file đó | Test Zod cho AC-8 và AC-9. AC-1 tới AC-12 trong `owner-venues.e2e.test.ts`. Các test cũ của `bookings.e2e.test.ts` vẫn đạt |
| 2 | Màn hình: form "Sửa giờ mở cửa" và "Sửa giá" trong "Đơn vị của tôi". `PROGRESS.md` | `apps/web/src/features/venues/`, `apps/web/src/lib/format.ts` (thêm `HALF_HOURS` dùng chung), `apps/web/src/features/admin/VenueAdmin.tsx` (chỉ đổi import `HALF_HOURS`), `apps/web/src/app/styles.css`, `PROGRESS.md` | AC-13 tới AC-15 trong `MyVenues.test.tsx`. Test cũ AC-28 vẫn đạt |

Form web dùng ô chọn giờ theo bước 30 phút như form admin: giờ mở cửa 00:00–23:30, giờ đóng cửa 00:30–24:00. Ô giá là `input type="number"`, `min=1`, `step=1`. Mỗi form có nút "Lưu" và "Hủy". Lưu xong, thẻ dùng giá trị trong response. Màn hình rộng 390px vẫn dùng được.

Các nút "Sửa giờ mở cửa" và "Sửa giá <tên sân>" nằm trong một hàng dưới danh sách sân của thẻ. Mỗi lần thẻ mở một form. `CourtPrices` không đổi, vì màn hình admin cũng dùng nó.

## Edit boundaries

- May edit: các path trong bảng Build order, `pnpm-lock.yaml` khi cần.
- Leave unchanged without approval: `AGENTS.md`, `.dependency-cruiser.cjs`, `scripts/check.mjs`, `.github/workflows/`, `apps/api/prisma/` (schema, migration, seed), `apps/api/src/modules/auth/`, `apps/api/src/modules/admin/venues.controller.ts`, `apps/api/src/modules/admin/accounts.controller.ts`, `apps/api/src/modules/admin/db-errors.ts`, `apps/api/src/modules/database/`, `apps/web/src/components/`, `apps/web/src/features/bookings/`, các file trong `docs/requirements/`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Tiền: yêu cầu đặt sân đọc giá cũ trong lúc chủ sân đổi giá | `BookingsService.request` | Đọc giá sau khóa dòng `Court`. AC-4 chạy trên Postgres thật. Review bằng phiên mới |
| Đồng thời: admin chuyển đơn vị sang chủ sân khác trong lúc chủ sân cũ sửa | Hai route `PATCH` của chủ sân | `FOR UPDATE` trên `Venue` khi sửa giờ, `FOR SHARE` khi sửa giá. Review bằng phiên mới kiểm tra cuộc đua này. AC-11 chỉ kiểm kết quả sau khi chuyển đơn vị |
| Phân quyền: chủ sân sửa đơn vị của người khác (BR-23) | Hai route `PATCH` | Điều kiện `ownerId` = người gọi trong transaction. 404, không lộ đơn vị có hay không. AC-10, AC-12 |
| Chủ sân sửa trường của admin | Zod strict | AC-9 |
| Yêu cầu đặt sân chạy cùng lúc với lệnh đổi giờ mở cửa | `BookingsService.request` | Yêu cầu đọc giờ trong transaction, sau khóa dòng `Court`. Lệnh đổi giờ chỉ khóa dòng `Venue`, nên hai việc không xếp hàng. Yêu cầu nào đọc giờ trước khi lệnh đổi giờ commit thì dùng giờ cũ và được nhận. Rủi ro đã chấp nhận: booking đó giống booking đã có trước khi đổi giờ, và được giữ (UC-11, Assumptions) |
| Deadlock giữa các route | Thứ tự khóa | Sửa giá: `Venue` (`FOR SHARE`), rồi `Court` (`UPDATE`). Sửa giờ: chỉ `Venue`. Route admin sửa đơn vị: `Venue`, rồi `User` (`FOR SHARE`) khi đổi chủ sân. Route admin sửa sân: chỉ `Court`. Yêu cầu đặt sân: chỉ `Court`, đọc `Venue` không khóa. Không route nào khóa `Court` rồi mới khóa `Venue`, nên không có vòng chờ |
| Màn hình đặt sân hiện giá cũ | `apps/web/src/features/bookings/BookingForm.tsx` | Màn hình tính giá xem trước từ danh sách sân đã tải. Sau khi chủ sân đổi giá, người đang mở trang thấy giá cũ cho tới khi tải lại. Server tính `priceTotal` và trả trong response, nên booking luôn lưu giá đúng. Rủi ro đã chấp nhận ở mức chạy thử |

## Assumptions

- Chủ sân sửa đơn vị hoặc sân không thuộc mình thì nhận 404, không phải 403. Lý do: không lộ đơn vị nào tồn tại. Route `decide` của F-002 trả 403 cho booking, và giữ nguyên.
- Admin gọi route của chủ sân thì nhận 403. Admin đã có route riêng từ F-003, và các route đó không kiểm `ownerId`.
- Body rỗng `{}` nhận 400. Một lần lưu không đổi gì là lỗi của màn hình.
- Giá mới có hiệu lực ngay khi lệnh ghi commit. Intake không có ngày hiệu lực.
- Giờ mở cửa mới không đổi các booking đã có, kể cả booking ngoài giờ mới (UC-11, Assumptions). Chủ sân tự gọi khách nếu cần.
- Slice này không thêm business rule mới. BR-6 và BR-23 đã đủ.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Có cần báo cho người có booking ngoài giờ mở cửa mới không? | Bạn, khi làm UC-14 | không |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
