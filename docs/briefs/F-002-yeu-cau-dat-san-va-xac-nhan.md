---
style: ste80
lang: vi
---

# F-002: Gửi yêu cầu đặt sân, chủ sân xác nhận hoặc từ chối

Status: draft
Source: `docs/requirements/use-cases.md` UC-3, UC-4 và luồng 1.1 (đăng nhập) của UC-1. `docs/requirements/business-rules.md` BR-1 tới BR-9, BR-20, BR-22, BR-23, BR-25, BR-27. `docs/requirements/data-dictionary.md`. Bạn giao brief này ngày 16/10/2026.

## Goal

Người dùng gửi được yêu cầu đặt một khung giờ trên một sân, và chủ sân xác nhận hoặc từ chối được yêu cầu đó. Người dùng kiểm tra kết quả bằng trạng thái của booking trên màn hình.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Đăng ký tài khoản (UC-1, luồng 1.0) | Slice này dùng tài khoản trong seed. Chỉ làm luồng đăng nhập 1.1 | Brief kế tiếp |
| Màn admin tạo đơn vị và sân (UC-10) | Seed thay thế, vì chạy thử chỉ có 3 đơn vị | Brief của UC-10 |
| Lưới giờ trống (UC-2) | Form chọn giờ trực tiếp. Giờ đã có người đặt trả lỗi 409 | Brief của UC-2 |
| Danh sách yêu cầu cập nhật tức thì (SSE) | Chủ sân tải lại trang để thấy yêu cầu mới | Brief của UC-14 |
| Web Push và thông báo trong app (UC-14) | Cần dịch vụ push riêng | Brief của UC-14 |
| Hủy booking, booking của khách gọi điện, trận (UC-5 tới UC-9) | Mỗi use case có brief riêng | Các brief sau |

## Acceptance criteria

Dữ liệu chung: đơn vị "Cầu lông A" mở cửa 06:00–23:00, có "Sân 1" (giờ thường 80.000đ/giờ, giờ cao điểm 120.000đ/giờ) và "Sân 2". Ngày chơi là 20/11/2026. Mọi giờ theo `Asia/Ho_Chi_Minh`. Người dùng "An" (`0901234567`) và chủ sân "Bình" (`0912345678`) có trong seed.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | "Sân 1" trống 20:00–21:00 | 50 người dùng gửi cùng lúc yêu cầu 20:00–21:00 trên "Sân 1" | Đúng 1 request nhận 201. 49 request nhận 409 "Khung giờ này vừa có người đặt" |
| AC-2 | "Sân 1" có booking "Chờ xác nhận" 19:00–20:00 | An gửi yêu cầu 20:00–21:00 trên "Sân 1" | 201. Hai booking liền kề cùng tồn tại |
| AC-3 | "Sân 1" có booking 19:00–20:00 "Bị từ chối" | An gửi yêu cầu 19:00–20:00 trên "Sân 1" | 201 |
| AC-4 | "Sân 1" trống | An gửi yêu cầu 16:30–18:00 | 201, `priceTotal` = 160.000 (40.000 + 60.000 + 60.000) |
| AC-5 | "Sân 1" trống | An gửi yêu cầu 21:30–22:30 | 201, `priceTotal` = 100.000. Khoảng 22:00–22:30 tính giờ thường |
| AC-6 | "Sân 1" trống | An gửi yêu cầu 19:15–20:15 | 400 "Giờ phải theo bước 30 phút" |
| AC-7 | "Sân 1" trống | An gửi yêu cầu 19:00–19:30 | 400 "Mỗi booking dài ít nhất 1 giờ" |
| AC-8 | "Sân 1" trống, bây giờ là 20/11/2026 10:00 | An gửi yêu cầu 20:00–21:00 | `confirmDeadline` = 20/11/2026 12:00 |
| AC-9 | "Sân 1" trống, bây giờ là 20/11/2026 18:30 | An gửi yêu cầu 20:00–21:00 | `confirmDeadline` = 20/11/2026 19:00 |
| AC-10 | "Sân 1" trống, bây giờ là 20/11/2026 19:10 | An gửi yêu cầu 20:00–21:00 | 400 "Đã quá hạn đặt trong app. Hãy gọi chủ sân" |
| AC-11 | "Sân 1" trống | An gửi yêu cầu 05:00–06:00 | 400 "Ngoài giờ mở cửa" |
| AC-12 | Booking của An 20:00–21:00 "Chờ xác nhận", bây giờ là 11:00 | Bình xác nhận booking đó | 200, `status` = `CONFIRMED`, `confirmedAt` = 11:00 |
| AC-13 | Booking của An 20:00–21:00 "Chờ xác nhận" | Bình từ chối booking đó | 200, `status` = `REJECTED` |
| AC-14 | Booking của An 20:00–21:00 tạo lúc 10:00, chưa ai xác nhận, bây giờ là 12:01 | Người dùng "Chi" gửi yêu cầu 20:00–21:00 trên "Sân 1" | 201. Booking của An có `status` = `EXPIRED` |
| AC-15 | Booking của An tạo lúc 10:00, bây giờ là 12:01 | Bình xác nhận booking đó | 409 "Yêu cầu đã hết hạn" |
| AC-16 | Booking của An trên "Cầu lông A" "Chờ xác nhận" | Chủ sân "Dũng" của đơn vị khác xác nhận booking đó | 403 |
| AC-17 | Booking của An "Chờ xác nhận" | Admin xác nhận booking đó | 403 |
| AC-18 | Bình mở danh sách yêu cầu | Hệ thống trả các booking "Chờ xác nhận" | Mỗi booking có tên và số điện thoại `0901234567` của An |
| AC-19 | An có tài khoản trong seed | An đăng nhập bằng `0901234567` và mật khẩu sai | 401 "Sai số điện thoại hoặc mật khẩu" |
| AC-20 | An đã đăng nhập trên web | An chọn "Sân 1", 16:30–18:00 ngày 20/11/2026 và bấm Gửi yêu cầu | Màn hình hiện "Chờ xác nhận" và "160.000đ" |
| AC-21 | Bình đã đăng nhập, có yêu cầu của An | Bình bấm Xác nhận trên dòng của An | Dòng đó hiện "Đã xác nhận" |

## Contract

Zod trong `packages/shared/src/` là nguồn duy nhất. Hàm tính giá (BR-5) và hàm tính hạn xác nhận (BR-7) là hàm thuần trong `packages/shared`.

| Endpoint or schema | Change | Request | Response and errors |
|---|---|---|---|
| `POST /api/auth/login` | new | `phone`, `password` | 200 `{ id, name, role }` và cookie httpOnly `session` · 401 |
| `POST /api/auth/logout` | new | — | 204, xóa cookie |
| `GET /api/auth/me` | new | cookie | 200 `{ id, name, role }` · 401 |
| `GET /api/venues` | new | — | 200 danh sách đơn vị: `id`, `name`, `address`, `phone`, `opensAt`, `closesAt`, `courts[]` (`id`, `name`, `sport`, `priceNormal`, `pricePeak`) |
| `POST /api/bookings` | new | `courtId`, `startAt`, `endAt` (ISO 8601). Vai trò `USER` | 201 booking · 400 lỗi tiếng Việt ở AC-6, AC-7, AC-10, AC-11 · 401 · 409 "Khung giờ này vừa có người đặt" |
| `GET /api/bookings/mine` | new | cookie | 200 các booking của người gọi, mới nhất trước |
| `GET /api/owner/bookings` | new | `status` (mặc định `PENDING`). Vai trò `OWNER` | 200 booking của các đơn vị của người gọi, kèm `customer` (`name`, `phone`) |
| `POST /api/owner/bookings/:id/confirm` | new | — | 200 booking · 403 · 404 · 409 "Yêu cầu đã hết hạn" hoặc "Yêu cầu không còn chờ xác nhận" |
| `POST /api/owner/bookings/:id/reject` | new | — | Như `confirm` |

Booking trả về gồm: `id`, `courtId`, `startAt`, `endAt`, `status`, `source`, `priceTotal`, `confirmDeadline`, `confirmedAt`, `createdAt`.

## Data

| Table | Change | Migration step |
|---|---|---|
| `User` | mới: `id`, `name`, `phone` (unique), `passwordHash`, `role`, `lockedAt`, `deletedAt`, `createdAt` | expand |
| `Venue` | mới: `id`, `ownerId`, `name`, `address`, `phone`, `opensAt`, `closesAt` | expand |
| `Court` | mới: `id`, `venueId`, `name`, `sport`, `priceNormal`, `pricePeak`. Unique (`venueId`, `name`) | expand |
| `Booking` | mới: mọi trường của data dictionary. `CHECK ("endAt" > "startAt")`. `EXCLUDE USING gist ("courtId" WITH =, tstzrange("startAt","endAt",'[)') WITH &&) WHERE ("status" IN ('PENDING','CONFIRMED'))` | expand. Migration viết tay bằng `prisma migrate dev --create-only`, kèm `CREATE EXTENSION IF NOT EXISTS btree_gist` |
| enum `Role`, `Sport`, `BookingStatus`, `BookingSource` | mới, giá trị theo data dictionary | expand |
| Seed `apps/api/prisma/seed.ts` | 1 admin, 3 chủ sân, 3 đơn vị (1 sân bóng, 2 sân cầu lông), mỗi đơn vị 2 sân, người dùng An và Chi | — |

Hết hạn (BR-8) không cần job nền. Trong transaction tạo booking, server chuyển các booking `PENDING` quá hạn **của đúng sân đó** sang `EXPIRED`, rồi mới chèn. `GET /api/owner/bookings` và `confirm`, `reject` cũng chuyển các booking quá hạn trước khi đọc. Server lấy giờ hiện tại từ một provider `Clock`, để test đặt được giờ.

## Build order

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Hợp đồng và schema: Zod, hàm giá, hàm hạn xác nhận, Prisma 7.10.1, migration, seed | `packages/shared/src/`, `apps/api/prisma/`, `apps/api/prisma.config.ts`, `apps/api/package.json` | Test Zod. Test hàm giá cho AC-4, AC-5. Test hàm hạn cho AC-8, AC-9. Migration chạy trên Postgres thật |
| 2 | Server: đăng nhập, `GET /api/venues`, booking của người dùng và của chủ sân | `apps/api/src/modules/auth/`, `apps/api/src/modules/venues/`, `apps/api/src/modules/bookings/`, `apps/api/src/app.module.ts` | AC-1 tới AC-3, AC-6, AC-7, AC-10 tới AC-19 |
| 3 | Màn hình: đăng nhập, form gửi yêu cầu, booking của tôi, danh sách yêu cầu của chủ sân | `apps/web/src/features/auth/`, `apps/web/src/features/bookings/`, `apps/web/src/app/` | AC-20, AC-21 |

Nếu PR 2 vượt khoảng 400 dòng thay đổi, tách thành 2a (đăng nhập, đơn vị) và 2b (booking).

## Edit boundaries

- May edit: các path trong bảng Build order, `apps/web/package.json`, `pnpm-lock.yaml`, `PROGRESS.md`.
- Leave unchanged without approval: `AGENTS.md`, `.dependency-cruiser.cjs`, `scripts/check.mjs`, `.github/workflows/`, `apps/api/src/modules/health/`, migration đã merge.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Đồng thời: hai booking chồng giờ | migration `EXCLUDE`, `POST /api/bookings` | AC-1 chạy trên Postgres thật. Review bằng phiên mới trước khi merge PR 1 và PR 2 |
| Prisma 7 báo lỗi `23P01` theo cách khác dự kiến | filter lỗi ở PR 2 | Viết test cho mã lỗi này trước tiên |
| Prisma 7 cần driver adapter và `prisma.config.ts` | PR 1 | Đọc tài liệu Prisma 7 trước khi code. Dùng `@prisma/adapter-pg` 7.10.1 |
| Schema | PR 1 | Review bằng phiên mới |
| Dữ liệu cá nhân: chủ sân thấy số điện thoại | AC-18 | Chỉ chủ sân của đơn vị đó thấy (BR-20, BR-23). Review bằng phiên mới |
| Bảo mật mật khẩu và phiên | PR 2 | Băm argon2 bằng `@node-rs/argon2` (dependency mới). Cookie httpOnly, `SameSite=Lax`, ký bằng `SESSION_SECRET`. Review bằng phiên mới |
| Hết hạn không có job nền | PR 2 | Một booking `PENDING` quá hạn vẫn giữ giờ trong DB tới lần đọc hoặc ghi kế tiếp trên sân đó. AC-14 kiểm điều này |

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Phiên đăng nhập kéo dài bao lâu? Đề xuất: 30 ngày | Bạn | không |
| Số sân thật của từng đơn vị (open item 1 của intake). Seed tạm dùng 2 sân cho mỗi đơn vị | Bạn | không |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
