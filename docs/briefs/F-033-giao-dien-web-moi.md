---
style: ste80
lang: vi
---

# F-033: Giao diện web mới theo mẫu "Ra Sân"

Status: accepted
Source:

- Người dùng, 14/11/2026: "xóa sạch giao diện cũ, dùng giao diện mới này (chỉ web), những tính năng chưa làm khi ấn nút cứ ghi là sắp ra mắt, nếu quy trình trong dự án thiếu thì tự bổ sung". <!-- lint-ok -->
- Mẫu: `docs/design/web-ui-v3/` (`index.html`, `styles.css`, `app.js`, `data.js`).
- `docs/adr/0009-giao-dien-web-theo-mau-ra-san.md`: mẫu là nguồn của giao diện web, và quy tắc "Sắp ra mắt".
- Intake `docs/requirements/intake-monsport-v1.md`: bảng "Tên gọi", UC-2 (câu "App mới ra mắt..."), "Quality" (web vẫn dùng được ở màn rộng 390px).

## Goal

Người dùng, chủ sân, nhân viên và admin dùng web với khung, màu, chữ và bố cục của mẫu. Mọi chức năng cũ vẫn chạy như trước. Mỗi nút của mẫu chưa có chức năng thật hiện "Sắp ra mắt".

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| `apps/mobile` | Người dùng nói "chỉ web". App giữ `DESIGN.md` | Khi người dùng yêu cầu |
| Đổi API, schema, `packages/shared`, luật nghiệp vụ | Brief này chỉ đổi màn hình | Không có kế hoạch |
| Làm chức năng mới của mẫu. Người chơi: đội, trận đội gặp đội, trò chuyện, rủ chơi, chia sẻ, sửa hồ sơ, tìm kiếm chung. Chủ sân: khóa khung giờ, bật tắt sân, đăng ký đơn vị mới. Admin: báo cáo vi phạm, bật tắt môn. Đơn vị: đánh giá và khoảng cách | Chưa có trong intake | Khi intake và brief của từng chức năng được duyệt |
| Chuyển vai trò trong menu tài khoản | Mẫu dùng nó để xem thử. Vai trò thật đến từ tài khoản | Không có kế hoạch |

## Quy tắc chung

1. Bố cục, class và token lấy từ `docs/design/web-ui-v3/styles.css` và `app.js`. `apps/web/src/app/styles.css` cũ bị xóa hết và viết lại từ `styles.css` của mẫu. Không còn class của giao diện cũ trong `apps/web/src`, trừ các class mà "Class giữ lại" liệt kê.
2. Token nằm trong `apps/web/src/app/theme.css` (chép `:root` của mẫu). Component không ghi mã màu thô.
3. Tên sản phẩm là MONSPORT. Logo là quả bóng `--lime` và chữ "MONSPORT" bằng họ chữ hiển thị.
4. Dùng tên gọi của intake: "trận" (không "kèo"), "đơn vị" (không "cụm sân"), "sân", "host", "phòng chờ". Giữ nguyên chữ của mọi nút, tiêu đề và thông báo đang có, trừ khi bảng "Màn hình" ghi khác.
5. Không hiện dữ liệu giả của mẫu. Một khối không có dữ liệu thật hiện trạng thái rỗng "Sắp ra mắt". Một nút không có chức năng thật gọi `comingSoon()`: thông báo nổi "Sắp ra mắt", không đổi trang, không gọi API.
6. Không dòng "Giao diện mẫu, dữ liệu giả lập" và không tên model trong sản phẩm.
7. Bố cục theo chiều rộng theo `docs/design/web-responsive.md`, không theo các `@media` của mẫu và không theo `DESIGN.md`. Trang không cuộn ngang từ 360px trở lên. Bỏ `min-width: 720px` của mẫu.
8. Icon giao diện dùng `lucide-react` như hiện tại. Icon môn và hình sân (`courtArt`) chép từ `app.js` thành component React.
9. Giữ tiêu điểm bàn phím nhìn thấy được, `prefers-reduced-motion`, và nhãn `aria` đang có.

## Màn hình

Đường dẫn cũ giữ nguyên. Đường dẫn mới có chữ "(mới)".

| Vai trò | Đường dẫn | Màn theo mẫu | Nội dung thật | "Sắp ra mắt" |
|---|---|---|---|---|
| Mọi vai trò | khung | `topbar` | Logo về trang đầu của vai trò. Chuông là `Notifications` (không có với nhân viên). Menu tài khoản (`pop`): tên, vai trò, `GoogleAccountActions` (người dùng), "Hồ sơ" (người dùng), "Đăng xuất". Khách thấy liên kết "Đăng nhập" (thẻ `a`). Tên người dùng luôn hiện trên thanh trên ở mọi cỡ màn, trong `.who .name` | — |
| Khách, người dùng | khung | tab của `topbar` | "Trang chủ" `/`, "Ghép trận" `/phong-cho`, "Sân" `/san`, "Đội" `/doi`, "Lịch" `/lich-cua-toi`. Nút "Tạo trận": người dùng tới `/lich-cua-toi`, khách tới `/dang-nhap` (một trận mở trên một booking). Ô tìm kiếm: Enter mở `/san?q=<chữ>`, và `/san` điền ô tìm theo tên sân (F-010) từ `q` | Nút "Tin nhắn" |
| Khách, người dùng | `/` | `home` (3 cột) | Cột trái: thẻ tên tới `/ho-so` (khách thấy liên kết "Đăng nhập"), liên kết "Lịch của tôi", "Ghép trận", "Tìm sân". Giữa: ô tạo trận, chip môn, danh sách trận đang mở từ `GET /api/matches` dạng thẻ cuống vé. Bấm thẻ tới `/phong-cho?tran=<id>`. Cột phải: "Sắp ra sân" (booking sắp tới của người dùng, tối đa 2), "Đơn vị" (3 đơn vị đầu của `GET /api/venues`, tới `/san/<id>`). Xử lý `?google=` và `?google_error=` vẫn ở `/` | "Tạo trận đội", lọc "Trận đội", "Đội của tôi", "Thành tích", khối "Bạn chơi quen" |
| Khách, người dùng | `/phong-cho` | `matchesPage` (danh sách và chi tiết) | `Lobby` với thẻ `mc compact`, khung chi tiết `detail` (hero, `facts`, người chơi, hàng chờ F-028, điểm uy tín F-032, trình độ F-029). `?tran=<id>` mở chi tiết của trận đó | Lọc "Trận đội", khối "Trò chuyện trong trận", "Chia sẻ trận" |
| Khách, người dùng | `/san` (mới) | `venuesPage` | Lưới thẻ đơn vị từ `GET /api/venues`: hình sân, icon môn, tên, địa chỉ, số sân, giá thấp nhất. Phần tìm theo tên sân (F-010) và "Giờ trống" (F-008) của `VenueBrowser` nằm ở đây, kèm câu UC-2 đầy đủ. Mọi màn hiện giờ trống đều hiện câu UC-2 đầy đủ, một lần | — |
| Khách, người dùng | `/san/:id` | `venuePage` | Đầu trang của đơn vị, dải ngày, `SlotGrid`, khối tóm tắt bên phải với giá, "Gọi chủ sân", câu UC-2 đầy đủ và nút gửi yêu cầu | — |
| Khách, người dùng | `/doi` (mới) | `teamsPage` | Tiêu đề "Đội" | Cả trang: trạng thái rỗng "Sắp ra mắt". Nút "Lập đội mới" |
| Người dùng | `/lich-cua-toi` | `schedulePage` | Hai tab "Sắp tới" và "Trận đã vào" dạng `seg`. `MyBookings` (mở trận, hủy, chấm điểm) và `JoinedMatches` | — |
| Người dùng | `/ho-so` (mới) | `profilePage` | Tên, số điện thoại của chính người dùng, trình độ nếu phiên có | "Sửa hồ sơ", các ô số liệu, "Trận gần đây" |
| Khách | `/dang-nhap` | thẻ `card` giữa trang | `AuthPanel` và các màn Google | — |
| Chủ sân, nhân viên | khung | `dash` | Thanh bên: "Tổng quan" (chỉ chủ sân), "Yêu cầu" (kèm số), "Lịch sân", "Doanh thu" (chỉ chủ sân), "Đơn vị và giá" (chỉ chủ sân). Thanh trên có nhãn "Kênh chủ sân" | — |
| Chủ sân | `/chu-san/tong-quan` (mới) | `ownerOverview` | Hai lời gọi: `GET /api/owner/bookings?status=PENDING` và `GET /api/owner/bookings?status=CONFIRMED` (không có `status`, API chỉ trả `PENDING`). Ô "Yêu cầu chờ duyệt" đếm lời gọi đầu. Ô "Lượt đặt hôm nay" đếm booking của lời gọi sau có `vnDateString(startAt) === vnDateString(now)`, 3 yêu cầu chờ mới nhất với liên kết tới `/chu-san/yeu-cau`. Không có số tiền ở màn này | Biểu đồ "Doanh thu 7 ngày", ô "Lấp đầy giờ vàng", "Lịch hôm nay" |
| Chủ sân, nhân viên | `/chu-san/yeu-cau` | `ownerRequests` | `OwnerRequests` và `PhoneBookings` dạng hàng `req` | — |
| Chủ sân, nhân viên | `/chu-san/lich` | `ownerCalendar` | `SchedulePage` (lịch, nhập booking khách gọi, đặt cố định) | Không thêm khóa khung giờ |
| Chủ sân | `/chu-san/don-vi` | `ownerCourts` | `MyVenues` dạng `ov` và `tbl`, `StaffSection` | "Đăng ký đơn vị mới" |
| Chủ sân | `/chu-san/doanh-thu` | `ownerRevenue` | `FinancialDashboard` dạng `tiles` | — |
| Admin | khung | `dash` | Thanh bên: "Tổng quan" `/admin`, "Tài khoản và đơn vị" `/admin/tai-khoan` (mới), "Báo cáo vi phạm" `/admin/bao-cao` (mới), "Môn thể thao" `/admin/mon` (mới). Thanh trên có nhãn "Trang quản trị" | — |
| Admin | `/admin` | `adminOverview` | `AdminStats` ("Số liệu toàn trang") dạng `tiles` và `tbl` | — |
| Admin | `/admin/tai-khoan` | `adminUsers`, `adminVenues` | Phần chủ sân, khóa tài khoản và đơn vị của `AdminPanel` | — |
| Admin | `/admin/bao-cao`, `/admin/mon` | `adminReports`, `adminSports` | Tiêu đề trang | Cả trang: trạng thái rỗng "Sắp ra mắt" |

Trang đầu sau đăng nhập giữ nguyên: người dùng `/`, chủ sân `/chu-san/yeu-cau`, nhân viên `/chu-san/lich`, admin `/admin`.

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Một màn nằm trong `ToastProvider` | Code gọi `comingSoon()` | Vùng `role="status"` hiện đúng chữ "Sắp ra mắt". Sau 3400 ms, chữ biến mất. Test: `apps/web/src/components/Toast.test.tsx` (new) |
| AC-2 | Khách mở `/` | Thanh trên hiện ra | Có liên kết "Trang chủ" (`/`), "Ghép trận" (`/phong-cho`), "Sân" (`/san`), "Đội" (`/doi`), "Lịch" (`/lich-cua-toi`), và chữ "MONSPORT". Test: `apps/web/src/app/App.test.tsx` |
| AC-3 | Người dùng mở `/` | Người dùng bấm "Tin nhắn", rồi bấm "Tạo trận đội" | Mỗi lần bấm hiện "Sắp ra mắt". Đường dẫn vẫn là `/`. Không có lời gọi `fetch` mới. Test: `apps/web/src/app/App.test.tsx` |
| AC-4 | `GET /api/matches` trả 2 trận đang mở | Khách mở `/` | Trang hiện 2 thẻ trận, mỗi thẻ là liên kết tới `/phong-cho?tran=<id>`. Trang không có lưới giờ. Test: `apps/web/src/app/HomePage.test.tsx` (new) |
| AC-5 | Khách ở `/`, rồi người dùng ở `/` | Mỗi người bấm "Tạo trận" | Khách tới `/dang-nhap`. Người dùng tới `/lich-cua-toi`. Test: `apps/web/src/app/HomePage.test.tsx` |
| AC-6 | `GET /api/matches` trả trận A và B | Người dùng mở `/phong-cho?tran=<id của B>` | Khung chi tiết hiện trận B. Test: `apps/web/src/features/matches/Lobby.test.tsx` |
| AC-7 | `GET /api/venues` trả 2 đơn vị | Khách mở `/san` | Trang hiện 2 thẻ đơn vị, mỗi thẻ là liên kết tới `/san/<id>`. Bấm một thẻ mở `SlotGrid` của đơn vị đó và câu UC-2 đầy đủ. Test: `apps/web/src/app/VenuesPage.test.tsx` (new) |
| AC-8 | Người dùng mở `/doi` | Trang hiện ra | Có tiêu đề "Đội" và chữ "Sắp ra mắt". Bấm "Lập đội mới" hiện thông báo "Sắp ra mắt". Test: `apps/web/src/app/App.test.tsx` |
| AC-9 | Chủ sân có 2 booking `PENDING` và 1 booking `CONFIRMED` hôm nay. `now` cố định | Chủ sân mở `/chu-san/tong-quan` | Web gọi đúng hai đường dẫn `?status=PENDING` và `?status=CONFIRMED`. Ô "Yêu cầu chờ duyệt" ghi 2. Ô "Lượt đặt hôm nay" ghi 1. Trang không hiện số tiền. Test: `apps/web/src/app/OwnerOverview.test.tsx` (new) |
| AC-10 | Nhân viên đã đăng nhập | Nhân viên mở `/chu-san/tong-quan` | Web chuyển tới `/chu-san/lich`. Thanh bên không có "Tổng quan". Test: `apps/web/src/app/App.test.tsx` |
| AC-11 | Admin đã đăng nhập | Admin mở `/admin`, rồi bấm "Tài khoản và đơn vị", "Báo cáo vi phạm", "Môn thể thao" | `/admin` hiện "Số liệu toàn trang". `/admin/tai-khoan` hiện tiêu đề "Chủ sân". Hai trang còn lại hiện "Sắp ra mắt". Test: `apps/web/src/app/App.test.tsx` |
| AC-12 | Người dùng "Lan" đã đăng nhập | Người dùng mở `/ho-so` và bấm "Sửa hồ sơ" | Trang hiện tên "Lan". Thông báo "Sắp ra mắt" hiện ra. Test: `apps/web/src/app/App.test.tsx` |

Kiểm bằng skill `verify-flow` ở 390px, 768px, 1024px và 1440px: không màn nào rộng hơn cửa sổ (`document.documentElement.scrollWidth <= innerWidth`). Các màn: `/`, `/phong-cho`, `/san`, `/san/:id`, `/doi`, `/lich-cua-toi`, `/ho-so`, `/dang-nhap`, `/chu-san/tong-quan`, `/chu-san/yeu-cau`, `/chu-san/lich`, `/chu-san/doanh-thu`, `/chu-san/don-vi`, `/admin`, `/admin/tai-khoan`, `/admin/bao-cao`, `/admin/mon`.

## Contract

Không đổi. `packages/shared` và `apps/api` giữ nguyên.

## Data

Không đổi.

## Build order

Người dùng muốn một pull request cho một thay đổi lớn (13/11/2026, PR #244). Brief này có một bước, với ba commit theo thứ tự: nền và khung, màn của khách và người dùng, màn của chủ sân và admin.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Giao diện web mới | `apps/web/`, `.agents/skills/verify-flow/`, `docs/design/web-ui-v3/`, `docs/design/web-responsive.md`, `docs/adr/0009-giao-dien-web-theo-mau-ra-san.md`, `docs/briefs/F-033-giao-dien-web-moi.md`, `DESIGN.md`, `scripts/design-tokens.mjs`, `PROGRESS.md`, `COMPLETED.md`, `HUMAN_DECISIONS.md`, `@map.md` | AC-1 đến AC-12, mọi test cũ của `apps/web`, và `verify-flow` pass trong check `image` |

## Edit boundaries

- May edit: the paths in "Build order".
- Leave unchanged without approval: `apps/api/`, `packages/`, `apps/mobile/`, `docs/requirements/`, the files of `docs/design/web-ui-v3/` (the pull request adds them and never edits them).

## Class giữ lại

Các flow `verify-flow` và các test đọc những class sau. Coder giữ chúng trên phần tử có cùng nghĩa, hoặc đổi bộ chọn và thêm một hàng vào "Test và flow được đổi bộ chọn".

- Test: `.slot-grid`, `.slot-grid-scroll`, `.slot-grid-h`, `.status`, `.filter-chips-row`, `.lobby-split`, `.lobby-list-pane`, `.lobby-detail-pane`, `.icon-button`, `.count-badge`, `active` trên nút đang chọn.
- Flow: `.who .name`, `.venue-card`, `.slot-cell[data-court-id]`, `.slot-windows`, `.slot-grid-court-label`, `.date-chips`, `.total strong`, `.ticket`, `.ticket.result[data-status]`, `.stub strong`, `section.panel`, `.match-detail`, `.queue-section`, `.players-section`, `li.match-ticket`, `.lobby-page`.
- `lib.mjs` che dữ liệu cá nhân trong ảnh của `verify-flow` (dòng có `.customer, .who, .hero h1, .call`). Thêm vào danh sách che mọi phần tử mới hiện tên, số điện thoại hoặc lời nhắn của một người.

## Test và flow được đổi bộ chọn

Khung mới đổi chữ, vai trò và đường dẫn của vài phần tử. Coder thêm một hàng cho mỗi bộ chọn bị đổi, trong cùng pull request. Mỗi test vẫn kiểm cùng một chức năng. Không test nào bị xóa, bị bỏ qua hoặc bị làm yếu.

| Test hoặc flow | Bộ chọn cũ | Bộ chọn mới | Lý do |
|---|---|---|---|
| `apps/web/src/app/App.test.tsx` (màn đặt sân ở `/`) | màn hiện ở `/` | mở `/san` hoặc `/san/<id>` trước | `/` là trang chủ. Đặt sân nằm ở `/san` |
| `apps/web/src/app/App.test.tsx` (admin) | `findByRole('heading', { name: 'Chủ sân' })` sau đăng nhập | `'Số liệu toàn trang'`, hoặc mở `/admin/tai-khoan` trước | `/admin` là "Tổng quan" |
| `apps/web/src/features/admin/AdminPanel.test.tsx` | nút tab "Tài khoản và đơn vị", "Số liệu" | liên kết của thanh bên, hoặc prop `view` | Tab thành mục điều hướng có đường dẫn |
| `.agents/skills/verify-flow/scripts/player-request.mjs` | bắt đầu ở `/`, bấm `.venue-card` | bắt đầu ở `/san` | Đặt sân nằm ở `/san` |
| `.agents/skills/verify-flow/scripts/player-request.mjs` | liên kết "Lịch của tôi" | liên kết "Lịch" | Tab của thanh trên đổi tên |
| `apps/web/src/app/App.test.tsx` (AC-16, AC-13, thanh trên) | liên kết "Phòng chờ", "Đặt sân", "Lịch của tôi" | liên kết "Ghép trận", "Sân", "Lịch" | Tab của thanh trên đổi tên. Tiêu đề "Phòng chờ" của màn giữ nguyên |
| `apps/web/src/app/App.test.tsx` (AC-20, AC-22) | tìm thẳng nút `"Đăng xuất"` | mở menu tài khoản (`/An/`) trước khi tìm nút `"Đăng xuất"` | Nút `"Đăng xuất"` nằm trong hộp bật lên của tài khoản ở thanh trên |
| `apps/web/src/app/App.test.tsx` (AC-25, AC-14) | tiêu đề "Đặt sân" ở `/` | tiêu đề "Đặt sân" ở `/san/<id>` | Đặt sân nằm ở `/san/<id>` |
| `apps/web/src/pwa.test.ts` | `<meta name="theme-color" content="#082f26">` | `<meta name="theme-color" content="#101915">` | Màu nền thanh trên đổi sang `--ink` (`#101915`) |
| `apps/web/src/app/BookPage.test.tsx` | mở thẳng `/` rồi tìm cả "Giờ trống" lẫn chọn khung giờ | mở `/san` cho test tìm sân, mở `/san/<id>` cho test đặt sân | Danh sách đơn vị ở `/san`, màn đặt sân chi tiết ở `/san/<id>` |
| `apps/web/src/app/App.test.tsx` (AC-25, AC-14, AC-7) | mở `/` rồi tìm "Giờ trống" và "Đặt sân" trên cùng trang | AC-25 kiểm "Trận đang mở" ở `/` rồi qua `/san/<id>` kiểm "Đặt sân"; AC-14 và AC-7 mở `/san` rồi bấm sang `/san/<id>` | Tách `/san` ("Giờ trống" + tìm sân) và `/san/<id>` ("Đặt sân") |
| `apps/web/src/app/App.test.tsx` (F-004 review) | `findByRole('heading', { name: 'Đặt sân' })` tại `/?google_error=taken` | `findByRole('heading', { name: 'Trận đang mở' })` tại `/?google_error=taken` | Trang `/` là trang chủ (`HomePage`) |
| `apps/web/src/app/App.test.tsx` (AC-20, AC-22) | `findByRole('button', { name: /An/ })` trên toàn trang | `within(screen.getByRole('banner')).findByRole('button', { name: /An/ })` | Trang chủ có thêm nút khung soạn "Hôm nay ra sân môn gì, An?" |
| `apps/web/src/features/matches/Lobby.test.tsx` (AC-11) | `screen.getByText('An')` trên toàn trang | `within(playersSection).getByText('An')` trong `.players-section` | Chi tiết trận hiển thị tên host trong mục thông tin chung (`facts`) và trong danh sách người chơi |

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Một màn cũ mất chức năng khi đổi khung | `apps/web/src/app/`, `apps/web/src/features/` | Số test `AC-n` cũ của `apps/web` không giảm. Reviewer so tên test trước và sau, và đọc bảng bộ chọn |
| Lộ dữ liệu cá nhân (BR-20) trên thẻ trận, trang chủ, hồ sơ, hoặc ảnh của `verify-flow` | Trang chủ, `/phong-cho`, `/ho-so`, `lib.mjs` | Thẻ trận chỉ hiện những gì `GET /api/matches` đã trả cho vai trò đó. `/ho-so` chỉ hiện dữ liệu của chính người dùng. Vòng review chạy thêm skill `rule-review` |
| Nhân viên thấy màn của chủ sân (BR-55) | `router.tsx`, khung chủ sân | AC-10 và các test `AC-12` cũ của F-031 |
| Dữ liệu giả của mẫu lọt vào sản phẩm | Mọi màn | Reviewer tìm tên và số của `data.js` trong `apps/web/src` |
| Tràn ngang ở 390px | Mọi màn | `verify-flow` ở 4 cỡ màn |

Không đổi tiền, khóa, schema.

## Assumptions

1. Tên sản phẩm vẫn là MONSPORT, không phải "Ra Sân" (`HUMAN_DECISIONS.md`, dòng 63).
2. Web dùng tên gọi của intake thay cho "kèo" và "cụm sân" (dòng 64).
3. Web co giãn theo quy tắc riêng trong `docs/design/web-responsive.md`. Người dùng giao quyết định này cho agent (dòng 65, đã chốt).
4. "Tạo trận" đưa người dùng tới `/lich-cua-toi`, vì một trận mở trên một booking (intake, "Tên gọi"). Hộp tạo trận của mẫu không được làm.
5. Trang đầu sau đăng nhập của chủ sân vẫn là `/chu-san/yeu-cau`, vì đó là việc chờ chủ sân làm (dòng 66).
6. "Tổng quan" của chủ sân không hiện tiền, nên nó không thêm luật về doanh thu. Doanh thu vẫn chỉ ở `/chu-san/doanh-thu`.
7. "Duyệt sân" của mẫu không có trong MONSPORT: admin tạo đơn vị và sân. Màn admin giữ chức năng hiện có dưới tên "Tài khoản và đơn vị".
8. Một bước lớn hơn 400 dòng, vì phần lớn là CSS và JSX của màn có sẵn. Tách nhỏ hơn làm hỏng màn giữa chừng.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Các dòng 63, 64 và 66 của `HUMAN_DECISIONS.md` | Người dùng | none |
| Thứ tự làm các chức năng "Sắp ra mắt" | Người dùng | none |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the pull request.
- The reviews in "Risks and reviews" are complete.
- `verify-flow` passes at 390px, 768px, 1024px and 1440px.
