---
style: ste80
lang: vi
---

# F-014: Thông báo Web Push

Status: accepted
Source:

- Intake `docs/requirements/intake-monsport-v1.md`:
  - UC-14: "Thông báo đi qua Web Push. Trên iPhone, người dùng phải "Thêm vào Màn hình chính" (iOS 16.4 trở lên)".
  - Bảng sự kiện UC-14 có 3 dòng:
    - Yêu cầu đặt sân mới tới chủ sân.
    - Yêu cầu được xác nhận hoặc bị từ chối tới người đặt.
    - Trận bị hủy tới mọi người trong trận.
  - Acceptance UC-14: "Bạn gửi yêu cầu đặt sân. Điện thoại của chủ sân nhận Web Push trong vòng 30 giây".
  - Bảng lưu trữ dữ liệu: "Thông báo và đăng ký Web Push | Dữ liệu thiết bị | Tới khi người dùng hủy đăng ký".
  - Mục "Assumptions": "App có danh sách thông báo trong app, cùng với Web Push".
- `docs/briefs/F-013-thong-bao-trong-app.md`: Non-goals hoãn Web Push sang F-014. F-013 đã tạo bảng `Notification` và 4 loại `NotificationType`.
- `docs/adr/0004-*.md`: trigger `pg_notify` cộng `LISTEN` trên từng instance Cloud Run, phát sau khi transaction commit.
- `docs/requirements/business-rules.md`:
  - BR-20: không lộ số điện thoại ngoài người được phép xem.
  - BR-29: người dùng đồng ý thông báo quyền riêng tư khi đăng ký.
- `docs/requirements/data-dictionary.md`: `Notification` (id, userId, type, bookingId, matchId, readAt, createdAt).

## Goal

Người dùng bật Web Push trên một thiết bị. Khi có sự kiện UC-14, thiết bị đó hiện thông báo của hệ thống, kể cả lúc app đóng.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Thông báo cho sự kiện mới ngoài 4 loại của UC-14 | Intake chỉ quy định 4 loại | Khi intake thêm |
| Chỉnh loại thông báo nào được đẩy | Intake không yêu cầu | Khi có yêu cầu |
| Giờ yên lặng, gom thông báo, hay đếm số trên biểu tượng | Intake không yêu cầu | Khi có yêu cầu |
| Gửi lại thông báo đẩy bị mất lúc không instance nào nghe | `NOTIFY` của PostgreSQL không lưu bền. Danh sách thông báo trong app vẫn đủ | Khi có hàng đợi bền |
| Sửa nội dung thông báo quyền riêng tư (`PRIVACY_NOTICE`) | Câu hỏi pháp lý, thuộc mục 4 của `PROGRESS.md` | Sau khi người dùng quyết định |
| Gửi qua Zalo, SMS hay email | Intake ghi ngoài phạm vi | Bản sau |
| Trang cài đặt thông báo riêng | Một nút trong ngăn thông báo là đủ cho v1 | Khi có nhiều tùy chọn |

## Assumptions

Intake để mở các điểm sau. Brief chọn phương án an toàn hơn. Người dùng sửa sau.

1. **Đồng ý.** Người dùng tự bấm nút "Nhận thông báo trên thiết bị này" và chấp nhận hộp thoại quyền của trình duyệt. Hai hành động này là sự đồng ý. Hệ thống không đăng ký tự động.
2. **Một thiết bị, một người.** Trình duyệt có đúng một `endpoint` cho mỗi origin. Khi người khác đăng nhập trên cùng trình duyệt và bật Web Push, dòng `PushSubscription` chuyển sang người đó.
3. **Giới hạn.** Mỗi người có tối đa 5 đăng ký. Đăng ký thứ 6 xóa đăng ký cũ nhất của người đó.
4. **Luôn hiện thông báo.** Mỗi lần đẩy, service worker luôn gọi `showNotification`, kể cả khi cửa sổ app đang mở. Safari yêu cầu mỗi push phải hiện một thông báo, nếu không nó thu hồi đăng ký.
5. **Nội dung.** Tiêu đề và nội dung dùng `formatNotificationContent` như thông báo trong app. Chúng chỉ có tên đơn vị, tên sân và giờ. Không có tên hay số điện thoại người dùng (BR-20).
6. **Cách gửi.** Mỗi instance API chạy `LISTEN`. Một trigger gọi `pg_notify` khi thêm dòng `Notification`. Instance nào nhận trước thì "giành" dòng bằng `UPDATE ... SET pushedAt = now WHERE pushedAt IS NULL RETURNING`. Chỉ một instance gửi.
7. **Gửi tốt nhất có thể.** Lỗi khi gửi không làm hỏng yêu cầu tạo booking. Thông báo trong app vẫn có.
8. **Chặn SSRF.** `endpoint` do người dùng gửi, và server sẽ gọi nó. Server chỉ nhận `https` với host của các dịch vụ push đã biết. Danh sách nằm trong `packages/shared/src/push.ts`.
9. **Người bị khóa.** Hệ thống không gửi tới người có `lockedAt` hoặc `deletedAt`.
10. **Thiếu khóa VAPID.** Khi thiếu `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` hay `VAPID_SUBJECT`, tính năng tắt. API vẫn chạy bình thường và nút ở app ẩn đi. API đọc ba biến này mỗi lần nhận yêu cầu và lúc khởi động bộ gửi.
11. **CPU luôn được cấp.** Mặc định Cloud Run giảm CPU của instance khi không có yêu cầu nào đang chạy. Việc gửi push chạy ngay sau khi trả lời, nên có thể bị chậm quá 30 giây hoặc mất. Sau khi bước 2 merge, đặt cờ bằng lệnh `gcloud run services update monsport --region asia-southeast1 --no-cpu-throttling` (tính tiền theo thời gian instance sống). `docs/deploy-gcp.md` ghi lệnh này. Quyết định này ghi ở `docs/adr/0005-thong-bao-web-push.md`. Nếu người dùng không chấp nhận chi phí, thay bằng gửi trong chính yêu cầu ghi dữ liệu, và đó là một brief khác.
12. **Mức ưu tiên và hạn.** Mỗi push gửi với `urgency: 'high'` và `TTL` 3600 giây. Điện thoại ngoài mạng quá 1 giờ không nhận thông báo cũ.
13. **Đăng xuất.** Đăng xuất trên web hủy đăng ký Web Push của thiết bị trước khi hủy phiên. Người đăng nhập sau trên cùng thiết bị không nhận thông báo của người trước.
14. **Chỉ chính chủ mới đồng bộ lại.** Khi bật, web lưu `userId` của người bật trong `localStorage`. Mỗi lần mở app, web chỉ gửi lại subscription nếu `userId` đó bằng người đang đăng nhập. Nếu khác hoặc không có (ví dụ phiên của người trước hết hạn mà chưa đăng xuất, hoặc `localStorage` bị xóa), web gọi `unsubscribe()` và hiện lại nút bật. Nhờ vậy một dòng đăng ký không tự chuyển sang người chưa bấm nút.
15. **Kết nối cơ sở dữ liệu.** Bộ gửi dùng thêm 1 kết nối `LISTEN push` trên mỗi instance, cùng với 1 kết nối `LISTEN lobby` của F-012. Với 2 instance, tổng là 4 kết nối `LISTEN`. Coder kiểm kích thước nhóm kết nối của Prisma so với giới hạn của `db-f1-micro` (25) và ghi con số vào ADR.

## Acceptance criteria

Dữ liệu mẫu chung:
- Người dùng "An" (`0901234567`, `USER`) và chủ sân "Bình" (`0912345678`, `OWNER`).
- Đơn vị "Cầu lông A" của Bình, có "Sân 1".
- Endpoint mẫu: `https://fcm.googleapis.com/fcm/send/abc123`. Khóa mẫu `p256dh` và `auth` hợp lệ về dạng.
- Test thay bộ gửi thật bằng bộ gửi giả ghi lại từng lần gọi.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Test đặt `process.env.VAPID_PUBLIC_KEY` trước lần gọi đầu, và xóa nó trước lần gọi cuối | An gọi `GET /api/push/public-key`. Khách chưa đăng nhập gọi cùng đường dẫn. Một lần khác, biến bị xóa | An nhận 200 `{ publicKey }`. Khách nhận 401. Khi thiếu khóa, An nhận 404 "Thông báo đẩy chưa bật" |
| AC-2 | An chưa có đăng ký | An gọi `POST /api/push/subscriptions` với endpoint mẫu và hai khóa | 201. Có đúng 1 dòng `PushSubscription` của An. Gọi lại cùng endpoint trả 200 và vẫn 1 dòng |
| AC-3 | Endpoint mẫu đang thuộc An. Bình đăng nhập trên cùng trình duyệt | Bình gọi `POST /api/push/subscriptions` với cùng endpoint | Dòng đó thuộc Bình. An không còn đăng ký nào |
| AC-4 | Body sai, mỗi lần một trường hợp: endpoint `http://fcm.googleapis.com/x`, `https://internal.example.com/x`, `https://169.254.169.254/x`, `https://fcm.googleapis.com:8443/x`, `https://user:pw@fcm.googleapis.com/x`, `https://fcm.googleapis.com.evil.com/x`, `https://evilnotify.windows.com/x`, và thiếu `keys.auth` | An gọi `POST /api/push/subscriptions` | Mỗi lần 400 "Dữ liệu không hợp lệ". Không có dòng nào được tạo. Hai endpoint hợp lệ `https://wns2-par02p.notify.windows.com/x` và `https://web.push.apple.com/x` được nhận |
| AC-5 | An có 5 đăng ký `e1` đến `e5`, tạo lần lượt, và `Clock` của test tiến thêm 1 giây sau mỗi lần | An thêm đăng ký thứ 6 `e6` | An có 5 đăng ký: `e2` đến `e6`. `e1` bị xóa. Thứ tự xét theo `(createdAt, id)` |
| AC-6 | An có đăng ký. Bình có đăng ký `e-binh` | An gửi yêu cầu đặt "Sân 1" | Bộ gửi giả nhận đúng 1 lần gọi, tới `e-binh`, trong vòng 30 giây. Tùy chọn gửi có `urgency: 'high'` và `TTL: 3600`. Tiêu đề và nội dung bằng thông báo `BOOKING_REQUESTED` trong app. Payload không có số điện thoại |
| AC-7 | An có đăng ký. Có 3 sự kiện: Bình xác nhận một booking của An, Bình từ chối một booking khác của An, và Lan (host, có đăng ký) hủy một trận mà An đã vào | Từng sự kiện xảy ra | Xác nhận và từ chối: 1 lần gửi tới An cho mỗi sự kiện. Hủy trận: 1 lần gửi tới mỗi người nhận thông báo `MATCH_CANCELLED` trong app, gồm An và Lan |
| AC-8 | Hai instance `PushService` cùng nghe một cơ sở dữ liệu. An có 1 đăng ký | Hệ thống thêm 1 dòng `Notification` cho An | Bộ gửi giả được gọi đúng 1 lần trên cả hai instance. `Notification.pushedAt` có giá trị |
| AC-9 | Dịch vụ push trả 410, hoặc 404, cho đăng ký của An | Hệ thống gửi một thông báo tới An | Dòng `PushSubscription` đó bị xóa. Yêu cầu đã tạo thông báo vẫn thành công |
| AC-10 | Dịch vụ push trả 500, hoặc không trả lời trong thời gian chờ (biến `PUSH_TIMEOUT_MS`, mặc định 10000, test đặt 200) | Hệ thống gửi một thông báo tới An | Đăng ký của An còn nguyên. Thông báo trong app vẫn có. Yêu cầu tạo thông báo vẫn thành công |
| AC-11 | Có 3 người: Chi không có đăng ký, Mai có đăng ký nhưng `lockedAt` có giá trị, và An có đăng ký | Mỗi người nhận một thông báo | Chi và Mai không có lần gửi nào, không lỗi. An có 1 lần gửi |
| AC-12 | Máy chủ thiếu khóa VAPID | Khởi động API, rồi An gửi một yêu cầu đặt sân | API khởi động được. Bảng `pg_stat_activity` không có phiên nào có `application_name` = `monsport-push` trên cơ sở dữ liệu hiện tại, sau khi test chờ (có giới hạn thời gian) cho các phiên của AC-8 đóng hẳn. Yêu cầu đặt sân thành công. Không có lần gửi nào |
| AC-13 | Web: trình duyệt có `PushManager`, quyền chưa hỏi, máy chủ bật Web Push | An mở ngăn thông báo và bấm "Nhận thông báo trên thiết bị này" | Web xin quyền, đăng ký `/sw.js`, đọc khóa từ `/api/push/public-key`, gọi `subscribe` với `userVisibleOnly: true`, rồi `POST /api/push/subscriptions`. Nút đổi thành "Tắt thông báo trên thiết bị này". `localStorage` ghi `userId` của An |
| AC-14 | Web: An đã bật Web Push | An bấm "Tắt thông báo trên thiết bị này" | Web gọi `unsubscribe` và `DELETE /api/push/subscriptions` với endpoint. Nút trở lại "Nhận thông báo trên thiết bị này" |
| AC-15 | Web: quyền thông báo là `denied` | An mở ngăn thông báo | Không có nút bật. Web hiện "Trình duyệt đang chặn thông báo. Hãy bật lại trong cài đặt của trình duyệt" |
| AC-16 | Web: trình duyệt không có `PushManager` (iPhone chưa thêm vào Màn hình chính, hoặc trình duyệt nhúng của Zalo) | An mở ngăn thông báo | Web hiện gợi ý "Trình duyệt này chưa hỗ trợ thông báo. Trên iPhone, hãy chọn Chia sẻ, rồi Thêm vào Màn hình chính, rồi mở app từ biểu tượng. Trên Android, hãy mở app bằng Chrome". Không có nút bật |
| AC-17 | `sw.js` chạy trong môi trường service worker giả (`apps/web/src/sw.test.ts` nạp `../public/sw.js` vào một `self` giả) | Sự kiện `push` mang `{ title, body }`. Một sự kiện `push` khác mang dữ liệu không đọc được thành JSON. Sau đó sự kiện `notificationclick` | `push` gọi `showNotification(title, { body })` bên trong `event.waitUntil`. Dữ liệu hỏng vẫn hiện một thông báo dự phòng "MONSPORT: Bạn có thông báo mới". `notificationclick` đóng thông báo và mở hoặc focus cửa sổ `/` |
| AC-18 | Tệp `manifest.webmanifest`, ba tệp PNG biểu tượng và `index.html` | `apps/web/src/pwa.test.ts` đọc các tệp | Manifest có `name` = `MONSPORT`, `start_url` = `/`, `display` = `standalone`, và biểu tượng PNG 192 và 512. `index.html` có `link rel="manifest"` và `link rel="apple-touch-icon"` trỏ tới tệp PNG 180 có thật |
| AC-20 | Web: An đã bật Web Push và đang đăng nhập | An bấm "Đăng xuất" | Web gọi `unsubscribe` và `DELETE /api/push/subscriptions` trước khi gọi `POST /api/auth/logout`. Lỗi của hai bước đầu không chặn việc đăng xuất |
| AC-21 | Web: `GET /api/push/public-key` trả 404 | An mở ngăn thông báo | Không có nút bật và không có gợi ý nào về Web Push |
| AC-22 | Web: quyền là `granted`, trình duyệt đã có một subscription (có thể đã đổi khóa). Lần thứ nhất, `localStorage` ghi `userId` của An. Lần thứ hai, `localStorage` ghi `userId` của Bình nhưng An đang đăng nhập (và ngược lại) | Lần thứ nhất: An mở app. Lần thứ ba: `localStorage` không có khóa. Lần thứ hai và thứ ba: người đăng nhập mở app | Lần thứ nhất: web gọi `POST /api/push/subscriptions` với subscription hiện tại một lần (upsert) và nút hiện "Tắt thông báo trên thiết bị này". Lần thứ hai và thứ ba: web không gọi `POST`, gọi `unsubscribe()` và nút hiện "Nhận thông báo trên thiết bị này" |
| AC-19 | Migration của F-014 đã chạy | Chèn một dòng `Notification` trên cơ sở dữ liệu thử, với một phiên `LISTEN` mở | Phiên nhận một sự kiện có payload là `id` của dòng đó và không có gì khác. Bảng `PushSubscription` có `endpoint` duy nhất |

## Contract

1. Tệp `packages/shared/src/push.ts` (new), xuất từ `packages/shared/src/index.ts`:

- `PUSH_HOST_ALLOWLIST`: danh sách host cho phép, và hàm `isAllowedPushEndpoint(url: string): boolean`. Hàm trả `false` và không ném lỗi với mọi chuỗi. Quy tắc:
  - Phân tích bằng `new URL(url)`. Giao thức là `https:`.
  - Không có cổng (`port === ''`), không có `username` và không có `password`.
  - `hostname` bằng đúng một host trong danh sách, hoặc kết thúc bằng dấu chấm cộng một hậu tố trong danh sách. Hậu tố phải có dấu chấm đứng trước, nên `evilnotify.windows.com` bị từ chối.
  - Host đúng: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com`.
  - Hậu tố: `.push.apple.com`, `.notify.windows.com`, `.push.services.mozilla.com`.
  - Khi từ chối, ghi log chỉ host, không ghi cả endpoint.
- `PushSubscribeRequest`:
  ```ts
  endpoint: z.string().max(2048).refine(isAllowedPushEndpoint)
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) })
  ```
- `PushUnsubscribeRequest`:
  ```ts
  endpoint: z.string().max(2048)
  ```
- `PushPublicKeyResponse`:
  ```ts
  publicKey: z.string().min(1)
  ```
- `PushPayload` (nội dung đẩy):
  ```ts
  title: z.string()
  body: z.string()
  notificationId: z.uuid()
  ```

2. Endpoint, mọi vai trò đã đăng nhập (`USER`, `OWNER`, `ADMIN`):
- `GET /api/push/public-key`: 200 `PushPublicKeyResponse`. 401 chưa đăng nhập. 404 "Thông báo đẩy chưa bật" khi thiếu khóa.
- `POST /api/push/subscriptions`: body `PushSubscribeRequest`. 201 khi tạo mới, 200 khi endpoint đã có. 400 "Dữ liệu không hợp lệ". 401. 404 khi thiếu khóa.
- `DELETE /api/push/subscriptions`: body `PushUnsubscribeRequest`. Chỉ xóa dòng của chính người gọi. 204, kể cả khi endpoint không tồn tại hoặc thuộc người khác (không lộ sự tồn tại). 401.

3. Biến môi trường của API: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, và `PUSH_TIMEOUT_MS` (mặc định 10000). Cloud Run đã đặt ba biến VAPID (2026-10-20). `apps/api/.env.example` thêm các dòng mẫu, không có giá trị thật.

4. Tùy chọn gửi (bước 2): `urgency: 'high'`, `TTL: 3600`, `timeout: PUSH_TIMEOUT_MS`. Bộ gửi giả ghi lại các tùy chọn này.

## Data

Migration `20261020000000_f014_web_push` (tên ngày có thể đổi theo ngày tạo):

- Bảng `PushSubscription` (new): `id`, `userId` (FK `User`), `endpoint` (`VarChar(2048)`, duy nhất), `p256dh` (`VarChar(200)`), `auth` (`VarChar(100)`), `createdAt`. Index `(userId, createdAt)`. Độ dài cột bằng độ dài lớn nhất của Zod.
- Cột `Notification.pushedAt` (nullable, timestamptz(3)).
- Hàm `notification_notify_push()` và trigger `Notification_notify_push` sau `INSERT` trên `Notification`. Trigger gọi `pg_notify('push', NEW."id"::text)`.
- Dòng `Notification` có từ trước migration giữ `pushedAt` rỗng. Để tránh gửi lại thông báo cũ, migration đặt `pushedAt = createdAt` cho mọi dòng hiện có.

`docs/requirements/data-dictionary.md` đã có `PushSubscription` với `endpoint` tối đa 1000. Bước 1 sửa dòng đó thành 2048, thêm dòng `Notification.pushedAt`, và đổi dòng `Notification` thành `... + (readAt) + (pushedAt) + createdAt`. Kết nối `LISTEN` của bộ gửi đặt `application_name` = `monsport-push`. Thời hạn lưu theo intake: tới khi người dùng hủy đăng ký.

## Build order

| # | Step | Branch | Paths | Tests |
|---|---|---|---|---|
| 1 | Schema, contract và API đăng ký | `feat/<issue>-1-push-subscriptions` | `packages/shared/src/push.ts`, `packages/shared/src/push.test.ts`, `packages/shared/src/index.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20261020000000_f014_web_push/migration.sql`, `apps/api/prisma/migration.test.ts`, `apps/api/src/modules/push/push.controller.ts`, `apps/api/src/modules/push/subscriptions.service.ts`, `apps/api/src/modules/push/push.module.ts`, `apps/api/src/modules/push/push.e2e.test.ts`, `apps/api/src/app.module.ts`, `apps/api/.env.example`, `docs/requirements/data-dictionary.md`, `PROGRESS.md` | Contract test cho `isAllowedPushEndpoint`. AC-1 đến AC-5, AC-19 |
| 2 | Bộ gửi và cấu hình CPU | `feat/<issue>-2-push-sender` | `apps/api/package.json`, `pnpm-lock.yaml`, `apps/api/src/modules/push/push-sender.ts`, `apps/api/src/modules/push/push.service.ts`, `apps/api/src/modules/push/push.module.ts`, `apps/api/src/modules/push/sender.e2e.test.ts`, `apps/api/src/modules/database/prisma.service.ts` (chỉ đặt `max: 6` cho nhóm kết nối, Assumption 15), `docs/adr/0005-thong-bao-web-push.md`, `docs/deploy-gcp.md`, `PROGRESS.md` | AC-6 đến AC-12. Sau khi merge, đặt `--no-cpu-throttling` bằng lệnh `gcloud` ở Assumption 11 và ghi vào báo cáo |
| 3 | Màn hình và service worker | `feat/<issue>-3-push-screen` | `apps/web/public/sw.js`, `apps/web/public/manifest.webmanifest`, `apps/web/public/icon-192.png`, `apps/web/public/icon-512.png`, `apps/web/public/apple-touch-icon.png`, `apps/web/index.html`, `apps/web/src/features/notifications/PushToggle.tsx`, `apps/web/src/features/notifications/PushToggle.test.tsx`, `apps/web/src/features/notifications/Notifications.tsx`, `apps/web/src/features/notifications/Notifications.test.tsx`, `apps/web/src/lib/push.ts`, `apps/web/src/app/App.tsx`, `apps/web/src/app/App.test.tsx`, `apps/web/src/app/styles.css`, `apps/web/src/sw.test.ts`, `apps/web/src/pwa.test.ts`, `apps/web/tsconfig.json`, `apps/web/package.json`, `pnpm-lock.yaml`, `PROGRESS.md` | AC-13 đến AC-18, AC-20 đến AC-22. Màn hình kiểm ở 390px bằng ảnh chụp |

Mỗi bước cập nhật `PROGRESS.md` khi bước kế tiếp đổi. Bước 3 viết lại phần "Next step". Ba tệp PNG biểu tượng là nền xanh thương hiệu với đường viền sân màu trắng. Coder tạo chúng bằng một script tạm và không commit script. Hai test mới đọc tệp bằng `node:fs`, nên bước 3 thêm `@types/node` vào `devDependencies` của `apps/web` và `"node"` vào `types` của `apps/web/tsconfig.json`.

## Edit boundaries

- May edit: các đường dẫn trong cột Paths ở trên, cùng `docs/briefs/F-014-thong-bao-web-push.md`.
- Leave unchanged without approval:
  - `apps/api/src/modules/bookings/*`
  - `apps/api/src/modules/matches/*`
  - `apps/api/src/modules/notifications/*` (trigger lo việc phát, nên không sửa dịch vụ thông báo)
  - `apps/api/src/modules/auth/*`
  - `packages/shared/src/account.ts` (`PRIVACY_NOTICE`, mục 4 của `PROGRESS.md`)
  - `.github/workflows/*`, `Dockerfile`

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| SSRF: server gọi endpoint do người dùng gửi | `PushSubscribeRequest`, `push.service.ts` | Chỉ `https` và host trong danh sách cho phép. Kiểm tra lại khi gửi, không chỉ khi lưu. Test AC-4. Reviewer chạy skill `rule-review` |
| Dữ liệu cá nhân: endpoint và khóa đăng ký gắn với người dùng (BR-20, Luật 91/2025) | Bảng `PushSubscription` | Người dùng tự bấm bật. Xóa khi hủy hoặc khi dịch vụ push trả 404 hoặc 410. Không ghi endpoint vào log. Payload không có số điện thoại. Câu hỏi về nội dung thông báo quyền riêng tư ghi ở Open questions |
| Gửi trùng khi có 2 instance | `push.service.ts` | Giành dòng bằng `UPDATE ... WHERE pushedAt IS NULL RETURNING`. Test AC-8 |
| Gửi lại thông báo cũ khi migration chạy | Migration | Đặt `pushedAt = createdAt` cho dòng hiện có. Test AC-19 |
| Lỗi gửi làm hỏng giao dịch booking hoặc trận | `push.service.ts` | Gửi sau commit, bắt mọi lỗi, đặt thời gian chờ `PUSH_TIMEOUT_MS`. Test AC-9, AC-10 |
| Push chậm quá 30 giây hoặc mất vì Cloud Run giảm CPU lúc không có yêu cầu | Cấu hình Cloud Run | `--no-cpu-throttling` (Assumption 11, ADR 0005). Đặt `urgency: 'high'` và `TTL` (Assumption 12). Kiểm một thiết bị thật sau khi deploy |
| Kết nối `LISTEN` làm cạn kết nối của `db-f1-micro` | `push.service.ts` | Coder đếm kết nối (Assumption 15) và ghi vào ADR 0005 |
| Thông báo của người trước hiện trên thiết bị dùng chung | Đăng xuất | Đăng xuất hủy đăng ký (Assumption 13). Phiên hết hạn mà chưa đăng xuất: Assumption 14. Test AC-20, AC-22 |
| Lộ khóa riêng VAPID | Log, mã, commit | Khóa riêng chỉ nằm trong Secret Manager và biến môi trường. Test và Reviewer kiểm không có khóa trong mã hay log |
| Safari thu hồi đăng ký nếu push không hiện thông báo | `sw.js` | Luôn gọi `showNotification` (Assumption 4). Test AC-17 |
| Service worker cũ còn cache sau khi đổi mã | `sw.js` | Tệp `sw.js` không cache tài nguyên. Chỉ xử lý `push` và `notificationclick` |
| Thay đổi schema | Migration | Đây là thay đổi schema và dữ liệu cá nhân, nên vòng Reviewer chạy cả skill `rule-review` cho bước 1 và bước 2 |

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| `PRIVACY_NOTICE` có cần nhắc việc lưu đăng ký Web Push (endpoint của thiết bị) không? Cần xem cùng cố vấn pháp lý (mục 4 của `PROGRESS.md`) | Người dùng và cố vấn pháp lý | Không chặn AC nào. Brief dùng hành động bấm nút làm sự đồng ý |
| Bạn chấp nhận chi phí của `--no-cpu-throttling` (tính tiền theo thời gian instance sống, thay vì chỉ lúc có yêu cầu) để push đến đúng hạn 30 giây không? Brief chọn có và ghi ADR 0005. Nếu không, cần một brief khác (gửi trong yêu cầu ghi dữ liệu) | Người dùng | Không chặn AC nào. Giá trị tạm: bật |
| Danh sách host dịch vụ push (Assumption 8) có thiếu trình duyệt nào mà người dùng của bạn dùng không (ví dụ trình duyệt Samsung dùng FCM)? | Người dùng | Không chặn AC nào. Thêm host khi có người báo lỗi 400 |

## Done when

- Mọi AC từ AC-1 đến AC-22 có test với tên bắt đầu bằng nhãn tương ứng và chạy đạt.
- Lệnh `pnpm check` chạy đạt không lỗi.
- Reviewer hoàn thành không còn lỗi mức medium hoặc cao hơn. Bước 1 và bước 2 có thêm bình luận của `rule-review`.
- Sau khi bước 3 merge và deploy, một thiết bị thật nhận được Web Push từ một yêu cầu đặt sân thử (tài khoản có tên bắt đầu bằng `test-`).
