---
style: ste80
lang: vi
---

# F-022: Tab Phòng chờ trên app mobile

Status: draft
Source: `docs/design/ke-hoach-app-mobile.md` (bước 5, tách đôi), UC-7, UC-8, UC-9, BR-15 đến BR-20, BR-27. `docs/briefs/F-011` và `F-012` (API và web của Phòng chờ). `docs/briefs/F-021-app-mobile-lich-cua-toi.md` giao việc vào, rời và hủy trận cho tab này. Quyết định theo "Autonomy" của `AGENTS.md`: xem "Assumptions".

## Goal

Người dùng mở tab "Phòng chờ" trên `/app/`, xem feed trận mở, lọc theo môn và ngày, vào hoặc rời trận, và thấy trận cập nhật tức thì. Host mở trận từ booking của mình và hủy trận. Kiểm tra bằng `verify-flow --app mobile` ở 360px và 390px.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Sửa API hoặc schema | `GET /api/matches`, `GET /api/matches/stream`, `GET /api/matches/joined`, `GET /api/matches/:id`, `POST /api/matches`, `POST /api/matches/:id/join`, `/leave`, `/cancel` đã đủ (F-011, F-012) | Không cần |
| Số điện thoại của người chơi trên màn hình của người không phải host | BR-20. API đã ẩn. App chỉ hiện `phone` khi `viewerRole` là `HOST` | Không đổi |
| Chat, đánh giá người chơi, mời bạn | Ngoài intake | Không có kế hoạch |
| Đổi `apps/web` để dùng hàm mới của `packages/client` | Web chạy đúng. Giữ thay đổi nhỏ | Một brief `chore` sau |
| Thông báo trong app (tab Thông báo) | Thuộc F-013 trên web và một brief riêng cho app | Brief tab Thông báo |
| Thanh toán và chia tiền | Phiên bản đầu không thu tiền (intake). App chỉ hiện giá mỗi suất | Không có kế hoạch |
| Sửa số suất hoặc giá của trận đã mở | API không có thao tác này | Khi người dùng yêu cầu |

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | `now` = 02/11/2026 10:00 (UTC+7). `GET /api/matches` trả 3 trận `OPEN`: M1 cầu lông 20:00 ngày mai, `joinedCount` 4 trên `capacity` 10, `pricePerSlot` 40000, `bookingStatus` `CONFIRMED`. M2 bóng đá 18:00 sau 2 ngày, `joinedCount` 6 trên 14, `bookingStatus` `PENDING`. M3 cầu lông 07:00 hôm nay (đã qua). Người dùng `USER` đã vào M4, bóng đá 19:00 ngày mai, `FULL`: `GET /api/matches/joined` trả M4, `GET /api/matches` không trả M4 | Mở `/app/phong-cho` | Thấy M1, M4, M2 theo giờ bắt đầu tăng dần (feed gộp trận của `GET /api/matches` với trận `OPEN` hoặc `FULL` chưa bắt đầu của `GET /api/matches/joined`, bỏ trùng theo `id`). M3 không hiện. Thẻ M1 có tên host, tên đơn vị, sân, ngày, "20:00–21:00", "4/10 suất", "40.000đ/suất", nhãn "Đã xác nhận", nút "Vào trận". Thẻ M2 có nhãn "Chưa xác nhận". Thẻ M4 có nhãn "Đầy" và "Bạn đã vào", không có nút "Vào trận". Các nhãn vẽ trong `features/lobby/`. Khách chưa đăng nhập không gọi `GET /api/matches/joined` |
| AC-2 | Cùng danh sách. Có chip môn "Tất cả", "Cầu lông", "Bóng đá" và chip ngày | Bấm chip "Bóng đá", rồi chip ngày của M2 | Mỗi lần bấm gửi `GET /api/matches?sport=FOOTBALL`, rồi `GET /api/matches?sport=FOOTBALL&date=<ngày>`. Chỉ thẻ khớp hiện. Bấm lại chip đang chọn bỏ bộ lọc đó. Ngày tính theo `Asia/Ho_Chi_Minh` (BR-27), ở `TZ=UTC` và `TZ=America/New_York` kết quả giống nhau |
| AC-3 | API trả danh sách rỗng. Một lần khác API lỗi mạng | Mở tab. Lần khác mở tab | Lần rỗng: thấy "Chưa có trận nào" và nút "Đặt sân" tới `/app/`. Lần lỗi: thấy "Không tải được" và nút "Thử lại". Bấm nút tải lại |
| AC-4 | Tab đang mở. Luồng SSE `/api/matches/stream` gửi sự kiện `match` | Sự kiện tới | Danh sách tải lại một lần, dù có nhiều sự kiện trong 500 ms. Sự kiện `ping` không tải lại. Khi tab ẩn (`visibilitychange`) app đóng luồng. Khi tab hiện lại app mở luồng mới và tải lại danh sách một lần. Khi rời tab Phòng chờ app đóng luồng |
| AC-5 | Trình duyệt không có `EventSource`. Một lần khác luồng gửi một `ping` rồi một sự kiện `error` (server đóng vì hết chỗ, trình duyệt tự nối lại theo `retry`) | Tab mở | Danh sách vẫn hiện, không lỗi. Hook tạo `EventSource` đúng một lần cho tới khi tab ẩn rồi hiện lại, và không tạo lại trong `onerror`. Tab hiện lại sau khi ẩn tải lại danh sách một lần |
| AC-6 | Khách chưa đăng nhập, thẻ M1 | Bấm "Vào trận" | Sheet đăng nhập mở. App không gọi `POST /api/matches/M1/join`. Sau khi đăng nhập app gọi `join` một lần cho M1 |
| AC-7 | Người dùng `USER` đăng nhập, thẻ M1 chưa vào. `GET /api/matches/joined` không có M1 | Bấm "Vào trận" | Gửi `POST /api/matches/M1/join`. Thành công: thẻ M1 hiện "5/10 suất" và nhãn "Bạn đã vào", nút đổi thành "Rời trận". Nút khóa trong lúc chờ. Sau một sự kiện SSE và lần tải lại, M1 vẫn hiện "Bạn đã vào", vì app tải `GET /api/matches/joined` cùng với feed |
| AC-8 | `join` trả 409 "Trận đã đủ người". Một lần khác trả 409 "Bạn đã ở trong trận này". Một lần khác trả 401 | Bấm "Vào trận" | Với 409: thấy thông báo của API trong sheet chi tiết hoặc dòng lỗi trên thẻ, và danh sách tải lại. Với 401: mở sheet đăng nhập và hiện "Phiên đăng nhập đã hết. Hãy đăng nhập lại." |
| AC-9 | Người dùng đã vào M1 (không phải host), M1 bắt đầu sau 3 giờ | Bấm "Rời trận", rồi "Rời trận" trong sheet xác nhận | Sheet "Rời trận này?" hiện sân, giờ. Xác nhận gửi `POST /api/matches/M1/leave`. Thẻ về "4/10 suất" và nút "Vào trận". Lỗi 409 "Đã tới giờ bắt đầu, không rời trận được nữa" hiện trong sheet và danh sách tải lại (BR-18) |
| AC-10 | Bấm vào thân thẻ M1 (không bấm nút) của người dùng đã đăng nhập | Sheet chi tiết mở | Gửi `GET /api/matches/M1`. Sheet hiện danh sách người chơi `ACTIVE` bằng tên. Người dùng không phải host không thấy số điện thoại nào (BR-20). Khách chưa đăng nhập thấy "Đăng nhập để xem người chơi" và app không gọi `GET /api/matches/M1` |
| AC-11 | Người dùng là host của M1, `viewerRole` `HOST`, người chơi A có `phone` | Mở sheet chi tiết | Thấy tên và số điện thoại của A dạng link `tel:`. Không có nút "Rời trận" (BR-18). Có nút "Hủy trận" |
| AC-12 | Host mở sheet chi tiết của M1 | Bấm "Hủy trận", rồi "Hủy trận" trong sheet xác nhận | Sheet "Hủy trận này?" nói trận và booking của trận sẽ bị hủy (BR-17). Xác nhận gửi `POST /api/matches/M1/cancel`. Thẻ rời feed. Lỗi 409 hiện thông báo của API. Lỗi 401 mở sheet đăng nhập |
| AC-13 | `now` = 02/11/2026 10:00 (UTC+7). Trong "Lịch của tôi": booking `PENDING` bắt đầu sau 3 giờ, `match` là `null`. Booking `CONFIRMED` bắt đầu sau 5 giờ, `match` là `null`. Booking có trận `OPEN` hoặc `FULL`. Booking `PENDING` đã qua giờ bắt đầu. Booking `CANCELLED`, `REJECTED`, `EXPIRED` | Thẻ hiện | Chỉ hai booking đầu có nút "Mở trận" (`match` là `null`, trạng thái `PENDING` hoặc `CONFIRMED`, và `startAt` sau `now`). Trận đã `CANCELLED` không mở lại được vì mỗi booking chỉ có một trận (409 "Booking này đã có trận") |
| AC-14 | Sheet "Mở trận" của booking `B1` | Nhập số suất 8 và giá 30000, bấm "Mở trận" | Gửi `POST /api/matches` với `{ bookingId, capacity: 8, pricePerSlot: 30000 }`. Thành công: sheet đóng, danh sách "Lịch của tôi" tải lại, thẻ hiện "Trận mở: 1/8 suất". Số suất ngoài 2 đến 30 hoặc giá âm: nút khóa và hiện "Số suất từ 2 đến 30" hoặc "Giá mỗi suất không hợp lệ", không gửi request. Lỗi 409 hoặc 403 hiện thông báo của API |
| AC-15 | Người dùng có vai trò `OWNER` hoặc `ADMIN` mở tab Phòng chờ | Tab mở | Thấy feed như khách. Nút "Vào trận" và thân thẻ mở màn "Dùng tài khoản người chơi để vào trận". App không gọi `join` và không gọi `GET /api/matches/:id` (server trả 403 vì `@Roles('USER')`) |
| AC-16 | Thẻ trận ở 360px và 390px | Tab mở | Không cuộn ngang. Chip và nút cao ít nhất 44px. Tên đơn vị dài xuống dòng, không tràn |
| AC-17 | Luồng `mobile-lobby` của `verify-flow`: người chơi seed đăng nhập, mở "Phòng chờ" ở 360px và 390px | Luồng chạy | Trang không cuộn ngang. Ô bấm cao ít nhất 44px. Luồng tự mở một trận trên booking mà nó tạo, thấy thẻ của trận trong feed, mở sheet chi tiết (không có nút "Rời trận" vì là host), và hủy trận đó. Báo cáo ghi 0 bước lỗi. Luồng chỉ đổi dữ liệu mà nó tạo |
| AC-18 | Người dùng `USER` ở trong M4 (`FULL`, không phải host, bắt đầu sau 3 giờ). Một lần khác người dùng là host của M4 | Mở thẻ M4 và sheet chi tiết | Người chơi có nút "Rời trận" (BR-18). Host có nút "Hủy trận" (BR-17). Hai nút chạy như AC-9 và AC-12. Sau khi rời, M4 về `OPEN` và vẫn có trong feed. Sau khi host hủy, M4 rời feed |

## Contract

Không đổi `packages/shared` và không đổi API.

| Endpoint or schema | Change | Request | Response and errors |
|---|---|---|---|
| `GET /api/matches` | unchanged | `?sport=&date=` | 200 `MatchView[]` (chỉ trận `OPEN`, `matches.service.ts`). 400 |
| `GET /api/matches/stream` | unchanged | không | SSE: sự kiện `match` khi một trận đổi, `ping` giữ kết nối. Tối đa 40 luồng mỗi instance. Quá giới hạn: một `ping` có `retry` rồi luồng kết thúc |
| `GET /api/matches/joined` | unchanged | không | 200 `MatchView[]` (trận mà người dùng có dòng `ACTIVE`, gồm cả trận do họ làm host). 401 · 403. App tải cùng với feed khi người dùng là `USER` |
| `GET /api/matches/:id` | unchanged | không | 200 `MatchDetailView`. 400 (id không phải UUID) · 401 · 403 (`OWNER`, `ADMIN`) · 404 |
| `POST /api/matches` | unchanged | `{ bookingId, capacity, pricePerSlot }` | 201 `MatchView`. 400 · 401 · 403 · 404 · 409 "Booking này đã có trận", "Chỉ mở được trận trên booking đang chờ xác nhận hoặc đã xác nhận", "Yêu cầu đang được xử lý, hãy thử lại" |
| `POST /api/matches/:id/join` | unchanged | không | 200 `MatchDetailView`. 400 · 401 · 403 · 404 · 409 "Trận đã đủ người", "Bạn đã ở trong trận này", "Trận này không vào được nữa", "Yêu cầu đang được xử lý, hãy thử lại" |
| `POST /api/matches/:id/leave` | unchanged | không | 200 `MatchDetailView`. 400 · 401 · 403 · 404 · 409 "Host không rời trận được. Hãy hủy trận", "Đã tới giờ bắt đầu, không rời trận được nữa", "Trận này không rời được nữa", "Bạn không ở trong trận này", "Yêu cầu đang được xử lý, hãy thử lại" |
| `POST /api/matches/:id/cancel` | unchanged | không | 200 `MatchView`. 400 · 401 · 403 (`OWNER`, `ADMIN`) · 404 (người gọi không phải host) · 409 thông báo của server |
| `lobbyMatches`, `matchesForDay`, `lobbyChips` (hàm thuần) trong `packages/client/src/lobby.ts` | new | `rows`, `now`, bộ lọc, `joinedIds` | Hàm thuần có test chạy ở `TZ=UTC` và `TZ=America/New_York`. Lọc trận chưa bắt đầu, sắp theo `startAt` tăng dần, gắn cờ "đã vào" từ `joinedIds` và "host" từ `hostId`. Server vẫn là nơi kiểm cuối |

## Data

Không đổi bảng nào.

## Build order

One pull request for each row. Each pull request passes the check command on its own.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Hàm thuần của feed và hook luồng SSE `useLobbyStream` | `packages/client/src/lobby.ts`, `packages/client/src/lobby.test.ts`, `packages/client/src/index.ts`, `apps/mobile/src/features/lobby/useLobbyStream.ts`, `apps/mobile/src/features/lobby/useLobbyStream.test.ts` | AC-1 (lọc và sắp xếp), AC-2 (ngày), AC-4, AC-5 |
| 2 | Màn Phòng chờ: feed gộp với danh sách đã vào, chip môn và ngày, trạng thái rỗng và lỗi, route `phong-cho` | `apps/mobile/src/features/lobby/`, `apps/mobile/src/app/router.tsx` | AC-1, AC-2, AC-3, AC-15, AC-16 |
| 3 | Vào, rời, chi tiết, hủy trận của host | `apps/mobile/src/features/lobby/` | AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-18 |
| 4 | Mở trận từ "Lịch của tôi" và luồng `verify-flow` | `apps/mobile/src/features/my/`, `.agents/skills/verify-flow/flows/mobile-lobby.md`, `.agents/skills/verify-flow/scripts/mobile-lobby.mjs`, `.agents/skills/verify-flow/scripts/run.mjs`, `PROGRESS.md` | AC-13, AC-14, AC-17 |

Các bước 2, 3 và 4 chạy lần lượt, không song song. Bước 1 không đụng `apps/mobile` ngoài `features/lobby/`.

## Edit boundaries

- May edit: các đường dẫn trong bảng "Build order", và `PROGRESS.md` ở bước cuối.
- Leave unchanged without approval: `apps/web/`, `apps/api/`, `packages/shared/`, `prisma/`, `apps/mobile/src/features/venues/`, `apps/mobile/src/features/bookings/`, `apps/mobile/src/features/auth/`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Dữ liệu cá nhân: số điện thoại người chơi lộ cho người không phải host (BR-20) | Sheet chi tiết ở bước 3 | App chỉ hiện `phone` khi `viewerRole` là `HOST`. Test AC-10 kiểm DOM không có số điện thoại cho người chơi và khách. API đã ẩn số. Review trong phiên mới, vì chạm dữ liệu cá nhân |
| Tranh chấp suất cuối (BR-15) | Nút "Vào trận" ở bước 3 | Server khóa và kiểm cuối. App khóa nút trong lúc chờ và hiện 409. Không tự cộng `joinedCount` mà không có phản hồi của server |
| Hết chỗ luồng SSE (40 luồng mỗi instance) | `useLobbyStream` ở bước 1 | Đóng luồng khi tab ẩn và khi rời tab. Không tạo lại `EventSource` trong `onerror`: trình duyệt tự nối lại theo `retry` của server. AC-4 và AC-5 |
| Hủy trận hủy luôn booking và báo người chơi (BR-17) | Nút "Hủy trận" ở bước 3 | Sheet xác nhận nêu hậu quả. Chỉ host thấy nút. Server kiểm quyền: người không phải host nhận 404, vai trò khác `USER` nhận 403 |
| Vòng lặp tải lại do sự kiện SSE dồn | Bước 1 | Gộp sự kiện trong 500 ms (AC-4). Một yêu cầu đang chạy không mở yêu cầu thứ hai song song |
| Phiên hết hạn khi vào, rời, hủy hoặc mở trận | Bước 3 và 4 | AC-6, AC-8, AC-12 mở lại đăng nhập |
| Luồng `verify-flow` đổi dữ liệu thật | Bước 4 | AC-17: luồng chỉ tạo, rồi hủy, trận trên booking mà nó tạo. Tìm thẻ theo id, không theo nội dung. Dữ liệu thử có tiền tố `test-` khi có tên |

## Assumptions

1. Feed gộp `GET /api/matches` (chỉ trận `OPEN`) với trận `OPEN` hoặc `FULL` chưa bắt đầu của `GET /api/matches/joined`, bỏ trùng theo `id`, sắp theo giờ bắt đầu tăng dần. Lý do: người ở trong một trận đầy vẫn phải thấy nó để rời trận (BR-18) hoặc hủy trận (BR-17), và API công khai không trả trận đầy. Người ngoài không thấy trận đầy: hiện trận đầy cho mọi người cần đổi API, để sau. Sửa lại bằng cách đổi API và bộ lọc `lobbyMatches`.
2. Nút "Vào trận" hiện ở thẻ. Thân thẻ mở sheet chi tiết. Lý do: hành động thường dùng nhất cần một lần chạm. Sửa lại bằng cách gộp hai chỗ.
3. Vào trận không cần sheet xác nhận, vì rời trận được tới giờ bắt đầu (BR-18). Rời trận và hủy trận cần xác nhận, vì hủy trận không đảo ngược được.
4. Chip ngày là 7 ngày bắt đầu từ hôm nay, theo `Asia/Ho_Chi_Minh`, dùng `dayChipLabel` của `packages/client`. Lý do: giống tab Đặt sân (F-020). Không chọn ngày là xem mọi ngày.
5. SSE chỉ mở khi tab Phòng chờ hiện và đang xem. Sự kiện `match` chỉ báo có thay đổi, nên app tải lại danh sách thay vì vá từng thẻ. Lý do: đơn giản và đúng, và web làm giống vậy. Ngưỡng gộp 500 ms là giả định, chỉnh được.
6. Host thấy trận của mình trong feed như người khác, với nhãn "Bạn là host" và nút "Hủy trận" thay cho "Vào trận". Lý do: host vẫn muốn xem trận mở. Câu hỏi mở 1.
7. Chủ sân và admin xem feed như khách. "Vào trận" và thân thẻ cho vai trò này chỉ hiện thông báo, không gọi API. Lý do: mọi thao tác trận ngoài danh sách và luồng chỉ cho vai trò `USER` (`@Roles('USER')`, mục "Phân quyền" của intake).
8. "Mở trận" nằm ở thẻ booking của "Lịch của tôi" (UC-7), vì trận gắn với một booking. Số suất mặc định là 10 cho mọi môn, và người dùng sửa được. Giá mặc định là 0.
9. Sau khi F-022 xong, dòng AC-15 của F-021 ("Hủy trận trên web hoặc ở tab Phòng chờ khi có") vẫn đúng, kể cả với trận `FULL`, vì feed gộp trận đã vào (Assumptions 1, AC-18).

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Host có muốn thấy trận của chính mình trong feed không? Mặc định: có (Assumptions 6) | Người dùng | AC-1, AC-11 |
| Giá mặc định của trận là 0 hay giá sân chia đều theo số suất? Mặc định: 0 (Assumptions 8) | Người dùng | AC-14 |
| Cần thông báo đẩy cho host khi có người vào hoặc rời? Mặc định: không. F-013 và F-014 đã gửi thông báo trong app và Web Push | Người dùng | none |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
