# Ra Sân · bản web

Model dựng: **Claude Fable 5.2**.

Đây là giao diện mẫu cho ứng dụng thể thao đa môn. Dữ liệu là dữ liệu giả lập. Không có máy chủ.

## Cách mở

Mở tệp `index.html` bằng trình duyệt. Không cần cài đặt hay build.

Tải lại trang thì dữ liệu trở về ban đầu.

## Nội dung

Bấm vào ảnh đại diện ở góc phải để đổi vai trò.

- **Người chơi:** trang chủ, ghép trận (kèo đơn và kèo đội), sân và đặt sân, đội, lịch, hồ sơ.
- **Chủ sân:** tổng quan, yêu cầu đặt sân, lịch sân, sân của tôi, doanh thu.
- **Quản trị:** tổng quan, người dùng, duyệt sân, báo cáo vi phạm, môn thể thao.

## Bố cục

Bản này là trang web cho màn hình lớn: thanh trên cùng có tab, cột trái, cột phải, bảng và lưới rộng.

Khi cửa sổ hẹp lại, trang ẩn cột phải, rồi đưa cột trái vào ngăn kéo. Trang không đổi sang giao diện điện thoại. Bản điện thoại là mã riêng, nằm ở thư mục `claude-fable-5.2-mobile`.

## Tệp

- `index.html`: khung trang.
- `styles.css`: toàn bộ kiểu dáng.
- `data.js`: dữ liệu giả lập.
- `app.js`: màn hình và thao tác.
