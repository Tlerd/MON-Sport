---
style: ste80
lang: vi
---

# F-026: Tab Doanh thu của chủ sân trên app mobile

Status: accepted
Source: `docs/design/ke-hoach-app-mobile.md` (bước 6, bảng "Tab theo vai trò": Doanh thu), UC-12, BR-23, BR-27. `docs/briefs/F-015-dashboard-tai-chinh-chu-san.md` (API `GET /api/owner/venues/:id/financials` và `PATCH /api/owner/bookings/:id/paid`). `docs/briefs/F-025-app-mobile-chu-san-lich-san.md` (mẫu cho màn chủ sân). `DESIGN.md`. Người dùng giao việc tự chạy ngày 2026-11-06 ("tiếp tục").

## Goal

Chủ sân mở tab "Doanh thu" trên `/app/chu-san/doanh-thu`. Chủ sân chọn đơn vị và khoảng Ngày, Tuần hoặc Tháng, rồi xem doanh thu và các chỉ số của UC-12. Chủ sân đánh dấu "Đã thu tiền" cho booking đã xác nhận. Kiểm tra bằng `verify-flow --app mobile` ở 360px và 390px.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Sửa API hoặc schema | `GET /api/owner/venues/:id/financials`, `PATCH /api/owner/bookings/:id/paid` và `GET /api/owner/bookings` đã đủ (F-015, F-007) | Không cần |
| Biểu đồ nhiệt giờ cao điểm theo thứ và giờ | API chưa trả dữ liệu theo thứ và giờ. Cần đổi API | Brief sau, khi chủ dự án yêu cầu |
| Thư viện biểu đồ (`recharts`) | App mobile giữ bundle nhỏ. Cột vẽ bằng CSS | Không có kế hoạch |
| Xuất file doanh thu | UC-12 không yêu cầu | Không có kế hoạch |
| Hủy booking, nhập booking, sửa giá | Thuộc tab Lịch sân và web | Không cần |
| Đổi `apps/web` | Web chạy đúng | Không cần |

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

Mọi giờ và ngày là giờ `Asia/Ho_Chi_Minh`. Test viết giờ có độ lệch, ví dụ `2026-11-06T15:10:00+07:00`, vì CI chạy ở UTC (BR-27). Đồng hồ giả của test là `2026-11-06T15:10:00+07:00`. Tuần chạy từ thứ Hai tới Chủ Nhật, như F-015.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Chủ sân (`OWNER`) có một đơn vị "Cầu lông A". `GET /api/owner/venues/VA/financials?period=week&date=2026-11-06` trả `revenue` 960000, `totalBookings` 13 (10 `CONFIRMED`, 2 `CANCELLED`, 1 `REJECTED`), `paidBookings` 8, `unpaidBookings` 2, `cancelledBookings` 2, `rejectedBookings` 1. API còn trả `bookedHours` 10, `occupancyRate` 0.25, `cancellationRate` 0.1538, `rejectionRate` 0.0769, `totalCustomers` 5, `returningCustomers` 2, `startDate` `2026-11-01T17:00:00.000Z`, `endDate` `2026-11-08T16:59:59.999Z` (API trả mốc UTC, không phải ngày), và `chartData` 7 điểm | Mở tab | Gọi đúng một lần API trên với `period=week` và `date=2026-11-06`. Chip "Tuần" được chọn. Tiêu đề ghi "Tuần 02/11–08/11/2026". Thẻ "Doanh thu" ghi "960.000đ" và ghi "8 đã thu · 2 chưa thu". Các thẻ ghi "Giờ đã đặt 10 giờ", "Lấp đầy 25%", "Hủy 15%", "Từ chối 8%", "Khách quay lại 2/5". App đổi `startDate` và `endDate` sang ngày giờ Việt Nam bằng `vnDateString(new Date(...))`, không cắt chuỗi |
| AC-2 | Như AC-1 | Bấm chip "Ngày", rồi "Tháng" | Mỗi lần bấm gọi một lần API với `period=day` rồi `period=month` và `date=2026-11-06`. Tiêu đề ghi "Thứ Sáu, 06/11/2026" rồi "Tháng 11/2026". Chip đã chọn có `aria-pressed="true"` |
| AC-3 | Như AC-1, chip "Tuần", ngày hôm nay 2026-11-06 | Bấm "Kỳ trước" hai lần, rồi "Kỳ sau" một lần | Ngày gọi API đổi lần lượt thành 2026-10-30, 2026-10-23, 2026-10-30. Với "Tháng" ngày đổi theo tháng. Với "Ngày" ngày đổi theo ngày. Khi màn về kỳ chứa ngày 2026-11-06, nút "Kỳ sau" bị khóa (`disabled`) |
| AC-4 | `chartData` của AC-1 có 7 điểm "T2 02/11" … "CN 08/11" với `revenue` 0 tới 320000 | Mở tab | Có 7 cột. Chiều cao mỗi cột theo `revenue` chia cho `revenue` lớn nhất. Cột có `revenue` 0 vẫn có nhãn. Mỗi cột có `aria-label` "T2 02/11: 120.000đ". Không dùng `recharts` |
| AC-5 | Chủ sân có 2 đơn vị "Cầu lông A" và "Bóng đá B" | Mở tab, rồi bấm chip "Bóng đá B" | Chip đơn vị theo tên. Đơn vị đầu tiên theo tên được chọn. Bấm chip khác thì gọi API của đơn vị đó. Chủ sân có 1 đơn vị: không có chip đơn vị |
| AC-6 | Như AC-1. `GET /api/owner/bookings?status=CONFIRMED` trả 4 booking: 3 booking của "Cầu lông A" trong 02/11–08/11 (2 chưa thu, 1 đã thu) và 1 booking chưa thu ngày 12/11 | Mở tab | Mục "Chưa thu tiền" chỉ có 2 booking chưa thu của đơn vị và của kỳ đang xem, xếp theo `startAt`. Mỗi dòng có tên sân (lấy từ `courts` của `GET /api/owner/venues`, vì `OwnerBookingView` không có tên sân), giờ, giá, tên khách và nút "Đã thu tiền" cao ít nhất 44px. Tên khách nằm trong phần tử có `data-field="customer"`, và số điện thoại (nếu hiện) có `data-field="phone"`, để ảnh live che được (BR-20). Test kiểm thuộc tính này. Số khớp với `unpaidBookings` của API là 2 |
| AC-7 | Mục "Chưa thu tiền" của AC-6 | Bấm "Đã thu tiền" ở dòng đầu | App gửi một lần `PATCH /api/owner/bookings/:id/paid` với `{ "paidAtVenue": true }`. Nút khóa trong lúc chờ. Khi API trả 200, dòng biến mất, và app gọi lại API financials. Thẻ "Doanh thu" hiện số mới từ API. Bấm hai lần liên tiếp chỉ gửi một PATCH |
| AC-8 | Như AC-7. API PATCH trả lần lượt: 400 "Chỉ đánh dấu thu tiền cho booking đã xác nhận", 404 "Không tìm thấy booking", 409 "Yêu cầu đang được xử lý, hãy thử lại", lỗi mạng | Bấm "Đã thu tiền" | 400 và 404: app hiện văn bản lỗi của API trong một thông báo (`role="alert"`) phía trên mục "Chưa thu tiền", rồi tải lại cả danh sách booking và financials. Dòng có thể biến mất. 409 và lỗi mạng: dòng ở lại, hiện văn bản của API (lỗi mạng: "Không cập nhật được. Thử lại."), nút mở lại, không tải lại. App không tự đổi số doanh thu |
| AC-9 | Đổi chip "Tuần" sang "Tháng" khi lần tải "Tuần" chưa về. Đổi đơn vị khi lần tải của đơn vị cũ chưa về | Lần tải cũ về sau | App bỏ kết quả cũ. Màn chỉ hiện kỳ và đơn vị đang chọn |
| AC-10 | Khách chưa đăng nhập, tài khoản `USER`, hoặc phiên hết hạn (401) | Mở `/app/chu-san/doanh-thu`, hoặc bấm "Đã thu tiền" | Khách: thấy "Đăng nhập để xem doanh thu" và nút "Đăng nhập". `USER`: app chuyển tới `/app/`. Cả hai không gọi API của chủ sân. 401: mở sheet đăng nhập lại, và sau khi đăng nhập màn tải lại |
| AC-11 | Một lần `GET /api/owner/venues` lỗi. Một lần `GET .../financials` lỗi. Một lần `GET /api/owner/bookings` lỗi. Chủ sân không có đơn vị | Mở tab | Đơn vị lỗi: "Không tải được" và nút "Thử lại". Financials lỗi: khối chỉ số ghi "Không tải được" và nút "Thử lại", chip và mục "Chưa thu tiền" vẫn dùng được. Booking lỗi: mục "Chưa thu tiền" ghi "Không tải được" và nút "Thử lại". Không có đơn vị: "Bạn chưa có đơn vị nào" |
| AC-12 | Kỳ không có booking: `revenue` 0, `totalBookings` 0, các tỉ lệ 0, `chartData` toàn 0 | Mở tab | Thẻ "Doanh thu" ghi "0đ". Các tỉ lệ ghi "0%". Mục "Chưa thu tiền" ghi "Không có booking cần thu tiền". Cột biểu đồ cao tối thiểu 2px và không chia cho 0 |
| AC-13 | Màn ở 360px và 390px. Tên đơn vị và tên khách rất dài | Tab mở | Trang không cuộn ngang. Mỗi nút và chip cao ít nhất 44px. Văn bản dài xuống dòng. Các thẻ chỉ số xếp 2 cột |
| AC-14 | Luồng `mobile-owner-revenue` của `verify-flow`: chủ sân seed mở "Doanh thu" ở 360px và 390px | Luồng chạy | Luồng mở tab, chọn "Tháng", thấy thẻ "Doanh thu" và 5 thẻ chỉ số, rồi chụp màn hình. Ảnh trên live che tên và số của khách (BR-20). Luồng không đánh dấu thu tiền trên live |
| AC-15 | `shiftPeriodDate(date, period, steps)` | Gọi với `2026-11-06`, `day`, -1. Với `week`, +1. Với `month`, -1. Với `2026-03-31`, `month`, -1 | Trả `2026-11-05`, `2026-11-13`, `2026-10-06`, `2026-02-28` |
| AC-16 | `periodHeading(view)` | Gọi với `period` `week`, `startDate` `2026-11-01T17:00:00.000Z`, `endDate` `2026-11-08T16:59:59.999Z`. Rồi với `day`, `date` 2026-11-06. Rồi với `month`, `date` 2026-11-06 | Trả "Tuần 02/11–08/11/2026" (không phải "01/11"), "Thứ Sáu, 06/11/2026", "Tháng 11/2026" |
| AC-17 | `unpaidInPeriod(bookings, startDate, endDate, courtIds)` | Gọi với `startDate` `2026-11-01T17:00:00.000Z`, `endDate` `2026-11-08T16:59:59.999Z`, và các booking: `CONFIRMED` chưa thu lúc `2026-11-01T17:00:00.000Z` (00:00 ngày 02/11 giờ Việt Nam), `CONFIRMED` chưa thu lúc `2026-11-01T16:59:00.000Z` (ngoài kỳ), `CONFIRMED` đã thu, ở sân khác, `PENDING` | Trả chỉ booking `CONFIRMED`, `paidAtVenue` false, `startAt` từ `startDate` tới `endDate` (so mốc thời gian, không so chuỗi ngày), `courtId` trong danh sách, xếp theo `startAt` tăng dần. Không đổi mảng vào |
| AC-18 | `percent(rate)` | Gọi với 0, 0.25, 0.125, 1 | Trả "0%", "25%", "13%", "100%" |

## Contract

Không đổi `packages/shared` và không đổi API.

| Endpoint or schema | Change | Request | Response and errors |
|---|---|---|---|
| `GET /api/owner/venues` | unchanged | không | 200 `VenueView[]`. Chỉ đơn vị của chủ sân (BR-23) |
| `GET /api/owner/venues/:id/financials?period=&date=` | unchanged | `period` `day`, `week` hoặc `month`. `date` `YYYY-MM-DD` | 200 `FinancialDashboardView`. 400 "Tham số truy vấn tài chính không hợp lệ". 404 "Không tìm thấy đơn vị". 401 |
| `GET /api/owner/bookings?status=CONFIRMED` | unchanged | không | 200 `OwnerBookingView[]` theo `startAt`, có `paidAtVenue`, `courtId`, `priceTotal`, `customer` |
| `PATCH /api/owner/bookings/:id/paid` | unchanged | `{ paidAtVenue: boolean }` | 200 `{ id, paidAtVenue }`. 400 "Chỉ đánh dấu thu tiền cho booking đã xác nhận", "Dữ liệu thu tiền không hợp lệ", "Dữ liệu không hợp lệ" (id sai). 404 "Không tìm thấy booking". 409 "Yêu cầu đang được xử lý, hãy thử lại". 401 |

`startDate` và `endDate` của `FinancialDashboardView` là mốc UTC dạng ISO (ví dụ `2026-11-01T17:00:00.000Z`). Đổi sang ngày Việt Nam bằng `vnDateString(new Date(...))` (BR-27). `GET /api/owner/venues/:id/financials` còn trả 400 "Dữ liệu không hợp lệ" khi id sai.

Phần mới nằm ở `packages/client/src/owner-revenue.ts`: hàm thuần `shiftPeriodDate`, `periodHeading`, `unpaidInPeriod` và `percent`. Màn dùng lại `Sheet`, `dayChipLabel`, `dayHeading`, `formatVnd`, `formatSlot`, `vnDateString`.

## Data

Không có thay đổi. Không bảng mới, không migration.

## Build order

One pull request for each row. Each pull request passes the check command on its own.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Hàm thuần `shiftPeriodDate`, `periodHeading`, `percent`, và màn Doanh thu chỉ đọc: chỉ số, biểu đồ, chip đơn vị và kỳ. Router thay `EmptyTab` của `chu-san/doanh-thu` | `packages/client/src/owner-revenue.ts`, `packages/client/src/owner-revenue.test.ts`, `packages/client/src/index.ts`, `apps/mobile/src/features/owner/RevenueScreen.tsx`, `apps/mobile/src/features/owner/RevenueScreen.test.tsx`, `apps/mobile/src/features/owner/RevenueChart.tsx`, `apps/mobile/src/app/router.tsx` | AC-1 đến AC-5, AC-9 đến AC-13, AC-15, AC-16, AC-18 (AC-10 và AC-11 chỉ phần financials và đơn vị) |
| 2 | Mục "Chưa thu tiền" và nút "Đã thu tiền" (đường tiền) | `packages/client/src/owner-revenue.ts`, `packages/client/src/owner-revenue.test.ts`, `apps/mobile/src/features/owner/UnpaidList.tsx`, `apps/mobile/src/features/owner/RevenueScreen.tsx`, `apps/mobile/src/features/owner/RevenueScreen.test.tsx` | AC-6, AC-7, AC-8, AC-17, và phần booking của AC-10, AC-11, AC-12 |
| 3 | Luồng `verify-flow` và `PROGRESS.md` | `.agents/skills/verify-flow/references/flows/mobile-owner-revenue.md`, `.agents/skills/verify-flow/references/targets.md`, `.agents/skills/verify-flow/scripts/mobile-owner-revenue.mjs`, `.agents/skills/verify-flow/scripts/run.mjs`, `.agents/skills/verify-flow/SKILL.md`, `PROGRESS.md` | AC-14 |

`@map.md` được cập nhật bằng `pnpm map` trong mỗi pull request. Bước 3 theo danh sách file của F-025 bước 3. Luồng mới chạy trong check `image` mà không sửa `ci.yml`.

## Edit boundaries

- May edit: các đường dẫn trong bảng "Build order".
- Leave unchanged without approval: `apps/web/`, `apps/api/`, `packages/shared/`, `prisma/`, `apps/mobile/src/components/`, `apps/mobile/src/app/App.tsx`, `apps/mobile/src/features/owner/RequestsScreen.tsx`, `apps/mobile/src/features/owner/ScheduleScreen.tsx`, các feature khác của `apps/mobile/src/features/`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Tiền: app hiển thị doanh thu khác số server | Bước 2 | App chỉ hiển thị `revenue` và các số của API. App không tự cộng `priceTotal`. Sau khi thu tiền, app gọi lại API (AC-7, AC-8) |
| Tiền: bấm "Đã thu tiền" nhầm hoặc hai lần | Bước 2 | Nút khóa khi chờ, một PATCH cho mỗi dòng (AC-7). Server kiểm tra trạng thái `CONFIRMED` và quyền chủ sân (F-015, BR-23). Bước này không có nút bỏ đánh dấu: xem câu hỏi mở 1 |
| Dữ liệu cá nhân: tên khách trong "Chưa thu tiền" | Bước 2 và 3 | API chỉ trả booking ở sân của chủ sân (BR-23). Ảnh live che tên và số (AC-14, BR-20). App không lưu ở `localStorage` |
| Múi giờ: kỳ tuần và tháng lệch ngày khi CI chạy UTC | Bước 1 | Test dùng đồng hồ có độ lệch và ngày ranh giới `2026-03-31` (AC-15, BR-27) |
| Luồng live đánh dấu thu tiền thật | Bước 3 | Luồng chỉ đọc. Không PATCH trên live (AC-14) |

Không đổi code server hay schema. Luồng thu tiền đã có `rule-review` ở F-015. Không cần `rule-review` lại. Reviewer trong phiên mới vẫn đọc bước 2, vì bước này chạm tiền.

## Assumptions

1. Tuần chạy từ thứ Hai tới Chủ Nhật, như F-015.
2. Mặc định mở "Tuần" của ngày hôm nay, đơn vị đầu tiên theo tên. Lý do: web làm như vậy (`FinancialDashboard`).
3. Mục "Chưa thu tiền" lấy từ `GET /api/owner/bookings?status=CONFIRMED` và lọc phía app. Lý do: không đổi API, và số booking của một chủ sân còn nhỏ (cùng cách với F-025).
4. Mục "Chưa thu tiền" gồm cả booking chưa diễn ra trong kỳ. Lý do: chủ sân có thể thu tiền trước giờ chơi, và API tính `unpaidBookings` theo cùng cách.
5. Không có nút bỏ đánh dấu trên app. Chủ sân sửa nhầm trên web. Lý do: giữ brief trong 3 pull request.
6. Biểu đồ nhiệt thuộc web và chưa có API. App không hiện nó.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Chủ sân có cần nút bỏ đánh dấu "Đã thu tiền" trên app không? Mặc định: không | Chủ dự án | Không |
| Chủ sân có cần ô chọn ngày bất kỳ ngoài nút "Kỳ trước" và "Kỳ sau" không? Mặc định: không | Chủ dự án | Không |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The flow `mobile-owner-revenue` runs in the check `image`.
- A Reviewer in a fresh session has reviewed step 2.
