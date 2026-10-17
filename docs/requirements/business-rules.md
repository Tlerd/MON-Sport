---
ba_doc: business-rules
style: ste80
lang: vi
req_keyword: phải
---

# Quy tắc nghiệp vụ

Nguồn: `intake-monsport-v1.md`, mục Rules, Data và Assumptions (đã duyệt ngày 16/10/2026).

| ID | Rule Definition | Type of Rule | Static or Dynamic | Source |
|---|---|---|---|---|
| BR-1 | Hai booking "Chờ xác nhận" hoặc "Đã xác nhận" trên cùng một sân không được chồng giờ. Hai khung liền kề (19:00–20:00 và 20:00–21:00) được phép | constraint | static | Intake, Chặn trùng giờ |
| BR-2 | Giờ bắt đầu và giờ kết thúc của booking nằm trên lưới 30 phút | constraint | static | Intake, Lưới giờ và giá |
| BR-3 | Một booking dài ít nhất 1 giờ | constraint | static | Intake, Lưới giờ và giá |
| BR-4 | Giờ cao điểm bắt đầu lúc 17:00 và kết thúc lúc 22:00. Khoảng 30 phút bắt đầu lúc 22:00 là giờ thường | fact | dynamic | Intake, Lưới giờ và giá |
| BR-5 | Giá booking bằng tổng giá của các khoảng 30 phút trong booking. Mỗi khoảng lấy nửa giá theo giờ của khung giờ chứa nó | computation | static | Intake, Assumptions |
| BR-6 | Giá booking được tính lúc đặt. Đổi giá sau đó không làm đổi giá của booking đã có | constraint | static | Intake, Acceptance UC-11 |
| BR-7 | Hạn xác nhận là thời điểm sớm hơn trong hai thời điểm: lúc gửi cộng 2 giờ, và giờ bắt đầu trừ 1 giờ | computation | dynamic | Intake, Trạng thái của booking |
| BR-8 | Khi hạn xác nhận qua mà chủ sân chưa xác nhận, booking chuyển sang "Hết hạn" | action enabler | static | Intake, Trạng thái của booking |
| BR-9 | Không nhận yêu cầu đặt sân khi hạn xác nhận của nó đã qua lúc gửi | constraint | static | Intake, Assumptions |
| BR-10 | Booking chủ sân nhập cho khách gọi điện ở trạng thái "Đã xác nhận" ngay | fact | static | Intake, Trạng thái của booking |
| BR-11 | Người đặt tự hủy được booking "Đã xác nhận" khi còn từ 6 giờ trở lên tới giờ bắt đầu | constraint | dynamic | Intake, Trạng thái của booking |
| BR-12 | Người đặt tự hủy được booking "Chờ xác nhận" vào bất kỳ lúc nào trước giờ bắt đầu | constraint | static | Intake, Assumptions |
| BR-13 | Một trận gắn với đúng một booking "Chờ xác nhận" hoặc "Đã xác nhận" của host. Một booking có nhiều nhất một trận | constraint | static | Intake, Trạng thái của trận |
| BR-14 | Host chiếm 1 suất trong trận của mình | fact | static | Intake, Assumptions |
| BR-15 | Trận "Đầy" khi số người trong trận bằng số suất. Trận về "Mở" khi có người rời | computation | static | Intake, Trạng thái của trận |
| BR-16 | Khi booking của trận bị từ chối hoặc hết hạn, trận chuyển sang "Đã hủy" | action enabler | static | Intake, Trạng thái của trận |
| BR-17 | Khi host hủy trận, booking của trận chuyển sang "Đã hủy" | action enabler | static | Intake, Trạng thái của trận |
| BR-18 | Người ghép trận rời trận được tới giờ bắt đầu | constraint | static | Intake, Assumptions |
| BR-19 | Trận chuyển sang "Đã đá xong" khi qua giờ kết thúc của booking | action enabler | static | Intake, Assumptions |
| BR-20 | Chỉ chủ sân của booking và host của trận thấy số điện thoại của người dùng | constraint | static | Intake, Data |
| BR-21 | Doanh thu chỉ tính các booking "Đã xác nhận" có đánh dấu "đã thu tiền tại sân" | computation | static | Intake, UC-12 |
| BR-22 | Admin không xác nhận và không hủy booking | constraint | static | Intake, Phân quyền |
| BR-23 | Chủ sân chỉ xem và sửa dữ liệu của các đơn vị mình quản lý | constraint | static | Intake, Phân quyền |
| BR-24 | Một số điện thoại chỉ thuộc một tài khoản | constraint | static | Intake, Acceptance UC-1 |
| BR-25 | Tiền là số nguyên VND | fact | static | Intake, Data |
| BR-26 | Khi người dùng xóa tài khoản, tên và số điện thoại được thay bằng "Người dùng đã xóa". Booking và trận vẫn còn | action enabler | static | Intake, Data |
| BR-27 | Giờ hiển thị theo múi giờ `Asia/Ho_Chi_Minh` | fact | static | Intake, Lưới giờ và giá |
| BR-28 | Tài khoản bị admin khóa không đăng nhập được | constraint | static | Intake, Phân quyền |
| BR-29 | Người dùng tự đăng ký phải đồng ý với thông báo bảo vệ dữ liệu cá nhân. Hệ thống lưu lúc người dùng đồng ý | constraint | static | Giả định cho open item 4 của intake (Luật 91/2025), brief F-003 |
| BR-30 | Hệ thống giới hạn số lần thử: 10 lần đăng nhập mỗi số điện thoại và 30 lần đăng nhập mỗi IP trong 15 phút, 20 lần đăng ký mỗi IP trong 1 giờ. Đăng nhập đúng xóa bộ đếm của số đó | constraint | dynamic | Giả định cho mục Quality "Bảo mật" của intake, brief F-006 |
| BR-31 | Mật khẩu mới không được nằm trong danh sách mật khẩu phổ biến, chứa số điện thoại của tài khoản, hoặc chỉ có một ký tự lặp lại | constraint | static | Giả định cho mục Quality "Bảo mật" của intake, brief F-006 |
| BR-32 | Khi admin mở khóa tài khoản, các phiên tạo trước lúc mở khóa không còn hiệu lực | constraint | static | Giả định cho mục Phân quyền của intake (khóa tài khoản), brief F-006 |

## Assumptions

- Quy tắc giờ cao điểm: mốc 22:00 thuộc giờ thường. Bản intake chỉ ghi "17:00–22:00".
- Quy tắc lưới giờ: giờ kết thúc cũng nằm trên lưới 30 phút. Bản intake chỉ ghi bước 30 phút cho giờ bắt đầu.
- Quy tắc khóa tài khoản: tài khoản bị khóa không đăng nhập được. Bản intake chỉ ghi admin "khóa tài khoản".
- Quy tắc đồng ý lúc đăng ký: intake chưa trả lời Luật 91/2025 có yêu cầu đồng ý lúc đăng ký hay không (open item 4). Ô đồng ý bắt buộc là lựa chọn an toàn hơn. Bạn sửa quy tắc này khi có ý kiến của người tư vấn luật.
