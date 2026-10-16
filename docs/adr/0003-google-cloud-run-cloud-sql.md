---
style: ste80
lang: vi
---

# ADR 0003: Chạy bản thử trên Google Cloud Run và Cloud SQL

Ngày: 2026-10-17. Trạng thái: chấp nhận.

## Bối cảnh

Người dùng muốn đưa app lên Google Cloud để chạy thử. Trước đó, `PROGRESS.md` ghi Supabase là nơi đặt Postgres cho production, và chưa chốt.

## Quyết định

- Một dịch vụ Cloud Run chạy một image. Image phục vụ cả API (`/api`) và trang web đã build. Cookie phiên vì vậy giữ cùng origin, và không cần CORS.
- Cloud SQL for PostgreSQL 18, bản Enterprise, hạng máy nhỏ nhất, vùng `asia-southeast1`.
- Secret Manager giữ `DATABASE_URL` và `SESSION_SECRET`.
- Container chạy `prisma migrate deploy` trước khi khởi động server.
- CI dựng image và chạy thử nó với Postgres 18 trên mỗi pull request.

## Hệ quả

- Không cần Supabase. Mục mở về phiên bản Postgres của Supabase hết hiệu lực.
- Cloud SQL tính tiền theo giờ, kể cả khi không có request. Cloud Run có thể về 0 instance.
- Đổi sang nhà cung cấp khác cần một `Dockerfile` chạy được ở nơi khác và một chuỗi kết nối mới. Code của app không đổi.
- Chưa có deploy tự động từ `main`. Người dùng chạy lệnh deploy trong `docs/deploy-gcp.md`.
