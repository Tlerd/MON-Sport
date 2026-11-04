---
style: ste80
lang: vi
---

# F-024: Tab Yêu cầu của chủ sân trên app mobile

Status: accepted
Source: `docs/design/ke-hoach-app-mobile.md` (bước 6, bảng "Màn chính", dòng "Yêu cầu (chủ sân)"), UC-4, BR-22, BR-23, BR-27. `docs/briefs/F-002` (API xác nhận và từ chối). Quyết định theo "Autonomy" của `AGENTS.md`: xem "Assumptions".

## Goal

Chủ sân mở tab "Yêu cầu" trên `/app/chu-san/yeu-cau`, thấy các yêu cầu đang chờ với hạn còn lại, và xác nhận hoặc từ chối ngay trên thẻ. Kiểm tra bằng `verify-flow --app mobile` ở 360px và 390px.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Sửa API hoặc schema | `GET /api/owner/bookings`, `POST /api/owner/bookings/:id/confirm`, `POST /api/owner/bookings/:id/reject` và `GET /api/owner/venues` đã đủ (F-002, F-003) | Không cần |
| Tab "Lịch sân" và sheet nhập booking khách gọi điện | Lát cắt riêng, để mỗi brief vừa 3 PR | Brief F-025 |
| Tab "Doanh thu" và nút "Đã thu tiền" | Thuộc màn tài chính (F-015). Thẻ yêu cầu chỉ có booking `PENDING` | Brief sau |
| Lý do từ chối | API không nhận lý do. Thêm lý do cần đổi schema | Khi chủ dự án yêu cầu |
| Cập nhật tức thì qua SSE | Không có luồng SSE cho booking. Màn tải lại mỗi 15 giây | Không có kế hoạch |
| Đổi `apps/web` | Web chạy đúng | Không cần |

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

Mọi giờ trong bảng là giờ `Asia/Ho_Chi_Minh`. Test viết giờ có độ lệch, ví dụ `2026-11-06T18:00:00+07:00`, vì CI chạy ở UTC (BR-27).

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Chủ sân (`OWNER`) đăng nhập. `GET /api/owner/bookings?status=PENDING` trả 2 yêu cầu theo `startAt` tăng dần: R1 ở "Sân 1" của "Sân Cầu Lông An Phú", 18:00-19:00 ngày 06/11/2026, 240.000đ, khách "Nguyễn Văn A" số `0901234567`, hạn 17:00 ngày 06/11/2026. R2 ở "Sân 2", khách không có số. `GET /api/owner/venues` trả đơn vị với hai sân đó | Mở `/app/chu-san/yeu-cau` lúc 15:30 ngày 06/11/2026 | Thấy 2 thẻ theo đúng thứ tự. Thẻ R1 có "Sân 1", "Sân Cầu Lông An Phú", "18:00–19:00 ngày 06/11/2026" (BR-27), "240.000đ", tên khách, số khách là link `tel:0901234567`, "Còn 1 giờ 30 phút", nút "Xác nhận" và nút "Từ chối". Thẻ R2 không có link gọi. Mỗi thẻ có `data-booking-id`. Tiêu đề ghi "2 yêu cầu đang chờ". Một lần khác `GET /api/owner/venues` lỗi: 2 thẻ vẫn hiện, tên sân là "Sân", không có tên đơn vị |
| AC-2 | Cùng chủ sân. Một lần danh sách rỗng. Một lần API lỗi mạng | Mở tab | Lần rỗng: thấy "Chưa có yêu cầu nào đang chờ". Lần lỗi: thấy "Không tải được" và nút "Thử lại". Bấm nút tải lại. Khi đã có danh sách và lần tải lại sau đó lỗi: danh sách cũ ở lại, app không hiện lỗi |
| AC-3 | Khách chưa đăng nhập, hoặc tài khoản `USER` | Mở `/app/chu-san/yeu-cau` | Khách: thấy "Đăng nhập để xem yêu cầu" và nút "Đăng nhập" mở sheet đăng nhập. `USER`: app chuyển tới `/app/`. Cả hai không gọi `GET /api/owner/bookings` |
| AC-4 | Thẻ R1 như AC-1 | Bấm "Xác nhận" | App gửi `POST /api/owner/bookings/R1/confirm` một lần. Hai nút của thẻ khóa trong lúc chờ. Thành công: thẻ R1 biến khỏi danh sách, hiện "Đã xác nhận yêu cầu", tiêu đề ghi "1 yêu cầu đang chờ", và app gọi `refreshCounts` để số trên tab "Yêu cầu" giảm |
| AC-5 | Thẻ R1 như AC-1 | Bấm "Từ chối" | Một sheet mở với "Từ chối yêu cầu này?", tên khách và giờ. Bấm "Từ chối" trong sheet: app gửi `POST /api/owner/bookings/R1/reject` một lần, thẻ biến khỏi danh sách, hiện "Đã từ chối yêu cầu", app gọi `refreshCounts`. Bấm "Thôi": sheet đóng, app không gửi request |
| AC-6 | Thẻ R1. API trả lần lượt: 409 "Yêu cầu đã hết hạn", 409 "Yêu cầu không còn chờ xác nhận", 409 "Yêu cầu đang được xử lý, hãy thử lại", 403, 404, lỗi mạng | Bấm "Xác nhận", hoặc "Từ chối" trong sheet. Có ít nhất một test cho đường từ chối với 409 `BUSY` | Hai 409 đầu (kết quả cuối): app hiện đúng văn bản của API, bỏ thẻ R1, gọi `refreshCounts`. 409 "đang được xử lý" (`BUSY`, booking vẫn `PENDING`): thẻ ở lại, hai nút mở lại, hiện văn bản của API. 403 và 404: hiện "Yêu cầu này không còn trong danh sách của bạn", bỏ thẻ, và tải lại danh sách một lần. Lỗi mạng: thẻ ở lại, hai nút mở lại, hiện "Không lưu được quyết định. Thử lại." |
| AC-7 | Chủ sân mở tab. Sau 15 giây API trả thêm yêu cầu R3 | 15 giây trôi qua | Danh sách tải lại và hiện R3. Khi tab ẩn (`visibilitychange`) app dừng tải lại. Khi tab hiện lại app tải lại một lần ngay và tiếp tục chu kỳ. Khi rời màn app dừng chu kỳ. Mỗi lần tải lại thành công, app báo số yêu cầu lên khung app bằng `setPendingRequests` |
| AC-8 | Một lần tải chậm trả về sau khi chủ sân xác nhận R1 | Danh sách chậm tới | App bỏ danh sách chậm. R1 không quay lại thẻ (đánh số yêu cầu như F-023) |
| AC-9 | Phiên hết hạn: API trả 401 | Mở tab hoặc bấm "Xác nhận" | Sheet đăng nhập mở và hiện "Phiên đăng nhập đã hết. Hãy đăng nhập lại." Danh sách giữ nguyên. Sau khi đăng nhập app tải lại danh sách |
| AC-10 | Danh sách ở 360px và 390px. Tên đơn vị và tên khách rất dài | Tab mở | Không cuộn ngang. Mỗi nút cao ít nhất 44px. Văn bản dài xuống dòng, không tràn |
| AC-11 | Luồng `mobile-owner-requests` của `verify-flow`: người chơi seed gửi một yêu cầu đặt sân, chủ sân seed mở "Yêu cầu" ở 360px và 390px | Luồng chạy | Luồng gửi một yêu cầu cho mỗi cỡ màn. Chủ sân tìm thẻ theo `data-booking-id` của booking mà luồng tạo, bấm "Từ chối" rồi xác nhận trong sheet, thẻ biến mất. Trang không cuộn ngang. Báo cáo ghi 0 bước lỗi. Luồng chỉ từ chối booking mà nó tạo |
| AC-12 | `deadlineLeft(confirmDeadline, now)`. Phút làm tròn xuống | Gọi với hạn sau `now` 2 giờ 5 phút, 1 giờ 59 phút 59 giây, 45 phút, 30 giây, đúng bằng `now`, trước `now`, và `null` | Trả "Còn 2 giờ 5 phút", "Còn 1 giờ 59 phút", "Còn 45 phút", "Còn dưới 1 phút", "Hết hạn", "Hết hạn", "" |
| AC-13 | `courtLabels(venues)` | Gọi với 2 đơn vị, mỗi đơn vị 2 sân, và với danh sách rỗng | Trả một map từ `courtId` tới `{ courtName, venueName }` cho cả 4 sân. Danh sách rỗng trả map rỗng |

## Contract

Không đổi `packages/shared` và không đổi API.

| Endpoint or schema | Change | Request | Response and errors |
|---|---|---|---|
| `GET /api/owner/bookings?status=PENDING` | unchanged | không | 200 `OwnerBookingView[]` theo `startAt` tăng dần. Server cho hết hạn các yêu cầu quá hạn trước khi trả. 401. 403 khi không phải `OWNER` |
| `POST /api/owner/bookings/:id/confirm` | unchanged | không | 200 `BookingView`. 400 khi `id` không phải UUID (văn bản tiếng Anh của `ParseUUIDPipe`, app không gửi id lạ). 403 khi sân của chủ khác (BR-23). 404. 409 "Yêu cầu đã hết hạn" hoặc "Yêu cầu không còn chờ xác nhận" (kết quả cuối). 409 "Yêu cầu đang được xử lý, hãy thử lại" (`BUSY`, sau deadlock, booking vẫn `PENDING`) |
| `POST /api/owner/bookings/:id/reject` | unchanged | không | Như `confirm` |
| `GET /api/owner/venues` | unchanged | không | 200 `VenueView[]` có `courts`. Chỉ đơn vị của chủ sân |

Phần mới nằm ở `packages/client/src/owner-requests.ts`: hàm thuần `deadlineLeft(confirmDeadline, now)` và `courtLabels(venues)`. `OwnerBookingView` không có tên sân, nên màn ghép tên sân từ `GET /api/owner/venues`.

`ShellContextType` của `apps/mobile/src/app/App.tsx` thêm `setPendingRequests?: (count: number) => void`, giống `setUnreadNotifications`.

## Data

Không có thay đổi. Không bảng mới, không migration.

## Build order

One pull request for each row. Each pull request passes the check command on its own.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Hàm thuần: `deadlineLeft`, `courtLabels` | `packages/client/src/owner-requests.ts`, `packages/client/src/owner-requests.test.ts`, `packages/client/src/index.ts` | AC-12, AC-13 |
| 2 | Màn Yêu cầu: danh sách, trạng thái rỗng, lỗi, khách, `USER`, xác nhận, sheet từ chối, 409, tải lại 15 giây, bỏ danh sách chậm, 401. Router thay `EmptyTab` của `chu-san/yeu-cau`. `App.tsx` thêm `setPendingRequests` vào context | `apps/mobile/src/features/owner/`, `apps/mobile/src/app/router.tsx`, `apps/mobile/src/app/App.tsx`, `apps/mobile/src/app/App.test.tsx` | AC-1 đến AC-10 |
| 3 | Luồng `verify-flow` và `PROGRESS.md` | `.agents/skills/verify-flow/references/flows/mobile-owner-requests.md`, `.agents/skills/verify-flow/scripts/mobile-owner-requests.mjs`, `.agents/skills/verify-flow/scripts/run.mjs`, `.agents/skills/verify-flow/SKILL.md`, `PROGRESS.md` | AC-11 |

## Edit boundaries

- May edit: các đường dẫn trong bảng "Build order", và `PROGRESS.md` ở bước cuối. `@map.md` được cập nhật bằng `pnpm map`.
- Leave unchanged without approval: `apps/web/`, `apps/api/`, `packages/shared/`, `prisma/`, `apps/mobile/src/features/venues/`, `apps/mobile/src/features/bookings/`, `apps/mobile/src/features/lobby/`, `apps/mobile/src/features/my/`, `apps/mobile/src/features/notifications/`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Đồng thời: hai thiết bị của chủ sân, hoặc hạn vừa qua, cùng quyết định một yêu cầu | Bước 2 | Server khóa `Venue` rồi `Court` và trả 409 (F-002). 409 kết quả cuối: app hiện văn bản và bỏ thẻ. 409 `BUSY`: app giữ thẻ và mở lại nút (AC-6). App không tự đổi trạng thái khi chưa có phản hồi |
| Bấm hai lần gửi hai request | Bước 2 | Hai nút khóa khi chờ (AC-4) |
| Dữ liệu cá nhân: tên và số của khách | Thẻ ở bước 2 | API chỉ trả booking ở sân của chủ sân (BR-23). Số chỉ hiện dạng link `tel:`. App không lưu số ở `localStorage` |
| Từ chối nhầm | Bước 2 | Sheet xác nhận trước khi gửi (AC-5) |
| Số trên tab "Yêu cầu" lệch với danh sách | Bước 2 | Màn báo số lên khung app sau mỗi lần tải (AC-7), và gọi `refreshCounts` sau mỗi quyết định (AC-4, AC-5, AC-6) |

Không đổi tiền, schema, hay code server. Không cần `rule-review`.

## Assumptions

1. Từ chối cần một sheet xác nhận. Xác nhận không cần. Lý do: từ chối hủy trận gắn với booking và báo cho người chơi (F-002, F-011), nên khó sửa hơn. Một dòng để đổi: bỏ sheet ở AC-5.
2. Thẻ đã quyết định biến khỏi danh sách, không ở lại với nhãn. Lý do: tab chỉ có yêu cầu đang chờ. Web giữ thẻ với nhãn, vì web không có tab khác cho booking đã xác nhận.
3. Tên sân lấy từ `GET /api/owner/venues`, không đổi API. Lý do: brief chỉ đổi phần app. Lỗi khi tải đơn vị không chặn danh sách: thẻ hiện "Sân".
4. Tải lại mỗi 15 giây khi tab hiện, như tab Thông báo (F-023).
5. Tài khoản `USER` mở URL của chủ sân thì về `/app/`. Lý do: thanh tab của `USER` không có tab này.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Chủ sân có cần nhập lý do khi từ chối không? Cần đổi schema và thông báo | Chủ dự án | Không |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The flow `mobile-owner-requests` runs in the check `image`.
