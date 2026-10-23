# 0007: Đăng nhập và đăng ký bằng Google, xác minh số điện thoại bằng OTP

Status: Accepted
Date: 2026-10-23. Người dùng duyệt cùng ngày: "accept F-004 (Thêm đề xuất gửi mã OTP để xác minh sdt, dù đăng nhập hoặc đăng kí bằng gmail thì phải xác minh sdt hoặc nếu đăng nhập bằng Zalo thì xác minh bằng zalo)".

## Context

Intake UC-1 ghi nhận người dùng đăng nhập bằng mật khẩu, Google hoặc Zalo.
Thêm nhà cung cấp danh tính và cho mật khẩu null là quyết định khó đảo ngược.
Google không trả số điện thoại của người dùng tại Việt Nam.
Chủ sân cần số điện thoại của người đặt sân để liên hệ khi có sự cố.
Người dùng yêu cầu xác minh số điện thoại bằng OTP cho tài khoản Google hoặc Zalo.
Đăng nhập Zalo cần Zalo App và Zalo Official Account riêng, nên chuyển sang brief F-018.

## Options

1. **Chỉ nhận diện qua số điện thoại và mật khẩu.**
   - Không hỗ trợ đăng nhập qua bên thứ ba.
   - Trái với use case UC-1 trong intake.

2. **Tự liên kết tài khoản theo email hoặc số điện thoại Google trả về.**
   - Người dùng không cần thao tác thêm.
   - Email trên Google có thể thay đổi và không duy nhất.
   - Rủi ro chiếm tài khoản khi số điện thoại đổi chủ.

3. **Google là nhà cung cấp danh tính theo `sub`, mật khẩu null được, xác minh số điện thoại qua OTP.**
   - Nhận diện tài khoản duy nhất qua `googleSub`.
   - `passwordHash` cho phép mang giá trị null với tài khoản tạo bằng Google.
   - Bắt buộc xác minh số điện thoại qua SMS OTP với interface `OtpSender`.
   - Brief F-018 dùng lại dịch vụ OTP này cho Zalo.

## Decision

Chọn phương án 3.

- Hệ thống xác thực Google qua luồng Authorization Code và PKCE ở phía server.
- Hệ thống chỉ dùng Google `sub` để nhận diện tài khoản.
- Server không dùng email để nhận diện hay tự động liên kết tài khoản.
- `User.passwordHash` cho phép null khi người dùng tạo tài khoản qua Google.
- Đăng nhập bằng mật khẩu khi `passwordHash` bằng null trả về lỗi 401.
- Mọi tài khoản Google phải xác minh số điện thoại bằng OTP trước khi cấp phiên.
- Dịch vụ OTP được tách thành module riêng qua interface `OtpSender`.
- Brief F-018 dùng lại dịch vụ OTP này để gửi mã qua Zalo ZNS.

## Consequences

- Bảng `User` nhận thêm các cột nullable: `googleSub`, `email` và `phoneVerifiedAt`.
- Cột `User.passwordHash` chuyển thành nullable.
- Tạo thêm hai bảng mới: `PhoneOtp` và `DevOtpOutbox`.
- Hệ thống thêm biến môi trường và secret cho OAuth Google và dịch vụ OTP.
- Khi người dùng xóa tài khoản (BR-26, R8), server xóa trắng `googleSub`, `email`, `phoneVerifiedAt` và `PhoneOtp`.

## Open

- Không còn. Người dùng đã duyệt quyết định ngày 23/10/2026.
