# 0004: Phát sự kiện phòng chờ qua PostgreSQL LISTEN/NOTIFY và SSE

Status: Accepted
Date: 2026-10-18

## Context

Intake yêu cầu phòng chờ tự cập nhật trong vòng 2 giây qua Server-Sent Events (SSE) khi có người mở trận, vào trận, rời trận hoặc khi trận bị hủy (UC-7, UC-8, BR-15, BR-16, BR-17).

Bản đầu triển khai trên Cloud Run với tối đa 2 instance (`--max-instances=2`) nối trực tiếp vào Cloud SQL PostgreSQL 18 qua Unix socket, không qua bộ gom kết nối chế độ transaction (`docs/deploy-gcp.md`). Một thay đổi có thể xảy ra trên instance A trong khi người dùng mở phòng chờ đang giữ kết nối SSE với instance B.

## Options

1. **Phát sự kiện trong bộ nhớ của từng process Node.js (`EventEmitter` / RxJS `Subject` nội bộ).** Đơn giản, không thêm migration. Rủi ro: khi Cloud Run chạy 2 instance, client nối vào instance B không nhận được sự kiện do instance A ghi.
2. **Dùng PostgreSQL `LISTEN`/`NOTIFY` với trigger trên bảng `Match`.** Trigger `Match_notify_lobby` gọi `pg_notify('lobby', NEW."id"::text)` sau khi chèn dòng mới hoặc đổi `status`, `joinedCount`. Mỗi instance API giữ một kết nối `pg.Client` riêng chạy `LISTEN lobby` và đẩy sự kiện `match` (`{"id":"<uuid>"}`) tới các client SSE của instance đó.
3. **Thêm Redis Pub/Sub hoặc Cloud Pub/Sub.** Độc lập với cơ sở dữ liệu, nhưng tốn thêm dịch vụ đám mây, chi phí và cấu hình mạng cho một hệ thống chỉ có tối đa 2 instance.

## Decision

Chọn phương án 2. Lý do quyết định: PostgreSQL `NOTIFY` chỉ phát sau khi transaction commit và tới mọi phiên `LISTEN` trên cả hai instance Cloud Run mà không cần thêm hạ tầng ngoài PostgreSQL sẵn có.

## Consequences

- Migration của F-012 tạo hàm `match_notify_lobby()` và trigger `Match_notify_lobby` trên bảng `Match`.
- Mọi thay đổi làm đổi `Match.status` hoặc `Match.joinedCount` (mở trận, vào trận, rời trận, hủy trận, chủ sân từ chối/hủy booking, hoặc tự hết hạn khi đọc) đều tự phát thông báo sau khi commit mà từng hàm nghiệp vụ không cần tự gọi `emit`.
- Mỗi instance API dùng thêm 1 kết nối PostgreSQL dành riêng cho `LISTEN lobby` (tối đa 2 kết nối trên toàn dịch vụ) và tự nối lại sau 1 giây nếu kết nối rớt.
- Payload thông báo chỉ chứa `id` của trận (UUID, 36 byte), không chứa số điện thoại hay thông tin cá nhân (BR-20). Client nhận sự kiện SSE sẽ gọi lại `GET /api/matches` theo bộ lọc hiện tại của mình.
