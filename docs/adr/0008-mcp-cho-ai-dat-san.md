# 0008: Máy chủ MCP để AI đặt sân và để người dùng nối connector

Status: Proposed
Date: 2026-11-03. Chờ người dùng duyệt.

## Context

Người dùng muốn hai việc: một AI tự đặt lịch trên MONSPORT, và người biết dùng AI nối MONSPORT qua connector.

Intake hiện không nói về AI agent hay MCP. Mọi chức năng đã có sẵn qua API và service. Cookie phiên là cách xác thực duy nhất cho người dùng (ADR 0007 thêm Google và OTP, vẫn cấp cookie).

## Options

1. **Một máy chủ MCP trong API, hai cách nối.** Công cụ gọi service hiện có. Cách A dùng PAT qua stdio. Cách B dùng OAuth qua Streamable HTTP.
   - Một lớp công cụ, không chép luật.
   - Cách B đòi một máy chủ OAuth: bảng client, mã cấp phép, token.
2. **Một gói riêng `apps/mcp` gọi API qua HTTP.**
   - Tách được tiến trình.
   - Phải xử lý lại xác thực và mất kiểm tra trong cùng giao dịch. Thêm một chỗ để triển khai.
3. **Chỉ cách A.**
   - Rẻ nhất.
   - Người dùng phổ thông không tự tạo và dán token. Không đạt mục tiêu 2.

## Decision

Chọn 1. Module `mcp` trong `apps/api`, công cụ gọi service của `bookings`, `venues`, `matches`. Hợp đồng công cụ nằm trong `packages/shared`.

Làm theo `docs/design/ke-hoach-mcp.md`: lớp công cụ, rồi cách A, rồi cách B. Bản đầu chỉ có công cụ cho vai trò người dùng. Yêu cầu đặt sân qua AI vẫn chờ chủ sân xác nhận.

## Consequences

- Cần đổi intake: thêm MCP vào phạm vi và một UC mới.
- Schema đổi: bảng token và client OAuth. Dữ liệu này nhạy cảm, nên cần reviewer mạnh nhất và `rule-review`.
- Thêm bề mặt tấn công. Giữ bằng token băm, hạn ngắn, phạm vi nhỏ và giới hạn tần suất.
- Cần kiểm đặc tả MCP hiện hành trước brief đầu tiên.
- Nếu người dùng không duyệt, giữ nguyên hiện trạng. Không có code nào phụ thuộc ADR này.
