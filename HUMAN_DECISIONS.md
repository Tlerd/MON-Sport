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
| 28 | Khi booking có trận, sheet từ chối của chủ sân trên app có cần báo trước "Trận có N người sẽ bị hủy" không? Cần đổi API | Không báo trước | Không | QA F-024 câu 1 |
| 29 | Chủ sân có nhiều đơn vị có cần chip lọc theo đơn vị trên tab Yêu cầu của app không? | Không. Một danh sách chung, mỗi thẻ ghi tên đơn vị | Không | QA F-024 câu 2 |
| 30 | Tab Yêu cầu xếp theo hạn xác nhận (gấp nhất trước) hay theo giờ chơi? | Theo giờ chơi (`startAt` tăng dần) | Không | QA F-024 câu 3 |
| 31 | Thẻ yêu cầu trên app có được dài 7 dòng không (`DESIGN.md` cho tối đa 3)? | Có, 7 dòng theo brief F-024 | Không | QA F-024 câu 4 |
| 32 | Khi thẻ yêu cầu ghi "Hết hạn", hai nút có cần khóa không? | Không. Server trả 409 và app bỏ thẻ | Không | QA F-024 câu 5 |
| 33 | Chủ sân có cần nhập lý do khi từ chối không? Cần đổi schema và thông báo | Không | Không | brief F-024 |
| 34 | Mục "Booking trong ngày" của Lịch sân trên app có cần API lọc theo ngày và đơn vị không? Hiện app tải mọi booking của chủ sân rồi lọc | Không. App lọc. Cần xem lại khi biết số booking mỗi ngày (mục 3) | Không | QA F-025 câu 1 |
| 35 | Lưới Lịch sân trên app có cần tách ô đã đặt (có tên khách), ô đã qua và ô trống ngắn hơn 1 giờ không? Cần đổi `SlotRow` | Không tách. Chi tiết ở "Booking trong ngày" | Không | QA F-025 câu 2, brief F-025 |
| 36 | `VERIFY_VENUE` trên live có phải là đơn vị thử riêng không? Luồng `verify-flow` để lại booking `CANCELLED`, mà tỉ lệ hủy đếm booking này | Có, một đơn vị thử riêng | Không | QA F-025 câu 3 |
| 37 | Chip ngày của Lịch sân trên app có cần "Hôm qua" và ô chọn ngày xa hơn 7 ngày không? | Không. 7 ngày từ hôm nay | Không | QA F-025 câu 4 |
| 38 | Lịch sân trên app có cần tự tải lại mỗi 15 giây không? | Không | Không | QA F-025 câu 5 |
| 39 | Tab Doanh thu của app có cần số giờ đã đặt và tỉ lệ lấp đầy của từng sân không? Cần đổi API, `packages/shared`, web và app | Không. Chỉ tổng của đơn vị | Không | QA F-026 câu 1 |
| 40 | Chủ sân có 2 đơn vị trở lên có cần mục "Tất cả đơn vị" với tổng doanh thu không? Cần một API mới | Không. Xem từng đơn vị | Không | QA F-026 câu 2 |
| 41 | Ảnh live của `verify-flow` có cần che số doanh thu và biểu đồ không? Luồng mở đơn vị đầu tiên, có thể là đơn vị thật | Che `[data-testid="metric-grid"]` và biểu đồ trên live | Không | QA F-026 câu 3 |
| 42 | App có cần thẻ "Giờ cao điểm / thường" như web không? | Không | Không | QA F-026 câu 4 |
| 43 | Tỉ lệ làm tròn tới số nguyên, hay một chữ số thập phân như web? | Số nguyên, và "<1%" khi lớn hơn 0 và nhỏ hơn 0,5% | Không | QA F-026 câu 5 |
| 44 | Giá trong "Chưa thu tiền" ghi "120.000đ" hay "120k"? | "120.000đ" | Không | QA F-026 câu 6 |
| 45 | Đăng ký bằng số điện thoại và mật khẩu có cần OTP xác minh số không? Cần đổi API, web, app và có phí SMS | Không cần OTP | Không | QA F-027 câu 1 |
| 46 | Đăng xuất có cần hủy phiên ở server không? Cookie bị chép dùng được 30 ngày. Cần lưu phiên hoặc đặt `sessionsValidFrom`, mọi thiết bị bị đăng xuất | Chỉ xóa cookie | Không | QA F-027 câu 2 |
| 47 | Tài khoản bị khóa có cần câu chỉ bước tiếp theo không? | Đổi câu thành "Tài khoản đã bị khóa. Liên hệ admin của MONSPORT" | Không | QA F-027 câu 3 |
| 48 | Admin đăng nhập trên app có cần nút "Đăng xuất" không? | Thêm nút "Đăng xuất" dưới link. Đã làm trong PR "fix: QA defects of F-027" | Không | QA F-027 câu 4 |
| 49 | Host có đổi được chế độ vào trận ("Vào ngay" hoặc "Host duyệt") sau khi mở trận không? | Không (BR-49) | Không | F-028 |
| 50 | Trận "Host duyệt" có tự duyệt người đã đá cùng host trước đó không? | Không | Không | F-028 |
| 51 | Phòng chờ của app có ẩn trận "Host duyệt" tới khi có brief app không? Hiện bấm "Vào trận" trên app gửi yêu cầu, nhưng app chưa hiện "Chờ duyệt" | Không ẩn | Không | F-028 |
| 52 | Duyệt intake V2 (`proposed`) và thứ tự W1 đến W7 của `docs/design/ke-hoach-v2.md`. W6 (thanh toán) và W7 (MCP) chưa làm khi bạn chưa duyệt | Agent làm W1 (F-028) trước, theo yêu cầu "bắt đầu làm" ngày 10/11/2026 | Không | V2 |

## Việc chỉ người dùng làm được

| Việc | Vì sao agent không làm được |
|---|---|
| Chạy `verify-flow` trên bản live và gửi kết quả | Cần máy và tài khoản của người dùng |
| Đặt `VERIFY_PLAYER2_PHONE` và `VERIFY_PLAYER2_PASSWORD` (một tài khoản `test-` thứ hai) để chạy luồng `lobby-approval` trên live | Luồng không tự đăng ký tài khoản trên live, vì số điện thoại có thể của người thật |
| Kiểm UC-14 (Web Push) trên máy Android thật. Lần thử ngày 21/10/2026 thất bại, sửa bởi PR #94 và #101, chưa có lần thử lại | Cần máy thật |
| Đăng nhập lại trên bản live sau lần deploy F-004 bước 2 (mỗi cookie một khóa) | Phiên của người dùng |

## Đã chốt

| # | Quyết định | Ngày | Nguồn |
|---|---|---|---|
| 7 | Chấp nhận F-004 và mở rộng: "accept F-004 (Thêm đề xuất gửi mã OTP để xác minh sdt, dù đăng nhập hoặc đăng kí bằng gmail thì phải xác minh sdt hoặc nếu đăng nhập bằng Zalo thì xác minh bằng zalo)". Tài khoản Google xác minh số bằng OTP qua SMS. Tài khoản Zalo xác minh qua Zalo | 23/10/2026 | người dùng |
| 10a | "làm theo cách hiện tại": bảng admin vẫn đếm người dùng tạo booking `APP`, vào trận, hoặc làm host trong tuần. Số lần đăng nhập (`User.lastLoginAt`) chỉ là đề xuất, chỉ làm khi người dùng đồng ý | 23/10/2026 | người dùng, F-016 |
