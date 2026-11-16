# 0008: Máy chủ MCP để AI đặt sân và để người dùng nối connector

Status: Accepted
Date: 2026-11-16. Đề xuất ngày 2026-11-03. Người dùng cho đi tiếp ngày 2026-11-16.

Lời người dùng, 16/11/2026: "Bắt đầu port app mobile cho W1, làm phần dọn dẹp, nếu được làm MCP, chạy verify-flow." Agent hiểu đây là lệnh bắt đầu MCP (W7) khi làm được (`HUMAN_DECISIONS.md`, dòng 26).

**Phạm vi của lần duyệt này.** Chỉ bước 2 của kế hoạch bắt đầu ngay: lớp công cụ, không xác thực ngoài, không đổi schema, không có đường HTTP (brief F-036). PAT (bước 3) và OAuth (bước 4) cần brief riêng và `rule-review` trước khi code. Bước 1b (GPS) và công cụ cho chủ sân và admin (dòng 27) vẫn mở.

## Sửa đổi 17/11/2026 (brief F-037)

- Cách A dùng PAT qua Streamable HTTP với header `Authorization: Bearer`, không qua stdio. Claude Code nối thẳng được bằng cách này (`HUMAN_DECISIONS.md`, dòng 70).
- Bước 3 mở `POST /api/mcp`, chỉ nhận PAT. Cookie không được tính. Request có header `Origin` bị từ chối.
- Bước 4 thêm OAuth cho cùng đường này.

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

Kiểm tra ngày 16/11/2026 (chi tiết và nguồn nằm trong brief F-036):

- Dùng SDK dòng v2: `@modelcontextprotocol/server` 2.4.0 (phát hành 23/10/2026). Dòng v1.x chỉ còn sửa lỗi và không hỗ trợ đặc tả 2026-07-28.
- Streamable HTTP chạy không giữ phiên (`sessionIdGenerator: undefined`), mỗi request một cặp server và transport. Cách này hợp Cloud Run với tối đa 2 instance (ADR 0005), vì không có trạng thái trong bộ nhớ.

## Consequences

- Intake V2 đã đổi: MCP (W7) nằm trong phạm vi, kèm UC-20 và BR-58.
- Schema đổi ở bước 3 và 4, không đổi ở bước 2: bảng token và client OAuth. Dữ liệu này nhạy cảm, nên cần reviewer mạnh nhất và `rule-review`.
- Thêm bề mặt tấn công. Giữ bằng token băm, hạn ngắn, phạm vi nhỏ và giới hạn tần suất.
- Đã kiểm đặc tả MCP và SDK trước brief đầu tiên. Kiểm lại phiên bản đặc tả và đường dẫn metadata OAuth trước brief của bước 4.
- Bước 2 không có đường HTTP và không đổi schema, nên chưa ai gọi được công cụ từ bên ngoài. Đây là lý do bước 2 chạy trước PAT và OAuth.
