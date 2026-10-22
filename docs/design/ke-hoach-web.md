# Kế hoạch giao diện web (`apps/web`)

Kế hoạch này chỉ dành cho web trên màn lớn, rộng từ 1024px. Từ 768px đến 1023px, web vẫn dùng được. App điện thoại có kế hoạch riêng trong [ke-hoach-app-mobile.md](ke-hoach-app-mobile.md). Mọi bước theo [DESIGN.md](../../DESIGN.md). Mockup nằm ở [mockup.html](mockup.html).

## Vấn đề của bản hiện tại

- Mỗi vai trò chỉ có một trang dài. "Giờ trống", "Phòng chờ", "Đặt sân" và "Booking của tôi" xếp chồng lên nhau.
- Web không có điều hướng giữa các việc, và mỗi màn không có URL riêng.
- "Giờ trống" và "Đặt sân" là một việc, nhưng nằm ở hai khối. Cả hai khối đều có ô "Chọn đơn vị".
- Trên desktop, bản hiện tại chỉ là cột điện thoại 576px đặt giữa màn hình.
- Môn thể thao, trạng thái và giá được viết thành câu, không có icon.

## Điều hướng

| Vai trò | Điều hướng | Các màn và URL |
|---|---|---|
| Khách, người chơi | Thanh trên cùng | `/` Đặt sân · `/san/:donVi` Đơn vị · `/phong-cho` · `/phong-cho/:tran` · `/lich-cua-toi` |
| Chủ sân | Sidebar 220px | `/chu-san/yeu-cau` · `/chu-san/yeu-cau/:id` · `/chu-san/lich` · `/chu-san/doanh-thu` · `/chu-san/don-vi` |
| Admin | Sidebar 220px | `/admin` Tổng quan · `/admin/chu-san` · `/admin/don-vi` |

Sau khi đăng nhập, mỗi vai trò vào màn đầu tiên của mình. Người chơi vào Đặt sân. Chủ sân vào Yêu cầu, vì đó là việc có hạn. Admin vào Tổng quan.

## Bố cục từng màn

| Màn | Mẫu bố cục | Nội dung |
|---|---|---|
| Đặt sân | 3 cột | Trái: tìm và danh sách đơn vị, mỗi đơn vị có icon môn, số sân và khoảng giá. Giữa: chip ngày và lưới sân × giờ. Phải: tóm tắt, giá tạm tính, nút "Gửi yêu cầu" và hạn xác nhận |
| Phòng chờ | Danh sách và chi tiết | Chip lọc môn (có icon) và ngày. Danh sách trận ở bên trái. Chi tiết trận và nút "Vào trận" ở bên phải |
| Lịch của tôi | Danh sách có tab | Sắp tới · Trận đã vào · Lịch sử. Mỗi dòng có thời gian, đơn vị, trạng thái và hành động |
| Yêu cầu (chủ sân) | Danh sách và chi tiết | Các yêu cầu đang chờ, xếp theo hạn gần nhất. Bên phải là chi tiết, nút Xác nhận và nút Từ chối |
| Lịch sân (chủ sân) | Lưới sân × giờ | Một lưới cho mỗi đơn vị. Bấm ô trống thì mở panel nhập booking khách gọi điện. Bấm ô chờ thì mở yêu cầu |
| Doanh thu | Dashboard | Thẻ số liệu và biểu đồ Recharts (UC-12) |
| Đơn vị và giá | Bảng và panel | Giá giờ thường, giá cao điểm, giờ mở cửa (UC-11) |
| Admin | Bảng và panel | Chủ sân, đơn vị, sân, khóa tài khoản (UC-10, UC-13) |

## Thứ tự làm

Mỗi bước là một brief và một hoặc vài pull request, theo `AGENTS.md`.

1. **Token và component nền.** Gồm:
   - `tokens.css`.
   - Icon môn trong `packages/shared/icons`.
   - Các component `Chip`, `StatusBadge`, `EmptyState`.
2. **Router và khung điều hướng.** Gồm:
   - ADR về router: đề xuất `react-router`.
   - `TopNav` cho người chơi, `Sidebar` cho chủ sân và admin.
   - Chuyển các khối hiện có vào đúng màn, chưa đổi nội dung bên trong.
3. **`SlotGrid`, rồi màn Đặt sân 3 cột.** Gộp "Giờ trống" và "Đặt sân" thành một luồng.
4. **Màn Lịch sân của chủ sân.** Dùng `SlotGrid` và panel nhập booking khách gọi điện.
5. **Yêu cầu và Phòng chờ** theo mẫu danh sách và chi tiết.
6. **Lịch của tôi, Doanh thu, Đơn vị và giá, Admin.**

Ở mỗi bước, `pnpm check` phải pass. `verify-flow` cũng phải pass ở 1024px và 1440px, và ảnh chụp được đính vào pull request.

## Quyết định mở

- **Router.** Phương án đề xuất là thêm `react-router`, và ghi quyết định trong một ADR. Phương án khác là tự viết router bằng `history.pushState`.
- **Banner trên màn dưới 768px.** Đề xuất: hiện link mở app mobile ở `/app/` (ADR 0006), không tự chuyển trang.
