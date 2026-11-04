---
style: ste80
lang: vi
---

# F-025: Tab Lịch sân và nhập booking khách gọi điện trên app mobile

Status: draft
Source: `docs/design/ke-hoach-app-mobile.md` (bước 6, bảng "Màn chính", dòng "Lịch sân (chủ sân)"), UC-5, BR-1, BR-2, BR-3, BR-4, BR-23, BR-27. `docs/briefs/F-007` (API nhập booking khách gọi điện). `docs/briefs/F-008` (API giờ trống). `DESIGN.md` ("Courts by hours"). Quyết định theo "Autonomy" của `AGENTS.md`: xem "Assumptions".

## Goal

Chủ sân mở tab "Lịch sân" trên `/app/chu-san/lich`, chọn ngày, thấy giờ trống của từng sân và các booking trong ngày, và bấm một ô trống để nhập booking của khách gọi điện. Kiểm tra bằng `verify-flow --app mobile` ở 360px và 390px.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Sửa API hoặc schema | `GET /api/owner/venues`, `GET /api/courts/:id/availability`, `GET /api/owner/bookings` và `POST /api/owner/bookings` đã đủ (F-005, F-007, F-008) | Không cần |
| Hủy booking từ Lịch sân | Lát cắt riêng, để brief vừa 3 PR. Web vẫn hủy được | Brief sau |
| Sửa giá và giờ mở cửa | Thuộc màn "Đơn vị và giá" của web (F-005) | Không có kế hoạch trên app |
| Tab "Doanh thu" | Lát cắt riêng | Brief sau |
| Kéo để chọn nhiều ô | Sheet có chip thời lượng | Không có kế hoạch |
| Đổi `apps/web` | Web chạy đúng | Không cần |

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

Mọi giờ trong bảng là giờ `Asia/Ho_Chi_Minh`. Test viết giờ có độ lệch, ví dụ `2026-11-06T18:00:00+07:00`, vì CI chạy ở UTC (BR-27). Đồng hồ giả của test là `2026-11-06T15:10:00+07:00`.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Chủ sân (`OWNER`) có một đơn vị "Cầu lông A" mở 06:00-22:00 với "Sân 1" và "Sân 2". `GET /api/courts/:id/availability?date=2026-11-06` trả giờ trống 15:30-22:00 cho "Sân 1" và 15:30-18:00, 20:00-22:00 cho "Sân 2" | Mở `/app/chu-san/lich` | Thấy chip ngày (7 ngày, bắt đầu hôm nay, "T6 06/11" được chọn) và một hàng ô 30 phút cho mỗi sân (`SlotRow`). Ô bắt đầu được (ô có ít nhất 1 giờ trống tính từ ô đó) là nút. Ô 18:00-19:30 của "Sân 2" không bấm được. App gửi đúng một `GET .../availability` cho mỗi sân |
| AC-2 | Chủ sân có 2 đơn vị | Mở tab | Thấy chip đơn vị theo tên. Đơn vị đầu tiên (theo tên) được chọn. Bấm chip đơn vị khác thì các hàng đổi sang sân của đơn vị đó. Chủ sân có 1 đơn vị: không có chip đơn vị |
| AC-3 | Như AC-1. `GET /api/owner/bookings?status=CONFIRMED` và `?status=PENDING` trả các booking của nhiều ngày và nhiều đơn vị | Mở tab | Dưới lưới, mục "Booking trong ngày" chỉ có booking của ngày và đơn vị đang chọn, xếp theo `startAt`. Mỗi dòng có sân, giờ "18:00–19:30", tên khách, số khách là link `tel:` khi có số, và nhãn "Đã xác nhận" hoặc "Chờ xác nhận". Không có booking: "Chưa có booking trong ngày này" |
| AC-4 | Như AC-1 | Bấm ô 16:00 của "Sân 1" | Sheet "Nhập booking khách gọi" mở với "Sân 1", "16:00 ngày 06/11/2026" và giá. Sheet có chip thời lượng "1 giờ", "1,5 giờ", "2 giờ", "2,5 giờ", "3 giờ", chỉ các thời lượng vừa giờ trống. Sheet có ô "Tên khách" và ô "Số điện thoại", đều không bắt buộc. "1 giờ" được chọn sẵn. Chọn "2 giờ" thì giá đổi theo `bookingPrice` (BR-4: 16:00-17:00 giá thường, 17:00-18:00 giá cao điểm) |
| AC-5 | Sheet của AC-4 với "2 giờ", tên "Chú Ba", số `0901234567` | Bấm "Lưu booking" | App gửi một lần `POST /api/owner/bookings` với `courtId`, `startAt` `2026-11-06T16:00:00+07:00` dạng ISO, `endAt` 18:00, `customerName`, `customerPhone`. Nút khóa trong lúc chờ. Thành công: sheet đóng, hiện "Đã lưu booking", app tải lại giờ trống của "Sân 1" và danh sách booking. Ô trống và số không gửi trường đó |
| AC-6 | Sheet của AC-5. API trả lần lượt 5 kết quả: 409 "Khung giờ này vừa có người đặt". 409 "Yêu cầu đang được xử lý, hãy thử lại". 400 với văn bản số điện thoại. 400 "Giờ bắt đầu đã qua". Lỗi mạng | Bấm "Lưu booking" | 409 có người đặt: sheet đóng, hiện văn bản của API, app tải lại giờ trống. 409 `BUSY`, 400 và lỗi mạng: sheet ở lại, nút mở lại, hiện văn bản của API (lỗi mạng: "Không lưu được booking. Thử lại.") trong sheet. Dữ liệu đã nhập ở lại |
| AC-7 | Đồng hồ 15:10 | Mở tab hôm nay | Ô 15:00 và các ô trước không bấm được. Ô 15:30 bấm được: chủ sân nhập booking bắt đầu sau `now` (BR-2), không cần cách 1 giờ như người chơi |
| AC-8 | Đổi chip ngày sang "T7 07/11" khi lần tải của "T6 06/11" chưa về | Lần tải cũ về sau | App bỏ kết quả cũ. Lưới và danh sách chỉ hiện ngày "T7 07/11" |
| AC-9 | Khách chưa đăng nhập, tài khoản `USER`, hoặc phiên hết hạn (401) | Mở `/app/chu-san/lich`, hoặc lưu booking | Khách: thấy "Đăng nhập để xem lịch sân" và nút "Đăng nhập". `USER`: app chuyển tới `/app/`. Cả hai không gọi API của chủ sân. 401: sheet đăng nhập mở với "Phiên đăng nhập đã hết. Hãy đăng nhập lại.", dữ liệu trong sheet nhập ở lại |
| AC-10 | Một lần `GET /api/owner/venues` lỗi. Một lần `GET .../availability` của một sân lỗi. Chủ sân không có đơn vị | Mở tab | Đơn vị lỗi: "Không tải được" và nút "Thử lại". Sân lỗi: hàng của sân đó ghi "Không tải được giờ trống" và các sân khác vẫn hiện. Không có đơn vị: "Bạn chưa có đơn vị nào" |
| AC-11 | Lưới và sheet ở 360px và 390px. Tên khách rất dài | Tab mở | Trang không cuộn ngang. Chỉ các hàng ô cuộn ngang. Mỗi nút và ô bấm được cao ít nhất 44px. Văn bản dài xuống dòng |
| AC-12 | Luồng `mobile-owner-schedule` của `verify-flow`: chủ sân seed mở "Lịch sân" ở 360px và 390px | Luồng chạy | Luồng chọn ngày mai, bấm ô trống đầu tiên của `VERIFY_COURT`, nhập tên `test-verify`, lưu, và thấy dòng mới trong "Booking trong ngày". Luồng kiểm `CONFIRMED` qua API rồi hủy đúng booking đó bằng `POST /api/owner/bookings/:id/cancel`. Trang không cuộn ngang. Báo cáo ghi 0 bước lỗi |
| AC-13 | `ownerStartableMinutes(date, free, now)` | Gọi với giờ trống 15:30-22:00 ngày 06/11/2026 và `now` 15:10, rồi với `now` 21:05, rồi với ngày 07/11/2026 | Trả 15:30, 16:00, …, 21:00 (mỗi 30 phút, đủ 1 giờ trống), rồi `[]` (21:30 không đủ 1 giờ, 21:00 đã qua), rồi các mốc của ngày đó. Phút là số phút từ 00:00 |
| AC-14 | `ownerDurationsAt(date, start, free, now)` | Gọi với giờ trống 15:30-18:00, `start` 16:00, rồi `start` 17:00, rồi `start` 15:00 | Trả `[60, 90, 120]`, rồi `[60]`, rồi `[]` |
| AC-15 | `bookingsOfDay(bookings, date, courtIds)` | Gọi với booking của 2 ngày và 2 đơn vị, ngày 06/11/2026 và các sân của một đơn vị | Trả chỉ booking có `startAt` trong ngày 06/11/2026 (giờ Việt Nam) và `courtId` trong danh sách, xếp theo `startAt` tăng dần |

## Contract

Không đổi `packages/shared` và không đổi API.

| Endpoint or schema | Change | Request | Response and errors |
|---|---|---|---|
| `GET /api/owner/venues` | unchanged | không | 200 `VenueView[]` có `courts`, `opensAt`, `closesAt`. Chỉ đơn vị của chủ sân (BR-23) |
| `GET /api/courts/:id/availability?date=YYYY-MM-DD` | unchanged | không | 200 `Availability` (`free`). Công khai |
| `GET /api/owner/bookings?status=CONFIRMED` và `?status=PENDING` | unchanged | không | 200 `OwnerBookingView[]` theo `startAt` |
| `POST /api/owner/bookings` | unchanged | `CreatePhoneBookingRequest`: `courtId`, `startAt`, `endAt`, `customerName?`, `customerPhone?` | 201 `OwnerBookingView` (`CONFIRMED`, `PHONE`). 400 "Giờ phải theo bước 30 phút", "Mỗi booking dài ít nhất 1 giờ", "Giờ bắt đầu đã qua", văn bản số điện thoại (`PHONE_MESSAGE`). 403. 404. 409 "Khung giờ này vừa có người đặt" (BR-1). 409 `BUSY` |

Phần mới nằm ở `packages/client/src/owner-schedule.ts`: hàm thuần `ownerStartableMinutes`, `ownerDurationsAt` và `bookingsOfDay`. Màn dùng lại `SlotRow`, `Sheet`, `slotAt`, `dayChipLabel`, `bookingPrice`, `formatSlot` và `formatVnd`.

## Data

Không có thay đổi. Không bảng mới, không migration.

## Build order

One pull request for each row. Each pull request passes the check command on its own.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Hàm thuần: `ownerStartableMinutes`, `ownerDurationsAt`, `bookingsOfDay` | `packages/client/src/owner-schedule.ts`, `packages/client/src/owner-schedule.test.ts`, `packages/client/src/index.ts` | AC-13, AC-14, AC-15 |
| 2 | Màn Lịch sân và sheet nhập booking. Router thay `EmptyTab` của `chu-san/lich` | `apps/mobile/src/features/owner/ScheduleScreen.tsx`, `apps/mobile/src/features/owner/ScheduleScreen.test.tsx`, `apps/mobile/src/features/owner/PhoneBookingSheet.tsx`, `apps/mobile/src/features/owner/PhoneBookingSheet.test.tsx`, `apps/mobile/src/features/owner/DayBookings.tsx`, `apps/mobile/src/app/router.tsx` | AC-1 đến AC-11 |
| 3 | Luồng `verify-flow` và `PROGRESS.md` | `.agents/skills/verify-flow/references/flows/mobile-owner-schedule.md`, `.agents/skills/verify-flow/scripts/mobile-owner-schedule.mjs`, `.agents/skills/verify-flow/scripts/run.mjs`, `.agents/skills/verify-flow/SKILL.md`, `PROGRESS.md` | AC-12 |

## Edit boundaries

- May edit: các đường dẫn trong bảng "Build order". `@map.md` được cập nhật bằng `pnpm map`.
- Leave unchanged without approval: `apps/web/`, `apps/api/`, `packages/shared/`, `prisma/`, `apps/mobile/src/components/`, `apps/mobile/src/app/App.tsx`, `apps/mobile/src/features/owner/RequestsScreen.tsx`, các feature khác của `apps/mobile/src/features/`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Đồng thời: người chơi gửi yêu cầu hoặc chủ sân khác nhập cùng giờ | Bước 2 | Server khóa `Court` và ràng buộc `EXCLUDE` trả 409 (BR-1, F-007). App hiện văn bản 409 và tải lại giờ trống (AC-6). App không tự thêm booking khi chưa có 201 |
| Tiền: giá trong sheet khác giá server lưu | Sheet ở bước 2 | Sheet chỉ hiển thị `bookingPrice` của `packages/shared`, cùng hàm server dùng. Server tự tính `priceTotal` |
| Dữ liệu cá nhân: tên và số của khách | Bước 2 | App gửi số chỉ khi chủ sân nhập. API chỉ trả booking ở sân của chủ sân (BR-23). Số chỉ hiện dạng link `tel:`. App không lưu ở `localStorage` |
| Bấm hai lần tạo hai booking | Bước 2 | Nút khóa khi chờ. Server từ chối booking trùng (BR-1) |
| Luồng live để lại booking `CONFIRMED` | Bước 3 | Luồng hủy đúng booking nó tạo. `VERIFY_VENUE` và `VERIFY_COURT` chọn sân thử trên live |

Không đổi code server hay schema. Luồng nhập booking đã có `rule-review` ở F-007. Không cần `rule-review` lại.

## Assumptions

1. Chủ sân nhập booking bắt đầu sau `now`, không cần cách 1 giờ (BR-2 và F-007). Lý do: server cho phép, và khách gọi điện thường muốn chơi ngay.
2. Thời lượng có chip từ 1 giờ tới 3 giờ, như web (`DURATIONS`).
3. Danh sách "Booking trong ngày" lấy từ `GET /api/owner/bookings` theo hai trạng thái và lọc phía app. Lý do: không đổi API. Số booking của một chủ sân còn nhỏ.
4. Chip ngày có 7 ngày từ hôm nay, như tab Đặt sân (F-020).
5. Hủy booking từ app nằm ngoài brief này. Chủ sân hủy trên web.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Lưới có cần hiện tên khách ngay trên ô đã đặt không? `SlotRow` hiện chỉ có ô trống và ô khóa | Chủ dự án | Không |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The flow `mobile-owner-schedule` runs in the check `image`.
