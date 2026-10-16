---
style: ste80
lang: vi
---

# Intake: MONSPORT bản đầu

Status: accepted
Date: 2026-10-16. Bạn duyệt bản này và các giả định cùng ngày.
Source: phỏng vấn bằng skill `ba-intake`, 4 vòng hỏi và 1 vòng đề xuất, ngày 16/10/2026. Tài liệu cũ (`docs/spec/dac-ta-ky-thuat.md`, `docs/briefs/F-001-tao-tran-kem-dat-san.md`) chỉ dùng để gợi ý câu hỏi.

## Kết quả

Người dùng đặt sân trong app, và chủ sân xác nhận thủ công. App chưa thu tiền. Host mở trận trong phòng chờ, và người khác bấm xác nhận để vào trận. Chủ sân xem số liệu tài chính và giờ sân. Admin xem số liệu của toàn trang. Kết quả đúng khi một sân không bao giờ có hai booking trùng giờ, và số liệu khớp với booking thật.

Bản đầu chạy thử ở 3 đơn vị. Bản chạy thử sẽ thành bản thật, nên code, test và dữ liệu theo chuẩn bản thật.

## Tên gọi

| Tên | Nghĩa |
|---|---|
| Đơn vị | Một cơ sở kinh doanh sân. Một đơn vị có nhiều sân |
| Sân | Một đơn vị đặt riêng trong một đơn vị |
| Booking | Một khoảng giờ trên một sân |
| Trận | Một phòng chờ mà host mở trên một booking |
| Host | Người dùng mở trận |
| Người ghép trận | Người dùng vào trận của host khác |

## Users

| Nhóm | Làm gì | Quyết định gì |
|---|---|---|
| Admin | Chủ của trang web. Tạo tài khoản chủ sân, tạo đơn vị và sân, xem số liệu toàn trang | Khóa tài khoản |
| Chủ sân | Xác nhận hoặc từ chối yêu cầu đặt sân, nhập booking của khách gọi điện, xem số liệu tài chính | Booking nào được xác nhận |
| Người dùng | Đặt sân, mở trận, vào trận | — |

Một người dùng có thể vừa đặt sân, vừa là host, vừa là người ghép trận. Một tài khoản chủ sân quản lý một hoặc nhiều đơn vị.

## Use cases

Thứ tự theo giá trị.

| # | Nhóm | Use case |
|---|---|---|
| UC-1 | Người dùng | Đăng ký và đăng nhập bằng số điện thoại và mật khẩu |
| UC-2 | Người dùng | Chọn đơn vị, chọn sân, xem giờ còn trống. Tìm theo tên sân thì mở trang của đơn vị chứa sân đó |
| UC-3 | Người dùng | Gửi yêu cầu đặt sân |
| UC-4 | Chủ sân | Xác nhận hoặc từ chối yêu cầu đặt sân |
| UC-5 | Chủ sân | Nhập booking của khách gọi điện |
| UC-6 | Người dùng | Xem trạng thái yêu cầu, hủy booking, xem lịch sử đặt sân |
| UC-7 | Host | Mở trận trong phòng chờ trên một booking của mình |
| UC-8 | Người ghép trận | Xem phòng chờ, lọc theo môn và ngày, xem chi tiết trận, vào trận, rời trận, xem các trận mình đã vào |
| UC-9 | Host | Hủy trận |
| UC-10 | Admin | Tạo tài khoản chủ sân, tạo và sửa đơn vị và sân, khóa tài khoản |
| UC-11 | Chủ sân | Sửa giá và giờ mở cửa |
| UC-12 | Chủ sân | Xem dashboard tài chính (đề xuất M1) |
| UC-13 | Admin | Xem dashboard toàn trang (đề xuất M2) |
| UC-14 | Mọi nhóm | Nhận thông báo tức thì (đề xuất M3) |

### UC-2: chọn sân

- Trang đặt sân hiện thông báo: "App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt."
- Mỗi giờ còn trống có nút **Gọi chủ sân**.

### UC-7, UC-8: phòng chờ

Phòng chờ hoạt động như phòng chờ của lichess.com.

1. Host gửi yêu cầu đặt sân (UC-3).
2. Host mở trận trên yêu cầu đó, kể cả khi chủ sân chưa xác nhận. Trận gồm môn, số suất và giá mỗi suất.
3. Trận ghi rõ chủ sân "đã xác nhận" hay "chưa xác nhận".
4. Người ghép trận bấm xác nhận và vào trận ngay. Host không duyệt.
5. Phòng chờ tự cập nhật trong vòng 2 giây khi có trận mới, khi trận hết suất hoặc khi trận bị hủy.

### UC-12: dashboard chủ sân (M1)

- Doanh thu theo ngày, tuần và tháng.
- Số giờ đã đặt và tỉ lệ lấp đầy của từng sân.
- Biểu đồ nhiệt giờ cao điểm theo thứ và giờ.
- Tỉ lệ hủy và tỉ lệ từ chối.
- Khách quay lại.
- Mỗi booking có ô "đã thu tiền tại sân". Doanh thu chỉ tính các booking có ô này.

### UC-13: dashboard admin (M2)

- Số tài khoản theo vai trò.
- Người dùng mới và người dùng hoạt động theo tuần.
- Số booking và số trận theo từng đơn vị.
- Thời gian trung bình chủ sân xác nhận một yêu cầu.
- Tỉ lệ yêu cầu hết hạn vì chủ sân không xác nhận.

### UC-14: thông báo (M3)

| Sự kiện | Ai nhận |
|---|---|
| Có yêu cầu đặt sân mới | Chủ sân |
| Yêu cầu được xác nhận hoặc bị từ chối | Người đặt |
| Trận bị hủy | Mọi người trong trận |

Thông báo đi qua Web Push. Trên iPhone, người dùng phải "Thêm vào Màn hình chính" (iOS 16.4 trở lên).

## Out of scope

| Mục | Lý do |
|---|---|
| Thanh toán trong app | Bản đầu chỉ cần chạy được. Host và chủ sân thu tiền tại sân |
| Hàng chờ và bước host duyệt người vào trận | Cắt B1: giảm khoảng 3–4 ngày, ít trạng thái hơn |
| Điểm uy tín | Cắt B2: giảm khoảng 3 ngày |
| Đặt cố định hằng tuần | Cắt B3: giảm khoảng 3 ngày. Chủ sân nhập tay từng buổi |
| Trình độ người chơi | Bạn nói chưa cần ở thời điểm này |
| Tài khoản nhân viên của chủ sân | Thêm sau nếu cần |
| App Android và iOS | Làm web trước |
| Đăng nhập bằng OTP hoặc Zalo | Bản sau |

## Inputs and outputs

| Vào | Ra | Dạng |
|---|---|---|
| Thao tác của người dùng, chủ sân và admin | Các màn hình | Web, dùng tốt ở màn rộng 390px |
| Request | JSON | REST API, tiền tố `/api` |
| Thay đổi ở phòng chờ và ở danh sách yêu cầu | Sự kiện tức thì | Server-Sent Events |
| Sự kiện ở UC-14 | Thông báo | Web Push |

## Data

| Thứ được lưu | Loại | Giữ bao lâu |
|---|---|---|
| Tài khoản: tên, số điện thoại, vai trò | Dữ liệu cá nhân | Tới khi người dùng xóa tài khoản |
| Mật khẩu | Bí mật | Chỉ lưu bản băm argon2 |
| Đơn vị, sân, giờ mở cửa, giá | Dữ liệu kinh doanh | Lâu dài |
| Booking: sân, giờ, trạng thái, nguồn, giá, ô "đã thu tiền tại sân" | Tiền (chỉ ghi nhận, app không thu) | Lâu dài |
| Trận và người trong trận | Dữ liệu hoạt động | Lâu dài |
| Thông báo và đăng ký Web Push | Dữ liệu thiết bị | Tới khi người dùng hủy đăng ký |

- Chỉ chủ sân của booking và host của trận thấy số điện thoại của người dùng. Người ghép trận khác chỉ thấy tên.
- Khi người dùng xóa tài khoản, app thay tên và số điện thoại bằng "Người dùng đã xóa". Booking và trận vẫn còn để làm thống kê.
- Tiền là số nguyên VND.

## Rules

### Phân quyền

| Thao tác | Admin | Chủ sân | Người dùng |
|---|---|---|---|
| Xem mọi số liệu | có | chỉ đơn vị của mình | — |
| Tạo và khóa tài khoản | có | — | — |
| Tạo và sửa đơn vị và sân | có | — | — |
| Sửa giá và giờ mở cửa | có | chỉ đơn vị của mình | — |
| Xác nhận, từ chối, nhập booking | không | chỉ đơn vị của mình | — |
| Đặt sân, mở trận, vào trận | — | — | có |

Admin không xác nhận và không hủy booking thay chủ sân.

### Lưới giờ và giá

- Giờ bắt đầu chọn theo bước 30 phút.
- Sân bóng và sân cầu lông đặt tối thiểu 1 giờ.
- Giá theo giờ có 2 khung: giờ thường và giờ cao điểm (17:00–22:00).
- Giờ hiển thị theo `Asia/Ho_Chi_Minh`.

### Chặn trùng giờ

Hai booking ở trạng thái "chờ xác nhận" hoặc "đã xác nhận" trên cùng một sân không được chồng giờ. Hai khung liền kề (19:00–20:00 và 20:00–21:00) được phép.

### Trạng thái của booking

| Trạng thái | Giữ giờ | Đi tới |
|---|---|---|
| Chờ xác nhận | có | Đã xác nhận, Bị từ chối, Hết hạn, Đã hủy |
| Đã xác nhận | có | Đã hủy |
| Bị từ chối | không | — |
| Hết hạn | không | — |
| Đã hủy | không | — |

- Chủ sân phải xác nhận trong 2 giờ, và chậm nhất 1 giờ trước giờ đá. Quá hạn thì booking chuyển sang "Hết hạn".
- Booking chủ sân nhập cho khách gọi điện ở trạng thái "Đã xác nhận" ngay.
- Người dùng tự hủy booking đã xác nhận tới 6 giờ trước giờ đá. Muộn hơn thì phải gọi chủ sân.

### Trạng thái của trận

| Trạng thái | Nghĩa |
|---|---|
| Mở | Còn suất |
| Đầy | Hết suất. Có người rời thì về "Mở" |
| Đã hủy | Host hủy, hoặc booking bị từ chối hay hết hạn |
| Đã đá xong | Đã qua giờ kết thúc |

- Trận phải gắn với một booking "chờ xác nhận" hoặc "đã xác nhận" của host. Sân và giờ của trận lấy từ booking.
- Booking bị từ chối hoặc hết hạn thì trận tự hủy. Mọi người trong trận nhận thông báo "Sân không được xác nhận, trận đã hủy".
- Host hủy trận thì booking cũng bị hủy, và mọi người trong trận nhận thông báo.
- Hai người cùng bấm vào suất cuối thì chỉ một người vào được. Người kia nhận "Trận đã đủ người".
- App hiện giá mỗi suất. Host tự thu tiền tại sân. App không theo dõi ai đã trả tiền cho host.

## Volume

| | Lúc chạy thử | Sau 6 tháng |
|---|---|---|
| Đơn vị | 3 (1 sân bóng, 2 sân cầu lông) | 20 |
| Người dùng | 300 | 5.000 |
| Booking mỗi ngày | 50 | TBD |
| Request mỗi ngày (giả định 30 request cho một người dùng) | khoảng 9.000 | khoảng 150.000 |
| Request trung bình mỗi giây | khoảng 0,1 | khoảng 1,7 |
| Request mỗi giây giờ cao điểm (giả định gấp 5 lần trung bình) | khoảng 0,5 | khoảng 9 |

Ở cả hai mức, một máy chủ nhỏ và một cơ sở dữ liệu Postgres là đủ. Chưa cần cache.

## Quality

| Thuộc tính | Mục tiêu |
|---|---|
| Ngôn ngữ | Chỉ tiếng Việt |
| Thời gian tải trang | Dưới 2 giây trên 4G |
| Thời gian trả lời API | 95% request dưới 300 ms |
| Phòng chờ tức thì | Cập nhật trong vòng 2 giây |
| Thời gian chạy | 99,5% mỗi tháng |
| Bảo mật | HTTPS. Mật khẩu băm bằng argon2 |
| Sao lưu | Mỗi ngày |
| Thiết bị | Web trên điện thoại, màn rộng 390px trở lên |

## Constraints

| Ràng buộc | Giá trị |
|---|---|
| Nhân lực | 1 người làm cùng coding agent |
| Ngân sách hosting | Tối đa 500.000đ mỗi tháng |
| Hạn chót | TBD |
| Công nghệ | NestJS, React + Vite, PostgreSQL trên Supabase, Prisma 7, Zod. Tức thì dùng SSE |
| Biểu đồ | Recharts (đề xuất M1) |

## Acceptance

Mỗi ví dụ dùng sân "Sân 1" của đơn vị "Cầu lông A", ngày 20/11/2026, giờ `Asia/Ho_Chi_Minh`. Bạn đã duyệt các ví dụ này ngày 16/10/2026.

| UC | Ví dụ |
|---|---|
| UC-1 | Bạn đăng ký bằng `0901234567` và một mật khẩu. Bạn đăng nhập lại bằng đúng số và mật khẩu đó. Đăng ký lần hai bằng cùng số thì app báo số đã có tài khoản |
| UC-2 | Bạn tìm "Sân 1" và app mở trang "Cầu lông A". Booking 19:00–20:00 đã có, nên giờ đó không hiện là còn trống. Giờ 20:00–21:00 hiện là còn trống và có nút Gọi chủ sân |
| UC-3 | Bạn gửi yêu cầu đặt 20:00–21:00 lúc 10:00. Yêu cầu ở trạng thái "Chờ xác nhận". Giá là giá cao điểm |
| UC-3 | 50 người gửi yêu cầu đặt 20:00–21:00 cùng lúc. Đúng 1 yêu cầu được nhận. 49 yêu cầu bị báo "Khung giờ này vừa có người đặt" |
| UC-4 | Chủ sân xác nhận lúc 11:00 và yêu cầu chuyển sang "Đã xác nhận". Chủ sân không làm gì tới 12:00, thì yêu cầu chuyển sang "Hết hạn" và giờ 20:00–21:00 trống lại |
| UC-5 | Khách gọi điện đặt 17:00–18:00. Chủ sân nhập booking đó, và booking ở trạng thái "Đã xác nhận" ngay |
| UC-6 | Bạn hủy booking 20:00–21:00 lúc 13:00 thì được. Bạn hủy lúc 15:00 thì app báo phải gọi chủ sân |
| UC-7 | Bạn mở trận cầu lông 4 suất, giá 50.000đ mỗi suất, trên booking 20:00–21:00 đang chờ xác nhận. Phòng chờ hiện trận với nhãn "Chưa xác nhận" |
| UC-8 | Người thứ 4 bấm vào trận và trận chuyển sang "Đầy". Một người rời thì trận về "Mở". Hai người cùng bấm vào suất cuối thì một người nhận "Trận đã đủ người" |
| UC-8 | Một người mở trận ở máy A. Máy B đang mở phòng chờ thấy trận mới trong vòng 2 giây mà không cần tải lại trang |
| UC-9 | Bạn hủy trận. Booking chuyển sang "Đã hủy", và 3 người trong trận nhận thông báo |
| UC-10 | Admin tạo tài khoản chủ sân cho "Cầu lông A" với 2 sân. Chủ sân đăng nhập và chỉ thấy đơn vị của mình |
| UC-11 | Chủ sân đổi giá cao điểm từ 120.000đ thành 150.000đ. Booking mới dùng giá mới. Booking cũ giữ giá cũ |
| UC-12 | Trong tuần có 10 booking 1 giờ, giá 120.000đ, và 8 booking được đánh dấu "đã thu tiền tại sân". Doanh thu tuần là 960.000đ |
| UC-13 | Có 3 chủ sân và 40 người dùng. Dashboard admin ghi đúng 3 chủ sân và 40 người dùng |
| UC-14 | Bạn gửi yêu cầu đặt sân. Điện thoại của chủ sân nhận Web Push trong vòng 30 giây |

## Assumptions

- Một người dùng dùng khoảng 30 request mỗi ngày. Giờ cao điểm có lượng request gấp 5 lần trung bình.
- Host chiếm 1 suất trong trận.
- Người ghép trận rời trận được tới giờ đá.
- Người dùng hủy được yêu cầu "Chờ xác nhận" vào bất kỳ lúc nào.
- Nếu yêu cầu được gửi trong vòng 1 giờ trước giờ đá, app không nhận yêu cầu đó và đề nghị gọi chủ sân.
- Giá của booking được tính lúc đặt và lưu lại. Booking qua mốc 17:00 hoặc 22:00 thì tính giá theo từng khoảng 30 phút.
- App có danh sách thông báo trong app, cùng với Web Push.
- Thứ tự ra mắt: UC-1, UC-10, UC-11 → UC-2 đến UC-6 → UC-7 đến UC-9 → UC-14 → UC-12, UC-13.
- Booking chủ sân nhập cho khách gọi điện lưu tên khách và số điện thoại, cả hai không bắt buộc.
- Trận chuyển sang "Đã đá xong" một cách tự động khi qua giờ kết thúc.

## Open items

| # | Mục | Ai trả lời |
|---|---|---|
| 1 | Số sân của từng đơn vị, loại sân bóng (5 người hay 7 người), và thành phố | Bạn |
| 2 | Ngày chạy thử | Bạn |
| 3 | Số booking mỗi ngày sau 6 tháng | Bạn |
| 4 | Yêu cầu của Luật Bảo vệ dữ liệu cá nhân (Luật 91/2025, theo đặc tả cũ §4.3.1) về việc xin đồng ý lúc đăng ký | Bạn, với người tư vấn luật |
