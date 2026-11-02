---
style: ste80
lang: vi
---

# F-023: Tab Thông báo trên app mobile

Status: draft
Source: `docs/design/ke-hoach-app-mobile.md` (tab theo vai trò, bước 5 và 6), UC-14, BR-27. `docs/briefs/F-013` (API thông báo trong app và màn của web). `docs/briefs/F-014` (Web Push). Quyết định theo "Autonomy" của `AGENTS.md`: xem "Assumptions".

## Goal

Người dùng và chủ sân mở tab "Thông báo" trên `/app/thong-bao`, xem danh sách thông báo, đánh dấu đã đọc, mở booking liên quan, và thấy số chưa đọc trên thanh tab. Kiểm tra bằng `verify-flow --app mobile` ở 360px và 390px.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Sửa API hoặc schema | `GET /api/notifications`, `POST /api/notifications/:id/read` và `POST /api/notifications/read-all` đã đủ (F-013) | Không cần |
| Nút bật Web Push trên app | Service worker của app nằm ở phạm vi `/app/`. Web Push cho app cần một quyết định riêng: xem "Open questions" | Brief sau, sau khi chủ dự án trả lời câu 1 |
| Thông báo cho sự kiện mới (vào trận, rời trận, nhắc giờ) | `NotificationType` có 4 loại (`BOOKING_REQUESTED`, `BOOKING_CONFIRMED`, `BOOKING_REJECTED`, `MATCH_CANCELLED`). Thêm loại cần đổi intake | Khi chủ dự án yêu cầu |
| Xóa hoặc lưu trữ thông báo | API không có thao tác này | Không có kế hoạch |
| Số đếm "Yêu cầu" của chủ sân và các màn chủ sân | Thuộc brief các màn chủ sân (bước 6 của kế hoạch) | Brief chủ sân |
| Thông báo cho tài khoản `ADMIN` | Admin không dùng app: app báo "Dùng web để quản trị" | Không đổi |
| Đổi `apps/web` | Web chạy đúng | Không cần |

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | `now` = 02/11/2026 10:00 (UTC+7). Người dùng `USER` đăng nhập. `GET /api/notifications` trả `unreadCount` 2 và 3 mục, mới nhất trước: N1 `BOOKING_CONFIRMED` chưa đọc, N2 `MATCH_CANCELLED` chưa đọc, N3 `BOOKING_REJECTED` đã đọc | Mở `/app/thong-bao` | Thấy 3 thẻ theo đúng thứ tự. Mỗi thẻ có `title`, `message`, tên đơn vị, tên sân và giờ dạng "HH:mm - HH:mm ngày DD/MM/YYYY" (BR-27). Thẻ chưa đọc có chấm và nền khác thẻ đã đọc. Thanh tab "Thông báo" hiện huy hiệu "2". App gọi `GET /api/notifications` một lần |
| AC-2 | Cùng danh sách. Một lần khác danh sách rỗng. Một lần khác API lỗi mạng | Mở tab | Lần rỗng: thấy "Chưa có thông báo". Lần lỗi: thấy "Không tải được" và nút "Thử lại". Bấm nút tải lại. Khi đã có danh sách và lần tải lại sau đó lỗi: danh sách cũ ở lại, app không hiện lỗi |
| AC-3 | Khách chưa đăng nhập | Mở `/app/thong-bao` | Thấy "Đăng nhập để xem thông báo" và nút "Đăng nhập" mở sheet đăng nhập. App không gọi `GET /api/notifications` |
| AC-4 | Cùng danh sách như AC-1 | Bấm thẻ N1 | App gửi `POST /api/notifications/N1/read`. Thẻ N1 thành đã đọc ngay, huy hiệu về "1". Sau đó app mở màn của booking: người dùng `USER` tới `/app/lich-cua-toi`. Lỗi mạng khi đánh dấu: app vẫn mở màn, thẻ giữ trạng thái chưa đọc và huy hiệu giữ "2" |
| AC-5 | Chủ sân (`OWNER`). Thẻ `BOOKING_REQUESTED` chưa đọc | Bấm thẻ | App gửi `POST /api/notifications/:id/read`, rồi mở `/app/chu-san/yeu-cau`. Chủ sân không được tới `/app/lich-cua-toi` |
| AC-6 | Cùng danh sách như AC-1, `unreadCount` 2 | Bấm "Đọc hết" | App gửi `POST /api/notifications/read-all` một lần. Mọi thẻ thành đã đọc, huy hiệu biến mất. Nút khóa trong lúc chờ. Khi `unreadCount` là 0, nút "Đọc hết" khóa và không gửi request. Lỗi mạng: thẻ giữ trạng thái cũ và hiện "Không đánh dấu được. Thử lại." |
| AC-7 | Tab mở, `unreadCount` 0. Sau 15 giây API trả thêm một mục chưa đọc | 15 giây trôi qua | Danh sách tải lại và hiện mục mới, huy hiệu "1". Khi tab ẩn (`visibilitychange`) app dừng tải lại. Khi tab hiện lại app tải lại một lần ngay và tiếp tục chu kỳ 15 giây. Khi rời màn Thông báo app dừng chu kỳ của màn |
| AC-8 | Một lần tải chậm trả về sau khi người dùng bấm "Đọc hết" | Danh sách chậm tới | App bỏ danh sách chậm. Huy hiệu không quay lại số cũ (cùng quy tắc đánh số yêu cầu như web) |
| AC-9 | Người dùng `USER` đang ở tab "Đặt sân", có 2 thông báo chưa đọc trên server | App mở và sau 15 giây | Huy hiệu "2" hiện trên thanh tab "Thông báo" mà không cần mở tab đó. Số này đến từ `GET /api/notifications` và `unreadCount`. Khách chưa đăng nhập không gọi API và không thấy huy hiệu. Số trên 99 hiện "99+" |
| AC-10 | Phiên hết hạn: API trả 401 | Mở tab hoặc bấm thẻ | Sheet đăng nhập mở và hiện "Phiên đăng nhập đã hết. Hãy đăng nhập lại." Danh sách giữ nguyên trên màn. Sau khi đăng nhập app tải lại danh sách |
| AC-11 | Tài khoản `ADMIN` đăng nhập | Mở `/app/thong-bao` | Thấy "Dùng web để quản trị" như mọi tab. App không gọi `GET /api/notifications` |
| AC-12 | Danh sách ở 360px và 390px. Tên đơn vị và `message` rất dài | Tab mở | Không cuộn ngang. Mỗi thẻ và nút cao ít nhất 44px. Văn bản dài xuống dòng, không tràn |
| AC-13 | Luồng `mobile-notifications` của `verify-flow`: chủ sân seed đăng nhập, người chơi seed gửi một yêu cầu đặt sân, chủ sân mở "Thông báo" ở 360px và 390px | Luồng chạy | Chủ sân thấy thẻ "Yêu cầu đặt sân mới" của booking mà luồng tạo, huy hiệu tăng, bấm thẻ thì tới `/app/chu-san/yeu-cau`. Trang không cuộn ngang. Báo cáo ghi 0 bước lỗi. Luồng chỉ đổi dữ liệu mà nó tạo (booking `test-`) |

## Contract

Không đổi `packages/shared` và không đổi API.

| Endpoint or schema | Change | Request | Response and errors |
|---|---|---|---|
| `GET /api/notifications` | unchanged | không | 200 `NotificationsListResponse` (`unreadCount`, `items`, mới nhất trước). 401. Role `USER`, `OWNER`, `ADMIN` |
| `POST /api/notifications/:id/read` | unchanged | không | 200 `NotificationReadResponse`. Idempotent. 400 khi `id` không phải UUID. 401 |
| `POST /api/notifications/read-all` | unchanged | không | 200 `NotificationReadAllResponse` (`count`). 401 |

Phần mới nằm ở `packages/client`: hàm thuần `notificationTarget(role, item)` (đường dẫn app của một thông báo) và `unreadBadge(count)` ("", số, hoặc "99+"). Web giữ bản riêng của nó.

## Data

Không có thay đổi. Không bảng mới, không migration.

## Build order

One pull request for each row. Each pull request passes the check command on its own.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Hàm thuần: `notificationTarget`, `unreadBadge` | `packages/client/src/notifications.ts`, `packages/client/src/notifications.test.ts`, `packages/client/src/index.ts` | phần hàm thuần của AC-4, AC-5, AC-9 |
| 2 | Màn Thông báo: danh sách, trạng thái rỗng, lỗi, khách, admin, đánh dấu đã đọc, "Đọc hết", tải lại 15 giây, bỏ danh sách chậm | `apps/mobile/src/features/notifications/`, `apps/mobile/src/app/router.tsx` | AC-1 đến AC-8, AC-10, AC-11, AC-12 |
| 3 | Huy hiệu trên thanh tab và luồng `verify-flow` | `apps/mobile/src/app/App.tsx`, `apps/mobile/src/app/App.test.tsx`, `apps/mobile/src/app/bars.tsx`, `apps/mobile/src/app/bars.test.tsx`, `.agents/skills/verify-flow/references/flows/mobile-notifications.md`, `.agents/skills/verify-flow/scripts/mobile-notifications.mjs`, `.agents/skills/verify-flow/scripts/run.mjs`, `PROGRESS.md` | AC-9, AC-13 |

Các bước 2 và 3 dùng chung trạng thái đếm trong `App.tsx` và chạy lần lượt, không song song.

## Edit boundaries

- May edit: các đường dẫn trong bảng "Build order", và `PROGRESS.md` ở bước cuối. `@map.md` được cập nhật bằng `pnpm map`.
- Leave unchanged without approval: `apps/web/`, `apps/api/`, `packages/shared/`, `prisma/`, `apps/mobile/src/features/venues/`, `apps/mobile/src/features/bookings/`, `apps/mobile/src/features/lobby/`, `apps/mobile/src/features/my/`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Dữ liệu cá nhân: `message` có tên đơn vị và giờ của người khác | Thẻ ở bước 2 | API chỉ trả thông báo của chính người dùng (`req.user.id`). Test AC-1 chỉ dùng dữ liệu của API. App không tự ghép nội dung từ nơi khác |
| Chủ sân hoặc người chơi tới sai màn | `notificationTarget` ở bước 1 | Một hàm duy nhất, test theo vai trò và loại (AC-4, AC-5). Loại `MATCH_CANCELLED` và `BOOKING_*` của `USER` tới Lịch của tôi |
| Huy hiệu sai sau yêu cầu chậm | Bước 2 và 3 | Đánh số yêu cầu, bỏ kết quả cũ (AC-8) |
| Tải lại 15 giây chạy khi tab ẩn, tốn pin và dữ liệu | Bước 2 | AC-7 kiểm tab ẩn dừng chu kỳ |
| `refreshCounts` của `App.tsx` hiện chỉ đếm yêu cầu của chủ sân, không đếm thông báo | Bước 3 | AC-9 buộc app đếm `unreadCount` từ API |

Không chạm tiền, đồng thời, schema. Không cần `rule-review`.

## Assumptions

1. Bấm thẻ đánh dấu đã đọc, rồi mở màn liên quan. Lý do: web làm vậy và đây là cách dùng quen.
2. Tải lại mỗi 15 giây khi tab hiện, như web (`RELOAD_MS`). Lý do: giữ cùng hành vi. SSE cho thông báo cần đổi API.
3. Chủ sân có tab "Thông báo" (kế hoạch app mobile). Thẻ `BOOKING_REQUESTED` của họ tới "Yêu cầu".
4. Web Push trên app không nằm trong brief này. Lý do: phạm vi service worker `/app/` cần quyết định riêng.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Web Push có chạy trên app `/app/` không? Subscription hiện gắn với `sw.js` của web ở phạm vi `/` | Chủ dự án | Không (brief sau) |
| Thông báo cũ hơn bao nhiêu ngày thì ẩn khỏi danh sách? API trả toàn bộ | Chủ dự án | Không |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The flow `mobile-notifications` runs in the check `image`.
