---
ba_doc: use-cases
style: ste80
lang: vi
req_keyword: phải
---

# Use case MONSPORT bản đầu

Nguồn: `intake-monsport-v1.md` (đã duyệt ngày 16/10/2026). Quy tắc nằm trong `business-rules.md`. Thuật ngữ nằm trong `glossary.md`. Mọi use case do Claude viết ngày 16/10/2026. Tần suất tính theo mức chạy thử: 300 người dùng và 50 booking mỗi ngày.

## Use Case List

| Primary Actor | Use cases |
|---|---|
| Người dùng | UC-1 Đăng ký và đăng nhập · UC-2 Chọn sân và xem giờ trống · UC-3 Gửi yêu cầu đặt sân · UC-6 Xem và hủy booking |
| Chủ sân | UC-4 Xác nhận hoặc từ chối booking · UC-5 Nhập booking của khách gọi điện · UC-11 Sửa giá và giờ mở cửa · UC-12 Xem dashboard tài chính |
| Host | UC-7 Mở trận · UC-9 Hủy trận |
| Người ghép trận | UC-8 Vào và rời trận |
| Admin | UC-10 Quản lý tài khoản và đơn vị · UC-13 Xem dashboard toàn trang |
| Hệ thống | UC-14 Gửi thông báo |

## UC-1 Đăng ký và đăng nhập

| Row | Content |
|---|---|
| Primary Actor, Secondary Actors | Người dùng · — |
| Trigger | Người dùng mở app khi chưa đăng nhập |
| Description | Người dùng tạo tài khoản bằng số điện thoại và mật khẩu, rồi đăng nhập. Sau khi đăng nhập, người dùng dùng được các use case khác |
| Preconditions | PRE-1: người dùng chưa đăng nhập |
| Postconditions | POST-1: người dùng đã đăng nhập và có một phiên |
| Normal Flow | 1.0 Đăng ký<br>1. Người dùng nhập tên, số điện thoại và mật khẩu.<br>2. Hệ thống tạo tài khoản vai trò người dùng.<br>3. Hệ thống đăng nhập người dùng |
| Alternative Flows | 1.1 Đăng nhập: người dùng đã có tài khoản và nhập số điện thoại cùng mật khẩu ở bước 1. Hệ thống đăng nhập người dùng |
| Exceptions | 1.0.E1 Số điện thoại đã có tài khoản: hệ thống báo số đã có tài khoản (BR-24).<br>1.1.E1 Sai số điện thoại hoặc mật khẩu: hệ thống báo sai thông tin, không nói phần nào sai.<br>1.1.E2 Tài khoản bị khóa: hệ thống từ chối đăng nhập (BR-28) |
| Priority | High |
| Frequency of Use | Khoảng 30 lần đăng nhập mỗi ngày |
| Business Rules | BR-24, BR-28 |
| Other Information | Mật khẩu được băm bằng argon2 |
| Assumptions | Chủ sân và admin đăng nhập ở cùng màn hình |

## UC-2 Chọn sân và xem giờ trống

| Row | Content |
|---|---|
| Primary Actor, Secondary Actors | Người dùng · Chủ sân (nhận cuộc gọi) |
| Trigger | Người dùng muốn đặt sân |
| Description | Người dùng chọn đơn vị, chọn sân, rồi xem giờ còn trống trong một ngày. Người dùng gọi được chủ sân từ mỗi giờ còn trống |
| Preconditions | PRE-2: có ít nhất một đơn vị có sân |
| Postconditions | POST-2: người dùng thấy giờ còn trống của sân đã chọn |
| Normal Flow | 2.0<br>1. Người dùng mở danh sách đơn vị.<br>2. Người dùng chọn một đơn vị.<br>3. Hệ thống hiện các sân của đơn vị và thông báo "App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt."<br>4. Người dùng chọn một sân và một ngày.<br>5. Hệ thống hiện các giờ còn trống trong giờ mở cửa. Mỗi giờ có nút Gọi chủ sân |
| Alternative Flows | 2.1 Tìm theo tên sân: ở bước 1, người dùng tìm tên sân. Hệ thống mở trang của đơn vị chứa sân đó, rồi tới bước 3 |
| Exceptions | 2.0.E1 Sân không còn giờ trống trong ngày: hệ thống báo hết giờ trống và đề nghị chọn ngày khác |
| Priority | High |
| Frequency of Use | Khoảng 200 lần xem mỗi ngày |
| Business Rules | BR-1, BR-2, BR-27 |
| Other Information | Giờ trống là giờ mở cửa trừ các booking "Chờ xác nhận" và "Đã xác nhận" |
| Assumptions | Người dùng chưa đăng nhập cũng xem được giờ trống |

## UC-3 Gửi yêu cầu đặt sân

| Row | Content |
|---|---|
| Primary Actor, Secondary Actors | Người dùng · Chủ sân |
| Trigger | Người dùng chọn một khung giờ còn trống |
| Description | Người dùng gửi yêu cầu đặt một khung giờ trên một sân. Hệ thống giữ khung giờ đó cho tới khi chủ sân trả lời hoặc hạn xác nhận qua |
| Preconditions | PRE-3: người dùng đã đăng nhập |
| Postconditions | POST-3: có một booking "Chờ xác nhận" với giá và hạn xác nhận |
| Normal Flow | 3.0<br>1. Người dùng chọn giờ bắt đầu và giờ kết thúc.<br>2. Hệ thống hiện giá booking.<br>3. Người dùng gửi yêu cầu.<br>4. Hệ thống tạo booking "Chờ xác nhận", tính hạn xác nhận và báo chủ sân (UC-14) |
| Alternative Flows | — |
| Exceptions | 3.0.E1 Khung giờ vừa có người đặt: hệ thống báo "Khung giờ này vừa có người đặt" (BR-1).<br>3.0.E2 Giờ không nằm trên lưới hoặc ngắn hơn 1 giờ: hệ thống từ chối (BR-2, BR-3).<br>3.0.E3 Hạn xác nhận đã qua: hệ thống từ chối và đề nghị gọi chủ sân (BR-9) |
| Priority | High |
| Frequency of Use | 50 lần mỗi ngày |
| Business Rules | BR-1, BR-2, BR-3, BR-4, BR-5, BR-6, BR-7, BR-9 |
| Other Information | 50 yêu cầu song song cho cùng khung giờ: đúng 1 yêu cầu thành công. Không có booking nào được tạo một nửa |
| Assumptions | — |

## UC-4 Xác nhận hoặc từ chối booking

| Row | Content |
|---|---|
| Primary Actor, Secondary Actors | Chủ sân · Người dùng |
| Trigger | Có booking "Chờ xác nhận" trên một sân của chủ sân |
| Description | Chủ sân xem danh sách yêu cầu, rồi xác nhận hoặc từ chối từng yêu cầu. Danh sách tự cập nhật |
| Preconditions | PRE-4: chủ sân đã đăng nhập |
| Postconditions | POST-4: booking ở trạng thái "Đã xác nhận" hoặc "Bị từ chối", và người đặt nhận thông báo |
| Normal Flow | 4.0<br>1. Chủ sân mở danh sách yêu cầu.<br>2. Hệ thống hiện các booking "Chờ xác nhận" của các đơn vị của chủ sân.<br>3. Chủ sân xác nhận một booking.<br>4. Hệ thống chuyển booking sang "Đã xác nhận" và báo người đặt (UC-14) |
| Alternative Flows | 4.1 Từ chối: ở bước 3, chủ sân từ chối. Hệ thống chuyển booking sang "Bị từ chối", hủy trận gắn với nó (BR-16) và báo người đặt |
| Exceptions | 4.0.E1 Hạn xác nhận đã qua: booking đã "Hết hạn", hệ thống không cho xác nhận (BR-8)<br>4.0.E2 Người đặt vừa hủy: hệ thống báo booking đã hủy |
| Priority | High |
| Frequency of Use | 50 lần mỗi ngày |
| Business Rules | BR-7, BR-8, BR-16, BR-23 |
| Other Information | Danh sách cập nhật trong vòng 2 giây khi có yêu cầu mới |
| Assumptions | — |

## UC-5 Nhập booking của khách gọi điện

| Row | Content |
|---|---|
| Primary Actor, Secondary Actors | Chủ sân · — |
| Trigger | Khách gọi điện cho chủ sân để đặt sân |
| Description | Chủ sân nhập khung giờ mà khách đặt qua điện thoại, để lịch trong app đúng với lịch thật |
| Preconditions | PRE-5: chủ sân đã đăng nhập |
| Postconditions | POST-5: có một booking "Đã xác nhận" nguồn điện thoại |
| Normal Flow | 5.0<br>1. Chủ sân chọn sân, giờ bắt đầu và giờ kết thúc. Chủ sân có thể nhập tên và số điện thoại của khách.<br>2. Hệ thống tạo booking "Đã xác nhận" (BR-10) |
| Alternative Flows | — |
| Exceptions | 5.0.E1 Khung giờ trùng một booking khác: hệ thống báo "Khung giờ này vừa có người đặt" (BR-1) |
| Priority | High |
| Frequency of Use | Khoảng 20 lần mỗi ngày |
| Business Rules | BR-1, BR-2, BR-3, BR-5, BR-10, BR-23 |
| Other Information | — |
| Assumptions | Tên và số điện thoại của khách không bắt buộc |

## UC-6 Xem và hủy booking

| Row | Content |
|---|---|
| Primary Actor, Secondary Actors | Người dùng · Chủ sân |
| Trigger | Người dùng mở trang booking của mình |
| Description | Người dùng xem trạng thái và lịch sử các booking của mình, và hủy một booking khi quy tắc cho phép |
| Preconditions | PRE-6: người dùng đã đăng nhập |
| Postconditions | POST-6: booking được hủy ở trạng thái "Đã hủy", và giờ đó trống lại |
| Normal Flow | 6.0<br>1. Người dùng mở danh sách booking.<br>2. Hệ thống hiện các booking cùng trạng thái, mới nhất trước.<br>3. Người dùng hủy một booking.<br>4. Hệ thống chuyển booking sang "Đã hủy" và hủy trận gắn với nó |
| Alternative Flows | — |
| Exceptions | 6.0.E1 Booking "Đã xác nhận" còn dưới 6 giờ tới giờ bắt đầu: hệ thống từ chối và đề nghị gọi chủ sân (BR-11) |
| Priority | High |
| Frequency of Use | Khoảng 100 lần xem và 5 lần hủy mỗi ngày |
| Business Rules | BR-11, BR-12, BR-17 |
| Other Information | — |
| Assumptions | Hủy booking có trận thì trận cũng bị hủy, giống như host hủy trận |

## UC-7 Mở trận

| Row | Content |
|---|---|
| Primary Actor, Secondary Actors | Host · Người ghép trận |
| Trigger | Host có một booking và muốn tìm thêm người |
| Description | Host mở trận trên một booking của mình. Trận hiện trong phòng chờ, kể cả khi chủ sân chưa xác nhận booking |
| Preconditions | PRE-7: host có một booking "Chờ xác nhận" hoặc "Đã xác nhận" chưa có trận |
| Postconditions | POST-7: có một trận "Mở" trong phòng chờ, host chiếm 1 suất |
| Normal Flow | 7.0<br>1. Host chọn booking.<br>2. Host nhập môn, số suất và giá mỗi suất.<br>3. Hệ thống tạo trận "Mở" và thêm host vào trận (BR-14).<br>4. Hệ thống hiện trận trong phòng chờ với nhãn "Đã xác nhận" hoặc "Chưa xác nhận" |
| Alternative Flows | — |
| Exceptions | 7.0.E1 Booking đã có trận: hệ thống từ chối (BR-13) |
| Priority | High |
| Frequency of Use | Khoảng 15 lần mỗi ngày |
| Business Rules | BR-13, BR-14, BR-25 |
| Other Information | Phòng chờ của mọi người dùng thấy trận mới trong vòng 2 giây |
| Assumptions | Số suất ít nhất là 2 |

## UC-8 Vào và rời trận

| Row | Content |
|---|---|
| Primary Actor, Secondary Actors | Người ghép trận · Host |
| Trigger | Người ghép trận thấy một trận trong phòng chờ |
| Description | Người ghép trận lọc phòng chờ theo môn và ngày, xem chi tiết trận, rồi bấm xác nhận để vào trận. Host không duyệt |
| Preconditions | PRE-8: người ghép trận đã đăng nhập |
| Postconditions | POST-8: người ghép trận có một suất trong trận |
| Normal Flow | 8.0<br>1. Người ghép trận lọc phòng chờ theo môn và ngày.<br>2. Hệ thống hiện các trận "Mở".<br>3. Người ghép trận mở chi tiết: sân, giờ, host, số suất trống và giá.<br>4. Người ghép trận bấm xác nhận.<br>5. Hệ thống thêm người đó vào trận. Khi hết suất, trận chuyển sang "Đầy" (BR-15) |
| Alternative Flows | 8.1 Rời trận: người ghép trận rời một trận đã vào. Hệ thống bỏ người đó khỏi trận, và trận "Đầy" về "Mở" (BR-15, BR-18)<br>8.2 Xem các trận đã vào: hệ thống hiện các trận của người đó |
| Exceptions | 8.0.E1 Hai người cùng bấm vào suất cuối: một người vào được, người kia nhận "Trận đã đủ người"<br>8.1.E1 Đã tới giờ bắt đầu: hệ thống không cho rời (BR-18) |
| Priority | High |
| Frequency of Use | Khoảng 40 lần vào trận mỗi ngày |
| Business Rules | BR-15, BR-18, BR-20 |
| Other Information | App chỉ hiện giá mỗi suất. Host tự thu tiền tại sân |
| Assumptions | Người đã rời vào lại được khi trận còn "Mở" |

## UC-9 Hủy trận

| Row | Content |
|---|---|
| Primary Actor, Secondary Actors | Host · Người ghép trận, Chủ sân |
| Trigger | Host không đá được nữa |
| Description | Host hủy trận. Booking của trận cũng bị hủy, và mọi người trong trận nhận thông báo |
| Preconditions | PRE-9: host có một trận "Mở" hoặc "Đầy" |
| Postconditions | POST-9: trận "Đã hủy", booking "Đã hủy" |
| Normal Flow | 9.0<br>1. Host hủy trận.<br>2. Hệ thống chuyển trận sang "Đã hủy" và booking sang "Đã hủy" (BR-17).<br>3. Hệ thống báo mọi người trong trận (UC-14) |
| Alternative Flows | — |
| Exceptions | 9.0.E1 Booking "Đã xác nhận" còn dưới 6 giờ tới giờ bắt đầu: hệ thống từ chối và đề nghị gọi chủ sân (BR-11) |
| Priority | Medium |
| Frequency of Use | Khoảng 2 lần mỗi ngày |
| Business Rules | BR-11, BR-17 |
| Other Information | Trận và booking đổi trạng thái trong một transaction |
| Assumptions | Mốc 6 giờ của BR-11 cũng áp dụng khi host hủy trận |

## UC-10 Quản lý tài khoản và đơn vị

| Row | Content |
|---|---|
| Primary Actor, Secondary Actors | Admin · Chủ sân |
| Trigger | Một đơn vị mới tham gia, hoặc một tài khoản cần khóa |
| Description | Admin tạo tài khoản chủ sân, tạo và sửa đơn vị cùng các sân, và khóa tài khoản |
| Preconditions | PRE-10: admin đã đăng nhập |
| Postconditions | POST-10: đơn vị và các sân có trong hệ thống, gắn với tài khoản chủ sân |
| Normal Flow | 10.0<br>1. Admin tạo tài khoản chủ sân bằng tên, số điện thoại và mật khẩu ban đầu.<br>2. Admin tạo đơn vị: tên, địa chỉ, số điện thoại, giờ mở cửa và chủ sân.<br>3. Admin thêm các sân: tên, môn, giá giờ thường và giá giờ cao điểm |
| Alternative Flows | 10.1 Khóa tài khoản: admin khóa một tài khoản. Tài khoản đó không đăng nhập được nữa (BR-28) |
| Exceptions | 10.0.E1 Số điện thoại đã có tài khoản: hệ thống từ chối (BR-24) |
| Priority | High |
| Frequency of Use | Khoảng 3 đơn vị trong lúc chạy thử |
| Business Rules | BR-22, BR-24, BR-28 |
| Other Information | — |
| Assumptions | Mỗi đơn vị có một giờ mở cửa và một giờ đóng cửa chung cho mọi ngày |

## UC-11 Sửa giá và giờ mở cửa

| Row | Content |
|---|---|
| Primary Actor, Secondary Actors | Chủ sân · — |
| Trigger | Chủ sân đổi giá hoặc giờ mở cửa |
| Description | Chủ sân sửa giá giờ thường, giá giờ cao điểm của từng sân, và giờ mở cửa của đơn vị |
| Preconditions | PRE-11: chủ sân đã đăng nhập |
| Postconditions | POST-11: booking mới dùng giá mới. Booking cũ giữ giá cũ |
| Normal Flow | 11.0<br>1. Chủ sân mở một đơn vị của mình.<br>2. Chủ sân sửa giá hoặc giờ mở cửa.<br>3. Hệ thống lưu giá trị mới |
| Alternative Flows | — |
| Exceptions | 11.0.E1 Giờ đóng cửa không sau giờ mở cửa: hệ thống từ chối |
| Priority | Medium |
| Frequency of Use | Khoảng 1 lần mỗi tháng cho mỗi đơn vị |
| Business Rules | BR-6, BR-23, BR-25 |
| Other Information | — |
| Assumptions | Giờ mở cửa mới không hủy các booking đã có ngoài giờ đó |

## UC-12 Xem dashboard tài chính

| Row | Content |
|---|---|
| Primary Actor, Secondary Actors | Chủ sân · — |
| Trigger | Chủ sân muốn xem doanh thu và giờ sân |
| Description | Chủ sân xem doanh thu, số giờ đã đặt, tỉ lệ lấp đầy, giờ cao điểm, tỉ lệ hủy và từ chối, và khách quay lại của các đơn vị mình |
| Preconditions | PRE-12: chủ sân đã đăng nhập |
| Postconditions | POST-12: không đổi dữ liệu |
| Normal Flow | 12.0<br>1. Chủ sân chọn đơn vị và khoảng thời gian: ngày, tuần hoặc tháng.<br>2. Hệ thống hiện các số liệu và biểu đồ |
| Alternative Flows | 12.1 Đánh dấu đã thu tiền: chủ sân đánh dấu một booking "đã thu tiền tại sân". Hệ thống tính booking đó vào doanh thu (BR-21) |
| Exceptions | 12.0.E1 Không có booking trong khoảng thời gian: hệ thống hiện số 0 |
| Priority | Medium |
| Frequency of Use | Khoảng 3 lần mỗi ngày cho mỗi chủ sân |
| Business Rules | BR-21, BR-23, BR-27 |
| Other Information | Tỉ lệ lấp đầy là số giờ đã xác nhận chia cho số giờ mở cửa |
| Assumptions | Khách quay lại là số điện thoại có từ 2 booking trở lên trong khoảng thời gian |

## UC-13 Xem dashboard toàn trang

| Row | Content |
|---|---|
| Primary Actor, Secondary Actors | Admin · — |
| Trigger | Admin muốn biết app được dùng thế nào |
| Description | Admin xem số tài khoản theo vai trò, người dùng mới và hoạt động theo tuần, số booking và trận theo đơn vị, thời gian xác nhận trung bình và tỉ lệ hết hạn |
| Preconditions | PRE-13: admin đã đăng nhập |
| Postconditions | POST-13: không đổi dữ liệu |
| Normal Flow | 13.0<br>1. Admin mở dashboard.<br>2. Hệ thống hiện các số liệu và biểu đồ |
| Alternative Flows | — |
| Exceptions | — |
| Priority | Medium |
| Frequency of Use | Khoảng 1 lần mỗi ngày |
| Business Rules | BR-22 |
| Other Information | — |
| Assumptions | Người dùng hoạt động là người có ít nhất một lần đăng nhập trong tuần |

## UC-14 Gửi thông báo

| Row | Content |
|---|---|
| Primary Actor, Secondary Actors | Hệ thống · Chủ sân, Người dùng |
| Trigger | Có yêu cầu đặt sân mới, booking được xác nhận hoặc bị từ chối, hoặc trận bị hủy |
| Description | Hệ thống gửi Web Push và thêm một dòng vào danh sách thông báo trong app |
| Preconditions | PRE-14: người nhận đã đăng ký Web Push, nếu muốn nhận push |
| Postconditions | POST-14: người nhận có một thông báo trong app |
| Normal Flow | 14.0<br>1. Một sự kiện xảy ra.<br>2. Hệ thống ghi thông báo cho từng người nhận.<br>3. Hệ thống gửi Web Push tới các thiết bị đã đăng ký |
| Alternative Flows | — |
| Exceptions | 14.0.E1 Thiết bị đã hủy đăng ký: hệ thống xóa đăng ký đó |
| Priority | Medium |
| Frequency of Use | Khoảng 150 thông báo mỗi ngày |
| Business Rules | — |
| Other Information | Push tới trong vòng 30 giây. Thông báo trong app vẫn còn khi push lỗi |
| Assumptions | — |
