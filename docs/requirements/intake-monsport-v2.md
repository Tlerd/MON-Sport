---
style: ste80
lang: vi
---

# Intake: MONSPORT V2

Status: proposed

Date: 2026-11-10. Planner viết bản nháp. Bạn chưa duyệt.

Mọi quyết định ở mục "Assumptions" là mặc định của agent, chờ bạn sửa.

Source: bảng "Out of scope" của `intake-monsport-v1.md` và `docs/design/ke-hoach-v2.md`.

V1 vẫn là nguồn sự thật cho mọi thứ V2 không đổi (ADR 0002). Khi bạn duyệt file này, trạng thái chuyển sang `accepted`.

## Kết quả

Người chơi ghép trận có kiểm soát: host chọn ai vào trận. Chủ sân đặt cố định hằng tuần mà không nhập tay từng buổi. Chủ sân giao việc cho nhân viên mà không chia sẻ mật khẩu. Người chơi chọn trận theo trình độ và theo uy tín của người khác.

Kết quả đúng khi các luật V1 giữ nguyên: không có hai booking trùng giờ trên một sân (BR-1), và không có trận nào vượt số suất (BR-15). Làm theo từng đợt W1 đến W5. Mỗi đợt chạy được riêng.

## Phạm vi V2

| Đợt | Tính năng | Use case |
|---|---|---|
| W1 | Hàng chờ và host duyệt người vào trận | UC-7 và UC-8 đổi. UC-15 mới |
| W2 | Đặt cố định hằng tuần | UC-16 |
| W3 | Tài khoản nhân viên của chủ sân | UC-17 |
| W4 | Trình độ người chơi | UC-18 |
| W5 | Điểm uy tín | UC-19 |

Thanh toán trong app (W6) và MCP (W7) chưa vào V2 cho tới khi bạn duyệt. Xem "Out of scope".

## Tên gọi mới

| Tên | Nghĩa |
|---|---|
| Chế độ vào trận | "Vào ngay" (như V1) hoặc "Host duyệt". Host chọn lúc mở trận |
| Yêu cầu vào trận | Người ghép trận xin một suất trong trận "Host duyệt". Yêu cầu chưa giữ suất |
| Hàng chờ | Các yêu cầu vào trận đang chờ host, xếp theo thời điểm gửi |

## W1: hàng chờ và host duyệt

### Cách hoạt động

1. Host mở trận (UC-7) và chọn chế độ vào trận. Mặc định là "Vào ngay", giống V1.
2. Trận "Vào ngay": người ghép trận vào ngay, như UC-8 của V1.
3. Trận "Host duyệt": người ghép trận bấm "Xin vào". Hệ thống tạo một yêu cầu vào trận "Chờ duyệt". Yêu cầu không giữ suất.
4. Host thấy hàng chờ của trận. Host bấm "Duyệt" hoặc "Từ chối" cho từng yêu cầu (UC-15).
5. "Duyệt": nếu trận còn suất, người đó có một suất và yêu cầu thành "Đã duyệt". Nếu trận đã đầy, hệ thống từ chối và hiện "Trận đã đủ người". Yêu cầu vẫn "Chờ duyệt".
6. "Từ chối": yêu cầu thành "Bị từ chối". Người đó không xin lại trận này.
7. Người xin hủy được yêu cầu "Chờ duyệt" của mình, và xin lại sau đó.
8. Người đã có suất rời trận như V1 (BR-18). Có suất trống thì host duyệt tiếp được.
9. Yêu cầu "Chờ duyệt" hết hạn khi trận bị hủy hoặc bắt đầu (BR-52). Hết hạn thì host không thấy yêu cầu và người xin không thấy "Chờ duyệt".
10. Trận "Host duyệt" đã "Đầy" vẫn nhận yêu cầu mới. Đó là hàng chờ.

### Luật mới (đề xuất)

| # | Luật |
|---|---|
| BR-49 | Trận có một chế độ vào trận: "Vào ngay" hoặc "Host duyệt". Host chọn lúc mở trận và không đổi sau đó |
| BR-50 | Yêu cầu vào trận không giữ suất. Chỉ khi host duyệt, người đó mới có suất, và chỉ khi trận còn suất. Kiểm tra và thêm người dưới cùng một khóa với BR-15 |
| BR-51 | Người bị host từ chối không gửi lại yêu cầu vào trận đó |
| BR-52 | Yêu cầu "Chờ duyệt" hết hạn khi trận không còn "Mở" hoặc "Đầy", hoặc khi đã qua giờ bắt đầu. Trận "Đầy" không làm yêu cầu hết hạn. Mọi chỗ đọc yêu cầu áp dụng cùng quy tắc này |

BR-33 đến BR-48 đã có trong `business-rules.md` (đăng nhập Google và OTP). Các luật mới của V2 bắt đầu từ BR-49.

BR-20 áp dụng cho yêu cầu: host thấy số điện thoại của người xin.

### Thông báo (đổi UC-14)

| Sự kiện | Ai nhận |
|---|---|
| Có yêu cầu vào trận mới | Host |
| Yêu cầu được duyệt hoặc bị từ chối | Người xin |

### Acceptance (mức intake)

- Hai host duyệt cùng lúc hai người vào suất cuối: một người có suất, người kia nhận "Trận đã đủ người".
- Trận "Vào ngay" của V1 chạy như cũ. Các test hiện có của UC-8 vẫn pass.
- Yêu cầu bị từ chối không gửi lại được. Yêu cầu bị hủy gửi lại được.
- Phòng chờ hiện đúng chế độ của từng trận, trong vòng 2 giây sau khi trận đổi.

## W2 đến W5 (mô tả ngắn, chi tiết khi tới lượt)

| Đợt | Hướng đi | Chốt trước brief |
|---|---|---|
| W2 | Chủ sân chọn sân, giờ, ngày bắt đầu và số tuần. Hệ thống tạo một booking cho mỗi tuần, qua cùng khóa `Court` (BR-6) | Buổi bị trùng giờ: bỏ buổi đó và báo, hay hủy cả chuỗi |
| W3 | Chủ sân tạo tài khoản nhân viên cho đơn vị của mình. Nhân viên xác nhận yêu cầu và nhập booking. Không xem doanh thu, không sửa giá | Nhân viên có xóa được booking không |
| W4 | Người chơi chọn một trong ba mức khi đăng ký. Phòng chờ lọc trận theo mức | Số mức và tên mỗi mức |
| W5 | Host chấm điểm người đã đá cùng. Điểm hiện trong yêu cầu vào trận | Luật tính điểm và vắng mặt |

## Assumptions

- Mọi luật V1 giữ nguyên. V2 chỉ thêm luật.
- Chế độ mặc định của trận là "Vào ngay". Host cũ và trận cũ không đổi hành vi.
- Chế độ vào trận không đổi sau khi mở trận. Lý do: đổi chế độ lúc đang có người ở hàng chờ tạo thêm trạng thái.
- Yêu cầu vào trận không giữ suất. Lý do: giữ suất cho yêu cầu chưa duyệt làm trận trông đầy khi chưa đầy.
- Người bị từ chối không xin lại. Lý do: tránh gửi lặp.
- Yêu cầu "Chờ duyệt" hết hạn một cách lazy, khi có người đọc, giống `GET /api/bookings/mine`. Không thêm công việc nền.
- Host thấy số điện thoại của người xin, theo BR-20.

## Open items

| # | Mục | Ai trả lời |
|---|---|---|
| 1 | Duyệt thứ tự W1 đến W5 | Bạn |
| 2 | Host có đổi được chế độ vào trận sau khi mở không | Bạn. Mặc định: không |
| 3 | Trận "Host duyệt" có tự duyệt người đã đá cùng host trước đó không | Bạn. Mặc định: không |
| 4 | Các mục "Chốt trước brief" của W2 đến W5 | Bạn |

## Out of scope

| Mục | Lý do |
|---|---|
| Thanh toán trong app (W6) | Cần ADR, nhà cung cấp và pháp lý. Bạn duyệt trước khi bắt đầu |
| MCP cho AI đặt sân (W7) | Chờ bạn duyệt ADR 0008 (`HUMAN_DECISIONS.md`, dòng 26) |
| App native Android và iOS (qua store) | Như V1. App mobile là PWA |
| App mobile cho W1 đến W5 | Làm sau khi web của từng đợt chạy ổn |
