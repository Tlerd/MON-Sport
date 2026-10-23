# Tiến độ MONSPORT bản đầu

Cập nhật: 23/10/2026. Nguồn: `docs/requirements/intake-monsport-v1.md` (UC-1 đến UC-14), `PROGRESS.md`, và git.

## Cách làm việc

- Code theo **use case (UC)** của intake, không theo user story.
- Mỗi nhóm UC có một **brief** `F-0xx` trong `docs/briefs/`. Brief chia việc thành các bước, mỗi bước một pull request.
- Mỗi brief có các **tiêu chí nghiệm thu** `AC-n`. Mỗi `AC-n` có một test tự động. Một UC xong khi mọi `AC-n` của brief pass trong `pnpm check` và bản đã deploy. `pnpm check` pass ngày 23/10/2026.

## Kết quả

**13 trên 14 use case xong (93%).**
UC-14 (thông báo đẩy) chưa đạt. Bản sửa đã lên live ngày 23/10/2026, và cần bạn test lại trên điện thoại Android.

Ký hiệu: ✅ xong. 🔴 đã code nhưng test thật chưa đạt. ⬜ chưa làm.

## Theo use case

| UC | Việc | Brief | Trạng thái |
|---|---|---|---|
| UC-1 | Đăng ký và đăng nhập | F-002, F-003, F-006, F-004 | ✅ số điện thoại và mật khẩu. 🟡 Google: code xong, chờ bật trên live |
| UC-2 | Chọn sân, xem giờ trống, tìm theo tên sân | F-002, F-008, F-010 | ✅ |
| UC-3 | Gửi yêu cầu đặt sân | F-002 | ✅ |
| UC-4 | Chủ sân xác nhận hoặc từ chối | F-002 | ✅ |
| UC-5 | Chủ sân nhập booking của khách gọi điện | F-007 | ✅ |
| UC-6 | Xem trạng thái, hủy booking, xem lịch sử | F-009 | ✅ |
| UC-7 | Host mở trận | F-011 | ✅ |
| UC-8 | Vào và rời trận, phòng chờ tức thì | F-012 | ✅ |
| UC-9 | Host hủy trận | F-011 | ✅ |
| UC-10 | Admin quản lý tài khoản và đơn vị | F-003 | ✅ |
| UC-11 | Chủ sân sửa giá và giờ mở cửa | F-005 | ✅ |
| UC-12 | Dashboard tài chính của chủ sân | F-015 | ✅ |
| UC-13 | Dashboard toàn trang của admin | F-016 | ✅ |
| UC-14 | Thông báo trong app và Web Push | F-013, F-014 | 🔴 thông báo trong app có. Web Push chờ test lại trên Android |

## Theo thứ tự ra mắt (intake, mục Assumptions)

| Đợt | Use case | Tiến độ |
|---|---|---|
| 1 | UC-1, UC-10, UC-11 | ✅ 3 trên 3 |
| 2 | UC-2 đến UC-6 | ✅ 5 trên 5 |
| 3 | UC-7 đến UC-9 | ✅ 3 trên 3 |
| 4 | UC-14 | 🔴 0 trên 1, Web Push chưa đạt |
| 5 | UC-12, UC-13 | ✅ 2 trên 2 |

## Theo brief

| Brief | Việc | Trạng thái |
|---|---|---|
| F-001 | Trần kèm đặt sân (chỉ để tham khảo) | không code |
| F-002 | Yêu cầu đặt sân và xác nhận | ✅ |
| F-003 | Đăng ký và quản lý đơn vị | ✅ |
| F-004 | Đăng nhập bằng Google, xác minh số bằng OTP | 🟡 bước 1 đến 3 xong. Bước 4 (bật trên live) chờ bạn |
| F-005 | Chủ sân sửa giá và giờ mở cửa | ✅ |
| F-006 | Giới hạn đăng nhập, thu hồi phiên | ✅ |
| F-007 | Chủ sân nhập booking khách gọi điện | ✅ |
| F-008 | Xem giờ trống | ✅ |
| F-009 | Hủy booking và xem lịch sử | ✅ |
| F-010 | Tìm theo tên sân | ✅ |
| F-011 | Mở trận, hủy trận | ✅ |
| F-012 | Vào và rời trận, phòng chờ tức thì | ✅ |
| F-013 | Thông báo trong app | ✅ |
| F-014 | Web Push | 🔴 chưa đạt |
| F-015 | Dashboard chủ sân | ✅ |
| F-016 | Dashboard admin | ✅ |
| F-017 | Giao diện web theo `DESIGN.md` | ✅ |
| F-018 | Đăng nhập bằng Zalo, OTP qua Zalo | ⬜ chưa viết brief |
| F-019 | Khung app mobile tại `/app/` | ✅ |

13 trên 14 brief đầu tiên của intake đã xong. Ngày 23/10/2026 intake thêm Google, Zalo và app mobile (ADR 0006).

## Hôm nay, 23/10/2026

27 pull request đã merge (#94 đến #126). Mỗi lần merge tự deploy lên live. Bản cuối có `/api/health` trả `ok`.

1. **Thông báo đến cùng lúc (UC-14).** Danh sách thông báo tải lại khi có push, khi mở lại tab và theo chu kỳ (#94, #101).
2. **Giao diện web mới (F-017).** Màn hình web theo `DESIGN.md`, dùng được ở 390px, 1024px và 1280px (#102, #104, #105, #107, #108).
3. **Quyết định của bạn được ghi lại.** ADR 0006 (app mobile) được chấp nhận. F-004 được chấp nhận, có thêm OTP số điện thoại. Quyết định 10 giữ cách đếm người dùng hoạt động hiện tại (#112, #113, #124).
4. **App mobile (F-019).** Khung app mobile chạy tại `/app/` trên live. Thanh trên và thanh tab ẩn khi cuộn xuống và hiện lại khi cuộn lên (#114, #117, #119, #120).
5. **Đăng nhập Google (F-004, bước 1 đến 3).**
   - Bảng dữ liệu, quy tắc BR-33 đến BR-48 và ADR 0007 (#118).
   - Server: luồng Google, gửi mã OTP 6 số, giới hạn số lần gửi và số lần nhập (#121).
   - Màn hình: nút "Tiếp tục với Google", "Hoàn tất đăng ký", "Xác minh số điện thoại", liên kết và gỡ liên kết Google (#126).
   - Google còn tắt trên live, vì chưa có client ID và nhà cung cấp SMS.
6. **Công cụ và test.**
   - Kiểm tra phạm vi file của pull request chạy bằng code (#95, #122).
   - Sửa 3 test chạy lúc pass lúc fail (#123, #125).
   - verify-flow đợi lịch sân trước khi nhập booking khách gọi (#111).
   - verify-flow trên máy local pass 12 trên 12 bước.

Cần biết: sau bản deploy của #121, người dùng trên live phải đăng nhập lại một lần.

## Còn lại

Việc chờ bạn:

1. ⬜ **Bật Google trên live (F-004 bước 4).**
   1. Chọn nhà cung cấp SMS (đề xuất: eSMS), tạo tài khoản, và đăng ký brandname.
   2. Tạo secret trong Secret Manager.
   3. Làm các bước Google Cloud console trong brief F-004.
   4. Gửi Google client ID.
2. ⬜ **Test Web Push trên điện thoại Android** (ví dụ nghiệm thu của UC-14). iPhone làm sau khi Android đạt.
3. ⬜ **Chạy verify-flow trên live** với các biến `VERIFY_*`.
4. ⬜ **Trả lời:** có thêm cột `lastLoginAt` để đếm theo lần đăng nhập không. Mục 5 và 6 của intake. Các quyết định mở 1 đến 6, 8, 9 và tỉ lệ hết hạn trong `PROGRESS.md`.

Việc agent làm tiếp:

1. ⬜ Brief F-018: đăng nhập bằng Zalo, gửi OTP qua Zalo ZNS.
2. ⬜ Brief cho các tab của app mobile, từ F-020.
