---
style: ste80
lang: vi
---

# F-003: Đăng ký tài khoản, admin quản lý tài khoản và đơn vị

Status: accepted
Source: `docs/requirements/use-cases.md` UC-1 (luồng 1.0 đăng ký) và UC-10. `docs/requirements/business-rules.md` BR-20, BR-22, BR-23, BR-24, BR-28 và BR-29 (mới). `docs/requirements/data-dictionary.md`. Intake, mục Acceptance của UC-1 và UC-10, và open item 4. Phiên trước giao brief này ngày 17/10/2026.

## Goal

Người dùng tự đăng ký, và admin tạo được chủ sân, đơn vị, sân và khóa được tài khoản. Kiểm tra bằng cách cho chủ sân mới đăng nhập: chủ sân chỉ thấy đơn vị của mình.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Xác minh số điện thoại bằng OTP | Intake không yêu cầu. OTP cần dịch vụ SMS trả phí | Khi chạy thử thấy có tài khoản giả |
| Đăng nhập bằng Google | Intake chưa có. Cần cấu hình OAuth trên Google Cloud | Kế hoạch ở brief F-004, theo yêu cầu ngày 17/10/2026. Chưa code |
| Chủ sân sửa giá và giờ mở cửa (UC-11) | Use case riêng, theo thứ tự ra mắt của intake | Brief của UC-11 |
| Xóa đơn vị hoặc xóa sân | Booking đã có trỏ tới sân. Xóa làm mất lịch sử | Khi có yêu cầu |
| Đổi mật khẩu, quên mật khẩu, xóa tài khoản (BR-26) | Cần luồng xác minh riêng | Trước khi có đơn vị thật thứ 4 |
| Chủ sân đồng ý với thông báo ở lần đăng nhập đầu | Cơ sở pháp lý cho dữ liệu chủ sân còn mở (Open questions) | Khi bạn trả lời câu hỏi đó |
| Giới hạn số lần đăng ký và đăng nhập sai | Mức chạy thử thấp: 300 người dùng. Cần nơi lưu bộ đếm dùng chung cho các instance | Trước ngày chạy thử |
| Dashboard toàn trang (UC-13) | Use case riêng | Brief của UC-13 |

## Acceptance criteria

Dữ liệu chung: mỗi test tạo lại dữ liệu này trước khi chạy. Admin (`0900000000`). Chủ sân "Bình" (`0912345678`) quản lý "Cầu lông A": mở 06:00 (`opensAt` = 360), đóng 23:00 (`closesAt` = 1380), có "Sân 1" và "Sân 2", cầu lông, 80.000đ và 120.000đ một giờ. Chủ sân "Dũng" (`0912345679`) quản lý "Cầu lông B". Người dùng "An" (`0901234567`). Bây giờ là 17/10/2026 10:00 `Asia/Ho_Chi_Minh`.

Test trên dịch vụ thật dùng tên có tiền tố `test-`.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Số `0901112233` chưa có tài khoản | Người chưa đăng nhập gửi đăng ký: tên "Lan", số `0901112233`, mật khẩu `matkhau123`, `consent` = `true` | 201 `{ id, name: "Lan", role: "USER" }` và cookie `session`. `User.consentAt` = 17/10/2026 10:00 |
| AC-2 | Lan có tài khoản `0901112233`, mật khẩu `matkhau123`, tạo bằng đăng ký | Lan đăng nhập bằng `0901112233` và `matkhau123` | 200, `role` = `USER` |
| AC-3 | An có tài khoản `0901234567` | Người chưa đăng nhập gửi đăng ký với số `0901234567` | 409 "Số điện thoại này đã có tài khoản" |
| AC-4 | Số `0901112233` chưa có tài khoản | 10 request đăng ký cùng số gửi cùng lúc | Đúng 1 request nhận 201. 9 request nhận 409 "Số điện thoại này đã có tài khoản" |
| AC-5 | Số `0901112233` chưa có tài khoản | Người chưa đăng nhập gửi đăng ký với `consent` = `false`, rồi gửi lại mà không có `consent` | Mỗi request nhận 400 "Bạn cần đồng ý với thông báo bảo vệ dữ liệu cá nhân". Không có tài khoản mới |
| AC-6 | Số `0901112233` chưa có tài khoản | Người chưa đăng nhập gửi đăng ký với mật khẩu `1234567` (7 ký tự) | 400 "Mật khẩu có ít nhất 8 ký tự" |
| AC-7 | Số `0912345681` chưa có tài khoản | Admin tạo chủ sân: tên "Giang", số `0912345681`, mật khẩu `matkhau123` | 201, `role` = `OWNER`, `lockedAt` = null. Giang đăng nhập được bằng số và mật khẩu đó |
| AC-8 | An có tài khoản `0901234567` | Admin tạo chủ sân với số `0901234567` | 409 "Số điện thoại này đã có tài khoản" |
| AC-9 | An không bị khóa | Admin khóa An, rồi An đăng nhập bằng đúng mật khẩu | Khóa trả 200 với `lockedAt` = 17/10/2026 10:00. Đăng nhập trả 403 "Tài khoản đã bị khóa" |
| AC-10 | An đã đăng nhập và có cookie `session` | Admin khóa An, rồi An gọi `GET /api/auth/me` bằng cookie cũ | 401 |
| AC-11 | An bị khóa | Admin mở khóa An, rồi An đăng nhập | Mở khóa trả 200 với `lockedAt` = null. Đăng nhập trả 200 |
| AC-12 | Admin đã đăng nhập | Admin khóa chính tài khoản admin | 400 "Không khóa được tài khoản admin". Admin vẫn dùng được phiên của mình |
| AC-13 | Bình và An đã đăng nhập. Một request khác không có cookie | Mỗi người gọi `POST /api/admin/owners`, `GET /api/admin/owners`, `POST /api/admin/users/search`, `POST /api/admin/users/:id/lock`, `POST /api/admin/users/:id/unlock` | Bình nhận 403, An nhận 403, request không có cookie nhận 401, ở mỗi route. Không tài khoản nào bị khóa |
| AC-14 | Admin đã đăng nhập | Admin mở `GET /api/admin/owners`, rồi tìm `{ phone: "0901234567" }`, `{ phone: "0909999999" }` và `{ phone: "09" }` | Danh sách chủ sân là Bình, Dũng, không có An. Tìm số của An trả đúng 1 tài khoản. Tìm số chưa có trả `[]`. Số `09` trả 400 "Số điện thoại có 10 chữ số và bắt đầu bằng 0". Không response nào có `passwordHash` |
| AC-15 | Giang là chủ sân, chưa có đơn vị | Admin tạo đơn vị "Cầu lông C": chủ sân Giang, địa chỉ "12 Lê Lợi", số `0912345681`, mở 06:00, đóng 23:00. Rồi admin thêm "Sân 1" và "Sân 2", cầu lông, 80.000đ và 120.000đ | 201 cho đơn vị và cho mỗi sân. `GET /api/venues` có "Cầu lông C" với 2 sân |
| AC-16 | Giang quản lý "Cầu lông C" có 2 sân | Giang gọi `GET /api/owner/venues` | 200, chỉ có "Cầu lông C" với 2 sân. Không có "Cầu lông A" và "Cầu lông B" |
| AC-17 | Admin đã đăng nhập | Admin tạo đơn vị với `ownerId` của An (vai trò `USER`), rồi với một `ownerId` không có trong DB | Mỗi request nhận 400 "Chủ sân không hợp lệ" |
| AC-18 | Admin đã đăng nhập | Admin tạo đơn vị với `opensAt` = 1380, `closesAt` = 360 | 400 "Giờ đóng cửa phải sau giờ mở cửa" |
| AC-19 | "Cầu lông A" mở lúc 06:00 | Admin sửa "Cầu lông A" bằng `{ closesAt: 300 }`, rồi bằng `{ ownerId: <id của An> }` | Lần đầu nhận 400 "Giờ đóng cửa phải sau giờ mở cửa". Lần sau nhận 400 "Chủ sân không hợp lệ". "Cầu lông A" không đổi |
| AC-20 | "Cầu lông A" có "Sân 1" và "Sân 2" | Admin thêm sân tên "Sân 1" vào "Cầu lông A", rồi đổi tên "Sân 2" thành "Sân 1" | Mỗi request nhận 409 "Tên sân đã có trong đơn vị này" |
| AC-21 | "Sân 1" của "Cầu lông A" có giá cao điểm 120.000đ | Admin sửa "Sân 1" bằng `{ pricePeak: 150000 }`, và sửa "Cầu lông A" bằng `{ closesAt: 1320 }` | 200 cho mỗi lần sửa. `GET /api/venues` trả `pricePeak` = 150000 và `closesAt` = 1320 |
| AC-22 | Bình và An đã đăng nhập. Một request khác không có cookie | Mỗi người gọi `GET` và `POST /api/admin/venues`, `PATCH /api/admin/venues/:id`, `POST /api/admin/venues/:id/courts`, `PATCH /api/admin/courts/:id`. An và admin gọi `GET /api/owner/venues` | Ở mỗi route admin: Bình 403, An 403, không có cookie 401. Ở `GET /api/owner/venues`: An 403, admin 403, không có cookie 401 |
| AC-23 | Migration của F-003 đã chạy | Một lệnh SQL chèn đơn vị có `closesAt` = `opensAt`, rồi chèn sân có `priceNormal` = 0 | Mỗi lệnh nhận SQLSTATE `23514` |
| AC-24 | Người chưa đăng nhập mở web | Người đó bấm "Tạo tài khoản", nhập tên, số và mật khẩu, nhưng chưa tick ô đồng ý | Nút "Tạo tài khoản" không bấm được. Màn hình hiện từng đoạn của `PRIVACY_NOTICE` |
| AC-25 | Màn hình ở AC-24 | Người đó tick ô đồng ý và bấm "Tạo tài khoản" | Màn hình hiện form gửi yêu cầu đặt sân và tên "Lan" ở thanh trên |
| AC-26 | Admin đã đăng nhập trên web | Admin tạo chủ sân "Giang", rồi tạo đơn vị "Cầu lông C" cho Giang, rồi thêm "Sân 1" | Danh sách đơn vị trên màn hình hiện "Cầu lông C" với "Sân 1" |
| AC-27 | Admin đã đăng nhập trên web | Admin tìm số `0901234567` và bấm "Khóa" | Dòng của An hiện "Đã khóa" và nút "Mở khóa" |
| AC-28 | Bình đã đăng nhập trên web | Màn hình chủ sân mở xong | Mục "Đơn vị của tôi" hiện "Cầu lông A", "Sân 1" và "Sân 2", mỗi sân có "80.000đ" và "120.000đ". Không có đơn vị khác |
| AC-29 | An bị khóa từ 16/10/2026 10:00 | Admin khóa An lần nữa, rồi khóa một id không có trong DB | Lần đầu nhận 200 với `lockedAt` = 16/10/2026 10:00. Lần sau nhận 404 |
| AC-30 | Admin đã đăng nhập | Admin tạo đơn vị với `opensAt` = 375, rồi thêm sân với `priceNormal` = 0 vào "Cầu lông A" | Lần đầu nhận 400 "Giờ phải theo bước 30 phút". Lần sau nhận 400 "Giá phải lớn hơn 0" |

## Contract

Zod trong `packages/shared/src/` là nguồn duy nhất. Mọi route `/api/admin/*` chỉ cho vai trò `ADMIN`. Route `/api/owner/venues` chỉ cho vai trò `OWNER`. Không route nào đặt số điện thoại trong URL.

| Endpoint or schema | Change | Request | Response and errors |
|---|---|---|---|
| `RegisterRequest` | new | `name` (1–100 ký tự, bỏ khoảng trắng hai đầu), `phone`, `password` (8–128 ký tự), `consent` (`true`) | — |
| `PRIVACY_NOTICE` | new | Hằng chuỗi tiếng Việt, mỗi dòng một đoạn: thông báo bảo vệ dữ liệu cá nhân hiện ở màn đăng ký | — |
| `POST /api/auth/register` | new | `RegisterRequest`. Server bỏ qua trường `role` | 201 `{ id, name, role }` và cookie `session` như đăng nhập · 400 · 409 |
| `CreateOwnerRequest` | new | `name`, `phone`, `password` (8–128 ký tự) | — |
| `AccountView` | new | — | `id`, `name`, `phone`, `role`, `lockedAt`, `createdAt` |
| `POST /api/admin/owners` | new | `CreateOwnerRequest` | 201 `AccountView` · 400 · 409 |
| `GET /api/admin/owners` | new | — | 200 `AccountView[]` vai trò `OWNER`, theo tên |
| `POST /api/admin/users/search` | new | `{ phone }` | 200 `AccountView[]` có 0 hoặc 1 phần tử · 400 |
| `POST /api/admin/users/:id/lock` | new | — | 200 `AccountView`. Khóa lại tài khoản đã khóa trả 200 và giữ `lockedAt` cũ · 400 "Không khóa được tài khoản admin" · 404 |
| `POST /api/admin/users/:id/unlock` | new | — | 200 `AccountView` · 404 |
| `VenueInput` | new | `ownerId`, `name`, `address`, `phone`, `opensAt`, `closesAt`, theo data dictionary | — |
| `VenueUpdate` | new | Các trường của `VenueInput`, mọi trường không bắt buộc | — |
| `CourtInput` | new | `name`, `sport`, `priceNormal`, `pricePeak`, theo data dictionary | — |
| `CourtUpdate` | new | `name`, `priceNormal`, `pricePeak`, mọi trường không bắt buộc. Không đổi được `sport` | — |
| `AdminVenueView` | new | — | `VenueView` cộng `owner` (`id`, `name`, `phone`) |
| `GET /api/admin/venues` | new | — | 200 `AdminVenueView[]`, theo tên |
| `POST /api/admin/venues` | new | `VenueInput` | 201 `AdminVenueView` · 400 "Chủ sân không hợp lệ" hoặc "Giờ đóng cửa phải sau giờ mở cửa" |
| `PATCH /api/admin/venues/:id` | new | `VenueUpdate` | 200 `AdminVenueView` · 400 · 404 |
| `POST /api/admin/venues/:id/courts` | new | `CourtInput` | 201 `CourtView` · 400 · 404 · 409 "Tên sân đã có trong đơn vị này" |
| `PATCH /api/admin/courts/:id` | new | `CourtUpdate` | 200 `CourtView` · 400 · 404 · 409 |
| `GET /api/owner/venues` | new | — | 200 `VenueView[]` của các đơn vị có `ownerId` là người gọi |

Ở `PATCH /api/admin/venues/:id`, server gộp body với đơn vị đang lưu. Rồi server kiểm kết quả bằng `VenueInput` và kiểm `ownerId` có vai trò `OWNER`. Server không lưu gì khi một kiểm tra sai.

Lỗi 400 của Zod trả câu tiếng Việt của lỗi đầu tiên, theo thứ tự trường. Các câu đó là câu ở AC-5, AC-6, AC-14, AC-18 và AC-30. Lỗi Zod khác trả "Dữ liệu không hợp lệ". Service đọc DB và trả hai câu 400 còn lại: "Không khóa được tài khoản admin" và "Chủ sân không hợp lệ".

Service đổi lỗi unique (`P2002`) của `User.phone` và của (`Court.venueId`, `Court.name`) thành 409. Khi hai lần sửa đơn vị chạy cùng lúc, CHECK trong DB có thể chặn lần sau với `23514`. Service đổi lỗi này thành 400 "Giờ đóng cửa phải sau giờ mở cửa".

## Data

| Table | Change | Migration step |
|---|---|---|
| `User` | mới: `consentAt` timestamptz(3), có thể null. Lúc người dùng đồng ý với thông báo bảo vệ dữ liệu cá nhân khi đăng ký | expand. Cột null được, nên tài khoản cũ không đổi |
| `Venue` | mới: `CHECK ("opensAt" >= 0 AND "closesAt" <= 1440 AND "closesAt" > "opensAt" AND "opensAt" % 30 = 0 AND "closesAt" % 30 = 0)` | expand. Dữ liệu seed và dữ liệu trên dịch vụ thật đã thỏa |
| `Court` | mới: `CHECK ("priceNormal" > 0 AND "pricePeak" > 0)` | expand. Viết tay trong cùng migration |
| `docs/requirements/data-dictionary.md` | thêm dòng `User.consentAt`, thêm `consentAt` vào thành phần của `User` | — |
| `docs/requirements/business-rules.md` | thêm BR-29: người dùng tự đăng ký phải đồng ý với thông báo bảo vệ dữ liệu cá nhân. Nguồn: giả định cho open item 4 của intake | — |

Không thêm bảng.

## Build order

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Hợp đồng và schema: Zod của F-003, `PRIVACY_NOTICE`, cột `consentAt`, CHECK của `Venue` và `Court`, BR-29, data dictionary | `packages/shared/src/`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/` (thư mục mới), `apps/api/prisma/migration.test.ts`, `docs/requirements/data-dictionary.md`, `docs/requirements/business-rules.md`, file brief này | Test Zod cho AC-5, AC-6, AC-18. AC-23 trên Postgres thật |
| 2 | Server: đăng ký, tài khoản chủ sân, khóa và mở khóa | `apps/api/src/modules/auth/`, `apps/api/src/modules/admin/` (mới), `apps/api/src/app.module.ts` | AC-1 tới AC-14, AC-29 |
| 3 | Server: admin tạo và sửa đơn vị và sân, đơn vị của chủ sân | `apps/api/src/modules/admin/`, `apps/api/src/modules/venues/` | AC-15 tới AC-22, AC-30 |
| 4 | Màn hình: đăng ký, màn admin, mục "Đơn vị của tôi" | `apps/web/src/features/auth/`, `apps/web/src/features/admin/` (mới), `apps/web/src/features/venues/` (mới), `apps/web/src/app/`, `apps/web/src/components/`, `apps/web/src/lib/` | AC-24 tới AC-28 |

Nếu PR 4 vượt khoảng 400 dòng thay đổi, tách thành 4a (đăng ký, đơn vị của tôi) và 4b (màn admin).

## Edit boundaries

- May edit: các path trong bảng Build order, `apps/api/package.json`, `apps/web/package.json`, `pnpm-lock.yaml`, `PROGRESS.md`.
- Leave unchanged without approval: `AGENTS.md`, `.dependency-cruiser.cjs`, `scripts/check.mjs`, `.github/workflows/`, `apps/api/src/setup-app.ts`, `apps/api/src/modules/health/`, `apps/api/src/modules/bookings/`, `apps/api/src/modules/database/`, migration đã merge.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Schema: cột mới trên `User`, CHECK mới trên `Venue` và `Court` | PR 1 | Cột null được. CHECK chạy được trên dữ liệu đang có. AC-23 chạy trên Postgres thật. Review bằng phiên mới |
| Sửa từng phần làm hỏng ràng buộc của đơn vị | `PATCH /api/admin/venues/:id` | Server gộp rồi kiểm bằng `VenueInput`. CHECK trong DB là lớp chặn cuối. AC-19 kiểm điều này |
| Đồng thời: hai đăng ký cùng số, hai sân cùng tên | `POST /api/auth/register`, `POST /api/admin/owners`, route sân | Ràng buộc unique trong DB quyết định. `P2002` thành 409. AC-4 chạy trên Postgres thật. Review bằng phiên mới |
| Dữ liệu cá nhân: admin thấy số điện thoại | `GET /api/admin/owners`, `POST /api/admin/users/search` | Admin chỉ xem danh sách chủ sân. Admin tìm người dùng theo đúng một số, không duyệt danh sách người dùng (BR-20). Số điện thoại nằm trong body, không nằm trong URL, nên không vào request log của Cloud Run. Review bằng phiên mới |
| Dữ liệu cá nhân: đồng ý khi đăng ký (Luật 91/2025) | PR 1, PR 2, PR 4 | Ô đồng ý bắt buộc, thông báo hiện trên màn đăng ký, server lưu `consentAt` (BR-29). Review bằng phiên mới |
| Dữ liệu cá nhân: đổi chủ sân của đơn vị | `PATCH /api/admin/venues/:id` | Chủ sân mới thấy số điện thoại trong các booking của đơn vị (BR-20). Chủ sân cũ mất quyền đó ngay |
| Bảo mật: leo quyền qua route admin | PR 2, PR 3 | `@Roles('ADMIN')` trên cả controller. AC-13 và AC-22 kiểm mọi route với chủ sân, người dùng và request không có cookie. Review bằng phiên mới |
| Bảo mật: lộ mật khẩu | PR 2 | Băm argon2 như đăng nhập. `AccountView` không có `passwordHash`. AC-14 kiểm điều này |
| Bảo mật: admin biết mật khẩu ban đầu của chủ sân | UC-10 bước 1 | Admin đặt mỗi chủ sân một mật khẩu riêng và gửi qua kênh riêng. Chủ sân đổi mật khẩu khi brief đổi mật khẩu xong |
| Bảo mật: dò số đã đăng ký, đoán mật khẩu, và làm hết RAM bằng argon2 | `POST /api/auth/register`, `POST /api/auth/login` | Intake yêu cầu báo "số đã có tài khoản", nên dò số là rủi ro đã chấp nhận. Mỗi lần băm argon2 dùng khoảng 19 MB RAM. Chưa giới hạn số lần thử. `PROGRESS.md` ghi việc này là bước phải xong trước ngày chạy thử (open decision 2) |
| Đơn vị của chủ sân bị khóa | `GET /api/venues` | Đơn vị vẫn nhận yêu cầu, nhưng không ai xác nhận, nên yêu cầu hết hạn. Admin chuyển đơn vị sang chủ sân khác |
| Đổi giờ mở cửa khi đã có booking ngoài giờ mới | PR 3 | Booking cũ giữ nguyên. Giờ mới chỉ áp dụng cho yêu cầu mới |

## Assumptions

- Open item 4 của intake (Luật 91/2025) chưa có câu trả lời. Lựa chọn an toàn hơn: ô đồng ý bắt buộc và thông báo bảo vệ dữ liệu cá nhân ở màn đăng ký. Server lưu lúc đồng ý vào `User.consentAt`. Bạn và người tư vấn luật sửa nội dung thông báo sau.
- Chỉ người dùng tự đăng ký mới có `consentAt`. Tài khoản do admin tạo và tài khoản seed có `consentAt` = null.
- Mật khẩu dài 8–128 ký tự. Intake không ghi độ dài. Đây là quyết định sản phẩm cho người dùng điện thoại. NIST SP 800-63B-4 đòi 15 ký tự cho mật khẩu là yếu tố duy nhất, nên bạn có thể nâng mức này sau.
- Server chưa so mật khẩu với danh sách mật khẩu phổ biến hoặc đã lộ. Việc này quay lại cùng với giới hạn số lần thử.
- Đăng ký xong thì đăng nhập luôn (UC-1, bước 3). Cookie và thời hạn phiên giống đăng nhập: 30 ngày.
- Admin không duyệt danh sách người dùng, vì BR-20 chỉ cho chủ sân của booking và host thấy số điện thoại của người dùng. Admin tìm một tài khoản theo đúng số điện thoại để khóa.
- Admin không khóa được tài khoản admin. Điều này tránh việc admin tự khóa mình và mất quyền vào trang.
- Admin mở khóa được tài khoản, vì khóa nhầm thì phải sửa được. Intake chỉ ghi khóa.
- Khóa tài khoản có hiệu lực ngay, vì guard đọc `lockedAt` ở mỗi request. Phiên cũ của tài khoản bị khóa nhận 401.
- Admin sửa được giá sân trong slice này, vì UC-10 cho admin sửa sân. Booking cũ giữ giá cũ (BR-6), vì `priceTotal` đã lưu lúc đặt.
- Admin không đổi được môn của sân, vì trận sau này phải cùng môn với sân (data dictionary, `Match.sport`).
- Thông báo bảo vệ dữ liệu cá nhân chưa có số phiên bản. Khi nội dung đổi, một brief sau thêm phiên bản.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Luật 91/2025 có yêu cầu thêm gì ngoài ô đồng ý và thông báo không (open item 4 của intake)? | Bạn, với người tư vấn luật | không |
| Nội dung chính thức của thông báo bảo vệ dữ liệu cá nhân | Bạn, với người tư vấn luật | không |
| Dữ liệu của chủ sân dựa trên hợp đồng với đơn vị, hay chủ sân cũng phải đồng ý riêng? | Bạn, với người tư vấn luật | không |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
