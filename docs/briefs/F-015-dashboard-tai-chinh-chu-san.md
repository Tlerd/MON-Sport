---
style: ste80
lang: vi
---

# F-015: Dashboard tài chính cho chủ sân

Status: accepted
Source:

- Intake `docs/requirements/intake-monsport-v1.md`:
  - UC-12: "Chủ sân: Xem doanh thu và giờ sân".
  - Acceptance UC-12: "Trong tuần có 10 booking 1 giờ, giá 120.000đ, và 8 booking được đánh dấu "đã thu tiền tại sân". Doanh thu tuần là 960.000đ".
  - Bảng "Constraints": "Biểu đồ: Recharts (đề xuất M1)".
  - Bảng "Quality": "Màn rộng 390px trở lên".
  - Mục "Assumptions": "Thứ tự ra mắt: UC-1, UC-10, UC-11 → UC-2 đến UC-6 → UC-7 đến UC-9 → UC-14 → UC-12, UC-13".
- `docs/requirements/use-cases.md`:
  - UC-12: Xem dashboard tài chính.
  - Normal Flow: 1. Chủ sân chọn đơn vị và khoảng thời gian (ngày, tuần hoặc tháng). 2. Hệ thống hiện các số liệu và biểu đồ.
  - Alternative Flow 12.1: Đánh dấu đã thu tiền: chủ sân đánh dấu một booking "đã thu tiền tại sân". Hệ thống tính booking đó vào doanh thu (BR-21).
  - Exceptions 12.0.E1: Không có booking trong khoảng thời gian: hệ thống hiện số 0.
- `docs/requirements/business-rules.md`:
  - BR-4: Giờ cao điểm bắt đầu lúc 17:00 và kết thúc lúc 22:00.
  - BR-21: Doanh thu chỉ tính các booking "Đã xác nhận" có đánh dấu "đã thu tiền tại sân".
  - BR-23: Chủ sân chỉ xem và sửa dữ liệu của các đơn vị mình quản lý.
  - BR-25: Tiền là số nguyên VND.
  - BR-27: Giờ hiển thị theo múi giờ `Asia/Ho_Chi_Minh`.
- `docs/requirements/data-dictionary.md`:
  - `Booking.paidAtVenue`: Chủ sân đã thu tiền tại sân, boolean, mặc định false (BR-21).
  - `Booking.priceTotal`: Giá booking tính lúc đặt, money (VND).
  - `Booking.status`: enum `CONFIRMED`, `CANCELLED`, `REJECTED`, `PENDING`, `EXPIRED`.
  - `Court`: `venueId`, `priceNormal`, `pricePeak`.
  - `Venue`: `ownerId`, `opensAt`, `closesAt`.

## Goal

Chủ sân xem được doanh thu, số giờ đã đặt, tỉ lệ lấp đầy, giờ cao điểm, tỉ lệ hủy và khách quay lại của đơn vị mình theo ngày, tuần hoặc tháng, và đánh dấu được booking đã thu tiền tại sân.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Dashboard toàn trang cho Admin (UC-13) | UC-13 dành riêng cho vai trò Admin với các chỉ số toàn hệ thống; tách để giữ pull request nhỏ gọn | F-016 (Dashboard admin) |
| Biểu đồ nhiệt 7x24 chi tiết theo từng giờ và thứ trong tuần | Cần tính ma trận 168 ô giờ và cấu hình giao diện bảng nhiệt riêng; hoãn để giữ pull request dưới 400 dòng | Lát cắt nâng cao sau v1 |
| Thống kê chi tiết bóc tách từng sân (`courtBreakdown`) | Intake UC-12 ưu tiên tổng quan đơn vị; bóc tách từng sân tách riêng để giảm độ phức tạp | Lát cắt sau khi chủ sân có trên 5 sân |
| Thanh toán online hoặc tích hợp cổng thanh toán | Intake ghi rõ bản đầu không thu tiền qua app | Bản sau |
| Xuất báo cáo ra tệp Excel hoặc PDF | Intake không yêu cầu chức năng xuất tệp trong v1 | Khi có yêu cầu |

## Acceptance criteria

Dữ liệu mẫu chung:
- Chủ sân "Bình" (`0912345678`) quản lý "Cầu lông A" (`venueId` = `VA`).
- "Cầu lông A" có 2 sân: "Sân 1" (`S1`) và "Sân 2" (`S2`).
- Giờ mở cửa: `opensAt` = 360 (06:00), `closesAt` = 1380 (23:00) -> 17 giờ mở cửa mỗi ngày.
- Giá: giờ thường 80.000đ/h, giờ cao điểm 120.000đ/h (17:00 - 22:00).
- Chủ sân "Dũng" (`0912345679`) quản lý "Cầu lông B" (`venueId` = `VB`).
- Khách hàng: "An" (`0901234567`), "Chi" (`0901234568`).
- Tuần thử nghiệm: từ thứ Hai 16/11/2026 đến Chủ nhật 22/11/2026 (`Asia/Ho_Chi_Minh`).
- Lọc khoảng thời gian theo `startAt` của booking quy về múi giờ `Asia/Ho_Chi_Minh`.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Trong tuần 16/11–22/11/2026, "Cầu lông A" có 10 booking CONFIRMED 1 giờ giá 120.000đ. Bình đánh dấu 8 booking `paidAtVenue = true` và 2 booking `paidAtVenue = false` | Bình gọi `GET /api/owner/venues/VA/financials?period=week&date=2026-11-20` | API trả về 200 với `revenue = 960000`, `totalBookings = 10`, `paidBookings = 8`, `unpaidBookings = 2`, `bookedHours = 10` |
| AC-2 | Bình sở hữu "Cầu lông A" (2 sân, mở 17 giờ/ngày = 34 giờ sân/ngày). Ngày 20/11/2026 có 2 booking CONFIRMED 1 giờ (tổng 2 giờ sân) | Bình gọi `GET /api/owner/venues/VA/financials?period=day&date=2026-11-20` | API trả về 200 với `bookedHours = 2`, `openingHours = 34`, `occupancyRate = 0.0588` (2 / 34 làm tròn 4 chữ số thập phân) |
| AC-3 | Ngày 20/11/2026, có 1 booking CONFIRMED 15:00–16:00 (1 giờ thường), 1 booking CONFIRMED 18:00–19:00 (1 giờ cao điểm 17:00–22:00), và 1 booking CONFIRMED 16:30–17:30 (0.5 giờ thường, 0.5 giờ cao điểm) | Bình gọi `GET /api/owner/venues/VA/financials?period=day&date=2026-11-20` | API trả về 200 với `peakHours = 1.5`, `normalHours = 1.5` |
| AC-4 | Trong tuần có 10 booking phát sinh: 6 CONFIRMED, 2 CANCELLED, 2 REJECTED | Bình gọi `GET /api/owner/venues/VA/financials?period=week&date=2026-11-20` | API trả về 200 với `totalBookings = 10`, `cancelledBookings = 2`, `rejectedBookings = 2`, `cancellationRate = 0.2`, `rejectionRate = 0.2` |
| AC-5 | Trong tháng 11/2026, An đặt 3 booking CONFIRMED bằng số `0901234567`, Chi đặt 1 booking CONFIRMED bằng số `0901234568`, và 1 booking gọi điện không có số điện thoại | Bình gọi `GET /api/owner/venues/VA/financials?period=month&date=2026-11-20` | API trả về 200 với `totalCustomers = 2`, `returningCustomers = 1` (An có từ 2 booking trở lên; booking không có số điện thoại bị bỏ qua) |
| AC-6 | Trong tuần không có booking nào tại "Cầu lông A" | Bình gọi `GET /api/owner/venues/VA/financials?period=week&date=2026-11-20` | API trả về 200 với `revenue = 0`, `bookedHours = 0`, `occupancyRate = 0`, `totalBookings = 0`, `cancellationRate = 0`, `rejectionRate = 0`, `chartData` các ngày đều có giá trị 0 |
| AC-7 | Dũng là chủ sân "Cầu lông B". Bình là chủ sân "Cầu lông A" | Dũng gọi `GET /api/owner/venues/VA/financials?period=week&date=2026-11-20` | API trả về 404 "Không tìm thấy đơn vị" (tránh lộ thông tin đơn vị theo chuẩn `OwnerVenuesController`). Khách chưa đăng nhập nhận 401 |
| AC-8 | Booking B của "Cầu lông A" có trạng thái CONFIRMED, ban đầu `paidAtVenue = false` | Bình gọi `PATCH /api/owner/bookings/<B>/paid` với `{ paidAtVenue: true }` | API thực hiện trong transaction với thứ tự khóa `Venue` FOR SHARE -> `Court` FOR UPDATE, trả về 200 `{ id: B, paidAtVenue: true }`. Gọi lại dashboard tài chính thấy doanh thu tăng tương ứng |
| AC-9 | Booking B đang ở trạng thái CANCELLED hoặc REJECTED | Bình gọi `PATCH /api/owner/bookings/<B>/paid` với `{ paidAtVenue: true }` | API trả về 400 "Chỉ đánh dấu thu tiền cho booking đã xác nhận" |
| AC-10 | Dũng gọi cập nhật tiền cho booking B thuộc đơn vị của Bình | Dũng gọi `PATCH /api/owner/bookings/<B>/paid` | API trả về 404 "Không tìm thấy booking" (tránh lộ sự tồn tại của booking). Khách chưa đăng nhập nhận 401 |
| AC-11 | Web: Bình đăng nhập vai trò OWNER và mở tab "Doanh thu". Chọn khoảng thời gian "Tuần" | Bình xem màn hình dashboard trên giao diện chuẩn và di động (390px) | Web hiển thị các thẻ chỉ số (Doanh thu, Giờ đã đặt, Tỉ lệ lấp đầy, Tỉ lệ hủy, Khách quay lại) và biểu đồ Recharts có nhãn ngày trong tuần |
| AC-12 | Web: Trong danh sách booking chủ sân (`OwnerRequests`), mỗi booking đã xác nhận hiển thị trạng thái thu tiền và nút gạt hoặc nút bấm "Đã thu tiền" | Bình bấm đổi trạng thái thu tiền trên booking CONFIRMED | Web gửi `PATCH /api/owner/bookings/<B>/paid` và cập nhật giao diện ngay lập tức |

## Contract

1. Tệp `packages/shared/src/finance.ts`:

- Schema query `FinancialQuerySchema`:
  ```ts
  period: z.enum(['day', 'week', 'month']).default('week')
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  ```

- Schema `FinancialChartPoint`:
  ```ts
  label: z.string() // e.g. "T2 16/11", "T3 17/11" hoặc "08:00"
  revenue: z.number().int().nonnegative() // VND
  bookedHours: z.number().nonnegative() // hours
  bookingCount: z.number().int().nonnegative()
  ```

- Schema `FinancialDashboardView`:
  ```ts
  venueId: z.string().uuid()
  venueName: z.string()
  period: z.enum(['day', 'week', 'month'])
  date: z.string() // YYYY-MM-DD
  startDate: z.string() // ISO
  endDate: z.string() // ISO
  revenue: z.number().int().nonnegative() // VND (CONFIRMED + paidAtVenue=true)
  totalBookings: z.number().int().nonnegative()
  paidBookings: z.number().int().nonnegative()
  unpaidBookings: z.number().int().nonnegative() // CONFIRMED + paidAtVenue=false
  bookedHours: z.number().nonnegative()
  openingHours: z.number().nonnegative()
  occupancyRate: z.number().min(0).max(1)
  peakHours: z.number().nonnegative()
  normalHours: z.number().nonnegative()
  cancelledBookings: z.number().int().nonnegative()
  rejectedBookings: z.number().int().nonnegative()
  cancellationRate: z.number().min(0).max(1)
  rejectionRate: z.number().min(0).max(1)
  totalCustomers: z.number().int().nonnegative()
  returningCustomers: z.number().int().nonnegative()
  chartData: z.array(FinancialChartPoint)
  ```

- Schema `UpdatePaidAtVenueSchema`:
  ```ts
  paidAtVenue: z.boolean()
  ```

- Schema `PaidAtVenueResponse`:
  ```ts
  id: z.string().uuid()
  paidAtVenue: z.boolean()
  ```

2. Tệp `packages/shared/src/booking.ts`:
- Bổ sung trường `paidAtVenue: z.boolean()` vào `OwnerBookingView`.

3. Endpoints:
- `GET /api/owner/venues/:id/financials?period=...&date=...`:
  - 200: `FinancialDashboardView`
  - 400: Sai định dạng `period` hoặc `date`
  - 401: Chưa đăng nhập
  - 404: "Không tìm thấy đơn vị" (nếu đơn vị không tồn tại hoặc không thuộc chủ sân)
- `PATCH /api/owner/bookings/:id/paid`:
  - Body: `{ paidAtVenue: boolean }`
  - 200: `PaidAtVenueResponse`
  - 400: "Chỉ đánh dấu thu tiền cho booking đã xác nhận" (nếu booking không ở trạng thái CONFIRMED)
  - 401: Chưa đăng nhập
  - 404: "Không tìm thấy booking" (nếu booking không tồn tại hoặc không thuộc đơn vị của chủ sân)

## Data

Bảng `Booking` đã có sẵn cột `paidAtVenue Boolean @default(false)` từ migration F-002 (`apps/api/prisma/schema.prisma:117`).
Bổ sung index hỗ trợ truy vấn lọc theo khoảng thời gian trên sân:
- `@@index([courtId, startAt])` trong `apps/api/prisma/schema.prisma` kèm migration `20261019120000_f015_financial_index`.

## Build order

| # | Step | Branch | Paths | Tests |
|---|---|---|---|---|
| 1 | Contract và schema | `feat/77-1-financial-contract-schema` | `packages/shared/src/finance.ts`, `packages/shared/src/finance.test.ts`, `packages/shared/src/booking.ts`, `packages/shared/src/booking.test.ts`, `packages/shared/src/index.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20261019120000_f015_financial_index/migration.sql`, `apps/api/prisma/migration.test.ts`, `apps/api/src/modules/bookings/bookings.service.ts` | Contract tests `packages/shared`, migration test |
| 2 | Server API | `feat/77-2-financial-api` | `apps/api/src/modules/finance/finance.service.ts`, `apps/api/src/modules/finance/finance.controller.ts`, `apps/api/src/modules/finance/finance.module.ts`, `apps/api/src/modules/bookings/bookings.service.ts`, `apps/api/src/modules/bookings/bookings.controller.ts`, `apps/api/src/app.module.ts`, `apps/api/src/modules/finance/finance.e2e.test.ts` | AC-1 đến AC-10 e2e tests |
| 3 | Screen | `feat/77-3-financial-screens` | `apps/web/package.json`, `apps/web/src/features/finance/FinancialDashboard.tsx`, `apps/web/src/features/finance/FinancialDashboard.test.tsx`, `apps/web/src/features/bookings/OwnerRequests.tsx`, `apps/web/src/features/bookings/OwnerRequests.test.tsx`, `apps/web/src/app/App.tsx`, `apps/web/src/app/App.test.tsx`, `apps/web/src/app/styles.css` | AC-11, AC-12 web tests |

## Edit boundaries

- May edit:
  - `docs/briefs/F-015-dashboard-tai-chinh-chu-san.md`
  - `packages/shared/src/finance.ts`
  - `packages/shared/src/finance.test.ts`
  - `packages/shared/src/booking.ts`
  - `packages/shared/src/booking.test.ts`
  - `packages/shared/src/index.ts`
  - `apps/api/prisma/schema.prisma`
  - `apps/api/prisma/migrations/*`
  - `apps/api/prisma/migration.test.ts`
  - `apps/api/src/modules/finance/*`
  - `apps/api/src/modules/bookings/bookings.controller.ts`
  - `apps/api/src/modules/bookings/bookings.service.ts`
  - `apps/api/src/app.module.ts`
  - `apps/web/package.json`
  - `pnpm-lock.yaml`
  - `apps/web/src/features/finance/*`
  - `apps/web/src/features/bookings/OwnerRequests.tsx`
  - `apps/web/src/features/bookings/OwnerRequests.test.tsx`
  - `apps/web/src/app/App.tsx`
  - `apps/web/src/app/App.test.tsx`
  - `apps/web/src/app/styles.css`
  - `PROGRESS.md`
- Leave unchanged without approval:
  - `apps/api/src/modules/auth/*`
  - `apps/api/src/modules/matches/*`
  - `apps/api/src/modules/notifications/*`

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Tính sai doanh thu hoặc vi phạm BR-21 | `finance.service.ts` | Chỉ tính booking `CONFIRMED` có `paidAtVenue = true`. Test AC-1 đối chiếu chính xác với ví dụ Acceptance UC-12 trong Intake |
| Deadlock hoặc race condition khi cập nhật `paidAtVenue` | `bookings.service.ts` (`PATCH /api/owner/bookings/:id/paid`) | Tuân thủ nghiêm ngặt thứ tự khóa: `lockVenueOf` FOR SHARE -> Court FOR UPDATE -> Booking update. Kiểm tra nguyên tử `WHERE id = :id AND status = 'CONFIRMED'`. Kèm e2e test gọi đồng thời với thao tác hủy |
| Lộ đơn vị hoặc booking của chủ sân khác (BR-23) | `finance.controller.ts`, `bookings.controller.ts` | Trả về 404 "Không tìm thấy đơn vị" / "Không tìm thấy booking" khi tài khoản không sở hữu đơn vị. Test AC-7, AC-10 |
| Lệch ngày và múi giờ khi gom nhóm tuần/tháng (BR-27) | `finance.service.ts` | Mọi mốc thời gian chuyển đổi qua múi giờ `Asia/Ho_Chi_Minh` trước khi xác định khoảng bắt đầu/kết thúc |
| Lỗi đo kích thước Recharts ResponsiveContainer trong Vitest JSDOM | `FinancialDashboard.test.tsx` | Mock `ResizeObserver` hoặc `ResponsiveContainer` trong môi trường test jsdom để tránh kích thước 0x0 |

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Không có | — | — |

## Done when

- Mọi AC từ AC-1 đến AC-12 có test với tên tương ứng và chạy đạt.
- Lệnh `pnpm check` chạy đạt không lỗi.
- Reviewer và Rule Reviewer hoàn thành không còn lỗi mức medium hoặc cao hơn.
