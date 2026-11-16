---
style: ste80
lang: vi
---

# F-037: Mã truy cập cá nhân (PAT) cho MCP

Status: draft
Source: `docs/requirements/intake-monsport-v2.md` (mục W7, UC-20, BR-32, BR-58, BR-59). ADR 0008. `docs/design/ke-hoach-mcp.md` (bước 3, mục "Hai cách nối"). Brief F-036 (lớp công cụ). Người dùng ngày 17/11/2026: "Làm bước 3 PAT".

## Goal

Người dùng tạo một mã truy cập cá nhân ở trang "Hồ sơ" và dán nó vào AI client. Sau đó AI gọi 9 công cụ MCP của F-036 qua `POST /api/mcp` bằng tài khoản của người dùng đó. Kiểm tra bằng test API: một yêu cầu `tools/call` với header `Authorization: Bearer <mã>` tạo booking "Chờ xác nhận" cho đúng người dùng.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| OAuth 2.1, metadata OAuth, màn "Cho phép", connector của Claude trên web | Bước 4 của kế hoạch. Cần brief riêng và `rule-review` | Brief bước 4 |
| Lệnh stdio (cầu nối cục bộ) | Client cho nhà phát triển (Claude Code) nối thẳng tới HTTP với header `Authorization`. Một gói stdio thêm mã để bảo trì mà không thêm khả năng. `HUMAN_DECISIONS.md`, dòng 70 | Khi một client cần nó |
| Mã truy cập trên app mobile | App chưa có trang "Hồ sơ" cho việc này. Brief F-033 chỉ đổi web | Khi bạn cần |
| Công cụ cho chủ sân, nhân viên, admin | `HUMAN_DECISIONS.md`, dòng 27. Mặc định: không | Khi bạn cần |
| Phiên MCP (`MCP-Session-Id`), SSE, `GET /api/mcp` | Chế độ không phiên hợp với Cloud Run (brief F-036, mục "Research") | Không có kế hoạch |
| Sửa tên hoặc gia hạn một mã | Thu hồi rồi tạo mã mới là đủ | Không có kế hoạch |
| Deploy và thử trên bản live bằng tài khoản thật | Bước 5. Người dùng chạy | Bước 5 |

## Research

Kiểm ngày 17/11/2026. Các điểm về đặc tả và SDK của brief F-036 vẫn đúng.

| Điểm | Kết quả | Nguồn |
|---|---|---|
| Nối Claude Code bằng HTTP và header | `claude mcp add --transport http <tên> <url> --header "Authorization: Bearer <mã>"` | https://code.claude.com/docs/en/mcp |
| Transport HTTP không phiên | `NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })` của `@modelcontextprotocol/node` 2.1.2. Một server và một transport cho mỗi request | Brief F-036, mục "Research", và README của gói |
| Kiểm `Origin` | Đặc tả bắt server kiểm `Origin` để chặn DNS rebinding. Client MCP không phải trình duyệt nên không gửi `Origin`. Web của MONSPORT không gọi `/api/mcp` | https://modelcontextprotocol.io/specification/2025-11-25/basic/transports |
| Trả lời khi thiếu xác thực | 401 với header `WWW-Authenticate: Bearer` | RFC 6750, mục 3 |
| Băm mã | Mã có 256 bit ngẫu nhiên, nên SHA-256 một lần là đủ. Không cần argon2: không ai đoán được mã theo từ điển | RFC 6750, mục 5.2 (mã đủ ngẫu nhiên), và cách GitHub lưu PAT |

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

Các test API dùng cơ sở dữ liệu thật, đồng hồ giả (`Clock`) và `supertest`, như các test e2e hiện có. "Mã" là chuỗi bí mật trả về lúc tạo. Giờ giả mặc định: 2026-12-01T03:00:00Z.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | `packages/shared/src/access-token.ts` | Test parse các schema | `CreateAccessTokenRequest` nhận `{ name: "Claude Code", scope: "BOOK", expiresInDays: 30 }`. Nó từ chối `expiresInDays` 365, `name` rỗng sau khi bỏ khoảng trắng, `name` dài 51 ký tự, `scope` "ADMIN" và khóa thừa `userId`. `AccessTokenView` có đúng các khóa `id`, `name`, `scope`, `prefix`, `createdAt`, `expiresAt`, `lastUsedAt`. `ACCESS_TOKEN_PREFIX` là "mst_" |
| AC-2 | Người dùng A (vai trò USER) đã đăng nhập | `POST /api/me/access-tokens` với `{ name: "Claude Code", scope: "BOOK", expiresInDays: 30 }` | 201. `secret` khớp `^mst_[A-Za-z0-9_-]{43}$`. `token.createdAt` là 2026-12-01T03:00:00.000Z và `token.expiresAt` là 2026-12-31T03:00:00.000Z. `token.prefix` bằng 12 ký tự đầu của `secret`. Dòng `AccessToken` có `tokenHash` bằng SHA-256 (hex) của `secret`. Không cột nào chứa `secret`. `GET /api/me/access-tokens` trả mã đó mà không có `secret` hay `tokenHash` |
| AC-3 | A có 5 mã còn hiệu lực, 1 mã đã thu hồi, 1 mã đã hết hạn và 1 mã tạo trước lúc admin mở khóa A | A tạo mã thứ 6 | 409 "Bạn đã có 5 mã. Thu hồi một mã trước". Không dòng mới. `GET` trả đúng 5 mã còn hiệu lực. Với 4 mã còn hiệu lực, hai `POST` cùng lúc trả đúng một 201 và một 409, và A có đúng 5 mã còn hiệu lực. Chủ sân, nhân viên và admin gọi `POST /api/me/access-tokens` nhận 403 "Bạn không có quyền làm việc này". Không có cookie nhận 401 |
| AC-4 | A có mã M1. B có mã M2 | A gọi `DELETE /api/me/access-tokens/<id của M1>`, rồi `DELETE` với id của M2 | Lần đầu: 204, M1 có `revokedAt`, `GET` không còn trả M1, và `POST /api/mcp` bằng M1 trả 401. Lần hai: 404 "Không tìm thấy mã". M2 vẫn dùng được |
| AC-5 | A có mã BOOK còn hiệu lực. Sân như AC-6 của F-036 | `POST /api/mcp` với `Authorization: Bearer <mã>`: `initialize`, `tools/list`, rồi `tools/call` `request_booking` cho 2026-12-10 18:00 đến 19:30 | `tools/list` trả 9 công cụ. `request_booking` tạo một booking `PENDING` của A, nguồn `APP`. `lastUsedAt` của mã bằng giờ giả. Log của server trong test không chứa "mst_" |
| AC-6 | Như AC-5 | Gửi `POST /api/mcp` sáu lần: (1) không có header. (2) "Bearer mst_sai". (3) Mã của A sau `expiresAt`. (4) Mã của người dùng bị khóa. (5) Mã của người dùng đã xóa. (6) Chỉ cookie phiên hợp lệ của A | Mỗi lần: 401, header `WWW-Authenticate: Bearer`, thân `{ "message": "Mã truy cập không hợp lệ" }`. Không service nào của công cụ được gọi |
| AC-7 | A tạo mã lúc 03:00 | Admin khóa A rồi mở khóa A lúc 04:00 (BR-32). A tạo mã mới lúc 05:00 | Mã cũ trả 401. Mã mới chạy |
| AC-8 | A có mã READ | `tools/list`, rồi `tools/call` `request_booking` | `tools/list` trả đúng 4 công cụ đọc. `request_booking` trả lỗi "công cụ không tồn tại" như AC-3 của F-036. `BookingsService.request` không được gọi |
| AC-9 | Hai `INestApplication` chạy trên cùng cơ sở dữ liệu. A có mã BOOK | A gọi 6 công cụ ghi qua app 1 rồi 5 công cụ ghi qua app 2 trong cùng phút | Lệnh ghi thứ 11 trả "Quá nhiều lệnh. Thử lại sau" và service không được gọi (BR-58). Sau khi giờ giả tăng 61 giây, A gọi lại được. Lệnh thứ 61 (đọc) trong một phút cũng bị từ chối. Bảng `AuthThrottle` không có khóa nào chứa id của A ở dạng đọc được |
| AC-10 | A có mã BOOK | `POST /api/mcp` có header `Origin: https://la.example` | 403. Không service nào được gọi |
| AC-11 | A có mã BOOK | `GET /api/mcp`, `DELETE /api/mcp` | 405, header `Allow: POST` |
| AC-12 | A dùng mã lúc 03:00:00 | A dùng mã lại lúc 03:00:30 và lúc 03:01:05 | `lastUsedAt` là 03:00:00 sau lần thứ hai và 03:01:05 sau lần thứ ba: mã ghi tối đa một lần mỗi 60 giây |
| AC-13 | Trang "Hồ sơ" (`/ho-so`) của A, API giả trả 1 mã "Claude Code" (BOOK, hạn 31/12/2026, chưa dùng) | A mở trang | Mục "Kết nối AI" liệt kê mã: tên, "Đặt sân", "mst_abcd1234…", "Hết hạn 31/12/2026", "Chưa dùng". Nút "Thu hồi" hỏi lại, rồi gọi `DELETE` và bỏ dòng. Thẻ "Sắp ra mắt" hiện có giữ nguyên |
| AC-14 | Như AC-13 | A điền "Máy tính", chọn "Chỉ xem" và "90 ngày", rồi bấm "Tạo mã" | Trang gửi `{ name: "Máy tính", scope: "READ", expiresInDays: 90 }`. Trang hiện mã một lần, câu "Mã chỉ hiện một lần. Lưu nó ngay", nút "Chép", và lệnh `claude mcp add --transport http monsport <origin>/api/mcp --header "Authorization: Bearer <mã>"`. Sau khi bấm "Xong" hoặc tải lại trang, mã không còn hiện. API trả 409 thì trang hiện đúng thông báo của API |

## Contract

`packages/shared/src/access-token.ts`, xuất qua `packages/shared/src/index.ts`:

```ts
export const ACCESS_TOKEN_PREFIX = 'mst_';
export const MAX_ACTIVE_ACCESS_TOKENS = 5;
export const AccessTokenScope = z.enum(['READ', 'BOOK']);   // READ: 4 công cụ đọc. BOOK: cả 9 công cụ
export const CreateAccessTokenRequest = z.object({
  name: z.string().trim().min(1).max(50),
  scope: AccessTokenScope,
  expiresInDays: z.union([z.literal(30), z.literal(90)]),
}).strict();
export const AccessTokenView = z.object({
  id: z.uuid(), name: z.string(), scope: AccessTokenScope, prefix: z.string(),
  createdAt: z.iso.datetime(), expiresAt: z.iso.datetime(), lastUsedAt: z.iso.datetime().nullable(),
});
export const CreateAccessTokenResponse = z.object({ token: AccessTokenView, secret: z.string() });
export const AccessTokenList = z.object({ tokens: z.array(AccessTokenView) });
```

Một luật cho "còn hiệu lực", dùng cho danh sách, cho việc đếm 5 mã và cho `authenticate`. Mã còn hiệu lực khi đủ ba điều kiện:

- `revokedAt` rỗng.
- `expiresAt` sau `clock.now()`.
- `User.sessionsValidFrom` rỗng, hoặc `createdAt` không trước `User.sessionsValidFrom` (BR-32).

`packages/shared/src/mcp.ts`: thêm `MCP_READ_TOOLS` (4 tên còn lại ngoài `MCP_WRITE_TOOLS`).

Đường API, mọi đường dưới tiền tố `/api`:

| Method | Path | Ai | Trả |
|---|---|---|---|
| GET | `/me/access-tokens` | USER, cookie phiên | 200 `AccessTokenList`: mã còn hiệu lực, mới nhất trước |
| POST | `/me/access-tokens` | USER, cookie phiên | 201 `CreateAccessTokenResponse`. 409 khi đã có 5 mã còn hiệu lực |
| DELETE | `/me/access-tokens/:id` | USER, cookie phiên | 204. 404 "Không tìm thấy mã" khi mã không thuộc người gọi, không có, hoặc đã thu hồi |
| POST | `/mcp` | Header `Authorization: Bearer <mã>`. Cookie không được tính | Thân JSON-RPC của MCP. 401, 403 (`Origin`), hoặc kết quả của transport |
| GET, DELETE | `/mcp` | Bất kỳ | 405, `Allow: POST` |

`apps/api/src/modules/access-tokens/` (mới):

```ts
@Injectable()
export class AccessTokensService {
  list(userId: string): Promise<AccessTokenView[]>;
  create(userId: string, input: CreateAccessTokenRequest): Promise<CreateAccessTokenResponse>;
  revoke(userId: string, id: string): Promise<void>;
  // Trả McpContext khi mã hợp lệ, null khi không. Không bao giờ ném lỗi chứa mã.
  authenticate(secret: string): Promise<McpContext | null>;
}
```

- `create` sinh `randomBytes(32)`, mã là `mst_` + base64url. Nó lấy `now = clock.now()` một lần. Nó ghi `createdAt: now` và `expiresAt` bằng `now` cộng số ngày. Không dùng `now()` của cơ sở dữ liệu.
- `create` đếm mã còn hiệu lực và chèn dòng mới trong một transaction, sau `SELECT ... FOR NO KEY UPDATE` trên dòng `User` của người gọi. Hai lời gọi cùng lúc không tạo được mã thứ 6.
- Response 201 có header `Cache-Control: no-store`.
- `authenticate` tìm theo `tokenHash` và so sánh với `clock.now()`. Nó trả null khi mã không còn hiệu lực, hoặc khi người dùng bị khóa hoặc đã xóa. Nó cập nhật `lastUsedAt` khi giá trị cũ rỗng hoặc cũ hơn 60 giây.
- `McpContext` thêm `scope: AccessTokenScope`. `McpService.createServer` chỉ đăng ký công cụ đọc khi `scope` là READ.
- `McpController` (`apps/api/src/modules/mcp/mcp.controller.ts`) chỉ có `POST /mcp`. Nó từ chối mọi request có header `Origin` với 403 trước khi đọc mã. Nó tạo một server và một transport không phiên cho mỗi request, rồi đóng cả hai khi response kết thúc.
- Bộ đọc JSON của Nest đã đọc thân request. Controller truyền `req.body` vào `transport.handleRequest(req, res, req.body)`.
- Client gửi `Accept: application/json, text/event-stream`, nếu không SDK trả 406. Các test `supertest` của AC-5 đến AC-12 đặt header này.
- BR-58 chuyển sang `ThrottleService`: hai bộ đếm mới `mcp-call` (60 trong 60 giây) và `mcp-write` (10 trong 60 giây), theo `userId`. Mỗi lệnh đếm `mcp-call`. Lệnh ghi đếm thêm `mcp-write`. Lệnh bị từ chối vẫn được đếm. Xóa `apps/api/src/modules/mcp/rate-limiter.ts`.
- Không ghi header `Authorization` hay mã vào log, kể cả khi lỗi. Lỗi khác trả "Có lỗi xảy ra. Thử lại sau", như F-036.

`packages/client/src/access-tokens.ts` (mới): `listAccessTokens`, `createAccessToken`, `revokeAccessToken`, theo mẫu của các file khác trong `packages/client/src/`.

## Data

Bảng mới `AccessToken`. Tên theo `docs/requirements/data-dictionary.md` (bước 2 thêm mục này):

```prisma
enum AccessTokenScope {
  READ
  BOOK
}

/// Brief F-037: a personal access token for MCP. Only the SHA-256 hash is stored.
model AccessToken {
  id         String           @id @default(uuid(7)) @db.Uuid
  userId     String           @db.Uuid
  name       String           @db.VarChar(50)
  scope      AccessTokenScope
  /// The first 12 characters of the token, for display ("mst_" and 8 more).
  prefix     String           @db.VarChar(12)
  /// SHA-256 of the whole token, lowercase hex.
  tokenHash  String           @unique @db.Char(64)
  expiresAt  DateTime         @db.Timestamptz(3)
  lastUsedAt DateTime?        @db.Timestamptz(3)
  revokedAt  DateTime?        @db.Timestamptz(3)
  createdAt  DateTime         @default(now()) @db.Timestamptz(3)
  user       User             @relation(fields: [userId], references: [id])

  @@index([userId])
}
```

`User` thêm `accessTokens AccessToken[]`. Một migration mới, chỉ thêm bảng và enum. Không đổi bảng có sẵn.

BR-59 (thêm vào `docs/requirements/business-rules.md` trong PR của brief này): người dùng có tối đa 5 mã truy cập còn hiệu lực. Mã có hạn 30 hoặc 90 ngày, chỉ hiện một lần, và chỉ được lưu dạng băm. Người dùng thu hồi được từng mã. Mã tạo trước `User.sessionsValidFrom` không còn hiệu lực (BR-32).

## Lock order

`create`: `User` (FOR NO KEY UPDATE, dòng của người gọi) rồi chèn `AccessToken`. Khóa này không chặn khóa ngoại của booking mới. Không đường nào khác khóa `User` rồi khóa `Venue` hoặc `Court`. Admin khóa hoặc mở khóa chỉ cập nhật `User`, nên không có vòng khóa. Công cụ vẫn khóa như F-036: `Venue` (FOR SHARE) rồi `Court` (FOR UPDATE). `authenticate` chạy trước công cụ. Lệnh UPDATE `lastUsedAt` giữ khóa dòng `AccessToken` trong lúc ngắn, ngoài transaction của công cụ.

## Build order

One pull request for each row. Each pull request passes the check command on its own.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Contract | `packages/shared/src/access-token.ts`, `packages/shared/src/access-token.test.ts`, `packages/shared/src/mcp.ts`, `packages/shared/src/mcp.test.ts`, `packages/shared/src/index.ts`, `packages/client/src/access-tokens.ts`, `packages/client/src/index.ts`, `PROGRESS.md`, `@map.md` | AC-1 |
| 2 | Bảng và đường quản lý mã | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<mới>/`, `apps/api/src/modules/access-tokens/`, `apps/api/src/app.module.ts`, `docs/requirements/data-dictionary.md`, `PROGRESS.md`, `@map.md` | AC-2, AC-3, AC-4 (phần quản lý), AC-7 (phần `authenticate`, test service) |
| 3 | Đường `/api/mcp` | `apps/api/src/modules/mcp/`, `apps/api/src/modules/access-tokens/`, `apps/api/src/modules/auth/throttle.service.ts`, `apps/api/src/modules/auth/auth.module.ts`, `apps/api/package.json`, `pnpm-lock.yaml`, `.dependency-cruiser.cjs`, `docs/requirements/data-dictionary.md`, `docs/requirements/business-rules.md`, `PROGRESS.md`, `@map.md` | AC-4 (phần 401), AC-5 đến AC-12 |
| 4 | Mục "Kết nối AI" và hướng dẫn | `apps/web/src/features/access-tokens/`, `apps/web/src/app/pages.tsx`, `docs/huong-dan/noi-ai-voi-monsport.md`, `PROGRESS.md`, `COMPLETED.md`, `@map.md` | AC-13, AC-14 |

Lưu ý:

- Bước 2: test `authenticate` gọi service trực tiếp, vì `/api/mcp` có ở bước 3.
- Bước 3: AC-14 của F-036 (`mcp.e2e.test.ts`) nói `McpModule` không có route. Sửa test đó: `POST /api/mcp` không có mã trả 401, và `/mcp` không tiền tố vẫn trả 404. Ghi việc sửa này trong mô tả PR.
- Bước 3: thêm `@modelcontextprotocol/node` đúng `2.1.2` vào `dependencies` của `apps/api`. Không dùng `^`. Reviewer kiểm `pnpm-lock.yaml` chỉ thêm gói này và phụ thuộc của nó.
- `pnpm-lock.yaml` phải có đúng một bản `@modelcontextprotocol/server` (2.4.0). Nếu gói `node` kéo một bản khác, không thêm gói `node`. Dùng `createMcpHandler` của `@modelcontextprotocol/server` 2.4.0 (brief F-036, mục "Research").
- Bước 3: ghi trong `data-dictionary.md` rằng khóa của `AuthThrottle` còn chứa bản băm của `userId` (bộ đếm `mcp-call`, `mcp-write`). Sửa câu "Bước 2 đếm trong bộ nhớ" của `business-rules.md`.
- Bước 3: `pnpm check` phải cho `mcp` import `access-tokens` và `auth`. Nếu luật import chặn, thêm luật trong cùng PR và nói rõ trong mô tả PR.
- Bước 4: dùng lớp và thành phần có sẵn của trang "Hồ sơ" (mẫu `docs/design/web-ui-v3/`, `docs/design/web-responsive.md`). Kiểm ở 390px và 1280px bằng skill `verify-flow` trước khi mở PR.
- Bước 4: hướng dẫn tiếng Việt nêu cách tạo mã, lệnh `claude mcp add` và cách thu hồi mã.
- Hướng dẫn có câu: "Ai có mã này thì đặt sân được bằng tài khoản của bạn. Không gửi mã cho người khác".

## Edit boundaries

- May edit: các đường dẫn trong "Build order", đúng bước của chúng.
- Leave unchanged without approval: các migration đã có, các bảng có sẵn trong `schema.prisma` (trừ quan hệ `accessTokens` trên `User`), `apps/api/src/modules/bookings/`, `apps/api/src/modules/matches/`, `apps/api/src/modules/venues/`, `apps/api/src/modules/auth/` trừ `throttle.service.ts` và `auth.module.ts`, `apps/api/src/modules/finance/`, `apps/mobile/`, `DESIGN.md`, `REVIEW.md`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Lộ mã: lưu, log, trả lại | Bước 2, 3 | Chỉ lưu SHA-256. `secret` chỉ có trong response 201. AC-2, AC-5 (log). Review bằng model mạnh nhất và `rule-review` |
| Schema: bảng mới | Bước 2 | Migration chỉ thêm. Reviewer kiểm SQL của migration. Model mạnh nhất và `rule-review` |
| Đồng thời: hai lời gọi tạo mã thứ 6 | Bước 2 | Khóa dòng `User` trong `create`. Một test gọi 2 `POST` cùng lúc khi đã có 4 mã: đúng 5 mã còn hiệu lực (thuộc AC-3) |
| CSRF và DNS rebinding trên `/api/mcp` | Bước 3 | Cookie không được tính. Request có `Origin` bị từ chối. AC-6, AC-10 |
| Mã cũ còn chạy sau khi khóa hoặc mở khóa | Bước 3 | `authenticate` kiểm `lockedAt`, `deletedAt`, `sessionsValidFrom`. AC-6, AC-7 |
| Quá nhiều lệnh qua nhiều instance | Bước 3 | BR-58 trong `AuthThrottle`. AC-9 |
| Dữ liệu cá nhân trong kết quả công cụ | Bước 3 | Không đổi công cụ của F-036. Các AC của F-036 vẫn pass |
| Phụ thuộc mới | Bước 3 | Ghim đúng phiên bản |

## Assumptions

| Assumption | Why |
|---|---|
| Không làm lệnh stdio. Client nối thẳng `/api/mcp` qua HTTP với header | Claude Code hỗ trợ cách này. Ít mã hơn. `HUMAN_DECISIONS.md`, dòng 70 |
| Mở `POST /api/mcp` ở bước này, chỉ cho mã truy cập | Kế hoạch đặt `/mcp` HTTP ở bước 4, nhưng mã cá nhân cần một đường để dùng. OAuth ở bước 4 dùng lại đường này |
| Tối đa 5 mã còn hiệu lực. Hạn 30 hoặc 90 ngày | Đủ cho vài máy và vài client. Mã sống lâu dễ bị quên. `HUMAN_DECISIONS.md`, dòng 69 |
| Hai phạm vi: READ (4 công cụ đọc) và BOOK (9 công cụ) | Kế hoạch nêu `read` và `book`. BOOK gồm mở, vào và rời trận, vì chúng cùng loại "ghi" của BR-58 |
| Mọi request có `Origin` bị từ chối | Client MCP không gửi `Origin`. Web của MONSPORT không gọi `/api/mcp`. Cách này chặn mọi trang web, không cần danh sách origin |
| SHA-256, không argon2 | Mã có 256 bit ngẫu nhiên. Argon2 chỉ làm chậm mỗi lệnh |
| `lastUsedAt` ghi tối đa một lần mỗi 60 giây | Bớt một lần ghi cho mỗi lệnh |
| Chỉ vai trò USER tạo được mã | Chỉ USER có công cụ (dòng 27) |
| Người dùng bị xóa: `authenticate` trả null, dòng mã ở lại | Không xóa dữ liệu. Admin xóa tay khi được yêu cầu (dòng 6) |

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Giới hạn 5 mã, hạn 30 hoặc 90 ngày. Mặc định: như vậy (dòng 69) | Bạn | none |
| Bỏ lệnh stdio, nối bằng HTTP và header. Mặc định: bỏ (dòng 70) | Bạn | none |
| Giới hạn BR-58: 60 lệnh và 10 lệnh ghi mỗi phút | Bạn | none |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete, with `rule-review` on steps 2 and 3.
- `docs/huong-dan/noi-ai-voi-monsport.md` exists.
- `PROGRESS.md` names the owner step: tạo mã trên bản live và nối Claude Code bằng tài khoản thật.
