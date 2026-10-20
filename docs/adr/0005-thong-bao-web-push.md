# 0005: Gửi Web Push từ mọi instance API qua trigger, LISTEN và giành dòng bằng pushedAt

Status: Accepted
Date: 2026-10-20

## Context

Intake yêu cầu thông báo đi qua Web Push (UC-14). Điện thoại của chủ sân phải nhận thông báo trong vòng 30 giây sau khi người dùng gửi yêu cầu đặt sân. Brief F-014 mô tả yêu cầu đầy đủ.

Bản đầu chạy trên Cloud Run với tối đa 2 instance, nối trực tiếp vào Cloud SQL `db-f1-micro` (tối đa 25 kết nối). Dòng `Notification` do bookings và matches ghi (F-013). Brief F-014 không cho sửa hai module đó. Mặc định, Cloud Run giảm CPU của instance khi không có yêu cầu nào đang chạy. Việc gửi push chạy ngay sau khi API trả lời, nên nó chạy trên CPU bị giảm.

## Options

1. **Gửi trong chính yêu cầu ghi dữ liệu.** Mỗi chỗ tạo `Notification` gọi bộ gửi trước khi trả lời. CPU luôn được cấp, nên không cần đổi cấu hình Cloud Run. Rủi ro: phải sửa bookings và matches, và một push chậm làm chậm yêu cầu của người dùng.
2. **Trigger `pg_notify`, mỗi instance `LISTEN push`, instance nhận trước giành dòng bằng `UPDATE ... SET "pushedAt" = now WHERE "pushedAt" IS NULL RETURNING`.** Không sửa module nào ngoài `push`. Cùng mẫu với ADR 0004. Rủi ro: việc gửi chạy sau khi trả lời, nên cần CPU luôn được cấp. `NOTIFY` không lưu bền, nên thông báo tạo lúc không instance nào nghe sẽ không được đẩy.
3. **Cloud Pub/Sub hoặc Cloud Tasks.** Hàng đợi bền, có thử lại. Tốn thêm dịch vụ, quyền IAM và chi phí cho một hệ thống tối đa 2 instance.

## Decision

Chọn phương án 2.

- **(a) Gửi từ mọi instance.** Migration của F-014 tạo trigger `Notification_notify_push`, gọi `pg_notify('push', id)` sau `INSERT`. Mỗi instance giữ một kết nối `LISTEN push` (`application_name` = `monsport-push`) và tự nối lại sau 1 giây. Instance nhận sự kiện giành dòng bằng câu `UPDATE` ở trên. Chỉ instance có dòng trả về mới gửi, nên hai instance không gửi trùng. Cloud Pub/Sub bị loại vì thêm hạ tầng. Gửi trong yêu cầu bị loại vì phải sửa bookings và matches.
- **(b) CPU luôn được cấp.** Sau khi merge bước 2, đặt cờ `--no-cpu-throttling` cho dịch vụ Cloud Run `monsport`. Lệnh nằm ở `docs/deploy-gcp.md`. Chi phí: Cloud Run tính tiền theo thời gian instance sống, thay vì chỉ lúc có yêu cầu. Đảo ngược được bằng `gcloud run services update monsport --region asia-southeast1 --cpu-throttling`. Nếu người dùng không chấp nhận chi phí, thay bằng phương án 1 trong một brief khác (mục 5 của "Open decisions" trong `PROGRESS.md`).
- **(c) Kết nối cơ sở dữ liệu.** Mỗi instance mở 4 loại kết nối:
  - Nhóm của `PrismaService` (`PrismaPg`, `pg.Pool`). Mặc định nhóm này tối đa 10 kết nối.
  - Nhóm của `Database` trong `apps/api/src/modules/health/database.ts`, tối đa 2 kết nối, cho `/api/health`.
  - 1 kết nối `LISTEN lobby` (ADR 0004).
  - 1 kết nối `LISTEN push`.

  Với nhóm Prisma mặc định, mỗi instance tối đa 10+2+1+1 = 14. Hai instance (`--max-instances=2`) tối đa 28, vượt giới hạn 25 của `db-f1-micro`. Trước F-014, con số là 2 x (10+2+1) = 26, cũng vượt. **Quyết định:** đặt `max: 6` cho `PrismaPg` trong `prisma.service.ts` (hằng `POOL_MAX`). Mỗi instance còn tối đa 6+2+1+1 = 10 kết nối. Hai instance tối đa 20 trên 25, biên còn lại là 5. Biên này quan trọng, vì Cloud SQL dành riêng một số kết nối cho quản trị, và `prisma migrate deploy` lúc khởi động dùng thêm một kết nối ngắn. Nhóm Prisma chỉ đầy khi tải đột biến. Khi tăng `POOL_MAX`, đếm lại theo công thức trên. Nếu cần thêm kết nối, dùng chung một kết nối `LISTEN` cho hai kênh.
- **(d) Gửi tốt nhất có thể.** Không có hàng đợi bền. Hai trường hợp làm mất thông báo đẩy:
  - Dòng được tạo lúc không instance nào nghe (khởi động lại, kết nối rớt trong 1 giây). Dòng giữ `pushedAt` rỗng, và bộ gửi không bù lại lúc khởi động.
  - Tiến trình chết sau khi giành dòng và trước khi gửi xong. `pushedAt` đã có giá trị, nên không instance nào gửi lại.

  Danh sách thông báo trong app vẫn đủ trong cả hai trường hợp. Khóa VAPID sai làm mọi lần gửi lỗi trước khi gọi mạng. Vì vậy bộ gửi kiểm ba giá trị lúc khởi động. Khóa sai thì tắt Web Push, không mở `LISTEN push` và không giành dòng nào. Lỗi gửi không làm hỏng yêu cầu ghi dữ liệu. Dịch vụ push trả 404 hoặc 410 thì bộ gửi xóa đăng ký. Lỗi khác (500, hết thời gian chờ, khóa không hợp lệ) giữ đăng ký và không gửi lại. Danh sách thông báo trong app vẫn đủ. Lỗi gửi không làm hỏng yêu cầu ghi dữ liệu. Dịch vụ push trả 404 hoặc 410 thì bộ gửi xóa đăng ký. Lỗi khác (500, hết thời gian chờ) giữ đăng ký và không gửi lại.

## Consequences

- Bộ gửi đọc ba biến `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` lúc khởi động. Thiếu một biến thì không mở kết nối `LISTEN push` và log một lần "Web Push is off". Đủ ba biến nhưng web-push từ chối chúng thì log "Web Push is off (invalid VAPID keys)" và cũng không mở kết nối.
- Server gọi endpoint do người dùng gửi. Trước mỗi lần gọi, bộ gửi kiểm lại `isAllowedPushEndpoint`. Endpoint không còn được phép thì dòng bị xóa và không có lần gọi mạng nào (chặn SSRF).
- Log không có endpoint, khóa hay payload. Payload chỉ có tiêu đề, nội dung (tên đơn vị, tên sân, giờ) và `notificationId`. Không có tên hay số điện thoại người dùng (BR-20).
- Mỗi push gửi với `urgency: 'high'` và `TTL` 3600 giây. Thời gian chờ lấy từ `PUSH_TIMEOUT_MS` (mặc định 10000).
- Khóa riêng VAPID nằm trong Secret Manager. Không tạo lại cặp khóa sau khi có người đăng ký, vì mọi đăng ký cũ mất hiệu lực.
