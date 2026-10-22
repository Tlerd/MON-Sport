# 0006: Tách app mobile thành PWA riêng trong `apps/mobile`

Status: Proposed
Date: 2026-10-23

## Context

Intake ghi "App Android và iOS" là ngoài phạm vi, với lý do "Làm web trước". Màn hình mục tiêu là "Web trên điện thoại, màn rộng 390px trở lên".

Ngày 23/10/2026, người dùng xem 3 bản giao diện web: bản hiện tại, bản A và bản B. Người dùng không duyệt bản nào, vì 3 lý do:

- Mọi vai trò dùng chung một trang dài.
- Giao diện không có điều hướng.
- Trên điện thoại, giao diện không giống cách dùng của app Facebook: thanh trên và thanh tab không ẩn khi cuộn xuống, và nội dung không gọn.

Người dùng yêu cầu làm phần mobile trong một folder riêng, với giao diện theo phong cách app Facebook. Web chỉ lên kế hoạch cho màn lớn.

## Options

1. **Một web responsive cho mọi màn.** Giữ một codebase. Bố cục điện thoại và desktop phải dùng chung cấu trúc. Đây chính là điều người dùng không duyệt.
2. **PWA riêng trong `apps/mobile`, cùng React + Vite, cùng API.**
   - Tách được bố cục và điều hướng của điện thoại.
   - Vẫn dùng Web Push (ADR 0005), cài từ trình duyệt, không qua store.
   - Đúng công nghệ trong intake.
   - Rủi ro: hai giao diện cho cùng các use case, nên số màn hình phải làm tăng gấp đôi.
3. **App native bằng React Native hoặc Expo.**
   - Cuộn và cử chỉ mượt hơn, có push native.
   - Trái với intake: app native đang ngoài phạm vi, và công nghệ không có trong ràng buộc.
   - Cần tài khoản Apple và Google, và một quy trình phát hành riêng.

## Decision

Đề xuất chọn phương án 2.

- `apps/mobile` là một ứng dụng React + Vite riêng. App dùng Zod contract trong `packages/shared`, và gọi cùng API `/api`.
- Code dùng chung giữa web và mobile chuyển vào một package mới, `packages/client`. Package này gồm client API, Web Push và các hàm định dạng giá và giờ. `apps/mobile` không import từ `apps/web`, và `apps/web` không import từ `apps/mobile`. Quy tắc này nằm trong `.dependency-cruiser.cjs`.
- App phục vụ ở đường dẫn `/app/` trên cùng tên miền với web. Nhờ vậy app dùng chung cookie phiên và API. Service worker có phạm vi `/app/`.
- `DESIGN.md` là quy chuẩn chung của web và mobile.

## Consequences

- Intake phải đổi mục "App Android và iOS" trong "Out of scope". Ghi rõ: app mobile là PWA trong `apps/mobile`, còn app native vẫn ngoài phạm vi.
- Mỗi brief có giao diện phải ghi rõ màn hình nằm ở web, ở mobile, hay ở cả hai. Mỗi brief cũng phải liệt kê đường dẫn của cả hai app.
- Deploy cần build thêm `apps/mobile`, rồi phục vụ thư mục build đó ở `/app/`.
- `verify-flow` cần thêm cờ `--app mobile` để chạy các flow ở 390px trên app.
- Web Push hiện đăng ký trên web. Khi có app, người dùng iPhone cài app và đăng ký push trong app. Đăng ký trên web vẫn được giữ.

## Open

- Người dùng duyệt ADR này. Sau khi duyệt, đổi Status thành Accepted và sửa intake.
