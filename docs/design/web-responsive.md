---
style: ste80
lang: vi
---

# Quy tắc co giãn của web MONSPORT

Tài liệu này là nguồn duy nhất cho cách `apps/web` đổi bố cục theo chiều rộng cửa sổ. Người dùng giao quyết định này cho agent ngày 14/11/2026 (`HUMAN_DECISIONS.md`, dòng 65).

Tài liệu này thay hai nguồn cũ:

- Bảng "Responsive Behavior" của `DESIGN.md`, phần nói về web.
- Các `@media` của mẫu `docs/design/web-ui-v3/styles.css`, kể cả `min-width: 720px`.

Mẫu vẫn là nguồn của màu, chữ và hình dáng thẻ (ADR 0009). Mẫu không còn là nguồn của bố cục theo chiều rộng.

## Ý tưởng

Một màn có một việc chính. Khi cửa sổ hẹp lại, việc chính giữ nguyên chỗ, và mọi thứ phụ lùi ra sau một lần chạm.

Bố cục đổi theo sức chứa của nội dung, không theo tên thiết bị. Web không có "bản điện thoại" riêng. Cùng một trang, cùng một đường dẫn, cùng một chức năng ở mọi chiều rộng.

## Năm nguyên tắc

1. **Trang không bao giờ cuộn ngang.** Từ 360px trở lên, `scrollWidth` của trang không lớn hơn cửa sổ. Một khối rộng tự cuộn trong khung của nó.
2. **Không chức năng nào biến mất.** Một phần bị ẩn phải mở lại được bằng một lần chạm: ngăn kéo, tấm trượt, hoặc một dòng mở rộng.
3. **Hành động chính luôn trong tầm tay.** Ở màn rộng, nó nằm trong cột phải và không trôi đi. Ở màn hẹp, nó nằm trên một thanh dính ở đáy.
4. **Thứ tự lùi cố định.** Phần lùi trước: cột phải. Rồi tới cột trái. Rồi tới chữ của nút. Nội dung chính lùi sau cùng.
5. **Ngón tay cần chỗ.** Dưới 720px, mỗi vùng chạm cao ít nhất 44px, và hai vùng chạm cách nhau ít nhất 8px.

## Bốn mức chiều rộng

| Mức | Chiều rộng | Cột | Điều hướng |
|---|---|---|---|
| Rộng | từ 1320px | Ba cột: trái, giữa, phải | Tab có icon và chữ trên thanh trên |
| Vừa | 980px đến 1319px | Hai cột. Cột phải lùi xuống dưới nội dung chính, hoặc ẩn khi nó chỉ nhắc lại | Như mức Rộng |
| Hẹp | 720px đến 979px | Một cột. Cột trái và thanh bên thành ngăn kéo | Tab chỉ còn icon, có `title` và nhãn `aria` |
| Gọn | 360px đến 719px | Một cột, lề 12px | Thanh trên hai hàng. Xem "Mức Gọn" |

Dưới 360px không được thiết kế. Trang vẫn không được cuộn ngang.

Kiểm ở bốn chiều rộng: 390px, 768px, 1024px và 1440px.

## Mức Gọn

Thanh trên có hai hàng, cùng dính ở đỉnh:

- Hàng một: nút mở ngăn kéo, logo, chuông, tài khoản. Tên người dùng rút gọn bằng dấu ba chấm, không ẩn.
- Hàng hai: năm tab, mỗi tab một icon và một chữ ngắn, chia đều chiều rộng. Vai trò chủ sân và admin không có hàng hai. Họ dùng ngăn kéo.

Các phần khác:

- Ô tìm kiếm chuyển vào đầu ngăn kéo.
- Nút "Tạo trận" chỉ còn icon, và giữ nhãn `aria`.
- Tiêu đề trang nhỏ lại: 38px thành 28px. Số lớn trên ô số liệu: 40px thành 30px.
- Ô số liệu (`tiles`): hai cột. Dưới 420px: một cột.
- Hộp thoại thành tấm trượt từ đáy, rộng hết cửa sổ, cao tối đa 90% cửa sổ.
- Khung nổi (thông báo, tài khoản) rộng hết cửa sổ, nằm ngay dưới thanh trên.
- Thông báo nổi nằm giữa, phía trên thanh dính ở đáy.

## Bốn mẫu bố cục

### Danh sách và chi tiết

Dùng cho: Ghép trận.

- Rộng và Vừa: danh sách bên trái, chi tiết bên phải và dính khi cuộn.
- Hẹp: danh sách 300px, chi tiết phần còn lại.
- Gọn: chỉ có danh sách. Chạm một thẻ mở chi tiết thành tấm phủ cả trang, có nút "Quay lại" ở đầu và hành động chính dính ở đáy. Đường dẫn có `?tran=<id>`, nên nút lùi của trình duyệt đóng tấm.

### Lưới giờ và tóm tắt

Dùng cho: trang đơn vị, Lịch sân.

- Rộng và Vừa: lưới bên trái, tóm tắt bên phải và dính khi cuộn.
- Hẹp: tóm tắt nằm dưới lưới.
- Gọn: tóm tắt thu thành thanh dính ở đáy với tổng tiền, "Gọi chủ sân" và nút gửi. Chạm thanh mở tóm tắt đầy đủ. Câu UC-2 nằm trên lưới, không nằm trong thanh.
- Mọi mức: lưới cuộn ngang trong khung của nó. Cột giờ dính bên trái. Hàng tên sân dính ở đỉnh khung.

### Bảng

Dùng cho: yêu cầu đặt sân, sân và giá, nhân viên, số liệu admin.

- Rộng và Vừa: bảng đủ cột.
- Hẹp: cột ít quan trọng nhất lùi vào dòng phụ của cột đầu.
- Gọn: mỗi hàng thành một thẻ. Cột đầu là tiêu đề thẻ. Mỗi cột còn lại là một dòng "nhãn: giá trị". Các nút hành động nằm ở cuối thẻ, chia đều chiều rộng.
- Một bảng chỉ có số (số liệu theo tuần) giữ dạng bảng và cuộn ngang trong khung, với cột đầu dính bên trái.

### Thẻ trong lưới

Dùng cho: danh sách đơn vị, thẻ trận ở trang chủ.

- Lưới tự chia cột theo chiều rộng tối thiểu của thẻ (`auto-fill`). Không đặt số cột cố định.
- Gọn: thẻ trận giữ cuống vé bên trái, hẹp lại còn 84px. Nhãn phụ lùi trước, giờ và tên không lùi.

## Ngăn kéo

- Mở bằng nút ở thanh trên. Đóng bằng: chạm lớp mờ, phím Escape, hoặc chọn một mục.
- Khi mở, tiêu điểm vào mục đầu tiên. Khi đóng, tiêu điểm về nút mở.
- Rộng 284px, và không quá 86% cửa sổ.

## Cách viết CSS

- Viết kiểu cho mức Rộng trước. Mỗi mức hẹp hơn nằm trong một khối `@media (max-width: ...)` ở cuối `styles.css`, theo thứ tự 1319px, 979px, 719px, 419px.
- Dùng `minmax(0, 1fr)` cho cột chứa chữ dài, để chữ không đẩy rộng cột.
- Không đặt `min-width` trên `body`. Không ẩn chức năng bằng `display: none` khi chưa có đường khác tới nó.
- Tôn trọng `prefers-reduced-motion`: ngăn kéo và tấm trượt hiện ngay, không chạy hiệu ứng.

## Xong khi nào

- `verify-flow` đo `scrollWidth <= innerWidth` ở 390px, 768px, 1024px và 1440px trên mọi màn của brief F-033.
- Ở 390px, mỗi luồng của `verify-flow` chạy hết mà không cần cuộn ngang.
- Mọi nút của mức Rộng có đường tới ở mức Gọn.
