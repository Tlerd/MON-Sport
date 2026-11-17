---
style: ste80
lang: vi
---

# Nối AI với MONSPORT

Một AI, ví dụ Claude Code, dùng tài khoản của bạn để làm việc trên MONSPORT. AI tìm sân và xem giờ trống. AI gửi yêu cầu đặt sân và hủy booking. AI xem trận và vào trận. Chủ sân vẫn xác nhận booking bằng tay.

## Tạo mã

1. Đăng nhập MONSPORT.
2. Mở trang "Hồ sơ".
3. Tìm mục "Kết nối AI".
4. Điền tên cho mã.
5. Chọn quyền: "Đặt sân" hoặc "Chỉ xem".
6. Chọn hạn dùng: 30 hoặc 90 ngày.
7. Bấm "Tạo mã".
8. Bấm "Chép" và lưu mã ngay. Mã chỉ hiện một lần.

Mỗi tài khoản có tối đa 5 mã.

## Nối Claude Code

Chạy lệnh này trong terminal. Thay `<mã>` bằng mã bạn vừa chép.

```bash
claude mcp add --transport http monsport https://monsport-774323404592.asia-southeast1.run.app/api/mcp --header "Authorization: Bearer <mã>"
```

Hỏi Claude, ví dụ: Tìm sân bóng đá trống tối thứ Bảy.

Nguồn: https://code.claude.com/docs/en/mcp

## Giới hạn

- Mỗi tài khoản chạy tối đa 60 lệnh mỗi phút, tính chung mọi mã. Trong đó có tối đa 10 lệnh ghi (BR-58).
- Mã hết hạn sau 30 hoặc 90 ngày.

## Thu hồi mã

1. Mở trang "Hồ sơ".
2. Tìm mục "Kết nối AI".
3. Bấm "Thu hồi" ở mã cần bỏ.
4. Bấm "Xác nhận thu hồi".

AI dùng mã đó mất quyền ngay. Khi tài khoản bị khóa rồi mở khóa, mọi mã cũ hết hiệu lực.

## An toàn

Ai có mã này thì đặt sân được bằng tài khoản của bạn. Không gửi mã cho người khác.

- Không dán mã vào chat, issue, hay ảnh chụp màn hình.
- Thu hồi mã ngay khi bạn nghi mã bị lộ.
