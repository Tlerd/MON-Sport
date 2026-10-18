---
style: ste80
lang: vi
---

# F-012: Vào trận, rời trận và phòng chờ tức thì

Status: accepted
Source:

- Intake `docs/requirements/intake-monsport-v1.md`:
  - UC-8: "Xem phòng chờ, lọc theo môn và ngày, xem chi tiết trận, vào trận, rời trận, xem các trận mình đã vào".
  - Mục "UC-7, UC-8: phòng chờ" (bước 4–5: phòng chờ tự cập nhật trong vòng 2 giây), mục "Trạng thái của trận" (Mở, Đầy), mục "Tức thì" (Server-Sent Events), mục Quality "Phòng chờ tức thì".
  - Acceptance UC-8: "Người thứ 4 bấm vào trận và trận chuyển sang Đầy. Một người rời thì trận về Mở. Hai người cùng bấm vào suất cuối thì một người nhận Trận đã đủ người", và "Máy B đang mở phòng chờ thấy trận mới trong vòng 2 giây mà không cần tải lại trang".
  - Assumptions: "Host chiếm 1 suất trong trận", "Người ghép trận rời trận được tới giờ đá".
- `docs/requirements/use-cases.md` UC-8 (8.0 bước 3–5, 8.1, 8.2, 8.0.E1, 8.1.E1).
- `docs/requirements/business-rules.md` BR-8, BR-15, BR-16, BR-18, BR-19, BR-20, BR-22.
- `docs/requirements/data-dictionary.md`: `Match.joinedCount`, `MatchPlayer` ("Vào lại thì cập nhật dòng cũ").
- `docs/requirements/models.md`: Figure 5 (luồng phòng chờ qua SSE), Figure 8 (`OPEN` ⇄ `FULL`).
- Brief `F-011-mo-tran-phong-cho-va-huy-tran.md`: non-goal "Người ghép trận bấm vào trận, rời trận…" và "Phòng chờ tự cập nhật trong vòng 2 giây qua SSE".

## Goal

Người dùng vào được và rời được một trận trong phòng chờ, xem chi tiết trận và các trận mình đã vào, còn phòng chờ tự cập nhật khi trận đổi. Kiểm tra bằng ví dụ của intake: người thứ 4 vào trận 4 suất thì trận chuyển sang "Đầy", một người rời thì trận về "Mở", và máy B thấy trận mới trong vòng 2 giây.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Thông báo Web Push và thông báo trong app khi có người vào, rời hoặc trận bị hủy (UC-14) | UC-14 nằm sau UC-8 trong thứ tự ra mắt của intake | Brief của UC-14 |
| Host mời người hoặc duyệt người vào trận | Intake: "Host không duyệt" (UC-8) | Không có kế hoạch |
| Host đuổi người khỏi trận | Intake không có thao tác này | Khi có yêu cầu |
| Host rời trận của mình | Host chiếm 1 suất (BR-14). Host muốn thôi thì hủy trận (UC-9, F-011) | Không có kế hoạch |
| Phòng chờ tự bỏ trận khi tới giờ bắt đầu mà không có sự kiện | Không có thay đổi nào trên dòng `Match` lúc đó. Lần tải lại kế tiếp lọc trận đó ra (F-011) | Khi có yêu cầu |
| Danh sách yêu cầu của chủ sân tự cập nhật qua SSE | Intake có ghi, nhưng đó là UC-4. Slice này chỉ làm phòng chờ | Brief riêng cho UC-4 tức thì |
| Thu tiền mỗi suất trong app | Intake, Out of scope | Bản sau |

## Acceptance criteria

Dữ liệu chung: mỗi test tạo lại dữ liệu này trước khi chạy, như `apps/api/src/modules/matches/matches.e2e.test.ts`.

- Admin (`0900000000`).
- Chủ sân "Bình" (`0912345678`) quản lý "Cầu lông A" (địa chỉ "10 Nguyễn Huệ", số `0911111111`, mở 06:00, đóng 23:00) có "Sân 1" (`BADMINTON`).
- Người dùng "An" (`0901234567`), "Chi" (`0901234568`), "Em" (`0901234569`), "Giang" (`0901234570`), "Hà" (`0901234571`).
- Bây giờ là 20/11/2026 10:00 `Asia/Ho_Chi_Minh`, trừ khi dòng ghi giờ khác. Mọi giờ dưới đây là ngày 20/11/2026.
- "Trận T" là trận An mở trên booking "Chờ xác nhận" 20:00–21:00 trên "Sân 1", `capacity` = 4, `pricePerSlot` = 50000.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Trận T có 1 người (An) | Chi gọi `POST /api/matches/<T>/join` | 200 `MatchDetailView`: `joinedCount` = 2, `status` = `OPEN`, `viewerRole` = `PLAYER`, `players` = An rồi Chi. Bảng `MatchPlayer` có dòng của Chi với `status` = `ACTIVE`, `joinedAt` = 10:00, `leftAt` = null |
| AC-2 | Trận T có An và Chi | Em vào, rồi Giang vào, rồi Hà vào | Em và Giang nhận 200. Sau Giang, `joinedCount` = 4 và `status` = `FULL` (BR-15). `GET /api/matches` không còn trận T. Hà nhận 409 "Trận đã đủ người" (8.0.E1), và số dòng `ACTIVE` vẫn là 4 |
| AC-3 | Trận T đầy (An, Chi, Em, Giang) | Giang gọi `POST /api/matches/<T>/leave` lúc 10:00. Rồi Hà vào. Rồi Hà rời lúc 10:05 và vào lại lúc 10:10 | Giang nhận 200: `joinedCount` = 3, `status` = `OPEN` (BR-15). Dòng của Giang có `status` = `LEFT`, `leftAt` = 10:00. `GET /api/matches` có lại trận T. Hà vào được (`FULL`). Sau khi Hà vào lại, bảng vẫn có đúng 1 dòng của Hà, với `status` = `ACTIVE`, `joinedAt` = 10:10, `leftAt` = null |
| AC-4 | Trận An mở trên booking "Đã xác nhận" 18:00–19:00, `capacity` = 2. Test tạo thêm 10 người dùng `test-khach-1` tới `test-khach-10` | 10 người đó gọi vào trận cùng lúc | Không request nào nhận 500. Đúng 1 request nhận 200. 9 request nhận 409 "Trận đã đủ người". Trận có `joinedCount` = 2, `status` = `FULL`, và đúng 2 dòng `ACTIVE` |
| AC-5 | Trận T có An và Chi. An có thêm: một trận đã hủy (`CANCELLED`), một trận trên booking "Đã xác nhận" 09:00–10:30 (đã bắt đầu, còn `OPEN`), và một trận trên booking "Chờ xác nhận" có hạn xác nhận 09:30 mà DB còn ghi `PENDING` | An vào trận T. Chi vào trận T lần nữa. Em vào từng trận còn lại. Em vào một UUID không có và `abc`. Bình, admin và request không cookie gọi vào trận T | An và Chi nhận 409 "Bạn đã ở trong trận này". Ba trận còn lại nhận 409 "Trận này không vào được nữa". Trận quá hạn chuyển sang `CANCELLED` và booking của nó sang `EXPIRED` (BR-8, BR-16). UUID không có nhận 404 "Không tìm thấy trận". `abc` nhận 400 "Dữ liệu không hợp lệ". Bình 403, admin 403, không cookie 401. `joinedCount` của các trận không đổi |
| AC-6 | Trận T có An, Chi, Em. Một trận khác trên booking "Đã xác nhận" 10:30–11:30 có An (host) và Giang. Một trận đã hủy có Hà `ACTIVE` | An rời trận T. Hà rời trận T. Lúc 10:29:59.999, Giang rời rồi vào lại trận 10:30. Lúc 10:30:00.000, Giang rời trận đó. Hà rời trận đã hủy. Chi rời một UUID không có. Bình và admin gọi rời trận T | An nhận 409 "Host không rời trận được. Hãy hủy trận". Hà (trận T) nhận 409 "Bạn không ở trong trận này". Giang rời lúc 10:29:59.999 nhận 200. Giang rời lúc 10:30:00.000 nhận 409 "Đã tới giờ bắt đầu, không rời trận được nữa" (BR-18, 8.1.E1). Hà (trận đã hủy) nhận 409 "Trận này không rời được nữa". UUID không có nhận 404. Bình 403, admin 403 |
| AC-7 | Trận T có An, Chi (vào 10:00), Em (vào 10:01). Giang đã vào rồi rời | Chi gọi `GET /api/matches/<T>`. An gọi lại. Hà gọi lại. Khách không cookie và Bình gọi lại. Chi gọi một UUID không có | Chi nhận 200 với `viewerRole` = `PLAYER`, `players` = An, Chi, Em theo `joinedAt` tăng dần (host đầu tiên), không có Giang, và mọi `phone` là null (BR-20). An nhận `viewerRole` = `HOST` và `phone` của An, Chi, Em là `0901234567`, `0901234568`, `0901234569` (BR-20). Hà nhận `viewerRole` = `NONE` và mọi `phone` là null. Không cookie 401, Bình 403. UUID không có 404 "Không tìm thấy trận" |
| AC-8 | Chi `ACTIVE` trong trận T (20:00), trong một trận đã hủy (19:00), và trong một trận trên booking "Đã xác nhận" 10:30–11:30. Chi đã rời một trận 18:00 | Lúc 11:31, Chi gọi `GET /api/matches/joined` | 200 có đúng 3 trận theo `startAt` giảm dần: trận T (`OPEN`), trận 19:00 (`CANCELLED`), trận 10:30 (`FINISHED`, BR-19). Không có trận 18:00. Không phần tử nào có số điện thoại. Bình 403, không cookie 401 |
| AC-9 | Hai instance API (A và B) chạy trên cùng một database. Một client nối `GET /api/matches/stream` của B, không cookie | An mở trận trên A. Chi vào trận trên A. An hủy trận trên A | Response có `Content-Type: text/event-stream`. Client nhận ba sự kiện `match` có `data` = `{"id":"<id trận>"}`, mỗi sự kiện trong vòng 2 giây sau response của A (Acceptance UC-8) |
| AC-10 | Trận T có An và Chi, `capacity` = 4 | Cùng lúc: An hủy trận, Chi rời, Em, Giang và Hà vào | Không request nào nhận 500. Sau cùng, `joinedCount` bằng số dòng `ACTIVE` của trận. Nếu trận `CANCELLED` thì booking `CANCELLED`. Mỗi request vào bị từ chối nhận 409 "Trận này không vào được nữa" hoặc "Trận đã đủ người" |
| AC-11 | Web: Chi đăng nhập với vai trò `USER`. API giả lập trả phòng chờ có trận T (2/4 suất, host "An") | Chi bấm "Xem chi tiết" ở trận T, rồi "Vào trận", rồi "Rời trận". Lần thứ hai, API trả 409 "Trận đã đủ người" khi bấm "Vào trận" | Chi tiết hiện sân, giờ, host, "Còn 2 suất trống", "50.000đ/suất" và tên người chơi. Web gọi `GET /api/matches/<T>`, rồi `POST /api/matches/<T>/join` và hiện nút "Rời trận", rồi `POST /api/matches/<T>/leave` và hiện lại nút "Vào trận". Khi 409, vùng `role="alert"` hiện "Trận đã đủ người". Khi `viewerRole` = `HOST`, mỗi người chơi có link `tel:` và không có nút "Rời trận". Khách chưa đăng nhập bấm "Xem chi tiết" thì thấy "Đăng nhập để vào trận" và web không gọi `GET /api/matches/<T>` |
| AC-12 | Web: phòng chờ đang mở với bộ lọc `sport=BADMINTON` | Server gửi một sự kiện `match` qua `EventSource('/api/matches/stream')`. Rồi component bị gỡ | Web gọi lại `GET /api/matches?sport=BADMINTON` một lần sau sự kiện. Khi gỡ, web đóng `EventSource` |
| AC-13 | Web: An đăng nhập với vai trò `USER`. `GET /api/matches/joined` trả hai trận: một `OPEN`, một `CANCELLED` | An mở app | Mục "Trận đã vào" hiện hai dòng với đơn vị · sân, ngày, giờ, nhãn "Trận đang mở" và "Trận đã hủy", và số suất (`2/4 suất`). Danh sách rỗng hiện "Bạn chưa vào trận nào". Khách, chủ sân và admin không thấy mục này |
| AC-14 | Migration của F-012 đã chạy. Một client `pg` chạy `LISTEN lobby` | Lệnh SQL chèn một dòng `Match`, rồi cập nhật `joinedCount` của dòng đó | Client nhận hai thông báo trên kênh `lobby`, mỗi thông báo có payload là `id` của dòng |

## Contract

Zod trong `packages/shared/src/match.ts` là nguồn duy nhất.

| Endpoint or schema | Change | Request | Response and errors |
|---|---|---|---|
| `MatchViewerRole` | new | — | `z.enum(['HOST', 'PLAYER', 'NONE'])` |
| `MatchPlayerView` | new | — | `{ userId: z.uuid(), name: z.string(), phone: Phone.nullable(), joinedAt: Instant }` |
| `MatchDetailView` | new | — | `MatchView.extend({ players: z.array(MatchPlayerView), viewerRole: MatchViewerRole })`. `phone` khác null chỉ khi `viewerRole` = `HOST` (BR-20) |
| Câu lỗi | new | — | `MATCH_FULL_MESSAGE` = "Trận đã đủ người", `ALREADY_IN_MATCH_MESSAGE` = "Bạn đã ở trong trận này", `NOT_JOINABLE_MESSAGE` = "Trận này không vào được nữa", `HOST_CANNOT_LEAVE_MESSAGE` = "Host không rời trận được. Hãy hủy trận", `NOT_IN_MATCH_MESSAGE` = "Bạn không ở trong trận này", `LEAVE_STARTED_MESSAGE` = "Đã tới giờ bắt đầu, không rời trận được nữa", `NOT_LEAVABLE_MESSAGE` = "Trận này không rời được nữa" |
| `GET /api/matches/stream` | new, công khai | — | 200 `text/event-stream`. Sự kiện `match` với `data` = `{"id":"<uuid>"}` mỗi khi một dòng `Match` được chèn, hoặc đổi `status` hay `joinedCount`. Sự kiện `ping` mỗi 25 giây để giữ kết nối |
| `GET /api/matches/joined` | new | Vai trò `USER` | 200 `MatchView[]`: các trận mà người gọi có dòng `MatchPlayer` `ACTIVE`, mọi `status`, theo `Booking.startAt` giảm dần rồi `id` giảm dần. Trước khi đọc, chạy `expire` rồi `finish` cho các booking của các trận đó, thử lại 1 lần khi `isDeadlock`, trả 409 "Yêu cầu đang được xử lý, hãy thử lại" nếu lần thử lại vẫn lỗi `40P01`/`P2034`. 401, 403 |
| `GET /api/matches/:id` | new | Vai trò `USER` | 200 `MatchDetailView`. `players` chỉ gồm dòng `ACTIVE`, theo `joinedAt` tăng dần rồi `userId`. Trước khi đọc, chạy `expire` rồi `finish` cho booking của trận, thử lại 1 lần khi `isDeadlock`, trả 409 "Yêu cầu đang được xử lý, hãy thử lại" nếu lần thử lại vẫn lỗi `40P01`/`P2034`. 400 khi `:id` không phải UUID. 401, 403. 404 "Không tìm thấy trận" |
| `POST /api/matches/:id/join` | new | Vai trò `USER` | 200 `MatchDetailView`. 400, 401, 403, 404 như trên. 409 theo thứ tự kiểm: `NOT_JOINABLE_MESSAGE` khi trận không `OPEN`/`FULL` hoặc `Booking.startAt` ≤ bây giờ. `ALREADY_IN_MATCH_MESSAGE` khi người gọi đang `ACTIVE`. `MATCH_FULL_MESSAGE` khi `joinedCount` ≥ `capacity`. 409 "Yêu cầu đang được xử lý, hãy thử lại" khi `40P01`/`P2034` |
| `POST /api/matches/:id/leave` | new | Vai trò `USER` | 200 `MatchDetailView`. 400, 401, 403, 404 như trên. 409 theo thứ tự kiểm: `HOST_CANNOT_LEAVE_MESSAGE` khi người gọi là host. `NOT_IN_MATCH_MESSAGE` khi người gọi không `ACTIVE`. `NOT_LEAVABLE_MESSAGE` khi trận không `OPEN`/`FULL`. `LEAVE_STARTED_MESSAGE` khi `Booking.startAt` ≤ bây giờ (BR-18). 409 "Yêu cầu đang được xử lý, hãy thử lại" khi `40P01`/`P2034` |

Các lỗi 409 của `join` và `leave` được ném sau khi transaction commit, để trạng thái `EXPIRED`, `CANCELLED` hoặc `FINISHED` do `expire` và `finish` ghi vẫn còn (AC-5), giống `MatchesService.create` và `cancel` của F-011.

Thứ tự khóa:

| Route | Khóa |
|---|---|
| Vào trận, rời trận | `Venue` (`FOR SHARE`), `Court` (`FOR UPDATE`), chạy `expire` và `finish` cho booking của trận, rồi `Match` (`FOR UPDATE`), rồi chèn hoặc cập nhật `MatchPlayer` và cập nhật `Match` |
| Các route của F-011 | Không đổi |

Vào trận và rời trận đi cùng thứ tự `Venue` → `Court` → `Booking` → `Match` với mọi route ghi khác, nên không có vòng chờ mới. Khóa `Court` làm các lượt vào cùng một sân chạy lần lượt. Ràng buộc `CHECK` `joinedCount <= capacity` của F-011 là chốt chặn cuối.

Sự kiện phòng chờ đi qua Postgres `LISTEN`/`NOTIFY`, để mọi instance Cloud Run nhận cùng một sự kiện (ADR 0004). Thông báo chỉ tới sau khi transaction commit, nên client không thấy trạng thái bị rollback.

## Data

| Table | Change | Migration step |
|---|---|---|
| `Match` | Hàm `match_notify_lobby()` gọi `pg_notify('lobby', NEW."id"::text)`. Trigger `Match_notify_lobby` `AFTER INSERT OR UPDATE OF "status", "joinedCount" ON "Match" FOR EACH ROW`. Không đổi cột | expand |
| `MatchPlayer` | Không đổi. Vào lại cập nhật dòng cũ theo khóa chính (`matchId`, `userId`) | — |

## Build order

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Hợp đồng, trigger và ADR | `packages/shared/src/match.ts`, `packages/shared/src/match.test.ts`, `apps/api/prisma/migrations/`, `apps/api/prisma/migration.test.ts`, `docs/adr/0004-su-kien-phong-cho-qua-postgres-notify.md`, `PROGRESS.md`, file brief này | Test Zod cho `MatchDetailView`, `MatchPlayerView`, câu lỗi. AC-14 trên Postgres thật. Review bằng phiên mới và skill `rule-review` |
| 2 | Server: vào, rời, chi tiết, trận đã vào, luồng SSE | `apps/api/src/modules/matches/`, `PROGRESS.md` | AC-1 tới AC-10 trong `apps/api/src/modules/matches/join-leave.e2e.test.ts` và `apps/api/src/modules/matches/lobby-stream.e2e.test.ts`. Review bằng phiên mới và skill `rule-review` |
| 3 | Màn hình: chi tiết trận, vào và rời, phòng chờ tức thì, "Trận đã vào" | `apps/web/src/features/matches/`, `apps/web/src/app/App.tsx`, `apps/web/src/app/App.test.tsx`, `apps/web/src/app/styles.css`, `PROGRESS.md` | AC-11 tới AC-13 trong `apps/web/src/features/matches/*.test.tsx` và `App.test.tsx` |

## Edit boundaries

- May edit: các path trong bảng Build order.
- Leave unchanged without approval: `AGENTS.md`, `.dependency-cruiser.cjs`, `scripts/check.mjs`, `.github/workflows/`, `apps/api/prisma/schema.prisma`, `apps/api/src/modules/auth/`, `apps/api/src/modules/admin/`, `apps/api/src/modules/venues/`, `apps/api/src/modules/database/`, `apps/api/src/modules/bookings/`, `apps/web/src/features/bookings/`, `apps/web/src/features/admin/`, `apps/web/src/features/auth/`, `apps/web/src/features/venues/`, các file trong `docs/requirements/`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Đồng thời: nhiều người vào suất cuối, hoặc vào và rời cùng lúc host hủy trận | `MatchesService.join`, `leave` | Cùng thứ tự khóa `Venue` → `Court` → `Booking` → `Match`. `CHECK` `joinedCount <= capacity`. AC-4 và AC-10 trên Postgres thật. Review bằng phiên mới và skill `rule-review` |
| `joinedCount` lệch với số dòng `ACTIVE` | `join`, `leave` | Đổi `MatchPlayer` và `joinedCount` trong cùng transaction, dưới khóa `Match`. AC-3, AC-4, AC-10 so `joinedCount` với số dòng `ACTIVE` |
| Lộ số điện thoại người chơi (BR-20) | `GET /api/matches/:id`, `GET /api/matches/joined`, luồng SSE | `phone` chỉ có khi người gọi là host. Luồng SSE chỉ gửi `id`. AC-7, AC-8, AC-9. Review bằng phiên mới và skill `rule-review` |
| Sự kiện không tới instance khác, hoặc kết nối `LISTEN` rớt | `LobbyEvents` | Postgres `NOTIFY` tới mọi phiên `LISTEN`. Kết nối rớt thì nối lại sau 1 giây. `EventSource` của trình duyệt tự nối lại. AC-9 dùng hai instance |
| Rò kết nối khi client đóng tab | `GET /api/matches/stream` | Hủy subscription khi response đóng. Một kết nối `LISTEN` cho mỗi instance, không phải cho mỗi client |
| Rời trận đúng lúc bắt đầu (BR-18) | `leave` | So `Booking.startAt` ≤ bây giờ trong transaction. AC-6 kiểm 1 ms trước và đúng giờ bắt đầu |

## Assumptions

- Chỉ vai trò `USER` vào, rời và xem chi tiết trận. Chủ sân và admin không phải người ghép trận. Khách chưa đăng nhập vẫn xem danh sách phòng chờ (F-011).
- Người dùng vào được trận trên booking "Chờ xác nhận". Intake cho phòng chờ hiện cả trận chưa xác nhận, với nhãn riêng.
- Host không rời trận của mình. Host muốn thôi thì hủy trận (UC-9).
- `GET /api/matches/joined` gồm cả trận người gọi làm host, vì host là một người `ACTIVE` trong trận (BR-14).
- Người chơi không thấy số điện thoại của host, vì BR-20 chỉ cho chủ sân và host thấy số điện thoại. Người chơi gọi host qua kênh khác, hoặc gặp tại sân.
- Sự kiện SSE chỉ mang `id`. Client tải lại danh sách với bộ lọc của mình, nên server không cần biết bộ lọc của từng client.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Người chơi có cần thấy số điện thoại của host không? BR-20 hiện không cho | Bạn | none |

## Done when

- Mỗi AC có một test đạt, với nhãn trong tên test.
- `pnpm check` đạt trên pull request cuối.
- Các review trong "Risks and reviews" đã xong.
