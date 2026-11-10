---
style: ste80
lang: vi
---

# F-028: Hàng chờ và host duyệt người vào trận

Status: draft
Source: `docs/requirements/intake-monsport-v2.md` (mục W1, BR-33 đến BR-36, UC-15). `docs/design/ke-hoach-v2.md`. Brief `F-012-vao-roi-tran-va-phong-cho-tuc-thi.md` (join, leave, SSE) và `F-013-thong-bao-trong-app.md` (thông báo). Quyết định theo "Autonomy" của `AGENTS.md`: xem "Assumptions" của intake V2.

## Goal

Host mở trận "Host duyệt", và người ghép trận xin vào. Host duyệt hoặc từ chối từng yêu cầu trong hàng chờ, còn trận không bao giờ vượt số suất. Kiểm tra bằng test API và `verify-flow` trên web ở 390px, 1024px và 1440px.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| App mobile cho hàng chờ | Làm web trước (`ke-hoach-v2.md`) | Brief sau W1 |
| Đổi chế độ vào trận sau khi mở trận | BR-33. Đổi lúc có người ở hàng chờ tạo thêm trạng thái | Chờ bạn trả lời mục 2 của "Open items" trong intake V2 |
| Tự duyệt người đã đá cùng host | Cần dữ liệu lịch sử, và W5 chưa có | Sau W5 |
| Giữ suất cho yêu cầu chưa duyệt | BR-34. Trận trông đầy khi chưa đầy | Không có kế hoạch |
| Lý do khi từ chối | Đổi schema và thông báo | Không có kế hoạch |
| Thay đổi `apps/mobile` | Web trước | Brief sau W1 |

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Host Bình có booking "Đã xác nhận" chưa có trận | `POST /api/matches` với `joinMode: "APPROVAL"` và `capacity: 4` | 201. Trận có `joinMode: "APPROVAL"` và `joinedCount: 1`. Không gửi `joinMode` thì trận có `joinMode: "INSTANT"` |
| AC-2 | Trận "Vào ngay" 1/4. Người ghép trận Lan | `POST /api/matches/:id/join` | Như V1: 200, Lan có suất, `joinedCount: 2`. Mọi test hiện có của UC-8 vẫn pass |
| AC-3 | Trận "Host duyệt" "Mở" 1/4. Lan chưa có suất | Lan gọi `POST /api/matches/:id/join` | 202 `{ status: "PENDING" }`. `joinedCount` vẫn là 1. Lan chưa có suất (BR-34) |
| AC-4 | Lan "Chờ duyệt" trong trận của Bình | Bình gọi `GET /api/matches/:id/requests`. Sau đó Lan và một người lạ gọi cùng đường dẫn | Bình: 200 và danh sách `{ userId, name: "Lan", phone, createdAt }` theo `createdAt` tăng dần. Lan và người lạ: 403. Chỉ host thấy `phone` (BR-20) |
| AC-5 | Trận "Host duyệt" 1/4 với Lan "Chờ duyệt". Một trận khác 3/4 với Minh "Chờ duyệt" | Host gọi `POST /api/matches/:id/requests/:userId/approve` cho mỗi trận | Trận 1/4: 200, Lan có suất, `joinedCount: 2`, trạng thái "Mở". Trận 3/4: 200, Minh có suất, `joinedCount: 4`, trạng thái "Đầy" (BR-15) |
| AC-6 | Trận "Đầy" 4/4 với Minh "Chờ duyệt" | Host duyệt Minh. Sau đó một người rời trận, và host duyệt Minh lần nữa | Lần 1: 409 "Trận đã đủ người", Minh vẫn "Chờ duyệt". Lần 2: 200, Minh có suất (BR-34, BR-36) |
| AC-7 | Trận 3/4 với Lan và Minh đều "Chờ duyệt" | Host gửi hai lệnh duyệt cùng lúc | Đúng một lệnh trả 200, lệnh kia trả 409 "Trận đã đủ người". `joinedCount` là 4. Trận không bao giờ vượt `capacity` (BR-15, BR-34) |
| AC-8 | Lan "Chờ duyệt" | Host từ chối Lan. Sau đó Lan gọi lại `POST .../join` | Từ chối: 200, yêu cầu của Lan thành "Bị từ chối". Lan gửi lại: 409 "Host đã từ chối yêu cầu của bạn" (BR-35) |
| AC-9 | Lan "Chờ duyệt" | Lan gọi `POST /api/matches/:id/leave`. Sau đó Lan gọi lại `POST .../join` | Hủy: 200 và Lan hết yêu cầu. Gửi lại: 202 "Chờ duyệt" |
| AC-10 | Lan "Chờ duyệt". Trận A bị host hủy. Trận B đã qua giờ bắt đầu | Host duyệt Lan ở trận A, rồi ở trận B | Cả hai: 409 "Yêu cầu này đã hết hạn". Lan không có suất (BR-36) |
| AC-11 | Lan gửi yêu cầu vào trận của Bình | Lan xin vào. Bình duyệt. Lan xin trận khác. Bình từ chối | Bình nhận thông báo `MATCH_JOIN_REQUESTED` cho mỗi yêu cầu. Lan nhận `MATCH_JOIN_APPROVED` rồi `MATCH_JOIN_REJECTED`. Web Push dùng đường của F-014 |
| AC-12 | Phòng chờ web có một trận "Vào ngay" và một trận "Host duyệt" | Người dùng mở phòng chờ và chi tiết từng trận | Trận "Host duyệt" có nhãn "Host duyệt" và nút "Xin vào". Trận "Vào ngay" giữ nút "Vào trận". Sau khi xin: "Đã gửi yêu cầu. Chờ host duyệt" và nút "Hủy yêu cầu" |
| AC-13 | Bình mở chi tiết trận "Host duyệt" của mình. Lan xin vào từ máy khác | Lan gửi yêu cầu | Trong 2 giây, Bình thấy mục "Hàng chờ (1)" với Lan, nút "Duyệt" và nút "Từ chối". Bấm "Duyệt" thì Lan có suất và hàng chờ về 0 |
| AC-14 | Màn rộng 390px | Mở phòng chờ và hàng chờ | Trang không cuộn ngang. Nút cao từ 44px |

## Contract

Hợp đồng nằm ở `packages/shared/src/match.ts` và `packages/shared/src/notification.ts`.

| Endpoint or schema | Change | Request | Response and errors |
|---|---|---|---|
| `JoinMode` | new | — | `z.enum(['INSTANT', 'APPROVAL'])` |
| `MatchPlayerStatus` | add values | — | `ACTIVE`, `LEFT`, `PENDING`, `REJECTED` |
| `CreateMatchRequest` | add field | `joinMode` (mặc định `INSTANT`) | 400 `matchErrorMessage` |
| `MatchView` | add fields | — | `joinMode` · `myRequest`: `PENDING`, `REJECTED` hoặc `null` · `pendingCount` chỉ có khi người xem là host |
| `POST /api/matches/:id/join` | change | — | Trận `INSTANT`: như V1. Trận `APPROVAL`: 202 `{ status: "PENDING" }` · 409 "Host đã từ chối yêu cầu của bạn" · 409 `ALREADY_IN_MATCH_MESSAGE` · 409 `NOT_JOINABLE_MESSAGE` |
| `POST /api/matches/:id/leave` | change | — | Người "Chờ duyệt": 200 và yêu cầu bị hủy. Còn lại như V1 |
| `GET /api/matches/:id/requests` | new | — | 200 `[{ userId, name, phone, createdAt }]` theo `createdAt` tăng dần · 403 khi không là host |
| `POST /api/matches/:id/requests/:userId/approve` | new | — | 200 `MatchDetailView` · 403 · 404 · 409 "Trận đã đủ người" · 409 "Yêu cầu này đã hết hạn" · 409 "Yêu cầu này không còn chờ duyệt" |
| `POST /api/matches/:id/requests/:userId/reject` | new | — | 200 `MatchDetailView` · 403 · 404 · 409 "Yêu cầu này đã hết hạn" · 409 "Yêu cầu này không còn chờ duyệt" |
| `NotificationType` | add values | — | `MATCH_JOIN_REQUESTED`, `MATCH_JOIN_APPROVED`, `MATCH_JOIN_REJECTED` |

Hằng số thông báo mới trong `match.ts`: `JOIN_REJECTED_MESSAGE`, `REQUEST_EXPIRED_MESSAGE`, `REQUEST_NOT_PENDING_MESSAGE`.

## Data

| Table | Change | Migration step |
|---|---|---|
| `Match` | Thêm cột `joinMode` kiểu enum `JoinMode`, `NOT NULL`, mặc định `INSTANT` | expand. Trận cũ nhận `INSTANT` |
| `MatchPlayer` | Thêm giá trị `PENDING` và `REJECTED` vào enum `MatchPlayerStatus`. `joinedCount` chỉ đếm `ACTIVE` | expand |
| `Notification` | Thêm ba giá trị vào enum `NotificationType` | expand |

Một migration thêm enum và cột. Không dùng giá trị enum mới trong cùng migration, vì `ALTER TYPE ... ADD VALUE` không cho dùng giá trị mới trong cùng transaction.

## Build order

One pull request for each row. Each pull request passes the check command on its own.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Contract and schema | `packages/shared/src/match.ts`, `packages/shared/src/match.test.ts`, `packages/shared/src/notification.ts`, `packages/shared/src/notification.test.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `docs/requirements/business-rules.md`, `docs/requirements/data-dictionary.md`, `docs/requirements/use-cases.md` | AC-1 (contract), AC-11 (kiểu thông báo) |
| 2 | Server | `apps/api/src/modules/matches/`, `apps/api/src/modules/notifications/`, `apps/api/src/modules/push/` | AC-1 đến AC-11 |
| 3 | Screen | `apps/web/src/features/matches/`, `apps/web/src/features/notifications/`, `.agents/skills/verify-flow/` | AC-12 đến AC-14 |

## Edit boundaries

- May edit: các đường dẫn trong "Build order", đúng bước của chúng.
- Leave unchanged without approval: `apps/mobile/`, `packages/client/`, `apps/api/src/modules/bookings/`, `apps/api/src/modules/finance/`, các migration đã có, `DESIGN.md`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Concurrency: hai lệnh duyệt cùng lúc vào suất cuối | Bước 2, `matches.service.ts` | Khóa dòng `Match` trước khi đếm và thêm người, cùng thứ tự khóa với `join` và `leave` (rubric AG-*). Test AC-7. Review ở phiên mới với model mạnh nhất và skill `rule-review` |
| Schema: thêm giá trị enum và cột có mặc định | Bước 1 | Chỉ expand. Test migrate trên cơ sở dữ liệu có trận cũ. Review ở phiên mới |
| Dữ liệu cá nhân: host thấy số điện thoại của người xin | Bước 2, `GET .../requests` | BR-20. Test AC-4 kiểm 403 cho người khác. Review ở phiên mới |
| Hồi quy: luồng "Vào ngay" của V1 | Bước 2 | AC-2 và các test hiện có của UC-8 |

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Host có đổi được chế độ vào trận sau khi mở trận không? Mặc định: không (BR-33) | Bạn | none |
| Trận "Host duyệt" có tự duyệt người đã đá cùng host trước đó không? Mặc định: không | Bạn | none |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
