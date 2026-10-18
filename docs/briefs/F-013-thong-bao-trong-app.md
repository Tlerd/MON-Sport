---
style: ste80
lang: vi
---

# F-013: Thông báo trong app

Status: accepted
Source:

- Intake `docs/requirements/intake-monsport-v1.md`:
  - UC-14: "Mọi nhóm: Nhận thông báo tức thì (đề xuất M3)".
  - Bảng sự kiện UC-14:
    - Có yêu cầu đặt sân mới → Chủ sân.
    - Yêu cầu được xác nhận hoặc bị từ chối → Người đặt.
    - Trận bị hủy → Mọi người trong trận.
  - Mục "Assumptions": "App có danh sách thông báo trong app, cùng với Web Push", "Thứ tự ra mắt: UC-1, UC-10, UC-11 → UC-2 đến UC-6 → UC-7 đến UC-9 → UC-14 → UC-12, UC-13".
  - Mục "Trạng thái của trận": "Booking bị từ chối hoặc hết hạn thì trận tự hủy. Mọi người trong trận nhận thông báo Sân không được xác nhận, trận đã hủy. Host hủy trận thì booking cũng bị hủy, và mọi người trong trận nhận thông báo".
- `docs/requirements/use-cases.md`: UC-14 (Gửi thông báo), UC-3 bước 4, UC-4 bước 4 và 4.1, UC-6, UC-9.
- `docs/requirements/business-rules.md`: BR-8, BR-16, BR-17, BR-20, BR-23, BR-27.
- `docs/requirements/data-dictionary.md`: bảng `Notification` (`id + userId + type + bookingId + (matchId) + (readAt) + createdAt`), enum `NotificationType` (`BOOKING_REQUESTED`, `BOOKING_CONFIRMED`, `BOOKING_REJECTED`, `MATCH_CANCELLED`).
- `docs/requirements/models.md`: Figure 3 (use case UC-14), Figure 6 (quan hệ thực thể `Notification`), Ma trận CRUD (UC-3 tạo, UC-4 tạo, UC-6 tạo, UC-9 tạo, UC-14 đọc).

## Goal

Chủ sân và người dùng nhận và xem được danh sách thông báo trong app khi có yêu cầu đặt sân mới, khi booking được xác nhận hoặc từ chối, và khi trận bị hủy. Kiểm tra bằng số thông báo chưa đọc trên thanh tiêu đề và nội dung từng thông báo.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Web Push qua Service Worker (PushSubscription, VAPID) | Cần cấu hình VAPID key và Service Worker riêng; tách để pull request dưới 400 dòng | F-014 (Thông báo Web Push) |
| Thông báo khi booking tự động hết hạn (EXPIRED) do lười kiểm tra | Intake bảng UC-14 chỉ quy định thông báo khi có yêu cầu mới, khi yêu cầu được xác nhận hoặc từ chối, và khi trận bị hủy. Lazy expiry chạy trên query đọc; tránh ghi side-effect không chủ đích | Khi hệ thống có scheduler hoặc background job |
| Thông báo khi có người vào trận hoặc rời trận | Intake UC-14 chỉ quy định 3 sự kiện (yêu cầu mới, xác nhận/từ chối, trận bị hủy) | Khi intake yêu cầu |
| Thông báo qua tin nhắn SMS, Zalo hoặc Email | Intake ghi rõ out of scope cho bản đầu | Bản sau |
| Xóa thông báo | Intake và Từ điển dữ liệu chỉ quy định đánh dấu đã đọc (`readAt`), không xóa | Khi có yêu cầu |
| Đẩy thông báo tức thì qua SSE hoặc WebSocket | Slice này dùng cơ chế tải khi mở app hoặc bấm chuông thông báo; SSE cho thông báo nếu cần sẽ xem xét sau | Khi có yêu cầu |

## Acceptance criteria

Dữ liệu chung: mỗi test tạo lại dữ liệu này trước khi chạy.

- Admin (`0900000000`).
- Chủ sân "Bình" (`0912345678`) quản lý "Cầu lông A" có "Sân 1" (`BADMINTON`).
- Người dùng "An" (`0901234567`), "Chi" (`0901234568`), "Em" (`0901234569`), "Hà" (`0901234570`).
- Mọi giờ dưới đây tính theo ngày 20/11/2026 `Asia/Ho_Chi_Minh`.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | An đã đăng nhập. Bình chưa có thông báo nào | An gửi yêu cầu đặt "Sân 1" khung 20:00–21:00 (`POST /api/bookings`) | Request thành công (201). Bảng `Notification` có đúng 1 dòng: `userId` là Bình, `type` = `BOOKING_REQUESTED`, `bookingId` là booking vừa tạo, `matchId` = null, `readAt` = null |
| AC-2 | Booking B của An đang `PENDING`. An chưa có thông báo nào | Bình gọi `POST /api/owner/bookings/<B>/confirm` | Request thành công (200). Bảng `Notification` có thêm 1 dòng: `userId` là An, `type` = `BOOKING_CONFIRMED`, `bookingId` = B, `matchId` = null, `readAt` = null |
| AC-3 | Booking B của An đang `PENDING`. An chưa có thông báo nào | Bình gọi `POST /api/owner/bookings/<B>/reject` | Request thành công (200). Bảng `Notification` có thêm 1 dòng: `userId` là An, `type` = `BOOKING_REJECTED`, `bookingId` = B, `matchId` = null, `readAt` = null |
| AC-4 | Trận T của An mở trên booking B, có 3 người `ACTIVE` (An là host, Chi và Em là người ghép) | An hủy trận (`POST /api/matches/<T>/cancel`) | Request thành công (200). Bảng `Notification` tạo ra đúng 3 dòng mới cùng có `type` = `MATCH_CANCELLED`, `bookingId` = B, `matchId` = T: 1 dòng cho An, 1 dòng cho Chi, 1 dòng cho Em |
| AC-5 | Trận T của An mở trên booking B đang `PENDING`, có An và Chi `ACTIVE` | Bình từ chối booking B (`POST /api/owner/bookings/<B>/reject`) | Bảng `Notification` có: 1 dòng `BOOKING_REJECTED` cho An (từ booking), và 2 dòng `MATCH_CANCELLED` (1 cho An, 1 cho Chi từ trận bị hủy theo BR-16) |
| AC-6 | Trận T của An mở trên booking B, có An và Chi `ACTIVE`. Hà đã vào rồi rời trận (`LEFT`) | An hủy booking B (`POST /api/bookings/<B>/cancel`) | Trận T tự hủy. Bảng `Notification` có đúng 2 dòng `MATCH_CANCELLED`: 1 cho An, 1 cho Chi. Hà không nhận thông báo vì không còn `ACTIVE` |
| AC-7 | Bình có 2 thông báo (1 chưa đọc loại `BOOKING_REQUESTED` cho booking 20:00–21:00 ngày 20/11/2026, 1 đã đọc lúc 09:00). An có 1 thông báo chưa đọc | Bình gọi `GET /api/notifications`. An gọi `GET /api/notifications`. Khách chưa đăng nhập gọi | Bình nhận 200 `{ unreadCount: 1, items: [...] }` gồm đúng 2 thông báo của Bình xếp theo `createdAt` giảm dần. Thông báo chưa đọc có `title`: "Yêu cầu đặt sân mới", `message`: "Có yêu cầu đặt sân tại Cầu lông A - Sân 1 khung 20:00 - 21:00 ngày 20/11/2026.", `venueName`: "Cầu lông A", `courtName`: "Sân 1". An nhận 200 `{ unreadCount: 1, items: [...] }` chỉ gồm thông báo của An. Khách chưa đăng nhập nhận 401 |
| AC-8 | An có thông báo N chưa đọc (`readAt` = null). Bình có thông báo N2 chưa đọc | An gọi `POST /api/notifications/<N>/read`. An gọi lại lần nữa. An gọi `POST /api/notifications/<N2>/read`. An gọi UUID không tồn tại | Lần 1: An nhận 200 `{ id: N, readAt: "<timestamp>" }`, DB cập nhật `readAt`. Lần 2: An nhận 200 giữ nguyên `readAt`. Khi gọi N2 (thuộc về Bình): An nhận 404 "Không tìm thấy thông báo". UUID không có nhận 404. Khách chưa đăng nhập nhận 401 |
| AC-9 | Bình có 3 thông báo chưa đọc | Bình gọi `POST /api/notifications/read-all` | Bình nhận 200 `{ count: 3 }`. Mọi thông báo của Bình có `readAt` khác null. Gọi `GET /api/notifications` trả về `unreadCount: 0` |
| AC-10 | Web: Bình đăng nhập vai trò `OWNER`. API trả về 2 thông báo (1 chưa đọc) | Bình xem thanh điều hướng và bấm vào chuông thông báo | Thanh điều hướng hiện biểu tượng chuông kèm huy hiệu "1". Bấm chuông mở bảng "Thông báo" hiện danh sách thông báo. Bấm vào thông báo chưa đọc: web gọi `POST /api/notifications/<id>/read` và huy hiệu giảm còn 0. Có nút "Đánh dấu tất cả đã đọc" gọi `POST /api/notifications/read-all` |
| AC-11 | Web: An đăng nhập vai trò `USER`. API trả về danh sách trống | An bấm vào chuông thông báo | Web hiện thông báo "Chưa có thông báo nào" |

## Contract

Tệp `packages/shared/src/notification.ts`:

- Enum `NotificationType`: `'BOOKING_REQUESTED' | 'BOOKING_CONFIRMED' | 'BOOKING_REJECTED' | 'MATCH_CANCELLED'`.
- Schema `NotificationItemView`:
  ```ts
  id: string (uuid)
  type: NotificationType
  bookingId: string (uuid)
  matchId: string | null (uuid)
  readAt: string | null (ISO timestamp)
  createdAt: string (ISO timestamp)
  title: string
  message: string
  venueName: string
  courtName: string
  startAt: string (ISO timestamp)
  endAt: string (ISO timestamp)
  ```
- Schema `NotificationsListResponse`:
  ```ts
  unreadCount: number
  items: NotificationItemView[]
  ```
- Schema `NotificationReadResponse`:
  ```ts
  id: string (uuid)
  readAt: string (ISO timestamp)
  ```
- Schema `NotificationReadAllResponse`:
  ```ts
  count: number
  ```

Quy tắc định dạng tiêu đề và thông điệp (giờ theo `Asia/Ho_Chi_Minh`, BR-27):
- Chuỗi thời gian `{slotTime}` có định dạng: `HH:mm - HH:mm ngày DD/MM/YYYY` (ví dụ `20:00 - 21:00 ngày 20/11/2026`).
- `BOOKING_REQUESTED`:
  - `title`: `"Yêu cầu đặt sân mới"`
  - `message`: `"Có yêu cầu đặt sân tại {venueName} - {courtName} khung {slotTime}."`
- `BOOKING_CONFIRMED`:
  - `title`: `"Yêu cầu đặt sân đã được xác nhận"`
  - `message`: `"Chủ sân đã xác nhận yêu cầu đặt sân tại {venueName} - {courtName} khung {slotTime}."`
- `BOOKING_REJECTED`:
  - `title`: `"Yêu cầu đặt sân bị từ chối"`
  - `message`: `"Chủ sân đã từ chối yêu cầu đặt sân tại {venueName} - {courtName} khung {slotTime}."`
- `MATCH_CANCELLED`:
  - `title`: `"Trận đấu đã bị hủy"`
  - `message`: `"Trận đấu tại {venueName} - {courtName} khung {slotTime} đã bị hủy."`

## Data

Bảng `Notification` theo `docs/requirements/data-dictionary.md`:

```sql
CREATE TYPE "NotificationType" AS ENUM (
  'BOOKING_REQUESTED',
  'BOOKING_CONFIRMED',
  'BOOKING_REJECTED',
  'MATCH_CANCELLED'
);

CREATE TABLE "Notification" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "type" "NotificationType" NOT NULL,
  "bookingId" UUID NOT NULL,
  "matchId" UUID,
  "readAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Notification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Notification_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
```

## Build order

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Contract and schema | `packages/shared/src/notification.ts`, `packages/shared/src/notification.test.ts`, `packages/shared/src/index.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*_f013_notifications/migration.sql`, `apps/api/prisma/migration.test.ts`, `PROGRESS.md` | Schema test, migration test, contract test |
| 2 | Server: Notifications module and event triggers | `apps/api/src/modules/notifications/*`, `apps/api/src/modules/bookings/bookings.service.ts`, `apps/api/src/modules/bookings/bookings.module.ts`, `apps/api/src/modules/bookings/bookings.service.test.ts`, `apps/api/src/modules/matches/matches.service.ts`, `apps/api/src/modules/matches/matches.module.ts`, `apps/api/src/app.module.ts`, `apps/api/src/modules/notifications/notifications.e2e.test.ts`, `PROGRESS.md` | AC-1 đến AC-9 e2e tests |
| 3 | Screen: Notification bell, list drawer and read actions | `apps/web/src/features/notifications/*`, `apps/web/src/app/App.tsx`, `apps/web/src/app/App.test.tsx`, `apps/web/src/app/styles.css`, `PROGRESS.md` | AC-10, AC-11 component tests |

## Edit boundaries

- May edit:
  - `packages/shared/src/notification.ts`, `packages/shared/src/notification.test.ts`, `packages/shared/src/index.ts`
  - `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*`
  - `apps/api/prisma/migration.test.ts`
  - `apps/api/src/modules/notifications/*`
  - `apps/api/src/modules/bookings/bookings.service.ts`, `apps/api/src/modules/bookings/bookings.module.ts`, `apps/api/src/modules/bookings/bookings.service.test.ts`
  - `apps/api/src/modules/matches/matches.service.ts`, `apps/api/src/modules/matches/matches.module.ts`
  - `apps/api/src/app.module.ts`
  - `apps/web/src/features/notifications/*`
  - `apps/web/src/app/App.tsx`, `apps/web/src/app/App.test.tsx`, `apps/web/src/app/styles.css`
  - `docs/briefs/F-013-thong-bao-trong-app.md`
  - `PROGRESS.md`
- Leave unchanged without approval:
  - Authentication logic, password hashing, and throttle logic
  - Court search and pricing logic
  - Existing business rules tests (AC-1 đến AC-21 của F-002, AC-1 đến AC-16 của F-011, AC-1 đến AC-16 của F-012)

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Schema: bảng mới `Notification` và enum `NotificationType` | Step 1 (`schema.prisma`, migration) | Reviewer subagent và `rule-review` kiểm tra cấu trúc bảng, khóa ngoại, chỉ mục và tính tương thích ngược |
| Concurrency / Transaction: tạo thông báo không được gây deadlock hoặc tạo thông báo rác khi transaction chính rollback | Step 2 (`bookings.service.ts`, `matches.service.ts`) | Thông báo trong app PHẢI được tạo trong cùng database transaction (`tx`) với thao tác tạo hoặc đổi trạng thái booking / match, ngay tại thời điểm thao tác thành công (`count > 0` hoặc tương đương). Tuân thủ đúng thứ tự khóa: `Venue` (FOR SHARE) -> `Court` (FOR UPDATE) -> `Booking` -> `Match` -> `MatchPlayer` -> `Notification`. Tuyệt đối không chạy ngoài transaction hoặc sau khi commit |
| Security / Authorization: người dùng chỉ đọc và sửa được thông báo của chính mình | Step 2 (`notifications.controller.ts`) | `userId` lấy từ auth session / token so khớp với `Notification.userId` trên mọi query và update; test AC-8 xác nhận 404 khi truy cập thông báo của người khác |

## Open questions

Không có câu hỏi mở chặn việc xây dựng tính năng.

## Done when

- Mọi AC từ AC-1 đến AC-11 đều có test tương ứng với nhãn trong tên.
- Lệnh `pnpm check` chạy thành công.
- Reviewer subagent và skill `rule-review` duyệt không có finding ở mức medium trở lên.
