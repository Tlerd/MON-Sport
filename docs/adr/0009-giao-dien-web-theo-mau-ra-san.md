# 0009: Giao diện web theo mẫu "Ra Sân"

Status: Accepted
Date: 2026-11-14. Người dùng yêu cầu cùng ngày: "xóa sạch giao diện cũ, dùng giao diện mới này (chỉ web), những tính năng chưa làm khi ấn nút cứ ghi là sắp ra mắt".

## Context

Web hiện tại theo `DESIGN.md` (brief F-017): nền xám xanh, một màu xanh sân, một họ chữ.

Ngày 14/11/2026, người dùng đưa một giao diện mẫu tĩnh cho web. Mẫu nằm ở `docs/design/web-ui-v3/` (`index.html`, `styles.css`, `app.js`, `data.js`). Mẫu dùng dữ liệu giả và không có máy chủ.

Mẫu khác `DESIGN.md` ở các điểm sau:

- Bảng màu mới: nền phấn sân, mực đậm, xanh quả bóng (`--lime`), đất nện (`--clay`).
- Họ chữ thứ hai cho số và tiêu đề: Big Shoulders Display, viết hoa.
- Khung mới: thanh trên cùng màu mực có tab, cột trái, cột phải, thẻ trận dạng cuống vé.
- Nhiều chức năng chưa có trong MONSPORT: đội, trận đội gặp đội, trò chuyện, báo cáo vi phạm, bật tắt môn, khóa khung giờ.

## Options

1. **Giữ `DESIGN.md` cho web.** Trái yêu cầu của người dùng.
2. **Đổi token của `DESIGN.md` theo mẫu.** `apps/mobile` cũng theo `DESIGN.md`, nên app đổi theo. Người dùng nói "chỉ web".
3. **Web theo mẫu, app giữ `DESIGN.md`.** Web có file theme riêng. `DESIGN.md` chỉ còn điều khiển `apps/mobile`, cùng các quy tắc chữ và từ dùng chung.

## Decision

Chọn phương án 3.

- `docs/design/web-ui-v3/` là nguồn của bố cục, màu, chữ và class cho `apps/web`. Agent không sửa các file mẫu.
- `apps/web/src/app/theme.css` giữ token của web, chép từ `:root` của mẫu. `apps/web/src/app/tokens.css` bị xóa.
- `DESIGN.md` giữ nguyên token và điều khiển `apps/mobile`. Phần "Words" của nó vẫn áp dụng cho web.
- `scripts/design-tokens.mjs` ghi vào `apps/mobile/src/app/tokens.css`.
- Tên sản phẩm vẫn là MONSPORT. Web dùng tên gọi của intake: "trận", "đơn vị", "sân", "host". Web không dùng "kèo" và "cụm sân" của mẫu.
- Bố cục theo chiều rộng không theo mẫu và không theo `DESIGN.md`. Nó theo `docs/design/web-responsive.md`, do agent viết. Người dùng, 14/11/2026: "Bỏ hết các quy tắc cũ, dùng quy tắc của bạn mà không phụ thuộc vào khuôn mẫu". Trang không cuộn ngang từ 360px trở lên.

Quy tắc "Sắp ra mắt":

- Một nút hoặc liên kết của mẫu chưa có chức năng thật: bấm vào hiện thông báo nổi "Sắp ra mắt". Nút không đổi trang và không gọi API.
- Một khối của mẫu chưa có dữ liệu thật: hiện khối với trạng thái rỗng ghi "Sắp ra mắt".
- Web không bao giờ hiện dữ liệu giả của mẫu (tên người, điểm, số liệu, khoảng cách, đánh giá).
- Khi một chức năng có brief và được làm xong, brief đó thay "Sắp ra mắt" bằng chức năng thật.

## Consequences

- Web và app không còn chung bảng màu. Một thay đổi về màu phải làm ở hai nơi.
- Web có họ chữ thứ hai và nhãn viết hoa. Hai điều "Don't" của `DESIGN.md` không áp dụng cho web.
- Các flow `verify-flow` của web phải đổi bộ chọn theo khung mới.
- Mỗi mục "Sắp ra mắt" là một chức năng chờ intake và brief. Danh sách nằm trong brief F-033.
