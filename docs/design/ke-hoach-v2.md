# Kế hoạch V2 (web trước)

Trạng thái: bản nháp của Planner ngày 10/11/2026. Chờ Opus 5.5 review và bạn duyệt. Intake V2 chưa có, nên kế hoạch này chưa là nguồn sự thật. Nguồn sự thật vẫn là [intake V1](../requirements/intake-monsport-v1.md) (ADR 0002).

## Nguyên tắc

- Làm web trước. App mobile chỉ nhận một tính năng sau khi web của tính năng đó chạy ổn.
- V1 chưa khép hẳn. F-004 bước 4, F-018, thử Web Push trên Android và thử nghiệm thật vẫn chờ bạn. V2 không được làm hỏng các phần này.
- Trước brief đầu tiên của V2, Planner viết intake V2 (`docs/requirements/intake-monsport-v2.md`). Mỗi giả định ghi trong mục "Assumptions" của file đó.
- Chạm tới tiền, đồng thời, schema hoặc dữ liệu cá nhân thì dùng model mạnh nhất và skill `rule-review` (`AGENTS.md`).

## Phạm vi đề xuất

Mọi mục lấy từ bảng "Out of scope" của intake V1. Cột "Lý do cắt" ghi lý do V1 bỏ mục đó.

| # | Tính năng | Lý do cắt ở V1 | Đổi schema | Rủi ro |
|---|---|---|---|---|
| W1 | Hàng chờ và host duyệt người vào trận | Cắt B1: 3–4 ngày, thêm trạng thái | Có: trạng thái thành viên của trận | Đồng thời trên suất. Đổi BR-15 và BR-18 |
| W2 | Đặt cố định hằng tuần | Cắt B3: 3 ngày. Chủ sân nhập tay từng buổi | Có: chuỗi booking | Nhiều buổi dưới khóa `Court` (BR-6). Giá lưu lúc đặt |
| W3 | Tài khoản nhân viên của chủ sân | "Thêm sau nếu cần" | Có: vai trò và liên kết với đơn vị | Quyền truy cập. Dữ liệu cá nhân |
| W4 | Trình độ người chơi | "Chưa cần" | Có: một trường và bộ lọc | Thấp. Cần W1 để có ý nghĩa khi duyệt người vào trận |
| W5 | Điểm uy tín | Cắt B2: 3 ngày | Có: sự kiện và điểm | Cần W1 (rời trận, vắng mặt). Cần luật tính điểm từ bạn |
| W6 | Thanh toán trong app | "Bản đầu chỉ cần chạy được" | Có | Tiền và pháp lý. Cần ADR, nhà cung cấp và bạn duyệt |
| W7 | MCP cho AI đặt sân | Không có trong intake V1 | Có: token và client OAuth | Chờ bạn duyệt ADR 0008 (`HUMAN_DECISIONS.md`, dòng 26) |

Mục nhỏ của web, làm khi tiện (mặc định hiện chạy, `HUMAN_DECISIONS.md`):

- Dòng 33: lý do khi chủ sân từ chối. Đổi schema và thông báo.
- Dòng 39: số giờ đã đặt và tỉ lệ lấp đầy của từng sân.
- Dòng 40: mục "Tất cả đơn vị" với tổng doanh thu cho chủ sân có nhiều đơn vị.

## Thứ tự đề xuất

1. **W1 trước.** Phòng chờ là phần xã hội của sản phẩm, và V1 cắt nó chỉ vì thời gian. Không có tiền. Cả W4 và W5 cần W1.
2. **W2.** Chủ sân phải nhập tay từng buổi. Đây là việc lặp lại nhiều nhất của chủ sân.
3. **W3.** Cần khi một chủ sân có người trực sân.
4. **W4, rồi W5.** Cần W1 xong. W5 cần bạn chốt luật tính điểm.
5. **W6 và W7** chỉ bắt đầu khi bạn duyệt. Agent không code hai mục này khi chưa có duyệt.

Mỗi tính năng chia thành các bước theo quy ước `feat/<issue>-<step>-<slug>`: schema và hợp đồng, API, màn web, luồng `verify-flow`. Số brief bắt đầu từ F-028.

## Nợ của app mobile (ghi chú, chưa sửa)

Năm lỗi thấp của QA còn mở. Không chặn ra mắt. Chỉ sửa khi port tính năng V2 sang app, hoặc khi bạn yêu cầu.

| Lỗi | Màn | Việc còn lại |
|---|---|---|
| F-022 D-8 | Phòng chờ | Thêm bước "Vào trận" và "Rời trận" (BR-15, BR-18) vào `mobile-lobby.mjs`. Cần tài khoản thử thứ hai (`test-…`) |
| F-025 D-8 | Lịch sân | Thông báo sau khi lưu chỉ hiện trên các hàng sân. Cuộn tới thông báo, hoặc dùng toast (`ScheduleScreen.tsx:402-416`) |
| F-026 D-6 | Doanh thu | Doanh thu từng ngày không đọc được trên điện thoại. Bấm cột để hiện số tiền (`RevenueChart.tsx`) |
| F-026 D-7 | Doanh thu | Trạng thái trống không nói việc tiếp theo: "Liên hệ admin để tạo đơn vị" và "Chưa có doanh thu trong kỳ này" (`RevenueScreen.tsx`) |
| F-026 D-8 | Doanh thu | `ADMIN` mở `/app/chu-san/doanh-thu` thấy trang trắng. Chuyển tới `/app/` như `USER` (`RevenueScreen.tsx:274`) |

Mục "Việc chỉ người dùng làm được" và các dòng 11, 45, 46 của `HUMAN_DECISIONS.md` giữ nguyên.

## Cách chạy từ 10/11/2026

Yêu cầu của bạn ngày 10/11/2026: chạy hết trên máy, đẩy lên CI sau, tránh chờ CI.

- **Vai trò.** Opus 5.5 lên plan và review. Agy code qua `node scripts/agy-run.mjs`. Agy hoặc Sonnet chạy test. Hết quota agy (exit 4) thì dùng subagent `backend` hoặc `frontend` (Sonnet), như `agent-workflow` quy định.
- **Cổng cục bộ.** Mỗi bước phải pass `pnpm check` và `verify-flow` trên máy (`pnpm db:start`, `pnpm dev:api`, `pnpm dev:web`) trước khi tạo pull request.
- **Pull request.** Tạo pull request cho từng bước và chưa merge. Các bước xếp chồng: nhánh bước N tách từ nhánh bước N−1, và pull request N trỏ vào nhánh N−1. Không chờ CI giữa các bước.
- **Đẩy CI một lần.** Khi hết các bước của một tính năng, đẩy cả chồng lên. CI chạy một lượt trên runner `monsport-wsl`. Sửa lỗi CI rồi mới merge theo thứ tự bằng `node scripts/merge.mjs <n>`.
- **Giữ nguyên các luật "Never".** Không đẩy lên `main`, không merge khi check đỏ, không làm yếu `pnpm check`.

## Bước tiếp theo

1. Opus 5.5 review kế hoạch này. Bạn chọn lại thứ tự hoặc cắt mục nếu cần.
2. Planner viết intake V2 bản nháp, trạng thái `proposed`.
3. Planner viết brief F-028 cho W1 (issue và các bước theo `feature-brief`).
