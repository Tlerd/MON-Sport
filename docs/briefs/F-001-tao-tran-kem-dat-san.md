---
style: ste80
lang: vi
---

# F-001: Tạo trận kèm đặt sân, chặn trùng giờ

Status: superseded. Chỉ dùng để tham khảo, không code theo file này (ADR 0002).
Source: `docs/spec/dac-ta-ky-thuat.md` §4.1, §5, §6 (M2), §9 tiêu chí 1, 2, 6. Viết bằng skill `feature-brief` ngày 16/10/2026.

## Decisions

Bạn chốt các mục này ngày 16/10/2026.

| # | Quyết định | Hệ quả |
|---|---|---|
| 1 | Chép §3–§6 và §9 của đặc tả `9.` vào `docs/spec/` của repo. Repo là nguồn sự thật cho phần kỹ thuật | Ghi thành ADR 0001. Sửa mục Specification của `AGENTS.md` |
| 2 | D2: tách bảng `Booking` ngay ở F-001 | `EXCLUDE` nằm trên `Booking`. `Match` trỏ tới `Booking` |
| 3 | Dùng Prisma 7.10.1 | Kiểm lại mã lỗi `23P01` và cấu hình URL migration của Supabase trên bản 7 |
| 4 | Sân và giờ chỉ nằm ở `Booking` | `Match` không có `courtId`, `startAt`, `endAt` |

## Goal

Host tạo được một trận trên một sân con trong một khung giờ. Hệ thống từ chối mọi khung giờ chồng lên một booking còn sống của cùng sân con đó.

## Non-goals

| Non-goal | Lý do | Khi nào làm |
|---|---|---|
| Đăng nhập thật bằng Zalo | Đặc tả giữ `AuthProvider` giả tới v0.3 (D10) | v0.3 |
| Trạng thái `HOLD` và hết hạn giữ chỗ | M2 chỉ có `CONFIRMED` (§4.1) | v0.3 |
| Vào trận, rời trận, `FULL` | Thuộc M3 | F-002 |
| Thanh toán, VietQR | Cấm tới hết Phase 0 | v0.3 |
| Lịch trống và đặt sân trực tiếp | Chủ sân chưa nhập lịch | v0.4 |
| App Flutter | App bắt đầu ở v0.3 | v0.3 |
| Màn admin nhập sân | Dùng seed cho slice này | Brief riêng của M2 |

## Acceptance criteria

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Sân con `C1` trống từ 19:00 tới 20:00 ngày 20/11/2026 | 50 request song song tạo trận trên `C1`, 19:00–20:00 | Đúng 1 request nhận 201. 49 request nhận 409 "Khung giờ này vừa có người đặt" |
| AC-2a | `C1` có booking 19:00–20:00 | Host tạo trận trên `C1`, 20:00–21:00 | 201. Hai khung liền kề cùng tồn tại |
| AC-2b | `C1` có booking 19:00–20:00 | Host tạo trận trên `C2`, 19:00–20:00 | 201 |
| AC-2c | Booking 19:00–20:00 trên `C1` đã `CANCELLED` | Host tạo trận trên `C1`, 19:00–20:00 | 201 |
| AC-6 | Trận có `startAt` = 2026-11-20T12:00:00Z | Web hiển thị trận | Web ghi 19:00 ngày 20/11/2026 (`Asia/Ho_Chi_Minh`) |

## Contract

Zod trong `packages/shared` là nguồn duy nhất của hợp đồng API.

| Endpoint | Thay đổi | Request | Response và lỗi |
|---|---|---|---|
| `POST /api/matches` | mới | `courtId`, `startAt`, `endAt` (cho `Booking`). `sport`, `capacity`, `pricePerSlot`, `minLevel`, `maxLevel` (cho `Match`). `confirmedWithOwner: true` | 201 trận kèm `booking`. 409 trùng giờ. 400 dữ liệu sai |
| `GET /api/matches/:id` | mới | `id` | 200 trận, kèm sân và giờ lấy từ `booking`. 404 |

## Data

| Bảng | Thay đổi | Bước migration |
|---|---|---|
| mọi `DateTime` | `@db.Timestamptz(3)` | expand: repo đang trống, nên tạo mới luôn |
| `Venue`, `Court` | `Court.sports Sport[]` | tạo mới |
| `Booking` | courtId, startAt, endAt, status, source, createdById, priceTotal. `CHECK ("endAt" > "startAt")`. `EXCLUDE USING gist` trên sân con và khoảng giờ, chỉ cho `HOLD` và `CONFIRMED` | migration viết tay bằng `prisma migrate dev --create-only`, kèm `btree_gist` |
| `Match` | `hostId`, `sport`, `capacity`, `pricePerSlot` (chỉ hiển thị), `minLevel`, `maxLevel`, `status` `OPEN/FULL/CANCELLED/FINISHED`, `bookingId` unique, `joinedCount` mặc định 0. Không có cột sân và giờ | tạo mới |

## Build order

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 0 | Khung dự án (nếu chưa có): NestJS, React, `packages/shared`, Postgres trong CI | `apps/`, `packages/`, `.github/workflows/` | `pnpm check` chạy được |
| 1 | Hợp đồng và schema | `packages/shared/src/`, `apps/api/prisma/` | test schema Zod. Migration chạy trên Postgres thật |
| 2 | Server | `apps/api/src/modules/matches/`, `apps/api/src/modules/bookings/` | AC-1, AC-2a, AC-2b, AC-2c |
| 3 | Màn hình | `apps/web/src/features/matches/` | AC-6 |

## Edit boundaries

- Được sửa: các path trong bảng Build order.
- Giữ nguyên nếu chưa được duyệt: `AGENTS.md`, `.dependency-cruiser.cjs`, `scripts/check.mjs`, `.github/workflows/`, migration đã chạy.

## Risks and reviews

| Rủi ro | Ở đâu | Kiểm soát |
|---|---|---|
| Đồng thời: hai booking chồng giờ | migration `EXCLUDE` | AC-1 chạy trên Postgres thật. Review bằng phiên mới trước khi merge |
| Schema | PR 1 | Review bằng phiên mới (`AGENTS.md`, đặc tả §8.3) |
| Prisma 7 báo mã `23P01` khác dự kiến | filter lỗi | Viết test cho mã lỗi này trước tiên (§4.1) |
| Prisma 7 cấu hình URL migration khác bản 6 | kết nối Supabase | Đọc tài liệu Prisma 7 trước PR 1, ghi cách làm vào ADR |
| Supabase chưa bật `btree_gist` | môi trường thật | Kiểm tra khi tạo project |

## Open questions

Không còn câu hỏi nào chặn một AC.

## Done when

- Mỗi AC có một test đạt, tên test bắt đầu bằng nhãn của nó.
- `pnpm check` đạt trên PR cuối.
- Phiên mới đã review PR 1 và PR 2.
