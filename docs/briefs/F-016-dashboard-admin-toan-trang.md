---
style: ste80
lang: vi
---

# F-016: Dashboard Admin toàn trang

Status: accepted
Source:

- Intake `docs/requirements/intake-monsport-v1.md`:
  - UC-13: "Xem dashboard toàn trang (đề xuất M2)".
  - Mục UC-13 liệt kê năm nhóm số liệu:
    - Số tài khoản theo vai trò.
    - Người dùng mới và người dùng hoạt động theo tuần.
    - Số booking và số trận theo từng đơn vị.
    - Thời gian trung bình chủ sân xác nhận một yêu cầu.
    - Tỉ lệ yêu cầu hết hạn vì chủ sân không xác nhận.
  - Acceptance UC-13: "Có 3 chủ sân và 40 người dùng. Dashboard admin ghi đúng 3 chủ sân và 40 người dùng".
  - Mục "Assumptions": "Thứ tự ra mắt: UC-1, UC-10, UC-11 → UC-2 đến UC-6 → UC-7 đến UC-9 → UC-14 → UC-12, UC-13".
- `docs/requirements/use-cases.md`:
  - UC-13: PRE-13 admin đã đăng nhập. POST-13 không đổi dữ liệu. Normal Flow: admin mở dashboard, hệ thống hiện các số liệu và biểu đồ.
  - Assumptions của UC-13: "Người dùng hoạt động là người có ít nhất một lần đăng nhập trong tuần". Brief này đổi định nghĩa (Assumption 4).
- `docs/requirements/business-rules.md`:
  - BR-8: Khi hạn xác nhận qua mà chủ sân chưa xác nhận, booking chuyển sang "Hết hạn".
  - BR-16: Booking hết hạn thì trận trên booking đó bị hủy.
  - BR-22: Admin không xác nhận và không hủy booking.
  - BR-27: Giờ hiển thị theo múi giờ `Asia/Ho_Chi_Minh`.
- `docs/requirements/data-dictionary.md`:
  - `User`: `role`, `lockedAt`, `deletedAt`, `createdAt`.
  - `Booking`: `status`, `source`, `confirmedAt`, `confirmDeadline`, `createdAt`, `startAt`, `courtId`.
  - `Match`: `bookingId`, `status`, `hostId`, `createdAt`.
  - `MatchPlayer`: `userId`, `joinedAt`.

## Goal

Admin xem được số liệu toàn trang trong một tuần: tài khoản, người dùng mới và hoạt động, booking và trận của từng đơn vị, thời gian xác nhận và tỉ lệ hết hạn. Dashboard không đổi dữ liệu.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Chọn khoảng ngày hoặc tháng | Intake chỉ đòi số liệu "theo tuần" | Khi admin yêu cầu |
| Biểu đồ chuỗi thời gian | Dashboard chỉ có số liệu của một tuần. Thẻ số và bảng theo đơn vị đủ cho v1 | Khi admin cần so nhiều tuần |
| Cột `lastLoginAt` hoặc bảng nhật ký hoạt động | Cần đổi schema và lưu dữ liệu cá nhân (Luật 91/2025). Định nghĩa "hoạt động" dùng dữ liệu có sẵn | Sau khi người dùng quyết định mục 10 của `PROGRESS.md` |
| Danh sách hoặc số điện thoại từng người dùng | Dashboard chỉ cho số tổng hợp. Giảm lộ dữ liệu cá nhân | Không có kế hoạch |
| Đổi dữ liệu từ dashboard (xác nhận, hủy, khóa) | POST-13 và BR-22 | Không có kế hoạch |
| Chuyển booking quá hạn sang `EXPIRED` khi admin mở dashboard | Ghi dữ liệu phá POST-13. Dashboard tính trạng thái quá hạn mà không ghi | Không có kế hoạch |
| Sửa `finance.service.ts` để dùng hàm ngày chung | Module tiền, không thuộc lát cắt này | Lát cắt dọn mã sau |

## Assumptions

Intake để mở các điểm sau. Brief chọn phương án an toàn hơn. Người dùng sửa sau.

1. **Tuần** chạy từ thứ Hai 00:00 đến Chủ nhật 23:59:59.999 theo `Asia/Ho_Chi_Minh` (BR-27), như F-015. Tham số `date` chọn ngày nằm trong tuần. Mặc định là hôm nay theo `Clock`. Mọi phép tính ngày đi qua `packages/shared/src/booking-time.ts`.
2. **Số tài khoản theo vai trò** đếm mọi `User` có `deletedAt` rỗng, kể cả tài khoản bị khóa. Không phụ thuộc tuần.
3. **Người dùng mới** là `User` có `role` = `USER`, `deletedAt` rỗng, và `createdAt` trong tuần.
4. **Người dùng hoạt động** là `User` có `role` = `USER` làm ít nhất một việc sau trong tuần. Mỗi người đếm một lần.
   - Tạo booking `source` = `APP` (`Booking.createdAt`).
   - Vào trận (`MatchPlayer.joinedAt`).
   - Mở trận (`Match.createdAt`).

   Đây khác `use-cases.md` (UC-13: có đăng nhập trong tuần). Hệ thống chưa ghi lần đăng nhập, và thêm cột cần đổi schema. Mục 10 của `PROGRESS.md` ghi quyết định mở. Brief này không sửa `use-cases.md`.
5. **Số booking của đơn vị** đếm booking `CONFIRMED` có `startAt` trong tuần. **Số trận của đơn vị** đếm `Match` có `status` khác `CANCELLED`, có `startAt` của booking trong tuần, và booking đó không quá hạn (Assumption 7). Cả hai gom theo `Court.venueId`. Đơn vị không có số liệu vẫn hiện, với số 0.
6. **Thời gian xác nhận trung bình** là trung bình của `confirmedAt - createdAt`. Đơn vị là phút, làm tròn số nguyên. Mẫu gồm booking `source` = `APP` có `confirmedAt` khác rỗng và `createdAt` trong tuần. Không có booking nào thì giá trị là `null`.
7. **Quá hạn** là `status` = `EXPIRED`, hoặc `status` = `PENDING` mà `confirmDeadline` nhỏ hơn `now` của `Clock`. Hệ thống chỉ chuyển sang `EXPIRED` khi có người đọc hoặc ghi (`expireBookings`). Booking của chủ sân không mở app vẫn là `PENDING` trong dữ liệu. Dashboard tính quá hạn bằng công thức này và không ghi gì.

   **Tỉ lệ hết hạn** là số booking `source` = `APP` quá hạn, chia cho số booking `source` = `APP` thuộc `CONFIRMED`, `REJECTED` hoặc quá hạn, với `createdAt` trong tuần. `PENDING` chưa quá hạn và `CANCELLED` không vào mẫu số. Mẫu số bằng 0 thì tỉ lệ là 0. Làm tròn 4 chữ số thập phân.

## Acceptance criteria

Dữ liệu mẫu chung:
- Admin "Quản trị" (`0900000001`). Chủ sân "Bình" (`0912345678`) và "Dũng" (`0912345679`).
- "Cầu lông A" (`VA`, chủ Bình) và "Cầu lông B" (`VB`, chủ Dũng).
- Người dùng `USER`: "An", "Chi", "Lan".
- Tuần thử nghiệm: thứ Hai 16/11/2026 đến Chủ nhật 22/11/2026 (`Asia/Ho_Chi_Minh`). Ngày hỏi: `2026-11-20`. `Clock` của test đặt ở `2026-11-20T05:00:00Z`, trừ khi AC ghi khác.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Hệ thống có 1 admin, 3 chủ sân, 40 người dùng `USER` (1 người bị khóa) và 1 người dùng `USER` có `deletedAt` | Admin gọi `GET /api/admin/stats?date=2026-11-20` | 200 với `accounts` = `{ ADMIN: 1, OWNER: 3, USER: 40 }`. Người bị khóa tính vào 40. Người đã xóa không tính |
| AC-2 | 5 `USER` có `createdAt` trong tuần 16–22/11, gồm 1 người tạo lúc `2026-11-15T17:30:00Z` (00:30 ngày 16/11 giờ Việt Nam). 2 `USER` tạo ngày 15/11 và 23/11. 1 `OWNER` tạo ngày 18/11 | Admin gọi như AC-1 | `newUsers` = 5 (chỉ `USER` trong tuần) |
| AC-3 | An tạo booking `APP` ngày 17/11. Chi vào trận ngày 18/11 (`MatchPlayer.joinedAt`). Lan mở trận ngày 19/11. An cũng vào trận ngày 20/11. Một `USER` khác chỉ hoạt động ngày 25/11 | Admin gọi như AC-1 | `activeUsers` = 3 (An, Chi, Lan). An đếm một lần. Người ngoài tuần không đếm |
| AC-4 | "Cầu lông A" có 4 booking `CONFIRMED` có `startAt` trong tuần, 1 booking `CANCELLED` trong tuần, 1 booking `CONFIRMED` có `startAt` ngày 25/11. Có 3 `Match` trong tuần: 1 `OPEN` trên booking `CONFIRMED`, 1 `CANCELLED`, và 1 `OPEN` trên booking `PENDING` có `confirmDeadline` ngày 17/11. "Cầu lông B" không có gì | Admin gọi như AC-1 | `venues` có 2 phần tử, sắp theo tên. "Cầu lông A": `bookingCount` = 4, `matchCount` = 1. "Cầu lông B": `bookingCount` = 0, `matchCount` = 0 |
| AC-5 | 3 booking `APP` có `createdAt` trong tuần và đã xác nhận, với `confirmedAt - createdAt` bằng 10, 20 và 45 phút. 1 booking `PHONE` đã xác nhận sau 600 phút | Admin gọi như AC-1 | `avgConfirmMinutes` = 25 (trung bình 25 phút). Booking `PHONE` không tính |
| AC-6 | Có 10 booking `APP` với `createdAt` trong tuần: 6 `CONFIRMED`, 2 `REJECTED`, 1 `EXPIRED`, 1 `PENDING` có `confirmDeadline` ngày 17/11 (đã quá hạn, chưa ai chuyển trạng thái). Có thêm 3 `PENDING` chưa quá hạn và 4 `CANCELLED` | Admin gọi như AC-1 | `expiryRate` = 0.2 (2 / 10) |
| AC-7 | Tuần không có booking nào | Admin gọi như AC-1 | 200 với `avgConfirmMinutes` = `null`, `expiryRate` = 0, và mọi `bookingCount` và `matchCount` = 0 |
| AC-8 | Người dùng `USER`, chủ sân `OWNER`, và khách chưa đăng nhập | Mỗi người gọi `GET /api/admin/stats` | `USER` và `OWNER` nhận 403. Khách nhận 401 |
| AC-9 | Tham số `date` sai: `2026-13-45`, `abc`, hoặc `2026-02-30` | Admin gọi `GET /api/admin/stats?date=<giá trị>` | 400 "Tham số truy vấn không hợp lệ" |
| AC-10 | Dữ liệu gồm 1 booking `PENDING` quá hạn có 1 `Match` `OPEN`, cùng booking, trận và người chơi khác | Admin gọi `GET /api/admin/stats`. Test chụp mọi dòng `User`, `Booking`, `Match`, `MatchPlayer` trước và sau | Hai ảnh chụp bằng nhau (`toEqual`). Booking vẫn `PENDING` và trận vẫn `OPEN` (POST-13) |
| AC-11 | Một booking `CONFIRMED` lúc `2026-11-22T23:30:00+07:00` và một booking `CONFIRMED` lúc `2026-11-23T00:00:00+07:00` | Admin gọi như AC-1 | Booking 23:30 Chủ nhật tính vào `bookingCount` của tuần. Booking 00:00 thứ Hai không tính |
| AC-12 | `Clock` đặt ở `2026-11-22T17:30:00Z` (00:30 thứ Hai 23/11 giờ Việt Nam) | Admin gọi `GET /api/admin/stats` không có `date` | `date` = `2026-11-23`, `weekStart` = `2026-11-23`, `weekEnd` = `2026-11-29` |
| AC-13 | Web: admin đăng nhập. `AdminPanel` có hai tab: "Tài khoản và đơn vị" (mặc định, chứa các mục hiện có) và "Số liệu" | Admin mở tab "Số liệu" | Web hiện thẻ số tài khoản theo vai trò, người dùng mới, người dùng hoạt động, thời gian xác nhận trung bình, tỉ lệ hết hạn, và bảng booking và trận theo đơn vị. Giá trị `null` hiện "Chưa có dữ liệu". Phản hồi không đúng `AdminStatsView` hiện thông báo lỗi và không làm sập màn hình |
| AC-14 | Web: tab "Số liệu" đang hiện tuần 16/11–22/11/2026 | Admin bấm "Tuần trước" | Web gọi API với `date` lùi 7 ngày (`2026-11-13`), bỏ kết quả của yêu cầu cũ về muộn, và hiện nhãn `09/11 – 15/11/2026` |

## Contract

1. Tệp `packages/shared/src/booking-time.ts` (đã có) thêm các hàm thuần, kèm test trong `booking-time.test.ts`. Tất cả theo `Asia/Ho_Chi_Minh` (BR-27):
   - `vnDateString(at: Date): string` trả `YYYY-MM-DD`.
   - `isRealDate(ymd: string): boolean` trả `false` cho `2026-02-30`, `2026-13-45` và `abc`. Hàm không bao giờ ném lỗi với một chuỗi bất kỳ.
   - `addDaysYmd(ymd: string, days: number): string`.
   - `vnWeekRange(ymd: string): { weekStart: string; weekEnd: string; from: Date; to: Date }`. `from` là 00:00 thứ Hai. `to` là 00:00 thứ Hai kế tiếp, không gồm. Truy vấn lọc `gte: from, lt: to`.

2. Tệp `packages/shared/src/admin-stats.ts` (new), xuất ra từ `packages/shared/src/index.ts`:

- `AdminStatsQuerySchema`:
  ```ts
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDate).refine(d => d >= '2000-01-01' && d <= '2999-12-31').optional()
  ```
  Giới hạn năm tránh ngày quá xa làm hàm tuần trả chuỗi sai.

- `AdminVenueStat`:
  ```ts
  venueId: z.string().uuid()
  venueName: z.string()
  bookingCount: z.number().int().nonnegative()
  matchCount: z.number().int().nonnegative()
  ```

- `AdminStatsView`:
  ```ts
  date: z.string() // YYYY-MM-DD, ngày đã dùng
  weekStart: z.string() // YYYY-MM-DD, thứ Hai
  weekEnd: z.string() // YYYY-MM-DD, Chủ nhật
  accounts: z.object({ ADMIN: int, OWNER: int, USER: int }) // mỗi số int nonnegative
  newUsers: z.number().int().nonnegative()
  activeUsers: z.number().int().nonnegative()
  avgConfirmMinutes: z.number().int().nonnegative().nullable()
  expiryRate: z.number().min(0).max(1)
  venues: z.array(AdminVenueStat) // sắp theo venueName
  ```

3. Endpoint `GET /api/admin/stats?date=YYYY-MM-DD`:
   - 200: `AdminStatsView`
   - 400: `date` sai định dạng hoặc không có thật
   - 401: chưa đăng nhập
   - 403: không phải `ADMIN`

## Data

Không đổi schema và không thêm migration. Mọi số liệu lấy từ cột có sẵn.

- Dùng `groupBy` và `count` của Prisma cho các số đếm.
- Được dùng một `$queryRaw` cho hai số liệu: `AVG(EXTRACT(EPOCH FROM "confirmedAt" - "createdAt"))` và `COUNT(DISTINCT ...)` trên `UNION` của ba nguồn.
- Index `Booking(courtId, startAt)` có từ F-015 phục vụ truy vấn theo đơn vị.
- `User.createdAt` và `Booking.createdAt` không có index riêng.

Quy mô v1 là khoảng 40 người dùng và vài trăm booking mỗi tuần. Quét tuần tự đủ nhanh.

Dịch vụ lấy `now` từ `Clock` (như `finance.service.ts`). Dịch vụ không gọi `expireBookings` và không ghi gì.

## Build order

| # | Step | Branch | Paths | Tests |
|---|---|---|---|---|
| 1 | Contract và hàm ngày | `feat/<issue>-1-admin-stats-contract` | `packages/shared/src/booking-time.ts`, `packages/shared/src/booking-time.test.ts`, `packages/shared/src/admin-stats.ts`, `packages/shared/src/admin-stats.test.ts`, `packages/shared/src/index.ts`, `PROGRESS.md` | Test đơn vị cho hàm ngày (ranh giới tuần, năm nhuận, `2026-02-30`, `2026-13-45`, `abc`). Contract test cho `AdminStatsQuerySchema` và `AdminStatsView` |
| 2 | Server API | `feat/<issue>-2-admin-stats-api` | `apps/api/src/modules/admin/stats.controller.ts`, `apps/api/src/modules/admin/stats.service.ts`, `apps/api/src/modules/admin/admin.module.ts`, `apps/api/src/modules/admin/stats.e2e.test.ts`, `PROGRESS.md` | AC-1 đến AC-12 e2e |
| 3 | Screen | `feat/<issue>-3-admin-stats-screen` | `apps/web/src/features/admin/AdminStats.tsx`, `apps/web/src/features/admin/AdminStats.test.tsx`, `apps/web/src/features/admin/AdminPanel.tsx`, `apps/web/src/features/admin/AdminPanel.test.tsx`, `apps/web/src/app/styles.css`, `PROGRESS.md` | AC-13, AC-14 web tests. Test AC-26 và AC-27 của F-003 vẫn đạt. Màn 390px kiểm bằng báo cáo và ảnh chụp của skill `verify-flow` |

## Edit boundaries

- May edit:
  - `docs/briefs/F-016-dashboard-admin-toan-trang.md`
  - `packages/shared/src/booking-time.ts`
  - `packages/shared/src/booking-time.test.ts`
  - `packages/shared/src/admin-stats.ts`
  - `packages/shared/src/admin-stats.test.ts`
  - `packages/shared/src/index.ts`
  - `apps/api/src/modules/admin/stats.controller.ts`
  - `apps/api/src/modules/admin/stats.service.ts`
  - `apps/api/src/modules/admin/stats.e2e.test.ts`
  - `apps/api/src/modules/admin/admin.module.ts`
  - `apps/web/src/features/admin/AdminStats.tsx`
  - `apps/web/src/features/admin/AdminStats.test.tsx`
  - `apps/web/src/features/admin/AdminPanel.tsx`
  - `apps/web/src/features/admin/AdminPanel.test.tsx`
  - `apps/web/src/app/styles.css`
  - `PROGRESS.md` (mỗi bước cập nhật "Next step". Mục 10 của "Open decisions" vào cùng pull request của brief)
- Leave unchanged without approval:
  - `apps/api/prisma/*`
  - `apps/api/src/modules/auth/*`
  - `apps/api/src/modules/bookings/*`
  - `apps/api/src/modules/finance/*`
  - `apps/api/src/modules/matches/*`
  - `apps/api/src/modules/notifications/*`
  - `apps/api/src/modules/admin/accounts.controller.ts`
  - `apps/api/src/modules/admin/venues.controller.ts`
  - `apps/web/src/app/App.tsx` và `apps/web/src/app/App.test.tsx` (tab mặc định giữ nội dung cũ, nên các test này không đổi)
  - `docs/requirements/*`

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| `OWNER` hoặc `USER` đọc được số liệu toàn trang (BR-22, phân quyền) | `stats.controller.ts` | `@Roles('ADMIN')` cùng `SessionGuard`, như `accounts.controller.ts`. Test AC-8 |
| Lộ dữ liệu cá nhân | `AdminStatsView` | View chỉ có số tổng hợp, không có tên hay số điện thoại. Contract test kiểm tra view không có trường phone. Reviewer đọc lại `stats.service.ts` về dữ liệu cá nhân |
| Số hết hạn thấp hơn thực tế vì hết hạn chạy chậm (BR-8, BR-16) | `stats.service.ts` | Tính quá hạn bằng `confirmDeadline < now`, không phụ thuộc trạng thái đã lưu. Test AC-4 và AC-6 |
| Dashboard ghi dữ liệu (phá POST-13) | `stats.service.ts` | Không gọi `expireBookings`. Test AC-10 so ảnh chụp toàn bộ dòng |
| Lệch tuần và múi giờ (BR-27) | `booking-time.ts`, `stats.service.ts` | Mọi mốc ngày qua hàm của `booking-time.ts`. Test AC-2, AC-11, AC-12 |
| Đếm sai (người đã xóa, đếm trùng người hoạt động, lẫn booking `PHONE`) | `stats.service.ts` | Test AC-1 đến AC-7. Người hoạt động gom bằng `COUNT(DISTINCT userId)` |
| Truy vấn nặng khi dữ liệu lớn | `stats.service.ts` | Dùng truy vấn tổng hợp. Quy mô v1 nhỏ. Ghi chú trong PR nếu cần index sau |

Brief này không đụng tiền, khóa, schema hay dữ liệu cá nhân mới. Vòng Reviewer thường đủ. Không bắt buộc chạy skill `rule-review`.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| "Người dùng hoạt động" tính theo hành vi nào (Assumption 4), và có cần đo lần đăng nhập không (đòi cột `lastLoginAt`)? Mục 10 của `PROGRESS.md` ghi câu hỏi này | Người dùng | Không chặn AC nào. Giá trị tạm theo Assumption 4 |
| Tỉ lệ hết hạn có nên tính cả booking `CANCELLED` sau khi được xác nhận không (Assumption 7)? | Người dùng | Không chặn AC nào |

## Done when

- Mọi AC từ AC-1 đến AC-14 có test với tên bắt đầu bằng nhãn tương ứng và chạy đạt.
- Lệnh `pnpm check` chạy đạt không lỗi.
- Reviewer hoàn thành không còn lỗi mức medium hoặc cao hơn.
