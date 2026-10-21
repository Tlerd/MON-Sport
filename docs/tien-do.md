# Tiến độ MONSPORT bản đầu

Cập nhật: 21/10/2026. Nguồn: `docs/requirements/intake-monsport-v1.md` (UC-1 đến UC-14), `PROGRESS.md`, và git.

## Cách làm việc

- Code theo **use case (UC)** của intake, không theo user story.
- Mỗi nhóm UC có một **brief** `F-0xx` trong `docs/briefs/`. Brief chia việc thành các bước, mỗi bước một pull request.
- Mỗi brief có các **tiêu chí nghiệm thu** `AC-n`. Mỗi `AC-n` có một test tự động. Một UC xong khi mọi `AC-n` của brief pass trong `pnpm check` và bản đã deploy. `pnpm check` pass ngày 21/10/2026.

## Kết quả

**14 trên 14 use case đã code, test pass và deploy (100%).**
Còn 1 việc kiểm tay: thử UC-14 trên điện thoại thật.

Ký hiệu: ✅ xong. 🟡 xong, còn một việc kiểm tay. ⬜ chưa làm.

## Theo use case

| UC | Việc | Brief | Trạng thái |
|---|---|---|---|
| UC-1 | Đăng ký và đăng nhập | F-002, F-003, F-006 | ✅ |
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
| UC-14 | Thông báo trong app và Web Push | F-013, F-014 | 🟡 chưa thử trên điện thoại thật |

## Theo thứ tự ra mắt (intake, mục Assumptions)

| Đợt | Use case | Tiến độ |
|---|---|---|
| 1 | UC-1, UC-10, UC-11 | ✅ 3 trên 3 |
| 2 | UC-2 đến UC-6 | ✅ 5 trên 5 |
| 3 | UC-7 đến UC-9 | ✅ 3 trên 3 |
| 4 | UC-14 | 🟡 1 trên 1, chờ thử điện thoại |
| 5 | UC-12, UC-13 | ✅ 2 trên 2 |

## Theo brief

| Brief | Việc | Trạng thái |
|---|---|---|
| F-001 | Trần kèm đặt sân (chỉ để tham khảo) | không code |
| F-002 | Yêu cầu đặt sân và xác nhận | ✅ |
| F-003 | Đăng ký và quản lý đơn vị | ✅ |
| F-004 | Đăng nhập bằng Google | ⬜ chờ quyết định 7. Không nằm trong intake |
| F-005 | Chủ sân sửa giá và giờ mở cửa | ✅ |
| F-006 | Giới hạn đăng nhập, thu hồi phiên | ✅ |
| F-007 | Chủ sân nhập booking khách gọi điện | ✅ |
| F-008 | Xem giờ trống | ✅ |
| F-009 | Hủy booking và xem lịch sử | ✅ |
| F-010 | Tìm theo tên sân | ✅ |
| F-011 | Mở trận, hủy trận | ✅ |
| F-012 | Vào và rời trận, phòng chờ tức thì | ✅ |
| F-013 | Thông báo trong app | ✅ |
| F-014 | Web Push | 🟡 |
| F-015 | Dashboard chủ sân | ✅ |
| F-016 | Dashboard admin | ✅ |

14 trên 14 brief nằm trong intake đã xong. F-004 nằm ngoài intake.

## Còn lại

1. 🟡 Thử Web Push trên điện thoại thật qua địa chỉ HTTPS của Cloud Run. Điện thoại chủ sân phải nhận push trong 30 giây (ví dụ nghiệm thu của UC-14).
2. ⬜ F-004 chờ bạn viết "chấp nhận F-004" (quyết định 7).
3. ⬜ 10 quyết định mở trong `PROGRESS.md`. Quan trọng nhất: số sân của từng đơn vị, ngày chạy thử, định nghĩa người dùng hoạt động, và nội dung thông báo theo Luật 91/2025.
