---
style: ste80
lang: vi
---

# F-031: Tài khoản nhân viên của chủ sân

Status: draft
Source: `docs/requirements/intake-monsport-v2.md` (mục W3, UC-17). `docs/design/ke-hoach-v2.md`. Người dùng ngày 12/11/2026: code hết các tính năng V2, dùng swarm của agy 3.8, không hỏi lại.

## Goal

Chủ sân tạo tài khoản nhân viên cho một đơn vị của mình. Nhân viên đăng nhập bằng số điện thoại và mật khẩu. Nhân viên xem "Lịch sân" và "Yêu cầu" của đơn vị đó. Nhân viên xác nhận hoặc từ chối yêu cầu đặt sân, và nhập booking gọi điện (cả đặt cố định của F-030). Nhân viên không xem doanh thu, không sửa giá, không hủy booking. Kiểm tra bằng test API và test màn web.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Nhân viên hủy booking hoặc đánh dấu đã thu tiền | Intake W3 để ngỏ. Hủy và tiền là việc của chủ sân. Mặc định an toàn hơn | Khi bạn chốt dòng 57 của `HUMAN_DECISIONS.md` |
| Một nhân viên làm cho nhiều đơn vị | Cần bảng liên kết và chọn đơn vị | Khi bạn cần |
| Thông báo cho nhân viên | Thông báo `BOOKING_REQUESTED` vẫn tới chủ sân | Khi bạn cần |
| App mobile cho nhân viên | Làm web trước. App chuyển `STAFF` sang thông báo "Dùng web" | Brief app của W3 |
| Nhân viên tự đổi mật khẩu | Chưa có luồng đổi mật khẩu | Brief sau |

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

- AC-1: `Role` có thêm `STAFF`. `CreateStaffRequest` nhận `name`, `phone`, `password` và `consent` là `true`, như `CreateOwnerRequest`. Mật khẩu yếu hoặc chứa số điện thoại bị từ chối (BR-31). `StaffView` có `id`, `name`, `phone`, `venueId`, `lockedAt`.
- AC-2: `POST /api/owner/venues/:venueId/staff` của chủ sân sở hữu đơn vị tạo một `User` vai trò `STAFF` với `staffVenueId` = `venueId`, `consentAt` = thời điểm tạo, và mật khẩu đã băm. Trả 201 với `StaffView`. Số điện thoại đã có tài khoản trả 409 "Số này đã có tài khoản".
- AC-3: Chủ sân không sở hữu đơn vị nhận 404 khi tạo, xem hoặc khóa nhân viên của đơn vị đó (BR-23). `USER`, `ADMIN` và `STAFF` nhận 403.
- AC-4: `GET /api/owner/venues/:venueId/staff` trả nhân viên của đơn vị, xếp theo tên. `POST /api/owner/staff/:id/lock` khóa tài khoản (`lockedAt`) và thu hồi các phiên cũ (`sessionsValidFrom`, BR-32). Nhân viên bị khóa không đăng nhập được, với thông báo khóa hiện có.
- AC-5: Nhân viên đăng nhập bằng `POST /api/auth/login`. Phiên có `role` = `STAFF`.
- AC-6: Nhân viên gọi `GET /api/owner/venues` nhận đúng một đơn vị: đơn vị của mình. `GET /api/owner/bookings` chỉ trả booking của các sân thuộc đơn vị đó.
- AC-7: Nhân viên xác nhận và từ chối yêu cầu của đơn vị mình (UC-4), với cùng khóa và luật như chủ sân (BR-6, BR-7, BR-8). Yêu cầu của đơn vị khác trả 403, như với chủ sân.
- AC-8: Nhân viên nhập booking gọi điện (`POST /api/owner/bookings`) và đặt cố định (`POST /api/owner/bookings/recurring`) trên sân của đơn vị mình. Sân của đơn vị khác trả cùng lỗi như chủ sân không sở hữu sân.
- AC-9: Nhân viên nhận 403 ở các lệnh sau:
  - hủy booking và đánh dấu đã thu tiền.
  - sửa đơn vị, sửa sân và giá.
  - báo cáo tài chính.
  - tạo và khóa nhân viên.
- AC-10: Migration chỉ thêm giá trị `STAFF` vào `Role` và cột `User.staffVenueId` (cho phép `null`, khóa ngoại tới `Venue`). Người dùng đã có không đổi. Số liệu admin (`stats.service.ts`) đếm tài khoản `STAFF` riêng và vẫn type-check.
- AC-13: Khi admin đổi chủ của một đơn vị, mọi nhân viên của đơn vị đó bị khóa và mất phiên cũ, trong cùng transaction. Khi admin khóa một chủ sân, mọi nhân viên của các đơn vị của chủ sân đó cũng bị khóa và mất phiên cũ.
- AC-14: `PRIVACY_NOTICE` nêu rằng nhân viên của đơn vị thấy tên và số điện thoại của khách đặt sân ở đơn vị đó (BR-55 mở rộng BR-20).
- AC-11: Web: trang "Đơn vị của tôi" của chủ sân có mục "Nhân viên" cho mỗi đơn vị. Mục này có:
  - danh sách nhân viên với tên, số điện thoại và trạng thái.
  - form "Thêm nhân viên" với tên, số điện thoại, mật khẩu và ô đồng ý "Nhân viên đã đồng ý với thông báo về dữ liệu cá nhân".
  - nút "Khóa" với hộp xác nhận.
- AC-12: Web: nhân viên đăng nhập thấy khung chủ sân chỉ với "Lịch sân" và "Yêu cầu". Không có "Doanh thu", "Đơn vị của tôi" hay nút hủy và thu tiền trong các màn đó. Mở trực tiếp đường dẫn doanh thu thì chuyển về "Lịch sân".

## Contract

`packages/shared/src/account.ts` (hoặc file chứa `Role`):

```ts
// Role: thêm 'STAFF'.
// The shape of CreateOwnerRequest: BR-31 needs the phone, so the weak-password check is object-level.
export const CreateStaffRequest = z
  .object({ name: Name, phone: Phone, password: Password, consent: z.literal(true, { error: Messages.consent }) })
  .strict()
  .superRefine(notWeak);
export type CreateStaffRequest = z.infer<typeof CreateStaffRequest>;

export const StaffView = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: Phone,
  venueId: z.uuid(),
  lockedAt: Instant.nullable(),
});
export type StaffView = z.infer<typeof StaffView>;
export const STAFF_PHONE_TAKEN = 'Số này đã có tài khoản';
```

Route mới (vai trò `OWNER`):

- `POST /api/owner/venues/:venueId/staff` → 201 `StaffView`.
- `GET /api/owner/venues/:venueId/staff` → `StaffView[]`.
- `POST /api/owner/staff/:id/lock` → 200 `StaffView`.

Route đổi vai trò từ `OWNER` sang `OWNER` và `STAFF`: `GET /api/owner/venues`, `GET /api/owner/bookings`, `POST /api/owner/bookings/:id/confirm`, `POST /api/owner/bookings/:id/reject`, `POST /api/owner/bookings`, `POST /api/owner/bookings/recurring`.

## Data

- Giá trị mới `STAFF` của enum `Role`.
- Cột mới `User.staffVenueId String? @db.Uuid`, khóa ngoại tới `Venue.id`, có index. Chỉ tài khoản `STAFF` có giá trị.
- Migration `20261112100000_f031_staff`. Chỉ thêm.
- Ghi vào `docs/requirements/data-dictionary.md`. Thêm BR-55 vào `business-rules.md` và UC-17 vào `use-cases.md`.

## Lock order

Không có khóa mới. Mọi lệnh của nhân viên dùng đúng thứ tự khóa của lệnh chủ sân tương ứng: `Venue` (FOR SHARE), rồi `Court` (FOR UPDATE). Với nhân viên, điều kiện sau khóa `Venue` là `venue.id = staffVenueId`, thay cho `venue.ownerId = ownerId`. Một hàm duy nhất tạo phạm vi truy cập từ người gọi: `{ ownerId }` cho `OWNER`, `{ venueId }` cho `STAFF`. `SessionGuard` thêm `staffVenueId` vào `AuthedRequest`. Response `SessionUser` không đổi.

## Build order

One pull request for each row. Each pull request passes the check command on its own. Bước 1 tách nhánh từ bước 2 của F-030 và dùng nhánh đó làm base, vì AC-8 cần route `/recurring`.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Contract, schema, server | `packages/shared/src/`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `apps/api/prisma/migration.test.ts`, `apps/api/src/modules/auth/`, `apps/api/src/modules/bookings/`, `apps/api/src/modules/venues/`, `apps/api/src/modules/staff/`, `apps/api/src/modules/finance/`, `apps/api/src/modules/admin/`, `apps/api/src/app.module.ts`, `apps/mobile/src/` (chỉ chỗ cần cho `Role` mới), `docs/requirements/`, `HUMAN_DECISIONS.md`, `PROGRESS.md`, `@map.md` | AC-1 đến AC-10, AC-13, AC-14 |
| 2 | Screen | `apps/web/src/features/venues/`, `apps/web/src/features/staff/`, `apps/web/src/features/bookings/`, `apps/web/src/app/`, `apps/web/src/styles.css`, `@map.md` | AC-11, AC-12 |

## Edit boundaries

- May edit: các đường dẫn trong "Build order", đúng bước của chúng.
- Leave unchanged without approval: các migration đã có, `DESIGN.md`, `REVIEW.md`, `apps/api/src/modules/matches/`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Quyền truy cập: nhân viên thấy hoặc sửa dữ liệu của đơn vị khác | Bước 1 | Một hàm phạm vi cho mọi lệnh. AC-6 đến AC-9. Review bằng model mạnh nhất và skill `rule-review` |
| Dữ liệu cá nhân: chủ sân nhập tên và số của nhân viên. Nhân viên thấy số của khách | Bước 1, 2 | Ô đồng ý bắt buộc (`consent`), `consentAt` lưu lúc tạo (BR-29). Không hiện mật khẩu. AC-13, AC-14 |
| Schema: thêm giá trị enum và cột | Bước 1 | Chỉ thêm. AC-10 |
| Hồi quy: các màn và test của chủ sân | Bước 1, 2 | Các test hiện có của chủ sân phải pass |

## Assumptions

| Assumption | Why |
|---|---|
| Nhân viên không hủy booking, không đánh dấu đã thu tiền (dòng 57) | Intake W3 để ngỏ việc xóa booking. Hủy và tiền ảnh hưởng tới khách và doanh thu, nên chọn mặc định an toàn hơn |
| Mỗi nhân viên làm cho một đơn vị | Đủ cho người trực sân. Cột trên `User` đơn giản hơn bảng liên kết |
| "Xóa" nhân viên là khóa tài khoản | Giữ lịch sử booking mà nhân viên đã xác nhận. Không xóa dữ liệu |
| Chủ sân xác nhận nhân viên đã đồng ý (BR-29) | Nhân viên không tự đăng ký |

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Nhân viên có hủy booking và đánh dấu đã thu tiền không? Mặc định: không | Bạn | none |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
