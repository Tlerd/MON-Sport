# Kế hoạch app mobile (`apps/mobile`)

App mobile là một PWA riêng cho điện thoại, rộng từ 360px đến 430px. Quyết định nằm ở [ADR 0006](../adr/0006-app-mobile-pwa.md), đang chờ duyệt. Mọi màn theo [DESIGN.md](../../DESIGN.md). Mockup tương tác nằm ở [mockup.html](mockup.html): cuộn trong khung điện thoại để xem các thanh ẩn và hiện.

## Cách dùng giống app Facebook

- **Thanh trên ẩn khi cuộn xuống.** Thanh trên chỉ có logo bên trái và 3 nút bên phải: tạo, tìm, thông báo. Cuộn lên thì thanh hiện lại.
- **Thanh tab nổi.** Thanh tab có dạng viên thuốc, bo tròn, nổi cách đáy 12px, nền trắng mờ. Thanh này cũng ẩn khi cuộn xuống.
- **Thanh ngữ cảnh ở lại.** Ví dụ: chip ngày. Khi thanh trên ẩn, thanh ngữ cảnh dính lên mép trên màn hình.
- **Thanh hành động không ẩn.** Ví dụ: "Sân 1 · 20:00–21:00 · 240k · Gửi yêu cầu". Thanh này ở lại khi người dùng đã chọn giờ.
- **Form mở dạng sheet từ dưới lên.** Form không nằm giữa trang dài.
- **Phòng chờ là một feed.** Mỗi trận là một thẻ như bài đăng. Thẻ có host, icon môn, giờ, sân, số suất và nút "Vào trận".

## Tab theo vai trò

| Vai trò | Tab |
|---|---|
| Khách, người chơi | Đặt sân · Phòng chờ · Lịch của tôi · Thông báo · Tôi |
| Chủ sân | Yêu cầu (số đếm) · Lịch sân · Doanh thu · Thông báo · Tôi |
| Admin | Không có trên app. App báo "Dùng web để quản trị" |

## Màn chính

| Màn | Nội dung |
|---|---|
| Đặt sân | Chip môn có icon (Tất cả, Cầu lông, Bóng đá). Danh sách đơn vị gần, mỗi đơn vị 1 thẻ 3 dòng: tên, icon môn và số sân, khoảng giá và giờ mở |
| Đơn vị | Chip ngày dính trên cùng. Mỗi sân có một hàng ô giờ cuộn ngang. Bấm ô thì thanh hành động hiện. Nút "Gọi chủ sân" nằm trong menu ⋯ |
| Gửi yêu cầu | Sheet xác nhận gồm sân, giờ, giá và hạn chủ sân xác nhận. Bấm "Gửi yêu cầu" thì app hiện "Đã gửi yêu cầu" |
| Phòng chờ | Feed trận, lọc môn bằng chip icon, chọn ngày bằng chip. Cập nhật tức thì qua SSE |
| Lịch của tôi | Tab nhỏ: Sắp tới · Trận đã vào · Lịch sử. Thẻ có trạng thái dạng badge |
| Yêu cầu (chủ sân) | Thẻ yêu cầu có hạn còn lại, nút Xác nhận và nút Từ chối ngay trên thẻ |
| Lịch sân (chủ sân) | Chip ngày, lưới sân × giờ cuộn ngang. Bấm ô trống thì mở sheet nhập booking khách gọi điện |

## Thứ tự làm

1. **Duyệt ADR 0006 và sửa intake.**
2. **Tạo `packages/client`.** Chuyển client API, Web Push và các hàm định dạng từ `apps/web` vào package này. Thêm quy tắc import vào `.dependency-cruiser.cjs`.
3. **Khung app.** Gồm:
   - Vite, React, router.
   - Manifest PWA và service worker ở phạm vi `/app/`.
   - `TopBar`, `TabBar`, `useHideOnScroll` với test cho từng dòng của bảng cuộn trong `DESIGN.md`.
   - `Sheet`.
4. **Đăng nhập và Đặt sân:** danh sách đơn vị, màn Đơn vị, sheet Gửi yêu cầu.
5. **Lịch của tôi và Phòng chờ.**
6. **Các màn của chủ sân:** Yêu cầu, Lịch sân, nhập booking khách gọi điện.
7. **Deploy.** Build `apps/mobile` và phục vụ ở `/app/`. Thêm `--app mobile` cho `verify-flow`.

Mỗi bước là một brief, theo `AGENTS.md`.
