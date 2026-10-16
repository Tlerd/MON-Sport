---
style: ste80
lang: vi
---

# F-004: Đăng nhập và đăng ký bằng Google

Status: plan. Chưa code. Bạn yêu cầu kế hoạch này ngày 17/10/2026.

Source: intake chưa có đăng nhập Google. Out of scope của intake chỉ ghi OTP và Zalo là "Bản sau". `docs/requirements/use-cases.md` UC-1. `docs/requirements/business-rules.md` BR-20, BR-24, BR-28, BR-29. Brief F-003.

Brief này là kế hoạch. Agent chỉ code khi hai điều kiện đều đúng. Bạn thêm đăng nhập Google vào intake, hoặc ghi chấp nhận vào open decision 7 của `PROGRESS.md`. Bạn làm xong các bước trên Google Cloud console ở mục "Việc bạn làm".

## Goal

Người dùng đăng nhập hoặc tạo tài khoản bằng tài khoản Google, rồi nhập số điện thoại một lần. Kiểm tra bằng cách đăng xuất, bấm "Tiếp tục với Google" lần nữa: app mở đúng tài khoản cũ.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Đăng nhập Zalo, Facebook, Apple | Intake ghi Zalo là "Bản sau". Mỗi nhà cung cấp cần cấu hình riêng | Khi bạn thêm vào intake |
| Bỏ số điện thoại khỏi tài khoản | Chủ sân cần số của người đặt (UC-4, BR-20). Google không trả số điện thoại | Không có kế hoạch |
| Tự liên kết theo email hoặc theo số điện thoại | Xem "Quy tắc liên kết" | Không có kế hoạch |
| Đọc lịch, Drive hoặc dữ liệu Google khác | Chỉ cần scope `openid`, `email`, `profile` | Không có kế hoạch |
| Chủ sân và admin tạo tài khoản bằng Google | Admin tạo tài khoản chủ sân (UC-10). Chủ sân chỉ liên kết Google sau khi đăng nhập | Không có kế hoạch |

## Luồng

Server làm luồng authorization code của OpenID Connect. Trình duyệt không thấy `client_secret` và không thấy token của Google.

1. Người dùng bấm "Tiếp tục với Google". Trình duyệt mở `GET /api/auth/google/start`.
2. Server sinh `state`, `nonce` và `code_verifier` (PKCE, `S256`). Server lưu ba giá trị trong cookie `google_flow`: httpOnly, ký bằng `SESSION_SECRET`, sống 10 phút. Server chuyển hướng tới `authorization_endpoint` của Google với scope `openid email profile`.
3. Google gọi lại `GET /api/auth/google/callback?code=…&state=…`. Server so `state` với cookie, rồi xóa cookie.
4. Server đổi `code` lấy `id_token` tại `token_endpoint`. Server kiểm chữ ký theo `jwks_uri`, `iss`, `aud` = `GOOGLE_CLIENT_ID`, `exp` và `nonce`.
5. Server tìm `User` theo `googleSub` = claim `sub`, rồi làm theo "Quy tắc liên kết".

Server đọc các endpoint từ discovery document `https://accounts.google.com/.well-known/openid-configuration`. Server không ghi cứng các endpoint đó.

## Quy tắc liên kết

| # | Tình huống | Server làm gì |
|---|---|---|
| R1 | Có `User` với `googleSub` = `sub` | Đăng nhập tài khoản đó. Tài khoản bị khóa nhận 403 "Tài khoản đã bị khóa" (BR-28). Tài khoản đã xóa nhận 401 |
| R2 | Không có `User` với `sub` đó, và người gọi chưa đăng nhập | Lưu `sub`, `email` và `name` trong cookie `google_pending` (ký, 30 phút). Màn hình hiện form "Hoàn tất đăng ký": tên, số điện thoại, ô đồng ý (BR-29) |
| R3 | Form "Hoàn tất đăng ký" gửi một số chưa có tài khoản | Tạo `User` vai trò `USER`, có `googleSub`, `email`, `consentAt`, không có mật khẩu. Rồi đăng nhập |
| R4 | Form "Hoàn tất đăng ký" gửi một số đã có tài khoản | 409 "Số này đã có tài khoản. Hãy đăng nhập bằng mật khẩu, rồi liên kết Google". Không liên kết tự động, vì Google không xác minh số điện thoại |
| R5 | Người gọi đã đăng nhập và bấm "Liên kết Google" | Gắn `sub` vào tài khoản đang đăng nhập, ở mọi vai trò. 409 khi `sub` đã thuộc tài khoản khác. 409 khi tài khoản đã có `googleSub` khác |
| R6 | Người dùng bấm "Gỡ liên kết Google" | Cho phép khi tài khoản có mật khẩu. Tài khoản chỉ có Google nhận 400 "Hãy đặt mật khẩu trước khi gỡ Google" |
| R7 | Email của Google trùng email của một tài khoản khác | Không làm gì. Server không dùng email để nhận diện, vì Google nói email có thể đổi và không duy nhất. Chỉ `sub` nhận diện tài khoản |

Server chỉ lưu `email` khi `email_verified` = `true`. `email` chỉ để hiển thị.

## Acceptance criteria (nháp)

Coder viết lại các AC này với giá trị thật khi brief chuyển sang `accepted`. Test giả lập Google bằng một discovery document và một khóa ký JWT tạo trong test.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Không có `User` với `sub` "g-111" | Google trả `id_token` có `sub` "g-111", rồi người dùng gửi tên "Lan", số `0901112233`, `consent` = `true` | 201. `User` mới có `googleSub` = "g-111", `passwordHash` = null, `consentAt` khác null. Cookie `session` có |
| AC-2 | Lan có `googleSub` "g-111" | Google trả `sub` "g-111" lần nữa | 302 về trang chủ, đã đăng nhập vào tài khoản của Lan |
| AC-3 | An có tài khoản `0901234567`, chưa có `googleSub` | Người chưa đăng nhập hoàn tất đăng ký Google với số `0901234567` | 409. Tài khoản của An không đổi |
| AC-4 | An đã đăng nhập bằng mật khẩu | An liên kết Google với `sub` "g-222" | `googleSub` của An = "g-222". Lần sau An đăng nhập được bằng Google |
| AC-5 | `state` của callback khác `state` trong cookie | Google gọi lại callback | 400. Không có phiên mới |
| AC-6 | `id_token` có `aud` khác `GOOGLE_CLIENT_ID`, hoặc `nonce` sai, hoặc đã hết hạn | Server kiểm `id_token` | 401. Không có phiên mới |
| AC-7 | Lan có `googleSub` "g-111" và bị khóa | Google trả `sub` "g-111" | 403 "Tài khoản đã bị khóa" |
| AC-8 | Lan chỉ có Google, không có mật khẩu | Lan gỡ liên kết Google | 400 "Hãy đặt mật khẩu trước khi gỡ Google" |
| AC-9 | `GOOGLE_CLIENT_ID` không có trong môi trường | Người dùng mở màn đăng nhập | Không có nút "Tiếp tục với Google". `GET /api/auth/google/start` trả 404 |

## Contract (nháp)

| Endpoint | Change | Request | Response and errors |
|---|---|---|---|
| `GET /api/auth/providers` | new | — | 200 `{ google: boolean }` |
| `GET /api/auth/google/start` | new | `mode` = `login` hoặc `link` | 302 tới Google · 404 khi chưa cấu hình |
| `GET /api/auth/google/callback` | new | `code`, `state` | 302 về `/` (R1, R5) hoặc `/?google=complete` (R2) · 400 · 401 · 403 |
| `GET /api/auth/google/pending` | new | cookie `google_pending` | 200 `{ name, email }` · 404 |
| `POST /api/auth/google/complete` | new | `name`, `phone`, `consent` | 201 `{ id, name, role }` và cookie `session` · 400 · 409 |
| `POST /api/auth/google/unlink` | new | cookie `session` | 200 · 400 |

## Data (nháp)

| Table | Change | Migration step |
|---|---|---|
| `User` | mới: `googleSub` varchar(255), unique, null được. `email` varchar(254), null được | expand |
| `User` | `passwordHash` thành null được, cho tài khoản chỉ có Google. Đăng nhập bằng mật khẩu với `passwordHash` = null trả 401 như sai mật khẩu | expand |

Bản ghi quyết định: một ADR mới, vì thêm nhà cung cấp danh tính và cho mật khẩu null là quyết định khó đảo ngược.

## Môi trường và secret

Không file nào trong repo chứa giá trị của các biến này.

| Tên | Loại | Ở đâu | Giá trị |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | biến môi trường | Cloud Run, `apps/api/.env` khi chạy máy | Client ID của OAuth client "MONSPORT web" |
| `GOOGLE_CLIENT_SECRET` | secret | Secret Manager, secret `monsport-google-client-secret`. Cloud Run đọc bằng `--update-secrets` | Client secret của client đó |
| `GOOGLE_REDIRECT_URI` | biến môi trường | Cloud Run, `apps/api/.env` | `https://monsport-774323404592.asia-southeast1.run.app/api/auth/google/callback` trên cloud. `http://localhost:5173/api/auth/google/callback` khi chạy máy |
| `SESSION_SECRET` | secret, đã có | Secret Manager `monsport-session-secret` | Ký thêm cookie `google_flow` và `google_pending` |

## Việc bạn làm trên Google Cloud console

Làm trong project Google Cloud đang chạy MONSPORT. Mỗi bước nằm trong trang Google Auth Platform.

1. Mở "Google Auth Platform", chọn "Branding". Điền tên app "MONSPORT" và email hỗ trợ của bạn. Thêm link trang chủ và link chính sách quyền riêng tư.
2. Ở "Branding", thêm tên miền của app vào "Authorized domains". Xem rủi ro về `run.app` ở mục dưới.
3. Mở "Audience". Chọn "External". Giữ trạng thái "Testing", và thêm số Gmail của bạn vào test users.
4. Mở "Data access". Thêm scope `openid`, `.../auth/userinfo.email` và `.../auth/userinfo.profile`. Không thêm scope khác.
5. Mở "Clients", bấm "Create client", chọn "Web application", đặt tên "MONSPORT web".
6. Thêm hai "Authorized redirect URIs": URL cloud và URL máy ở bảng trên. Để trống "Authorized JavaScript origins".
7. Bấm "Create". Chép client secret ngay, vì console chỉ hiện nó một lần.
8. Tạo secret trong PowerShell. Lệnh đọc giá trị từ bàn phím, nên giá trị không vào lịch sử lệnh:

   ```powershell
   $s = Read-Host -AsSecureString "Client secret"
   [System.Net.NetworkCredential]::new('', $s).Password | gcloud secrets create monsport-google-client-secret --data-file=-
   ```

9. Cho tài khoản dịch vụ của Cloud Run quyền `roles/secretmanager.secretAccessor` trên secret đó, như `docs/deploy-gcp.md` làm với `monsport-session-secret`.
10. Gửi client ID cho agent và nói "tiếp tục". Client ID không phải bí mật. Agent chạy `gcloud run services update` để thêm `GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI` và secret.
11. Khi mọi thứ chạy, quay lại "Audience" và bấm "Publish app".

## Build order (khi brief được chấp nhận)

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | ADR, hợp đồng và schema: `googleSub`, `email`, `passwordHash` null được | `docs/adr/`, `packages/shared/src/`, `apps/api/prisma/` | Migration trên Postgres thật |
| 2 | Server: luồng OIDC, quy tắc R1 tới R7 | `apps/api/src/modules/auth/`, `apps/api/package.json`, `pnpm-lock.yaml` | AC-1 tới AC-9, với Google giả lập |
| 3 | Màn hình: nút Google, form "Hoàn tất đăng ký", liên kết và gỡ liên kết | `apps/web/src/features/auth/`, `apps/web/src/app/` | AC-1, AC-9 trên màn hình |

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Chiếm tài khoản qua email hoặc số điện thoại trùng | Quy tắc liên kết | Chỉ `sub` nhận diện. Không tự liên kết (R4, R7). Review bằng phiên mới |
| CSRF và replay ở callback | `state`, `nonce`, PKCE | Cookie `google_flow` ký, sống 10 phút, xóa sau một lần dùng. AC-5, AC-6 |
| Lộ `client_secret` | Secret Manager | Chỉ Cloud Run đọc secret. Không log, không commit |
| `run.app` không phải tên miền của bạn | Branding, Authorized domains | Google có thể không cho publish khi chưa xác minh tên miền. Khi đó cần một tên miền riêng trỏ tới Cloud Run |
| Schema: `passwordHash` null được | PR 1 | Đăng nhập mật khẩu kiểm null trước argon2. Review bằng phiên mới |
| Dữ liệu cá nhân: lưu thêm email | `User.email` | Chỉ lưu khi `email_verified`. Thông báo bảo vệ dữ liệu cá nhân thêm email và Google |

## Assumptions

- Mỗi tài khoản có nhiều nhất một tài khoản Google. Một tài khoản Google thuộc nhiều nhất một tài khoản MONSPORT.
- Tài khoản tạo bằng Google luôn có vai trò `USER`.
- Thư viện: `openid-client` (dependency mới), vì nó làm discovery, PKCE và kiểm `id_token`. Coder đọc tài liệu qua Context7 trước khi code.
- Cookie `google_flow` dùng `SameSite=Lax`, vì Google gọi lại bằng một lần chuyển hướng GET từ site khác.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Thêm đăng nhập Google vào intake không? | Bạn | Có, chặn việc code |
| Dùng tên miền riêng cho MONSPORT không? | Bạn | Có, chặn bước "Publish app" nếu Google đòi xác minh tên miền |
| Người dùng chỉ có Google có cần đặt mật khẩu không? | Bạn | Không |

## Nguồn

- Google, OpenID Connect: https://developers.google.com/identity/openid-connect/openid-connect
- Google Cloud, quản lý OAuth client: https://support.google.com/cloud/answer/15549257
- Google Cloud, Audience và test users: https://support.google.com/cloud/answer/15549945

## Done when

- Bạn trả lời hai câu hỏi chặn ở trên, và brief chuyển sang `accepted`.
- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
