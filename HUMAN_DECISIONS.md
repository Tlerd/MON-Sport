# Quyết định cần người chốt

File này đi cùng `PROGRESS.md`. `PROGRESS.md` giữ bước tiếp theo. File này giữ mọi việc chỉ người dùng chốt hoặc làm được.

## Quy tắc cho agent

- Đọc file này ngay sau `PROGRESS.md` khi bắt đầu phiên.
- Không dừng việc để hỏi. Làm theo cột "Mặc định" và ghi quyết định ở brief hoặc PR, theo mục "Autonomy" của `AGENTS.md`.
- Khi một việc mới cần người chốt, thêm một dòng vào bảng "Đang mở". Làm trong cùng PR với việc đó.
- Khi người dùng trả lời, chuyển dòng sang "Đã chốt" cùng ngày và ngày trả lời. Ghi lại lời của người dùng nếu có.
- Giữ số thứ tự cũ. Brief và ADR gọi quyết định theo số.
- Không xóa dòng. Dòng đã chốt ở lại làm lịch sử.

## Đang mở

Cột "Chặn" ghi việc dừng lại vì câu hỏi. "Không" nghĩa là việc vẫn chạy theo mặc định.

| # | Câu hỏi | Mặc định đang chạy | Chặn | Nguồn |
|---|---|---|---|---|
| 1 | Số sân của mỗi đơn vị, cỡ sân bóng đá, và thành phố | Dữ liệu demo | Thử nghiệm thật | intake |
| 2 | Ngày thử nghiệm | Chưa có | Thử nghiệm thật | intake |
| 3 | Số booking mỗi ngày sau 6 tháng | Chưa có | Cỡ hạ tầng | intake |
| 4 | Luật 91/2025 có đòi nhiều hơn ô đồng ý và thông báo của F-003 không? Và văn bản cuối của thông báo (`PRIVACY_NOTICE` trong `packages/shared/src/account.ts`). Cần người tư vấn pháp lý | Ô đồng ý và thông báo hiện có | Thử nghiệm thật | F-003 |
| 5 | Bản dùng thử Google Cloud có thành bản chạy thật không (ADR 0003, `docs/deploy-gcp.md`)? Có giữ `--no-cpu-throttling` cho Web Push, chi phí cao hơn không (ADR 0005)? | Giữ cờ này | Không | F-014 |
| 6 | Dữ liệu chủ sân có cần đồng ý riêng, hay hợp đồng với đơn vị đã đủ? Tới khi có chức năng xóa tài khoản, admin xóa tay khi được yêu cầu | Admin xóa tay | Không | F-003 |
| 8 | Giới hạn của BR-30 có hợp với đơn vị mà người chơi dùng chung một Wi-Fi không? Kiểm sau tuần thử nghiệm đầu | Giới hạn hiện có | Không | F-006 |
| 9 | (a) Kết quả tìm kiếm có chọn sẵn sân khi chỉ một sân khớp không? (b) Hủy có báo bên kia không (UC-14 chưa có sự kiện hủy)? Chủ sân có được hủy sau giờ bắt đầu không? (c) Người chơi khác có cần số của host không? | (a) không (b) không báo, không được hủy sau giờ bắt đầu (c) không | Không | F-009, F-010, F-012 |
| 10 | Tỷ lệ hết hạn có tính booking đã bị hủy sau khi xác nhận không? | Không tính | Không | F-016 |
| 11 | Chọn nhà cung cấp SMS và đăng ký brandname. Làm các bước trong Google console của brief F-004, rồi gửi client ID | Chưa có | F-004 bước 4 (live), rồi F-018 (Zalo, OTP qua ZNS) | F-004 |
| 12 | Người chơi (không phải host) bấm thẻ "Trận bị hủy": app nên mở màn nào? "Lịch của tôi" hiện không hiện trận đã hủy | Mở "Lịch của tôi" (QA F-023 D-1, mức medium) | Không | QA F-023 câu 2 |
| 13 | Bấm thông báo có mở đúng màn của booking hoặc trận (`/lich-cua-toi/:id`, `/chu-san/yeu-cau/:id`), hay chỉ màn danh sách? | Màn danh sách. Đổi sang màn chi tiết cần brief màn chủ sân | Không | QA F-023 câu 1 |
| 14 | Thẻ thông báo trên app có ghi lúc nhận (`createdAt`) như web không? | Không ghi | Không | QA F-023 câu 3 |
| 15 | Web Push có chạy trên app `/app/` không? Đăng ký hiện gắn với `sw.js` của web ở phạm vi `/` | Không | Không | brief F-023 |
| 16 | Có cần nút "Xem thêm" khi `unreadCount` lớn hơn 50 mục mà API trả không? | Không | Không | brief F-023 |
| 17 | Các mục 4 đến 6 của QA F-020 (đọc `docs/qa/F-020-qa-2026-10-30.md`) | Các mặc định trong file QA | Không | QA F-020 |
| 18 | Người chưa vào trận có cần thấy trận "Đầy" trong Phòng chờ không? | Không. Trận đầy biến khỏi feed | Không | QA F-022 câu 1 |
| 19 | Khi booking "Đã xác nhận" còn dưới 6 giờ tới giờ bắt đầu, host có được hủy trận không? | Không. App ẩn "Hủy trận" và chỉ tới "Lịch của tôi". Server trả 409 (BR-11) | Không | QA F-022 câu 2 |
| 20 | Luồng `mobile-lobby` có được tạo yêu cầu đặt sân thật trên đơn vị chạy thử sau mỗi lần deploy không? | Có, trên `VERIFY_VENUE` | Không | QA F-022 câu 3 |
| 21 | Thẻ trận có được dài hơn 3 dòng không? | Có, 4 dòng | Không | QA F-022 câu 4 |
| 22 | Chủ sân có tab Phòng chờ trên app không? | Không có tab. Chủ sân vào bằng URL và chỉ xem | Không | QA F-022 câu 5 |
| 23 | Host có thấy trận của mình trong feed Phòng chờ không? | Có | Không | brief F-022 |
| 24 | Giá mặc định mỗi suất khi mở trận: 0, hay giá sân chia đều theo số suất? | 0 | Không | brief F-022 |
| 25 | Có gửi thông báo đẩy khi có người vào hoặc rời trận không? | Không | Không | brief F-022 |
| 26 | Duyệt ADR 0008 (máy chủ MCP cho AI đặt sân và connector) và đổi intake để thêm MCP vào phạm vi? | Chưa duyệt. Agent không code MCP | Kế hoạch MCP (`docs/design/ke-hoach-mcp.md`) | ADR 0008 |
| 27 | Chủ sân và admin có công cụ MCP không (xác nhận booking, đóng sân)? | Không. Bản đầu chỉ có công cụ cho người dùng | Không | `docs/design/ke-hoach-mcp.md` |

## Việc chỉ người dùng làm được

| Việc | Vì sao agent không làm được |
|---|---|
| Chạy `verify-flow` trên bản live và gửi kết quả | Cần máy và tài khoản của người dùng |
| Kiểm UC-14 (Web Push) trên máy Android thật. Lần thử ngày 21/10/2026 thất bại, sửa bởi PR #94 và #101, chưa có lần thử lại | Cần máy thật |
| Đăng nhập lại trên bản live sau lần deploy F-004 bước 2 (mỗi cookie một khóa) | Phiên của người dùng |

## Đã chốt

| # | Quyết định | Ngày | Nguồn |
|---|---|---|---|
| 7 | Chấp nhận F-004 và mở rộng: "accept F-004 (Thêm đề xuất gửi mã OTP để xác minh sdt, dù đăng nhập hoặc đăng kí bằng gmail thì phải xác minh sdt hoặc nếu đăng nhập bằng Zalo thì xác minh bằng zalo)". Tài khoản Google xác minh số bằng OTP qua SMS. Tài khoản Zalo xác minh qua Zalo | 23/10/2026 | người dùng |
| 10a | "làm theo cách hiện tại": bảng admin vẫn đếm người dùng tạo booking `APP`, vào trận, hoặc làm host trong tuần. Số lần đăng nhập (`User.lastLoginAt`) chỉ là đề xuất, chỉ làm khi người dùng đồng ý | 23/10/2026 | người dùng, F-016 |
