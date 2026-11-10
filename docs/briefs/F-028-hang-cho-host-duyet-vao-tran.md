---
style: ste80
lang: vi
---

# F-028: Hàng chờ và host duyệt người vào trận

Status: draft
Source: `docs/requirements/intake-monsport-v2.md` (mục W1, BR-49 đến BR-52, UC-15). `docs/design/ke-hoach-v2.md`. Brief `F-012-vao-roi-tran-va-phong-cho-tuc-thi.md` (join, leave, SSE) và `F-013-thong-bao-trong-app.md` (thông báo). Review vòng 1 của Reviewer ngày 10/11/2026 (2 high, 6 medium, 3 low) và vòng 2 (3 medium, 3 low) đã sửa trong bản này.

## Goal

Host mở trận "Host duyệt", và người ghép trận xin vào. Host duyệt hoặc từ chối từng yêu cầu trong hàng chờ, còn trận không bao giờ vượt số suất. Kiểm tra bằng test API và `verify-flow` trên web ở 390px, 1024px và 1440px.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| App mobile cho hàng chờ | Làm web trước (`ke-hoach-v2.md`). Trận "Host duyệt" hiện trong phòng chờ của app như trận thường. Bấm "Vào trận" gửi yêu cầu, và app chưa hiện trạng thái "Chờ duyệt" | Brief app ngay sau W1 |
| Đổi chế độ vào trận sau khi mở trận | BR-49. Đổi lúc có người ở hàng chờ tạo thêm trạng thái | Chờ bạn trả lời mục 2 của "Open items" trong intake V2 |
| Tự duyệt người đã đá cùng host | Cần dữ liệu lịch sử, và W5 chưa có | Sau W5 |
| Giữ suất cho yêu cầu chưa duyệt | BR-50. Trận trông đầy khi chưa đầy | Không có kế hoạch |
| Lý do khi từ chối | Đổi schema và thông báo | Không có kế hoạch |
| Thông báo mở thẳng chi tiết trận | `notificationTarget` nằm trong `packages/client`, dùng chung với app. Thông báo mới mở `/lich-cua-toi` như thông báo hiện có | Brief app |
| Giới hạn số lần gửi lại yêu cầu | `Notification` không có cột người xin để gom thông báo. Người xin hủy rồi gửi lại nhiều lần thì host nhận nhiều thông báo | Theo dõi sau tuần thử nghiệm đầu |

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Host Bình có booking "Đã xác nhận" chưa có trận | `POST /api/matches` với `joinMode: "APPROVAL"` và `capacity: 4`. Một lần khác không gửi `joinMode` | 201. Trận đầu có `joinMode: "APPROVAL"` và `joinedCount: 1`. Trận sau có `joinMode: "INSTANT"` |
| AC-2 | Trận "Vào ngay" 1/4. Người ghép trận Lan | `POST /api/matches/:id/join` | Như V1: 200, Lan có suất, `joinedCount: 2`. Mọi test hiện có của UC-8 vẫn pass |
| AC-3 | Trận "Host duyệt" "Mở" 1/4. Một trận "Host duyệt" "Đầy" 4/4. Lan và Minh chưa có suất | Lan xin vào trận "Mở". Minh xin vào trận "Đầy". Sau đó Lan bấm xin vào lần nữa | Cả hai: 200 `MatchDetailView` với `myRequest: "PENDING"`. `joinedCount` không đổi (1 và 4). Lan và Minh chưa có suất (BR-50, BR-52). Lần xin thứ hai của Lan: 200, `requestedAt` không đổi, host không nhận thông báo thứ hai |
| AC-4 | Lan rồi Minh cùng "Chờ duyệt" trong trận của Bình | Bình gọi `GET /api/matches/:id/requests`. Lan và một người lạ gọi cùng đường dẫn | Bình: 200 và `[Lan, Minh]` theo `requestedAt` tăng dần. Mỗi mục có `userId`, `name` và `phone`. Lan và người lạ: 403. Chỉ host thấy `phone` (BR-20) |
| AC-5 | Trận "Host duyệt" 1/4 với Lan "Chờ duyệt". Một trận khác 3/4 với Minh "Chờ duyệt" | Host gọi `POST /api/matches/:id/requests/:userId/approve` cho mỗi trận | Trận 1/4: 200, Lan có suất, `joinedCount: 2`, trạng thái "Mở". Trận 3/4: 200, Minh có suất, `joinedCount: 4`, trạng thái "Đầy" (BR-15) |
| AC-6 | Trận "Đầy" 4/4 với Minh "Chờ duyệt" | Host duyệt Minh. Sau đó một người rời trận, và host duyệt Minh lần nữa | Lần 1: 409 "Trận đã đủ người", Minh vẫn "Chờ duyệt". Lần 2: 200, Minh có suất (BR-50, BR-52) |
| AC-7 | Trận 3/4 với Lan và Minh đều "Chờ duyệt" | Host gửi hai lệnh duyệt cùng lúc | Đúng một lệnh trả 200, lệnh kia trả 409 "Trận đã đủ người". `joinedCount` là 4. Trận không bao giờ vượt `capacity` (BR-15, BR-50) |
| AC-8 | Lan "Chờ duyệt" | Host từ chối Lan. Sau đó Lan gọi lại `POST .../join` | Từ chối: 200, yêu cầu của Lan thành "Bị từ chối". Lan gửi lại: 409 "Host đã từ chối yêu cầu của bạn" (BR-51) |
| AC-9 | Lan "Chờ duyệt" | Lan gọi `POST /api/matches/:id/leave`. Sau đó Lan gọi lại `POST .../join` | Hủy: 200 và dòng `PENDING` của Lan bị xóa. Gửi lại: 200 với `myRequest: "PENDING"` và `requestedAt` là lúc gửi lại |
| AC-10 | Lan "Chờ duyệt" ở trận A (host đã hủy) và ở trận B (đã qua giờ bắt đầu) | Host duyệt Lan ở A rồi B. Host gọi `GET .../requests`. Lan mở chi tiết | Duyệt: 409 "Yêu cầu này đã hết hạn" ở cả hai. Danh sách yêu cầu: 200 `[]`. Chi tiết của Lan có `myRequest: null`. Lan không có suất (BR-52) |
| AC-11 | Lan gửi yêu cầu vào trận của Bình | Lan xin vào. Bình duyệt. Lan xin trận khác. Bình từ chối | Bình nhận thông báo `MATCH_JOIN_REQUESTED` cho mỗi yêu cầu. Lan nhận `MATCH_JOIN_APPROVED` rồi `MATCH_JOIN_REJECTED`. Web Push dùng đường của F-014 |
| AC-12 | Phòng chờ web có một trận "Vào ngay" và một trận "Host duyệt" | Người dùng mở phòng chờ và chi tiết từng trận | Trận "Host duyệt" có nhãn "Host duyệt" và nút "Xin vào". Trận "Vào ngay" giữ nút "Vào trận". Sau khi xin: "Đã gửi yêu cầu. Chờ host duyệt" và nút "Hủy yêu cầu" |
| AC-13 | Bình mở chi tiết trận "Host duyệt" của mình. Lan xin vào từ máy khác | Lan gửi yêu cầu | Trong 2 giây, Bình thấy mục "Hàng chờ (1)" với Lan, nút "Duyệt" và nút "Từ chối". Server gửi một sự kiện `lobby` cho trận ngay khi yêu cầu được ghi, và màn tải lại chi tiết khi nhận sự kiện đó. Bấm "Duyệt" thì Lan có suất và hàng chờ về 0 |
| AC-14 | Màn rộng 390px | Mở phòng chờ và hàng chờ | Trang không cuộn ngang. Nút cao từ 44px |
| AC-15 | Lan "Chờ duyệt" trong trận của Bình | Bình duyệt Lan và hủy trận cùng lúc | Kết quả là một trong hai: duyệt 200 rồi trận "Đã hủy", hoặc duyệt 409 "Yêu cầu này đã hết hạn". Không có lỗi 5xx và không có `BUSY`. Trận ở "Đã hủy" |
| AC-16 | Người dùng Minh chỉ có dòng `PENDING` hoặc `REJECTED` trong tuần này. Người dùng Hà gửi yêu cầu rồi hủy | Admin gọi `GET /api/admin/stats` | Minh và Hà không tính vào người dùng hoạt động (UC-13). Người từng vào trận rồi rời vẫn tính |
| AC-17 | Host Bình mở form "Mở trận" trên "Booking của tôi" | Bình xem form, rồi chọn "Host duyệt" và gửi | Form có lựa chọn "Vào ngay" (đã chọn sẵn) và "Host duyệt". App gửi `joinMode: "APPROVAL"`. Trận mới có nhãn "Host duyệt" |

## Contract

Hợp đồng nằm ở `packages/shared/src/match.ts` và `packages/shared/src/notification.ts`. Mọi trường mới của view là `optional`. Các object literal có sẵn của web, client và mobile vẫn qua kiểm kiểu. Server luôn gửi các trường đó.

| Endpoint or schema | Change | Request | Response and errors |
|---|---|---|---|
| `JoinMode` | new | — | `z.enum(['INSTANT', 'APPROVAL'])` |
| `MatchPlayerStatus` | add values | — | `ACTIVE`, `LEFT`, `PENDING`, `REJECTED` |
| `CreateMatchRequest` | add field | `joinMode` (mặc định `INSTANT`) | 400 `matchErrorMessage` |
| `MatchView` | add field | — | `joinMode` (optional. Vắng nghĩa là `INSTANT`) |
| `MatchDetailView` | add fields | — | `myRequest`: `PENDING`, `REJECTED` hoặc `null` (optional) · `pendingCount` chỉ có khi người xem là host (optional) |
| `POST /api/matches/:id/join` | change | — | Luôn 200 `MatchDetailView`. Trận `APPROVAL`: `myRequest: "PENDING"` và người xin chưa có suất. Lỗi: 409 "Host đã từ chối yêu cầu của bạn" · 409 `ALREADY_IN_MATCH_MESSAGE` · 409 `NOT_JOINABLE_MESSAGE`. Trận `INSTANT` "Đầy": 409 `MATCH_FULL_MESSAGE` như V1 |
| `POST /api/matches/:id/leave` | change | — | Người "Chờ duyệt": 200 và dòng `PENDING` bị xóa. Còn lại như V1 |
| `GET /api/matches/:id/requests` | new | — | 200 `[{ userId, name, phone, requestedAt }]` theo `requestedAt` tăng dần, chỉ yêu cầu chưa hết hạn · 403 khi không là host |
| `POST /api/matches/:id/requests/:userId/approve` | new | — | 200 `MatchDetailView` · 403 · 404 · 409 "Trận đã đủ người" · 409 "Yêu cầu này đã hết hạn" · 409 "Yêu cầu này không còn chờ duyệt" |
| `POST /api/matches/:id/requests/:userId/reject` | new | — | 200 `MatchDetailView` · 403 · 404 · 409 "Yêu cầu này đã hết hạn" · 409 "Yêu cầu này không còn chờ duyệt" |
| `NotificationType` | add values | — | `MATCH_JOIN_REQUESTED`, `MATCH_JOIN_APPROVED`, `MATCH_JOIN_REJECTED` |

Hằng số thông báo mới trong `match.ts`: `JOIN_REJECTED_MESSAGE`, `REQUEST_EXPIRED_MESSAGE`, `REQUEST_NOT_PENDING_MESSAGE`.

Join là idempotent. Người đã `PENDING` gọi lại thì nhận 200 với `myRequest: "PENDING"`. `joinedAt` không đổi và không có thông báo thứ hai.

Bước 1 thêm ba case vào `formatNotificationContent` (`notification.ts`), nếu không `tsc` báo thiếu nhánh. Văn bản (`{venue}`, `{court}` và `{slot}` như các case hiện có):

| Loại | Tiêu đề | Nội dung |
|---|---|---|
| `MATCH_JOIN_REQUESTED` | Có người xin vào trận | Có người xin vào trận của bạn tại `{venue}` - `{court}` khung `{slot}` |
| `MATCH_JOIN_APPROVED` | Bạn đã được vào trận | Host đã duyệt yêu cầu vào trận tại `{venue}` - `{court}` khung `{slot}` |
| `MATCH_JOIN_REJECTED` | Yêu cầu vào trận bị từ chối | Host đã từ chối yêu cầu vào trận tại `{venue}` - `{court}` khung `{slot}` |

`requestedAt` lấy từ `MatchPlayer.joinedAt`. Với dòng `PENDING`, `joinedAt` là lúc gửi yêu cầu gần nhất. Danh sách công khai của phòng chờ và `joined` không có người xem, nên không có `myRequest` và `pendingCount`.

## Data

| Table | Change | Migration step |
|---|---|---|
| `Match` | Thêm cột `joinMode` kiểu enum `JoinMode`, `NOT NULL`, mặc định `INSTANT` | expand. Trận cũ nhận `INSTANT` |
| `MatchPlayer` | Thêm giá trị `PENDING` và `REJECTED` vào enum `MatchPlayerStatus`. `joinedCount` chỉ đếm `ACTIVE`. Hủy yêu cầu xóa dòng `PENDING`, nên `LEFT` chỉ có nghĩa người đó đã vào trận rồi rời. Gửi lại sau `LEFT` cập nhật dòng cũ. Duyệt đặt `status` là `ACTIVE` và `joinedAt` là lúc duyệt | expand |
| `Notification` | Thêm ba giá trị vào enum `NotificationType` | expand |

Một migration thêm enum và cột. Không dùng giá trị enum mới trong cùng migration, vì `ALTER TYPE ... ADD VALUE` không cho dùng giá trị mới trong cùng transaction. Không thêm trigger. Khi ghi, hủy hoặc xử lý một yêu cầu, service gọi `pg_notify('lobby', <matchId>)` trong cùng transaction. Sự kiện `lobby` hiện có (F-012, ADR 0004) chỉ nhận id của trận, nên chi tiết và danh sách yêu cầu được tải lại qua API.

Bước 1 cũng sửa `docs/requirements/data-dictionary.md`: `MatchPlayer.joinedAt` là lúc vào trận gần nhất, hoặc lúc gửi yêu cầu gần nhất khi `status` là `PENDING`.

## Lock order

Mọi thao tác đổi trận hoặc yêu cầu theo đúng thứ tự khóa của `notifications.service.ts` (Venue, Court, Booking, Match, MatchPlayer, Notification). Các thao tác là join, leave, approve, reject và hủy yêu cầu:

1. `lockVenueOf` (Venue `FOR SHARE`).
2. `Court FOR UPDATE`.
3. `expireBookings` và `finishPastMatches`.
4. `Match FOR UPDATE`.
5. Đọc `MatchPlayer`, rồi ghi.

Thông báo tạo trong cùng transaction.

## Build order

One pull request for each row. Each pull request passes the check command on its own.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Contract and schema | `packages/shared/src/match.ts`, `packages/shared/src/match.test.ts`, `packages/shared/src/notification.ts`, `packages/shared/src/notification.test.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `docs/requirements/business-rules.md`, `docs/requirements/data-dictionary.md`, `docs/requirements/use-cases.md` | AC-1 (contract), AC-11 (kiểu thông báo) |
| 2 | Server: tạo trận, xin vào, hủy yêu cầu, danh sách yêu cầu | `apps/api/src/modules/matches/`, `apps/api/src/modules/admin/stats.service.ts`, `apps/api/src/modules/admin/` (test của stats) | AC-1 đến AC-4, AC-9, AC-10, AC-16 |
| 3 | Server: duyệt, từ chối, thông báo | `apps/api/src/modules/matches/`, `apps/api/src/modules/notifications/`, `apps/api/src/modules/push/` | AC-5 đến AC-8, AC-11, AC-15 |
| 4 | Screen | `apps/web/src/features/matches/`, `apps/web/src/features/bookings/MyBookings.tsx`, `apps/web/src/features/bookings/MyBookings.test.tsx`, `apps/web/src/features/notifications/`, `.agents/skills/verify-flow/` | AC-12 đến AC-14, AC-17 |

## Edit boundaries

- May edit: các đường dẫn trong "Build order", đúng bước của chúng.
- Leave unchanged without approval: `apps/mobile/`, `packages/client/`, `apps/api/src/modules/bookings/`, `apps/api/src/modules/finance/`, các migration đã có, `DESIGN.md`, `REVIEW.md`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Concurrency: hai lệnh duyệt cùng lúc vào suất cuối, và duyệt cùng lúc với hủy trận | Bước 2 và 3, `matches.service.ts` | Thứ tự khóa của mục "Lock order". Test AC-7 và AC-15. Review ở phiên mới với model mạnh nhất và skill `rule-review` |
| Schema: thêm giá trị enum và cột có mặc định | Bước 1 | Chỉ expand. Test migrate trên cơ sở dữ liệu có trận cũ. Review ở phiên mới |
| Dữ liệu cá nhân: host thấy số điện thoại của người xin | Bước 2, `GET .../requests` | BR-20. Test AC-4 kiểm 403 cho người khác. Review ở phiên mới |
| Số liệu admin đổi nghĩa: dòng `PENDING` và `REJECTED` | Bước 2, `stats.service.ts` | Lọc theo trạng thái. Test AC-16 |
| Hồi quy: luồng "Vào ngay" của V1, và app mobile | Bước 2 | AC-2, các test hiện có của UC-8, và trường mới `optional` |

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Host có đổi được chế độ vào trận sau khi mở trận không? Mặc định: không (BR-49) | Bạn | none |
| Trận "Host duyệt" có tự duyệt người đã đá cùng host trước đó không? Mặc định: không | Bạn | none |
| Phòng chờ của app có ẩn trận "Host duyệt" tới khi có brief app không? Mặc định: không ẩn | Bạn | none |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
