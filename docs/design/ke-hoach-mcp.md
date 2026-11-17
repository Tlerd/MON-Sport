# Kế hoạch MCP (`apps/api/src/modules/mcp`)

**Kế hoạch này chỉ có hiệu lực sau khi ADR 0008 được duyệt (Accepted) và intake đổi.** Intake hiện không nói về MCP hay AI agent. Xem [ADR 0008](../adr/0008-mcp-cho-ai-dat-san.md).

MCP (Model Context Protocol) cho một AI gọi các chức năng của web như công cụ. Kế hoạch này làm một máy chủ MCP với hai cách nối.

## Mục tiêu

1. **AI tự đặt lịch.** Một AI agent tìm sân, xem giờ trống và gửi yêu cầu đặt sân thay người dùng.
2. **Người biết dùng AI tự nối.** Người dùng thêm một connector vào Claude hoặc một client MCP khác, bằng một đường dẫn. Họ đăng nhập MONSPORT và cho phép. Sau đó AI hành động bằng tài khoản của họ.

Hai mục tiêu dùng chung một lớp công cụ. Chỉ khác cách xác thực.

## Không đổi luật

- AI gọi cùng service với web và app. Không có luật riêng cho AI.
- Yêu cầu đặt sân qua AI vẫn ở trạng thái chờ. Chủ sân vẫn xác nhận bằng tay (UC-4).
- Mọi luật BR giữ nguyên: khóa `Court` (BR-6), hạn xác nhận, hủy (BR-11, BR-12), giới hạn tần suất (BR-30), thu hồi phiên (BR-32).
- Bản đầu không có thanh toán, nên AI không trả tiền.

## Công cụ (vai trò người dùng)

| Công cụ | UC | Loại | Ghi chú |
|---|---|---|---|
| `search_venues` | UC-2 | đọc | Lọc theo môn và tên sân. Nhận thêm `lat`, `lng`, `radiusKm` (mục "Định vị GPS") |
| `get_availability` | UC-2 | đọc | Theo sân và ngày, như `GET /api/courts/:id/availability` |
| `request_booking` | UC-3 | ghi | Trả về hạn chủ sân xác nhận. Kèm số của chủ sân để AI nhắc người dùng gọi (UC-2) |
| `list_my_bookings` | UC-6 | đọc | |
| `cancel_booking` | UC-6 | ghi | |
| `list_matches` | UC-8 | đọc | Phòng chờ |
| `open_match` | UC-7 | ghi | |
| `join_match` và `leave_match` | UC-8 | ghi | |

- Mỗi công cụ ghi có chú thích `destructiveHint` và mô tả rõ hậu quả, để client hỏi người dùng trước khi chạy.
- Chủ sân và admin chưa có công cụ ở bản đầu. Xem mục 27 của `HUMAN_DECISIONS.md`.
- Tên và tham số công cụ lấy từ Zod schema trong `packages/shared`. Đó là một nguồn cho hợp đồng.

## Định vị GPS và sân trong bán kính 20 km

Người dùng cho phép lấy vị trí. Hệ thống liệt kê các sân trong bán kính 20 km, gần nhất trước. Tính năng này chạy cho web, app và AI. Nó không chỉ thuộc về MCP.

**Hiện trạng.** `Venue` chỉ có `address` (chuỗi). Chưa có tọa độ. Phải thêm tọa độ trước khi tìm theo khoảng cách.

**Dữ liệu.**
- Thêm `latitude` và `longitude` (kiểu số thực, có thể rỗng) vào `Venue`. Đổi schema nên cần reviewer mạnh nhất.
- Chủ sân đặt tọa độ khi tạo hoặc sửa đơn vị. Cách nhập: bấm "Dùng vị trí hiện tại" hoặc chọn trên bản đồ.
- Sân chưa có tọa độ không xuất hiện trong kết quả theo bán kính. Chúng vẫn xuất hiện khi tìm theo tên.

**Tìm kiếm.**
- `GET /api/venues` nhận thêm `lat`, `lng`, `radiusKm`. Mặc định `radiusKm` là 20. Giá trị tối đa là 20.
- Kết quả có thêm `distanceKm` và xếp theo khoảng cách tăng dần.
- Tính khoảng cách bằng công thức haversine trong SQL. Lọc trước bằng hộp giới hạn (bounding box) trên hai cột tọa độ, rồi mới tính haversine. Với số sân hiện tại, chưa cần PostGIS.
- Công cụ `search_venues` của MCP gọi cùng service. AI truyền `lat` và `lng` mà người dùng cung cấp.

**Giao diện.**
- Web dùng `navigator.geolocation`. App mobile (PWA, ADR 0006) dùng cùng API.
- Chỉ hỏi quyền vị trí khi người dùng bấm "Gần tôi". Không hỏi khi mở trang.
- Nếu người dùng từ chối, hiện ô chọn khu vực hoặc tìm theo tên. Không chặn màn hình.

**Riêng tư (BR-29, luật 91/2025).**
- Vị trí người dùng là dữ liệu cá nhân. Server chỉ dùng `lat` và `lng` trong một request để tính khoảng cách. Không lưu, không ghi vào log.
- Không đưa tọa độ chính xác của người dùng vào kết quả hay vào dữ liệu trả cho AI.
- Màn "Cho phép" của connector nêu rõ: AI có thể gửi vị trí của người dùng khi tìm sân.

**Giả định, chờ chủ dự án duyệt.**
- Bán kính 20 km là giới hạn cứng ở server. Người dùng không tăng được.
- Khoảng cách tính theo đường chim bay, không theo đường đi.
- Chưa có bản đồ trong bản đầu. Danh sách có `distanceKm` là đủ.

## Hai cách nối

| | Cách A: mã truy cập cá nhân (PAT) | Cách B: connector từ xa |
|---|---|---|
| Dành cho | Người dán mã vào client MCP, ví dụ Claude Code | Người dùng Claude và các client MCP |
| Giao thức | Streamable HTTP tại `/api/mcp`, header `Authorization: Bearer` (brief F-037) | Streamable HTTP tại `/api/mcp` |
| Xác thực | Mã truy cập cá nhân (PAT) | OAuth 2.1, mã cấp phép với PKCE |
| Người dùng làm | Tạo PAT ở mục "Kết nối AI" của trang "Hồ sơ" (`/ho-so`), chạy lệnh `claude mcp add` | Dán URL, đăng nhập, bấm "Cho phép" |

- Cách B là cách cho người không rành kỹ thuật. Cách A là bước đệm rẻ để thử các công cụ.
- Cả hai cách ánh xạ về một `userId`. Từ đó guard và service chạy như request thường.
- Token chỉ lưu dạng băm. Token có hạn, có phạm vi (`read`, `book`), và thu hồi được.
- Một lần mở khóa của admin thu hồi mọi token cũ của người dùng, qua `User.sessionsValidFrom` (BR-32).
- Người dùng xem và thu hồi từng kết nối ở mục "Kết nối AI" của trang "Hồ sơ".

## Rủi ro và cách giữ an toàn

| Rủi ro | Cách giữ |
|---|---|
| AI đặt nhiều lần một lúc | Giới hạn theo người dùng trong `AuthThrottle`, tính chung mọi token (BR-58, brief F-037). Mỗi người dùng có tối đa số yêu cầu chờ như BR hiện có |
| Dữ liệu lạ trong tên sân thành lệnh cho AI | Công cụ trả dữ liệu có cấu trúc. Không trả chuỗi tự do của người dùng khác mà không đánh dấu là dữ liệu |
| Token bị lộ | Chỉ lưu băm, hạn ngắn, thu hồi từng token, phạm vi nhỏ nhất |
| Đồng ý dữ liệu cá nhân (BR-29, luật 91/2025) | Màn "Cho phép" nêu rõ dữ liệu nào AI đọc. Câu hỏi 4 của `HUMAN_DECISIONS.md` đang mở |
| Hai giao diện cho một luật | Công cụ gọi service. Không chép luật |

## Thứ tự làm

1. **Duyệt ADR 0008 và sửa intake.** Thêm "MCP cho AI" vào phạm vi, và một UC mới.
1b. **Định vị GPS và tìm trong 20 km.** Một brief riêng, làm được trước MCP. Thêm tọa độ vào `Venue`, ô nhập của chủ sân, tham số `lat`, `lng`, `radiusKm` cho `GET /api/venues`, và nút "Gần tôi". Chạm schema và dữ liệu cá nhân, nên chạy thêm `rule-review`. Intake cần thêm một UC và một BR cho bán kính 20 km.
2. **Lớp công cụ.** Module `mcp` trong API, schema trong `packages/shared`, test `AC-n` cho từng công cụ. Chưa có xác thực ngoài, chỉ test với một `userId` giả.
3. **PAT và cách A.** Bảng token (đổi schema, cần reviewer mạnh nhất), mục "Kết nối AI" ở `/ho-so`, `POST /api/mcp`. Đã xong (brief F-037). Không có lệnh stdio (`HUMAN_DECISIONS.md`, dòng 70).
4. **OAuth và cách B.** Điểm cuối OAuth (metadata, đăng ký client, cấp phép, token), màn "Cho phép", dùng lại `POST /api/mcp`.
5. **Deploy và thử thật.** Nối bằng connector của Claude trên bản live. Người dùng chạy bước này, vì cần tài khoản của họ. Viết hướng dẫn "Nối MONSPORT với AI" bằng tiếng Việt.

Mỗi bước là một brief và một pull request, theo `AGENTS.md`. Các bước 3 và 4 chạm vào tiền, dữ liệu cá nhân và schema nên chạy thêm `rule-review`.

## Việc kiểm tra trước khi code

- Đọc đặc tả MCP hiện hành và tài liệu SDK bằng Context7 hoặc nguồn chính. Kế hoạch này chưa kiểm phiên bản đặc tả, đường dẫn metadata OAuth, hay yêu cầu của từng client.
- Kiểm Cloud Run có giữ được kết nối Streamable HTTP và SSE như thiết lập hiện tại (ADR 0005). Nếu không, dùng chế độ không giữ kết nối.
