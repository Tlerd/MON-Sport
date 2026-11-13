---
style: ste80
lang: vi
---

# F-030: Đặt cố định hằng tuần

Status: draft
Source: `docs/requirements/intake-monsport-v2.md` (mục W2, UC-16). `docs/design/ke-hoach-v2.md`. Người dùng ngày 12/11/2026: code hết các tính năng V2, dùng swarm của agy 3.8, không hỏi lại.

## Goal

Chủ sân nhập một lần một booking của khách gọi điện, lặp lại cùng giờ mỗi tuần trong 2 đến 12 tuần. Hệ thống tạo một booking cho mỗi tuần dưới cùng khóa `Court` (BR-6). Kiểm tra bằng test API và test màn web "Lịch sân".

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Hủy cả chuỗi bằng một lệnh | Chủ sân hủy từng buổi bằng lệnh hủy hiện có (F-009). Thêm lệnh mới cần thêm luật | Khi bạn cần |
| Đặt cố định cho người dùng app | Intake W2 chỉ nói chủ sân | Brief sau |
| Đổi giờ hoặc số tuần của chuỗi đã tạo | Cần màn sửa chuỗi | Khi bạn cần |
| App mobile | Làm web trước (`ke-hoach-v2.md`) | Brief app của W2 |
| Luồng `verify-flow` mới | Các luồng chủ sân hiện có phải pass. Luồng mới cần tài khoản thử riêng | Khi port sang app |

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

- AC-1: `RecurringPhoneBookingRequest` nhận các trường của `CreatePhoneBookingRequest` và `weeks` là số nguyên từ 2 đến 12. Giá trị 1, 13 và 2.5 bị từ chối. `RecurringPhoneBookingResponse` có `seriesId`, `created` (mảng `OwnerBookingView`) và `skipped` (mảng `{ startAt, endAt }`).
- AC-2: `POST /api/owner/bookings/recurring` với `weeks` = 4 trên sân trống tạo 4 booking `CONFIRMED`, nguồn `PHONE`, cách nhau đúng 7 ngày, cùng `seriesId`. `priceTotal` của mỗi buổi bằng `bookingPrice` với giá sân lúc đặt (BR-5, BR-6). Response có 4 buổi trong `created` và `skipped` rỗng.
- AC-3: Tuần thứ 2 trùng giờ với một booking `CONFIRMED` đã có. Response có 3 buổi trong `created`, và `skipped` có đúng giờ của tuần thứ 2. Booking đã có không đổi (BR-1, BR-54).
- AC-4: Mọi tuần đều trùng giờ. API trả 409 "Mọi buổi đều đã có người đặt", và không tạo booking nào.
- AC-5: Một yêu cầu `PENDING` đã quá hạn xác nhận không chặn buổi trùng giờ với nó. Yêu cầu đó thành `EXPIRED` trước khi tạo chuỗi (BR-8).
- AC-6: Hai lệnh đặt cố định cùng sân, cùng giờ, gửi cùng lúc. Mỗi giờ chỉ có một booking active (BR-1). Một lệnh nhận 201 với 4 buổi. Lệnh kia nhận 409 "Mọi buổi đều đã có người đặt".
- AC-7: Chủ sân không sở hữu sân nhận cùng lỗi như lệnh nhập booking gọi điện (F-007). Giờ bắt đầu đã qua nhận 400 "Giờ bắt đầu đã qua". Giờ ngoài giờ mở cửa nhận cùng lỗi 400 như F-007.
- AC-8: Migration chỉ thêm cột `Booking.seriesId` (cho phép `null`). Booking đã có giữ `seriesId` là `null`. `OwnerBookingView` có `seriesId` (`null` khi không thuộc chuỗi).
- AC-9: Trên "Lịch sân" của web, form nhập booking gọi điện có ô "Lặp lại hằng tuần". Khi ô không chọn, form gửi đúng request cũ tới `/api/owner/bookings`. Khi ô được chọn, form hiện ô "Số tuần" với các giá trị 2 đến 12, mặc định 4, và gửi `POST /api/owner/bookings/recurring` có `weeks`.
- AC-10: Sau khi đặt cố định thành công, màn hiện "Đã tạo 3 buổi". Khi `skipped` không rỗng, màn hiện thêm "Bỏ qua 1 buổi trùng giờ: 20/11" (ngày theo giờ Việt Nam, dạng dd/mm, cách nhau bởi dấu phẩy). Lịch tải lại. Khi API trả 409, màn hiện thông báo của API.

## Contract

`packages/shared/src/booking.ts`:

```ts
export const RECURRING_MIN_WEEKS = 2;
export const RECURRING_MAX_WEEKS = 12;
export const ALL_WEEKS_TAKEN = 'Mọi buổi đều đã có người đặt';

export const RecurringPhoneBookingRequest = CreatePhoneBookingRequest.extend({
  weeks: z.int().min(RECURRING_MIN_WEEKS).max(RECURRING_MAX_WEEKS),
}).strict();
export type RecurringPhoneBookingRequest = z.infer<typeof RecurringPhoneBookingRequest>;

export const RecurringPhoneBookingResponse = z.object({
  seriesId: z.uuid(),
  created: z.array(OwnerBookingView),
  skipped: z.array(z.object({ startAt: Instant, endAt: Instant })),
});
export type RecurringPhoneBookingResponse = z.infer<typeof RecurringPhoneBookingResponse>;

// BookingView: thêm seriesId: z.uuid().nullable().optional(). `optional` giữ app hiện có type-check được.
```

Route mới: `POST /api/owner/bookings/recurring`, vai trò `OWNER`, trả 201 với `RecurringPhoneBookingResponse`. Request sai trả 400 như `POST /api/owner/bookings` (lỗi số điện thoại dùng `PHONE_MESSAGE`). Buổi thứ k (k = 0 đến `weeks` − 1) có `startAt + 7k ngày` và `endAt + 7k ngày`. Việt Nam không đổi giờ theo mùa, nên cộng 7 × 24 giờ là đúng.

## Data

- Cột mới `Booking.seriesId String? @db.Uuid`, có index. Không có bảng chuỗi riêng: chuỗi chỉ là nhóm booking cùng `seriesId`.
- Migration `20261112000000_f030_booking_series`. Chỉ thêm cột và index.
- Ghi `Booking.seriesId` vào `docs/requirements/data-dictionary.md`. Thêm BR-54 vào `business-rules.md` và UC-16 vào `use-cases.md`.

## Lock order

Một transaction cho cả chuỗi: `Venue` (FOR SHARE, như F-007), rồi `Court` (FOR UPDATE), một lần. Sau khóa: đọc giá sân, cho hết hạn các yêu cầu quá hạn của sân (BR-8), đọc các booking active trùng giờ với từng buổi, bỏ các buổi trùng, rồi thêm các buổi còn lại. Ràng buộc `EXCLUDE` vẫn là lớp chặn cuối: nếu nó báo trùng, cả transaction rollback và API trả 409 `TAKEN`. Deadlock (40P01) chạy lại một lần như `insertUnderLock`.

## Build order

One pull request for each row. Each pull request passes the check command on its own.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Contract, schema, server | `packages/shared/src/booking.ts`, `packages/shared/src/booking.test.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `apps/api/prisma/migration.test.ts`, `apps/api/src/modules/bookings/`, `docs/requirements/data-dictionary.md`, `docs/requirements/business-rules.md`, `docs/requirements/use-cases.md`, `HUMAN_DECISIONS.md`, `PROGRESS.md`, `@map.md` | AC-1 đến AC-8 |
| 2 | Screen | `apps/web/src/app/SchedulePage.tsx`, `apps/web/src/app/SchedulePage.test.tsx`, `apps/web/src/styles.css`, `@map.md` | AC-9, AC-10 |

## Edit boundaries

- May edit: các đường dẫn trong "Build order", đúng bước của chúng.
- Leave unchanged without approval: `apps/mobile/`, `packages/client/`, `apps/api/src/modules/matches/`, `apps/api/src/modules/finance/`, các migration đã có, `DESIGN.md`, `REVIEW.md`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Đồng thời: nhiều buổi dưới một khóa `Court` | Bước 1 | Một transaction, thứ tự khóa của F-007. AC-6. Review bằng model mạnh nhất và skill `rule-review` |
| Schema: thêm cột | Bước 1 | Chỉ thêm, cho phép `null`. AC-8 |
| Tiền: giá mỗi buổi | Bước 1 | Giá đọc sau khóa, cho từng buổi (BR-6). AC-2 |
| Dữ liệu cá nhân: tên và số của khách | Bước 1 | Như F-007. Không thêm chỗ hiện mới |

## Assumptions

| Assumption | Why |
|---|---|
| Buổi trùng giờ bị bỏ và báo lại. Các buổi khác vẫn tạo (BR-54) | Intake W2 để ngỏ. Chủ sân thấy ngay buổi nào thiếu và nhập tay buổi đó. Hủy cả chuỗi làm mất các buổi trống |
| Số tuần từ 2 đến 12 | Một quý là đủ cho khách cố định. Số lớn hơn giữ sân quá lâu |
| Chỉ chủ sân đặt cố định, qua form booking gọi điện | Intake W2 |
| Không gửi thông báo | Booking gọi điện của F-007 không gửi thông báo |

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Buổi trùng giờ: bỏ và báo, hay hủy cả chuỗi? Mặc định: bỏ và báo | Bạn | none |
| Số tuần tối đa. Mặc định: 12 | Bạn | none |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
