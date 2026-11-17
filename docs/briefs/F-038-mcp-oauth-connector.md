---
style: ste80
lang: vi
---

# F-038: OAuth cho MCP (connector của Claude)

Status: draft
Source: `docs/requirements/intake-monsport-v2.md` (mục W7, UC-20, BR-29, BR-32, BR-58). ADR 0008 (cách B). `docs/design/ke-hoach-mcp.md` (bước 4, mục "Hai cách nối", "Rủi ro"). Brief F-036 (lớp công cụ), brief F-037 (PAT, `POST /api/mcp`). Người dùng ngày 17/11/2026: "Viết brief OAuth".

## Goal

Người dùng Claude dán địa chỉ `https://<máy chủ>/api/mcp` vào mục "Add custom connector", đăng nhập MONSPORT và bấm "Cho phép". Sau đó Claude gọi 9 công cụ MCP của F-036 bằng tài khoản của người dùng đó, không cần tạo hay dán mã. Kiểm tra bằng test API: một luồng cấp phép đủ bước (metadata, `authorize`, "Cho phép", `token`, `tools/call`) tạo booking "Chờ xác nhận" cho đúng người dùng.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Đăng ký client động (DCR, RFC 7591), `POST /oauth/register` | Claude dùng CIMD khi máy chủ hỗ trợ. DCR tạo một client mới cho mỗi lần nối, nên bảng client lớn không giới hạn. Một điểm cuối ghi công khai cũng là bề mặt tấn công | Khi một client cần nối không hỗ trợ CIMD |
| Client có bí mật (`client_secret`, `private_key_jwt`) | Claude là public client với PKCE | Không có kế hoạch |
| Redirect về `localhost` cho Claude Code | Claude Code đã có PAT (F-037) | Khi bạn cần |
| OpenID Connect (`id_token`, `/userinfo`) | MCP chỉ cần access token | Không có kế hoạch |
| Đăng nhập bằng Google trên màn "Cho phép" bằng một luồng riêng | Màn dùng phiên đăng nhập web hiện có. Người dùng Google đăng nhập web như thường rồi quay lại | Không có kế hoạch |
| Đưa MONSPORT vào danh mục connector của Anthropic | Cần nộp hồ sơ, logo, chính sách riêng tư | Khi bạn cần |
| Công cụ cho chủ sân, nhân viên, admin | `HUMAN_DECISIONS.md`, dòng 27 | Khi bạn cần |
| App mobile | Brief F-033 chỉ đổi web. Màn "Cho phép" mở trong trình duyệt | Khi bạn cần |
| Deploy và thử trên bản live bằng tài khoản thật | Bước 5 của kế hoạch. Người dùng chạy | Bước 5 |

## Research

Kiểm ngày 17/11/2026.

| Điểm | Kết quả | Nguồn |
|---|---|---|
| Phiên bản đặc tả | MCP 2025-11-25, mục "Authorization" | https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization |
| Metadata của tài nguyên | Máy chủ MCP phải có Protected Resource Metadata (RFC 9728) với `authorization_servers`. Phải trả URL metadata trong `WWW-Authenticate` (tham số `resource_metadata`) hoặc ở đường well-known. Nên thêm `scope` vào `WWW-Authenticate` | Đặc tả MCP, mục "Protected Resource Metadata Discovery Requirements". RFC 9728, mục 3 và 5.1 |
| Metadata của máy chủ cấp phép | Client thử `/.well-known/oauth-authorization-server` trước, rồi `/.well-known/openid-configuration`, khi issuer không có đường dẫn | Đặc tả MCP, mục "Authorization Server Metadata Discovery". RFC 8414 |
| Đăng ký client | Máy chủ và client nên hỗ trợ Client ID Metadata Document (CIMD). DCR là tùy chọn. Claude dùng CIMD khi metadata có `client_id_metadata_document_supported: true` và `none` trong `token_endpoint_auth_methods_supported` | Đặc tả MCP, mục "Client Registration Approaches". https://claude.com/docs/connectors/building/authentication |
| PKCE | Bắt buộc `S256`. Metadata phải có `code_challenge_methods_supported`, nếu không client dừng | Đặc tả MCP, mục "Authorization Code Protection". OAuth 2.1, mục 4.1.1 |
| `resource` (RFC 8707) | Client gửi `resource` ở cả `authorize` và `token`. Máy chủ MCP chỉ nhận token cấp cho chính nó. Không chuyển tiếp token | Đặc tả MCP, mục "Token Audience Binding and Validation", "Token Handling". RFC 8707 |
| Redirect URI | Chỉ `https` hoặc `localhost`. Máy chủ cấp phép so khớp chính xác với giá trị đã đăng ký. Với Claude trên web, desktop, mobile: `https://claude.ai/api/mcp/auth_callback` | Đặc tả MCP, mục "Open Redirection". Tài liệu connector của Claude |
| Refresh token | Public client: phải xoay vòng refresh token. Claude làm mới khi nhận 401 và trước khi hết hạn 5 phút. Token hỏng trả `invalid_grant`. Claude thêm `offline_access` khi `scopes_supported` của metadata máy chủ cấp phép có nó | Đặc tả MCP, mục "Token Theft". OAuth 2.1, mục 4.3.1. Tài liệu connector của Claude |
| Điểm cuối `token` | Phải nhận `application/x-www-form-urlencoded`. Claude chờ discovery và `token` 10 giây, refresh 30 giây | RFC 6749, mục 4.1.3. Tài liệu connector của Claude |
| `resource` khớp URL | Trường `resource` trong Protected Resource Metadata phải bằng URL người dùng nhập, kể cả đường dẫn | Tài liệu connector của Claude |
| Claude chỉ dùng máy chủ cấp phép đầu tiên | Claude đọc mục đầu của `authorization_servers` | Tài liệu connector của Claude |
| SDK | `@modelcontextprotocol/server` 2.4.0 chỉ xuất kiểu (`OAuthMetadata`, `OAuthProtectedResourceMetadata`, `OAuthTokens`), không có router cấp phép. Các điểm cuối viết bằng NestJS | `node_modules/@modelcontextprotocol/server/dist/index.d.mts` |
| Cookie phiên | `SameSite=Lax`. Một lần chuyển trang cấp cao nhất từ `claude.ai` vẫn mang cookie, nên màn "Cho phép" biết người dùng đã đăng nhập | `apps/api/src/modules/auth/session.ts:147` |

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

Các test API dùng cơ sở dữ liệu thật, đồng hồ giả (`Clock`), `supertest`, và một `fetch` giả cho tài liệu CIMD. `ORIGIN` là `https://monsport.test`. `CLIENT` là `https://claude.ai/oauth/mcp-oauth-client-metadata`. Tài liệu CIMD giả có `client_id` = `CLIENT`, `client_name` = "Claude", `redirect_uris` = [`https://claude.ai/api/mcp/auth_callback`], `token_endpoint_auth_method` = "none". `VERIFIER` là 43 ký tự, `CHALLENGE` là base64url của SHA-256 của nó. Giờ giả mặc định: 2026-12-01T03:00:00Z.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | `packages/shared/src/oauth.ts` | Test parse các schema | `OAuthScope` nhận "read", "book", "offline_access" và từ chối "admin". `parseScope("book offline_access")` trả `{ access: "BOOK", offline: true }`. `parseScope("")` trả `{ access: "READ", offline: false }`. `OAuthConnectionView` có đúng các khóa `id`, `clientName`, `scope`, `createdAt`, `lastUsedAt`. `OAuthConsentView` có đúng các khóa `clientName`, `clientHost`, `scopes`, `dataRead`. `OAUTH_ACCESS_TOKEN_PREFIX` là "mot_", `OAUTH_REFRESH_TOKEN_PREFIX` là "mor_" |
| AC-2 | Máy chủ đang chạy | `GET /.well-known/oauth-protected-resource/api/mcp` và `GET /.well-known/oauth-authorization-server` | Lần 1: 200, `resource` = `ORIGIN/api/mcp`, `authorization_servers` = [`ORIGIN`], `scopes_supported` = ["read", "book", "offline_access"], `bearer_methods_supported` = ["header"]. Lần 2: 200, `issuer` = `ORIGIN`, `authorization_endpoint` = `ORIGIN/api/oauth/authorize`, `token_endpoint` = `ORIGIN/api/oauth/token`, `response_types_supported` = ["code"], `grant_types_supported` = ["authorization_code", "refresh_token"], `code_challenge_methods_supported` = ["S256"], `token_endpoint_auth_methods_supported` = ["none"], `client_id_metadata_document_supported` = true, `scopes_supported` = ["read", "book", "offline_access"], `authorization_response_iss_parameter_supported` = true. Không có `registration_endpoint`. `GET /.well-known/openid-configuration` trả 404 |
| AC-3 | Như AC-2 | `POST /api/mcp` không có header `Authorization` | 401, `WWW-Authenticate` = `Bearer resource_metadata="ORIGIN/.well-known/oauth-protected-resource/api/mcp", scope="read book"`, thân `{ "message": "Mã truy cập không hợp lệ" }`. AC-6 của F-037 vẫn pass (chỉ đổi header thành kiểm tiền tố `Bearer`) |
| AC-4 | `fetch` giả trả tài liệu CIMD | `GET /api/oauth/authorize` với `response_type=code`, `client_id=CLIENT`, `redirect_uri=https://claude.ai/api/mcp/auth_callback`, `code_challenge=CHALLENGE`, `code_challenge_method=S256`, `state=xyz`, `scope=read book offline_access`, `resource=ORIGIN/api/mcp` | 302 tới `ORIGIN/ket-noi-ai/cho-phep?yeu-cau=<id>`. Một dòng `OAuthRequest` có `clientId`, `clientName` "Claude", `redirectUri`, `codeChallenge`, `scope`, `state`, `expiresAt` = giờ giả + 10 phút, `userId` rỗng. `fetch` được gọi đúng một lần với `CLIENT`, `redirect: "error"` |
| AC-5 | Như AC-4 | `authorize` với từng lỗi: (1) `client_id` là `https://la.example/x`. (2) `client_id` là `http://claude.ai/x`. (3) `fetch` trả tài liệu có `client_id` khác URL. (4) `fetch` quá 5 giây hoặc trả hơn 10 KB. (5) `redirect_uri` không có trong tài liệu. (6) `code_challenge_method=plain`. (7) `resource` là `https://la.example/api/mcp`. (8) `response_type=token`. (9) `client_id` xuất hiện hai lần trong query | (1) đến (5) và (9): 400 với trang lỗi "Ứng dụng này không nối được với MONSPORT", không chuyển hướng tới `redirect_uri`. `fetch` không được gọi ở (1), (2) và (9). (6) đến (8): 302 tới `redirect_uri` với `state=xyz`, `iss=ORIGIN` và `error` lần lượt là `invalid_request`, `invalid_target`, `unsupported_response_type`. Không dòng `OAuthRequest` nào được tạo |
| AC-6 | Có `OAuthRequest` của AC-4. A (USER) đã đăng nhập | `GET /api/oauth/requests/<id>` rồi `POST /api/oauth/requests/<id>/approve` với `{ "scopes": ["read", "book"] }` | `GET`: 200 `OAuthConsentView` với `clientName` "Claude", `clientHost` "claude.ai", `scopes` ["read", "book"], `dataRead` là 4 dòng của mục "Contract". `POST`: 200 `{ "redirectTo": "https://claude.ai/api/mcp/auth_callback?code=<mã>&state=xyz&iss=ORIGIN" }`. `<mã>` có 43 ký tự base64url. Dòng `OAuthRequest` có `userId` của A, `grantedScope` "read book offline_access", `codeHash` là SHA-256 của mã, `codeExpiresAt` = giờ giả + 60 giây |
| AC-7 | Như AC-6 | (1) A gửi `POST .../deny`. (2) A duyệt khi `OAuthRequest` đã quá 10 phút. (3) Không có cookie. (4) Chủ sân, nhân viên hoặc admin duyệt. (5) A duyệt cùng yêu cầu lần hai. (6) Request có header `Origin: https://la.example` | (1) 200 `{ redirectTo }` với `error=access_denied&state=xyz`. (2) 410 "Yêu cầu đã hết hạn. Nối lại từ Claude". (3) 401. (4) 403 "Bạn không có quyền làm việc này". (5) 409 "Yêu cầu đã được xử lý". (6) 403. Không mã nào được cấp ở (2) đến (6) |
| AC-8 | Mã của AC-6 | `POST /api/oauth/token` dạng `application/x-www-form-urlencoded` với `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id=CLIENT`, `code_verifier=VERIFIER`, `resource=ORIGIN/api/mcp` | 200, `Cache-Control: no-store`, thân `{ access_token: "mot_…", token_type: "Bearer", expires_in: 3600, refresh_token: "mor_…", scope: "read book offline_access" }`. Một dòng `OAuthConnection` có `userId` của A, `clientId`, `clientName` "Claude", `scope` "BOOK", `accessTokenHash` và `refreshTokenHash` là SHA-256 của hai token. Không cột nào chứa token. `OAuthRequest` có `codeUsedAt`. Một luồng khác có `scope=read book` (không `offline_access`): response không có `refresh_token`, và `refreshTokenHash` rỗng |
| AC-9 | Như AC-8 | `token` với từng lỗi: (1) sai `code_verifier`. (2) mã dùng lần hai. (3) mã quá 60 giây. (4) `redirect_uri` khác. (5) `client_id` khác. (6) `resource` khác. (7) thân JSON thay vì form. (8) `code` xuất hiện hai lần trong form | (1) đến (6): 400 `{ "error": "invalid_grant" }`. (7) và (8): 400 `{ "error": "invalid_request" }`. Ở (2), kết nối đã cấp từ mã đó vẫn dùng được. Hai lần gửi cùng mã cùng lúc trả đúng một 200 và một `invalid_grant`. Token của lần 200 vẫn gọi được `/api/mcp` |
| AC-10 | Kết nối của AC-8 | `POST /api/mcp` với `Authorization: Bearer <access_token>`: `tools/list`, rồi `tools/call` `request_booking` 2026-12-10 18:00 đến 19:30 | `tools/list` trả 9 công cụ. Booking `PENDING` của A, nguồn `APP`. `lastUsedAt` của kết nối bằng giờ giả. Log của server không chứa "mot_" hay "mor_". BR-58 đếm chung với PAT của A |
| AC-11 | Kết nối chỉ có "read" | `tools/list` rồi `tools/call` `request_booking` | 4 công cụ đọc. `request_booking` trả lỗi "công cụ không tồn tại". `BookingsService.request` không được gọi |
| AC-12 | Kết nối của AC-8, giờ giả + 59 phút | `token` với `grant_type=refresh_token`, `refresh_token`, `client_id=CLIENT`, `resource` | 200 với access token mới và refresh token mới. Access token cũ trả 401 trên `/api/mcp`. Gửi lại refresh token cũ trong 60 giây sau khi xoay vòng: 400 `invalid_grant`, kết nối vẫn còn (token mới vẫn chạy). Gửi lại refresh token cũ sau 60 giây: 400 `invalid_grant`, và cả kết nối bị thu hồi (token mới cũng trả 401). Refresh token sau 30 ngày không dùng: `invalid_grant`. Sau 90 ngày kể từ lúc cấp, refresh trả `invalid_grant` dù token còn mới |
| AC-13 | Kết nối của AC-8 | (1) Access token sau 3600 giây. (2) Admin khóa rồi mở khóa A (BR-32). (3) A thu hồi kết nối bằng `DELETE /api/me/oauth-connections/<id>`. (4) Một chuỗi `mot_` đúng dạng nhưng không có trong bảng | Mỗi lần: `/api/mcp` trả 401 với `WWW-Authenticate` như AC-3. Ở (2) và (3), refresh cũng trả `invalid_grant` |
| AC-14 | A có 10 kết nối còn hiệu lực | (1) A duyệt một yêu cầu mới. (2) A có 9 kết nối, duyệt R1 rồi R2, rồi Claude đổi cả hai mã. (3) A có 9 kết nối, hai lần duyệt cùng lúc | (1) 409 "Bạn đã có 10 kết nối AI. Thu hồi một kết nối trước". (2) Lần duyệt R2 trả 409, vì R1 đã duyệt mà chưa đổi mã cũng được đếm. Nếu R2 vẫn có mã (dữ liệu dựng tay), lần đổi mã thứ hai trả `invalid_grant`. A có đúng 10 kết nối. (3) Đúng một 200 |
| AC-15 | `GET /api/oauth/authorize` 61 lần và `POST /api/oauth/token` 61 lần từ một IP trong một phút | Lần thứ 61 | 429 "Quá nhiều lệnh. Thử lại sau". `fetch` CIMD không được gọi ở lần bị từ chối. Bảng `AuthThrottle` không có IP đọc được |
| AC-16 | Màn `/ket-noi-ai/cho-phep?yeu-cau=<id>`, API giả trả `OAuthConsentView` của AC-6 | (1) Khách chưa đăng nhập mở màn. (2) A mở màn, bỏ chọn "Đặt sân", bấm "Cho phép". (3) A bấm "Từ chối". (4) API trả 410 | (1) Chuyển tới `/dang-nhap?tiep=%2Fket-noi-ai%2Fcho-phep%3Fyeu-cau%3D<id>`. Sau đăng nhập, quay lại màn này. (2) Màn hiện "Claude (claude.ai) muốn dùng tài khoản MONSPORT của bạn" và danh sách `dataRead`. Ô "Xem sân, giờ trống, trận và booking của bạn" luôn được chọn. Ô "Đặt sân, hủy booking, mở và vào trận" bỏ được. Trang gửi `{ scopes: ["read"] }`, rồi chuyển tới `redirectTo`. (3) Gửi `deny` và chuyển tới `redirectTo`. (4) Hiện đúng thông báo của API, không có nút "Cho phép" |
| AC-17 | `/dang-nhap?tiep=<x>` | Đăng nhập thành công với từng `x`: `/ket-noi-ai/cho-phep?yeu-cau=1`, `https://la.example`, `//la.example`, `/\la.example` | Chỉ giá trị đầu được dùng. Ba giá trị sau đi về trang mặc định của vai trò |
| AC-18 | Mục "Kết nối AI" của `/ho-so`, API giả trả 1 kết nối "Claude" (BOOK, tạo 01/12/2026, dùng lần cuối 02/12/2026) và 1 mã PAT | A mở trang, bấm "Thu hồi" ở kết nối, xác nhận | Mục có hai phần: "Ứng dụng đã nối" (tên, "Đặt sân", "Nối từ 01/12/2026", "Dùng lần cuối 02/12/2026") và "Mã truy cập" (như F-037). "Thu hồi" hỏi lại, gọi `DELETE /api/me/oauth-connections/<id>` và bỏ dòng. Mục hiện "Địa chỉ connector" là trường `resource` đọc từ `/.well-known/oauth-protected-resource/api/mcp`, kèm nút "Chép". Các test AC-13, AC-14 của F-037 vẫn pass |
| AC-19 | A có 1 kết nối còn hiệu lực, 1 đã thu hồi, 1 quá 90 ngày. B có 1 kết nối | `GET /api/me/oauth-connections`, rồi `DELETE` với id của B | `GET`: đúng 1 kết nối của A, các khóa của `OAuthConnectionView`, không có hash. `DELETE`: 404 "Không tìm thấy kết nối". Chủ sân gọi `GET`: 403. Không cookie: 401 |
| AC-20 | Bản build web phục vụ qua `serve-web.ts` | `GET /.well-known/khong-co` và `GET /ket-noi-ai/cho-phep` | Lần 1: 404, không phải `index.html`. Lần 2: 200 `index.html` với `Content-Security-Policy: frame-ancestors 'none'` |

## Contract

`packages/shared/src/oauth.ts`, xuất qua `packages/shared/src/index.ts`:

```ts
export const OAUTH_ACCESS_TOKEN_PREFIX = 'mot_';
export const OAUTH_REFRESH_TOKEN_PREFIX = 'mor_';
export const OAUTH_ACCESS_TTL_SECONDS = 3600;          // 1 giờ
export const OAUTH_REFRESH_IDLE_DAYS = 30;             // refresh token hết hạn sau 30 ngày không dùng
export const OAUTH_CONNECTION_MAX_DAYS = 90;           // một kết nối sống tối đa 90 ngày kể từ lúc cấp, như PAT dài nhất
export const MAX_ACTIVE_OAUTH_CONNECTIONS = 10;
export const OAuthScope = z.enum(['read', 'book', 'offline_access']);
/** "book" cho cả 9 công cụ (BOOK). Không có "book" thì chỉ 4 công cụ đọc (READ). Chuỗi rỗng là "read". */
export function parseScope(scope: string): { access: AccessTokenScope; offline: boolean };
export const OAuthConsentView = z.object({
  clientName: z.string(), clientHost: z.string(),
  scopes: z.array(z.enum(['read', 'book'])), dataRead: z.array(z.string()),
});
export const OAuthDecisionRequest = z.object({ scopes: z.array(z.enum(['read', 'book'])).min(1) }).strict();
export const OAuthDecisionResponse = z.object({ redirectTo: z.url() });
export const OAuthConnectionView = z.object({
  id: z.uuid(), clientName: z.string(), scope: AccessTokenScope,
  createdAt: z.iso.datetime(), lastUsedAt: z.iso.datetime().nullable(),
});
export const OAuthConnectionList = z.object({ connections: z.array(OAuthConnectionView) });
```

`dataRead` (BR-29, câu hỏi 4 của `HUMAN_DECISIONS.md` vẫn mở), đúng 4 dòng:

1. "Tên của bạn"
2. "Booking của bạn: sân, giờ, giá, trạng thái"
3. "Trận bạn mở hoặc đã vào, và phòng chờ ghép trận"
4. "AI không thấy số điện thoại, mật khẩu hay email của bạn"

Một luật cho "kết nối còn hiệu lực", dùng cho danh sách, cho việc đếm 10 kết nối, cho `/api/mcp` và cho refresh. Kết nối còn hiệu lực khi đủ bốn điều kiện:

- `revokedAt` rỗng.
- `createdAt` cộng `OAUTH_CONNECTION_MAX_DAYS` sau `clock.now()`.
- Người dùng không bị khóa, không bị xóa.
- `User.sessionsValidFrom` rỗng, hoặc `createdAt` không trước `User.sessionsValidFrom` (BR-32).

Access token còn dùng được khi kết nối còn hiệu lực và `accessExpiresAt` sau `clock.now()`.

Đường, mọi đường API dưới tiền tố `/api` trừ hai đường well-known:

| Method | Path | Ai | Trả |
|---|---|---|---|
| GET | `/.well-known/oauth-protected-resource/api/mcp` | Bất kỳ | 200 metadata (AC-2). `Cache-Control: public, max-age=3600` |
| GET | `/.well-known/oauth-authorization-server` | Bất kỳ | 200 metadata (AC-2). `Cache-Control: public, max-age=3600` |
| GET | `/oauth/authorize` | Bất kỳ (trình duyệt) | 302 tới màn "Cho phép", 302 tới `redirect_uri` với lỗi, hoặc 400 trang lỗi (AC-4, AC-5) |
| GET | `/oauth/requests/:id` | USER, cookie phiên | 200 `OAuthConsentView`. 404, 410 |
| POST | `/oauth/requests/:id/approve` | USER, cookie phiên, không có `Origin` lạ | 200 `OAuthDecisionResponse`. 403, 404, 409, 410 |
| POST | `/oauth/requests/:id/deny` | USER, cookie phiên, không có `Origin` lạ | 200 `OAuthDecisionResponse` |
| POST | `/oauth/token` | Bất kỳ, thân form | 200 `OAuthTokens` hoặc 400 lỗi OAuth (RFC 6749, mục 5.2) |
| GET | `/me/oauth-connections` | USER, cookie phiên | 200 `OAuthConnectionList`, mới nhất trước |
| DELETE | `/me/oauth-connections/:id` | USER, cookie phiên | 204. 404 "Không tìm thấy kết nối" |
| POST | `/mcp` | `Authorization: Bearer mst_…` (PAT) hoặc `Bearer mot_…` (OAuth) | Như F-037. 401 kèm `WWW-Authenticate` của AC-3 |

"`Origin` lạ": header `Origin` có và khác `PUBLIC_ORIGIN`. Không có header `Origin` thì nhận, như các đường cookie hiện có.

`apps/api/src/modules/oauth/` (mới):

```ts
@Injectable()
export class OAuthService {
  metadata(): { resource: OAuthProtectedResourceMetadata; server: OAuthMetadata };
  // Kiểm client, redirect_uri, PKCE, resource. Lưu OAuthRequest. Trả URL màn "Cho phép" hoặc lỗi (AC-4, AC-5).
  startAuthorization(query: Record<string, string>): Promise<{ redirect: string } | { page: 'client-error' }>;
  consent(userId: string, id: string): Promise<OAuthConsentView>;
  approve(userId: string, id: string, input: OAuthDecisionRequest): Promise<OAuthDecisionResponse>;
  deny(userId: string, id: string): Promise<OAuthDecisionResponse>;
  token(form: Record<string, string>): Promise<OAuthTokens>;   // ném OAuthGrantError → 400 { error }
  // Trả McpContext khi access token hợp lệ, null khi không. Không bao giờ ném lỗi chứa token.
  authenticate(accessToken: string): Promise<McpContext | null>;
  listConnections(userId: string): Promise<OAuthConnectionView[]>;
  revokeConnection(userId: string, id: string): Promise<void>;
}

/** Đọc một Client ID Metadata Document. Chỉ host trong OAUTH_CIMD_HOSTS, chỉ https, không theo chuyển hướng, 5 giây, 10 KB. */
@Injectable()
export class ClientMetadataFetcher {
  fetch(clientId: string): Promise<{ clientId: string; clientName: string; redirectUris: string[] } | null>;
}
```

- `PUBLIC_ORIGIN` (biến môi trường mới, ví dụ `https://monsport-774323404592.asia-southeast1.run.app`) là `issuer` và gốc của mọi URL trong metadata. Thiếu biến này thì `OAuthModule` không mở đường nào ngoài 404, và `/api/mcp` giữ `WWW-Authenticate: Bearer` như F-037.
- `OAUTH_CIMD_HOSTS` (biến môi trường mới, mặc định `claude.ai`): danh sách host được phép làm `client_id`, phân cách bằng dấu phẩy.
- `setupApp` loại hai đường well-known khỏi tiền tố `api`. `serve-web.ts` không trả `index.html` cho `/.well-known/`.
- `authorize` kiểm hai nhóm, theo thứ tự:
  1. Lỗi không chuyển hướng: tham số bắt buộc, `client_id` (host, `https`), tài liệu CIMD (`client_id` khớp, `redirect_uris` có `redirect_uri`, `token_endpoint_auth_method` rỗng hoặc "none").
  2. Lỗi chuyển hướng tới `redirect_uri`: `response_type`, `code_challenge_method`, `code_challenge` (43 ký tự base64url), `resource` (bằng `PUBLIC_ORIGIN/api/mcp`), `scope`.
- `approve` chạy trong một transaction: `SELECT ... FOR UPDATE` trên dòng `OAuthRequest`, rồi `FOR NO KEY UPDATE` trên dòng `User`, đếm kết nối còn hiệu lực, rồi ghi `codeHash`. Mã sinh từ `randomBytes(32)`.
- `token` (mã), trong một transaction: `UPDATE "OAuthRequest" SET "codeUsedAt" = now WHERE id = … AND "codeUsedAt" IS NULL` nguyên tử, rồi `FOR NO KEY UPDATE` trên dòng `User`, đếm kết nối còn hiệu lực, rồi `INSERT`. 0 dòng ở `UPDATE`, hoặc đã đủ 10 kết nối: `invalid_grant`. Mã đã dùng không thu hồi kết nối, vì mã sống 60 giây và gắn PKCE. So PKCE bằng `timingSafeEqual`.
- `approve` đếm kết nối còn hiệu lực cộng các `OAuthRequest` của người đó đã có `codeHash`, chưa có `codeUsedAt`, và `codeExpiresAt` còn hạn.
- `token` (refresh): tìm theo `refreshTokenHash`. Xoay vòng trong một `UPDATE ... WHERE "refreshTokenHash" = <cũ>` nguyên tử, ghi `refreshRotatedAt`. Không thấy, nhưng khớp `previousRefreshTokenHash`: trong 60 giây sau `refreshRotatedAt` thì chỉ trả `invalid_grant` (lần refresh song song hoặc thử lại). Sau 60 giây thì thu hồi cả kết nối (phát hiện dùng lại).
- Mọi tham số của query và form phải là đúng một chuỗi. Mảng hoặc object (`a[]=1`, `a[b]=1`, tham số lặp) là `invalid_request`, hoặc trang lỗi 400 ở `authorize`.
- Mọi chuyển hướng của `authorize` và `approve` tới `redirect_uri` có `iss=PUBLIC_ORIGIN` (RFC 9207).
- Mọi token và mã: 32 byte ngẫu nhiên, base64url, chỉ lưu SHA-256 hex. Response `token` có `Cache-Control: no-store` và `Pragma: no-cache`.
- `authenticate` của `/api/mcp` chọn theo tiền tố: `mst_` tới `AccessTokensService`, `mot_` tới `OAuthService`, còn lại 401. Cập nhật `lastUsedAt` tối đa một lần mỗi 60 giây, như F-037.
- BR-58: lệnh qua OAuth đếm vào cùng bộ đếm `mcp-call` và `mcp-write` theo `userId`.
- Bộ đếm mới trong `ThrottleService.LIMITS`: `oauth-authorize-ip` (60 trong 60 giây) và `oauth-token-ip` (60 trong 60 giây), theo `ipBucket`. Đếm trước khi gọi `fetch` hay đọc bảng.
- Không ghi token, mã, `code_verifier`, header `Authorization` hay thân form vào log.
- Màn lỗi của `authorize` (400) là một trang HTML tĩnh tối thiểu, tiếng Việt, không chèn tham số nào của request vào trang.

`packages/client/src/oauth.ts` (mới): `getConsent`, `approveConsent`, `denyConsent`, `listOAuthConnections`, `revokeOAuthConnection`.

## Data

Hai bảng mới. Tên theo `docs/requirements/data-dictionary.md` (bước 2 thêm mục này):

```prisma
/// Brief F-038: one authorization request of an OAuth client, and the code it gets after "Cho phép".
model OAuthRequest {
  id            String    @id @default(uuid(7)) @db.Uuid
  clientId      String    @db.VarChar(500)
  clientName    String    @db.VarChar(100)
  redirectUri   String    @db.VarChar(500)
  codeChallenge String    @db.Char(43)
  scope         String    @db.VarChar(100)
  state         String?   @db.VarChar(500)
  resource      String    @db.VarChar(500)
  expiresAt     DateTime  @db.Timestamptz(3)
  userId        String?   @db.Uuid
  grantedScope  String?   @db.VarChar(100)
  /// SHA-256 of the code, lowercase hex.
  codeHash      String?   @unique @db.Char(64)
  codeExpiresAt DateTime? @db.Timestamptz(3)
  codeUsedAt    DateTime? @db.Timestamptz(3)
  deniedAt      DateTime? @db.Timestamptz(3)
  connectionId  String?   @unique @db.Uuid
  createdAt     DateTime  @default(now()) @db.Timestamptz(3)
  user          User?     @relation(fields: [userId], references: [id])

  @@index([expiresAt])
}

/// Brief F-038: one connection of an OAuth client to a user. Only SHA-256 hashes of tokens are stored.
model OAuthConnection {
  id                       String           @id @default(uuid(7)) @db.Uuid
  userId                   String           @db.Uuid
  clientId                 String           @db.VarChar(500)
  clientName               String           @db.VarChar(100)
  scope                    AccessTokenScope
  accessTokenHash          String           @unique @db.Char(64)
  accessExpiresAt          DateTime         @db.Timestamptz(3)
  refreshTokenHash         String?          @unique @db.Char(64)
  previousRefreshTokenHash String?          @unique @db.Char(64)
  refreshRotatedAt         DateTime?        @db.Timestamptz(3)
  refreshExpiresAt         DateTime?        @db.Timestamptz(3)
  lastUsedAt               DateTime?        @db.Timestamptz(3)
  revokedAt                DateTime?        @db.Timestamptz(3)
  createdAt                DateTime         @default(now()) @db.Timestamptz(3)
  user                     User             @relation(fields: [userId], references: [id])

  @@index([userId])
}
```

`User` thêm `oauthRequests OAuthRequest[]` và `oauthConnections OAuthConnection[]`. Một migration mới, chỉ thêm hai bảng, index và khóa ngoại. Không đổi bảng có sẵn. `OAuthRequest` hết hạn và cũ hơn 1 ngày bị xóa ở lần `authorize` kế tiếp, như `AuthThrottle`.

BR-60 (thêm vào `docs/requirements/business-rules.md` trong PR của brief này): người dùng có tối đa 10 kết nối OAuth còn hiệu lực. Access token sống 1 giờ. Refresh token xoay vòng mỗi lần dùng, hết hạn sau 30 ngày không dùng. Dùng lại refresh token cũ sau 60 giây kể từ lúc xoay vòng thì cả kết nối bị thu hồi. Một kết nối sống tối đa 90 ngày, rồi người dùng nối lại. Người dùng thu hồi được từng kết nối. Kết nối tạo trước `User.sessionsValidFrom` không còn hiệu lực (BR-32).

## Lock order

- `approve`: `OAuthRequest` (FOR UPDATE) rồi `User` (FOR NO KEY UPDATE), rồi đếm và ghi. Không đường nào khác khóa `User` rồi khóa `OAuthRequest`.
- `token` (mã): `UPDATE` có điều kiện trên `OAuthRequest`, rồi `User` (FOR NO KEY UPDATE), rồi đếm và `INSERT` vào `OAuthConnection`, trong một transaction. Cùng thứ tự với `approve`.
- `token` (refresh) và `revokeConnection`: một `UPDATE` có điều kiện trên một dòng `OAuthConnection`.
- Admin khóa hoặc mở khóa chỉ cập nhật `User`. `create` của PAT (F-037) chỉ khóa `User`. Không có vòng khóa.
- Công cụ vẫn khóa như F-036: `Venue` (FOR SHARE) rồi `Court` (FOR UPDATE). `authenticate` chạy trước công cụ, ngoài transaction của công cụ.

## Build order

One pull request for each row. Each pull request passes the check command on its own.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Contract | `packages/shared/src/oauth.ts`, `packages/shared/src/oauth.test.ts`, `packages/shared/src/index.ts`, `packages/client/src/oauth.ts`, `packages/client/src/index.ts`, `PROGRESS.md`, `@map.md` | AC-1 |
| 2 | Bảng, metadata và `authorize` | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<mới>/`, `apps/api/src/modules/oauth/`, `apps/api/src/app.module.ts`, `apps/api/src/setup-app.ts`, `apps/api/src/serve-web.ts`, `apps/api/src/modules/auth/throttle.service.ts`, `apps/api/.env.example`, `docs/requirements/data-dictionary.md`, `PROGRESS.md`, `@map.md` | AC-2, AC-4, AC-5, AC-6, AC-7, AC-14, AC-15 (phần `authorize`) |
| 3 | `token`, refresh và `/api/mcp` | `apps/api/src/modules/oauth/`, `apps/api/src/modules/mcp/`, `apps/api/src/modules/auth/throttle.service.ts`, `.dependency-cruiser.cjs`, `PROGRESS.md`, `@map.md` | AC-3, AC-8 đến AC-13, AC-15 (phần `token`), AC-19 |
| 4 | Màn "Cho phép", `?tiep=` và mục "Kết nối AI" | `apps/web/src/features/oauth/`, `apps/web/src/features/access-tokens/`, `apps/web/src/features/auth/`, `apps/web/src/app/router.tsx`, `apps/web/src/app/pages.tsx`, `apps/web/src/app/ProfilePage.test.tsx`, `apps/api/src/serve-web.ts`, `docs/huong-dan/noi-ai-voi-monsport.md`, `.github/workflows/deploy.yml`, `PROGRESS.md`, `COMPLETED.md`, `@map.md` | AC-16, AC-17, AC-18, AC-20 |

Lưu ý:

- Bước 2 và 3 đổi schema, xác thực và dữ liệu cá nhân: model mạnh nhất và `rule-review`.
- Bước 2: test `approve` gọi đường API trực tiếp. Màn web có ở bước 4.
- Bước 3: sửa AC-6 của F-037 (`mcp-http.e2e.test.ts`) chỉ ở điểm header: `WWW-Authenticate` bắt đầu bằng `Bearer`. Ghi việc sửa này trong mô tả PR.
- Bước 3: `pnpm check` phải cho `mcp` import `oauth`. Nếu luật import chặn, thêm luật trong cùng PR và nói rõ trong mô tả PR.
- Bước 4: `deploy.yml` thêm `PUBLIC_ORIGIN` vào biến môi trường của Cloud Run. Không đổi gì khác trong file đó.
- Bước 4: chạy `verify-flow` ở 390px và 1280px cho màn "Cho phép" và `/ho-so` trước khi mở PR.
- Bước 4: hướng dẫn thêm mục "Nối Claude trên web": "Settings", "Connectors", "Add custom connector", dán `https://<máy chủ>/api/mcp`, "Connect", đăng nhập, "Cho phép". Câu an toàn của F-037 giữ nguyên.
- Không thêm phụ thuộc mới. Dùng `node:crypto` và `fetch` của Node.

## Edit boundaries

- May edit: các đường dẫn trong "Build order", đúng bước của chúng.
- Leave unchanged without approval: các migration đã có, các bảng có sẵn trong `schema.prisma` (trừ hai quan hệ mới trên `User`), `apps/api/src/modules/bookings/`, `apps/api/src/modules/matches/`, `apps/api/src/modules/venues/`, `apps/api/src/modules/access-tokens/` (trừ việc `mcp` gọi nó như F-037), `apps/api/src/modules/auth/` trừ `throttle.service.ts`, `apps/api/src/modules/finance/`, `apps/mobile/`, `DESIGN.md`, `REVIEW.md`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Chuyển hướng mở (open redirect) | Bước 2 | `redirect_uri` so khớp chính xác với tài liệu CIMD. Lỗi về client không bao giờ chuyển hướng. AC-5 |
| SSRF qua `client_id` | Bước 2 | Chỉ host trong `OAUTH_CIMD_HOSTS`, chỉ `https`, không theo chuyển hướng, 5 giây, 10 KB. AC-5 |
| Cướp mã hoặc dùng lại mã | Bước 3 | PKCE S256, mã sống 60 giây, dùng một lần, gắn `client_id`, `redirect_uri`, `resource`. AC-9 |
| Lộ refresh token | Bước 3 | Xoay vòng, phát hiện dùng lại sau 60 giây thì thu hồi cả kết nối, hạn 30 ngày không dùng và 90 ngày tối đa. AC-12 |
| Token cho máy chủ khác | Bước 3 | `resource` phải bằng `PUBLIC_ORIGIN/api/mcp`. AC-9, AC-13 |
| CSRF trên "Cho phép" | Bước 2, 4 | `POST` với cookie `SameSite=Lax`, từ chối `Origin` lạ. Yêu cầu gắn với `id` một lần. AC-7 |
| Clickjacking màn "Cho phép" | Bước 4 | `serve-web.ts` gửi `Content-Security-Policy: frame-ancestors 'none'` cho đường `/ket-noi-ai/`. Bước 4 thêm `apps/api/src/serve-web.ts` vào đường được sửa và một test |
| Lộ token trong log | Bước 2, 3 | Không ghi token, mã, form. AC-10 |
| Đồng thời: hai lần duyệt, hai lần đổi mã, hai lần refresh | Bước 2, 3 | Khóa dòng và `UPDATE` có điều kiện. AC-9, AC-12, AC-14 |
| Dữ liệu cá nhân (BR-29) | Bước 2, 4 | Màn "Cho phép" liệt kê `dataRead`. Câu hỏi 4 của `HUMAN_DECISIONS.md` vẫn mở |
| Schema: hai bảng mới | Bước 2 | Migration chỉ thêm. Reviewer kiểm SQL. Model mạnh nhất và `rule-review` |
| Quá nhiều yêu cầu | Bước 2, 3 | Bộ đếm IP trong `AuthThrottle`. AC-15 |

## Assumptions

| Assumption | Why |
|---|---|
| Chỉ CIMD, không DCR | Claude hỗ trợ CIMD. DCR làm bảng client lớn không giới hạn. Đặc tả MCP xếp CIMD trước DCR |
| `OAUTH_CIMD_HOSTS` mặc định chỉ `claude.ai` | Giảm SSRF và client lạ. Thêm host bằng biến môi trường, không cần code |
| Máy chủ cấp phép nằm trong API, cùng origin | Một nơi deploy. Đăng nhập dùng lại cookie phiên |
| Access token 1 giờ, refresh 30 ngày không dùng, kết nối tối đa 90 ngày | Hạn ngắn theo kế hoạch ("Token bị lộ"). 90 ngày bằng PAT dài nhất (BR-59) |
| Tối đa 10 kết nối còn hiệu lực | Mỗi lần nối lại từ Claude tạo một kết nối. 10 đủ cho vài máy và vài lần nối lại |
| Phạm vi "read" luôn có. Người dùng bỏ được "book" ở màn "Cho phép" | Phạm vi nhỏ nhất. Màn cho người dùng quyết |
| `WWW-Authenticate` đề nghị `scope="read book"` | Claude xin phạm vi theo header này. Người dùng vẫn bỏ được "book" |
| Token dạng chuỗi ngẫu nhiên lưu băm, không JWT | Thu hồi có hiệu lực ngay. Không cần quản lý khóa ký |
| Dùng lại mã đã đổi chỉ trả `invalid_grant`, không thu hồi kết nối | Mã sống 60 giây và gắn PKCE, nên kẻ lấy mã không đổi được. Thu hồi sẽ làm hỏng kết nối khi Claude thử lại sau timeout |
| Dùng lại refresh token cũ trong 60 giây sau khi xoay vòng không thu hồi kết nối | Claude có thể làm mới song song hoặc thử lại sau timeout 30 giây |
| Không có đường `revocation_endpoint` (RFC 7009) | Người dùng thu hồi ở `/ho-so`. Claude không cần nó |

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Giới hạn 10 kết nối, access 1 giờ, refresh 30 ngày, tối đa 90 ngày. Mặc định: như vậy (dòng 71) | Bạn | none |
| Chỉ nhận `client_id` của `claude.ai`. Mặc định: như vậy (dòng 72) | Bạn | none |
| Màn "Cho phép" có đủ cho Luật 91/2025 không (câu hỏi 4)? Mặc định: 4 dòng `dataRead` | Bạn, người tư vấn pháp lý | none |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete, with `rule-review` on steps 2 and 3.
- `docs/huong-dan/noi-ai-voi-monsport.md` has the section "Nối Claude trên web".
- `PROGRESS.md` names the owner step: thêm connector trên claude.ai với bản live và tài khoản thật.
- `PUBLIC_ORIGIN` trong `deploy.yml` bằng địa chỉ trong hướng dẫn. Trường `resource` của metadata trên bản live bằng `PUBLIC_ORIGIN/api/mcp`.
