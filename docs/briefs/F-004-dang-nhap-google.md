---
style: ste80
lang: vi
---

# F-004: Đăng nhập và đăng ký bằng Google

Status: plan. Chưa code. Bạn yêu cầu kế hoạch này ngày 17/10/2026.

Source: intake chưa có đăng nhập Google. Out of scope của intake chỉ ghi OTP và Zalo là "Bản sau". `docs/requirements/use-cases.md` UC-1. `docs/requirements/business-rules.md` BR-20, BR-24, BR-26, BR-28, BR-29. Brief F-003.

Brief này là kế hoạch. Agent chỉ code khi hai điều kiện đều đúng:

- Bạn thêm đăng nhập Google vào intake, hoặc chính bạn đóng open decision 7 của `PROGRESS.md`.
- Bạn làm xong các bước ở mục "Việc bạn làm trên Google Cloud console".

Agent không được tự đóng open decision 7 theo mục "Autonomy" của `AGENTS.md`. Chỉ bạn đóng quyết định này.

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
| Đặt mật khẩu cho tài khoản chỉ có Google | Cần luồng đổi mật khẩu (non-goal của F-003) | Cùng brief đổi mật khẩu |

## Luồng

Server làm luồng authorization code của OpenID Connect. Trình duyệt không thấy `client_secret` và không thấy token của Google.

1. Người dùng bấm "Tiếp tục với Google". Trình duyệt mở `GET /api/auth/google/start`. Khi liên kết, người dùng đã đăng nhập gửi `POST /api/auth/google/link-start` với mật khẩu của mình (R5).
2. Server sinh `state`, `nonce` và `code_verifier` (PKCE, `S256`). Server lưu ba giá trị này, `mode` (`login` hoặc `link`) và `userId` (chỉ khi `mode` = `link`) trong cookie `google_flow`.
3. Cookie `google_flow` có httpOnly, `SameSite=Lax`, `Secure` khi production, `Path=/api/auth/google`, ký bằng `SESSION_SECRET`, sống 10 phút. Server chuyển hướng tới `authorization_endpoint` với scope `openid email profile`.
4. Google gọi lại `GET /api/auth/google/callback`. Server so `state` với cookie, rồi xóa cookie. Khi Google trả `error` (ví dụ `access_denied`), server chuyển hướng về `/?google_error=<mã>`.
5. Server đổi `code` lấy `id_token` tại `token_endpoint`. Server kiểm chữ ký theo `jwks_uri`, `iss` (`https://accounts.google.com` hoặc `accounts.google.com`), `aud` = `GOOGLE_CLIENT_ID`, `exp` và `nonce`.
6. Server làm theo "Quy tắc liên kết" với `mode` lấy từ cookie, không lấy từ phiên. Mọi lỗi ở callback chuyển hướng về `/?google_error=<mã>`, không trả JSON, vì callback là một lần trình duyệt chuyển trang.

Server đọc các endpoint từ discovery document `https://accounts.google.com/.well-known/openid-configuration`. Server không ghi cứng các endpoint đó.

## Quy tắc liên kết

| # | Tình huống | Server làm gì |
|---|---|---|
| R1 | `mode` = `login`, và có `User` với `googleSub` = `sub` | Đăng nhập tài khoản đó, thay phiên đang có. Tài khoản bị khóa nhận `google_error=locked` (BR-28) |
| R2 | `mode` = `login`, và không có `User` với `sub` đó | Lưu `sub`, `email` và `name` trong cookie `google_pending` (ký, 30 phút, cùng cờ như `google_flow`). Màn hình hiện form "Hoàn tất đăng ký": tên, số điện thoại, ô đồng ý (BR-29) |
| R3 | Form "Hoàn tất đăng ký" gửi một số chưa có tài khoản | Tạo `User` vai trò `USER`, có `googleSub`, `email`, `consentAt`, không có mật khẩu. Xóa cookie `google_pending`. Rồi đăng nhập |
| R4 | Form "Hoàn tất đăng ký" gửi một số đã có tài khoản | 409 "Số này đã có tài khoản. Hãy đăng nhập bằng mật khẩu, rồi liên kết Google". Không liên kết tự động, vì Google không xác minh số điện thoại |
| R5 | `mode` = `link` | Người dùng đã nhập lại đúng mật khẩu ở `link-start`. Phiên hiện tại phải là `userId` trong cookie, nếu không thì `google_error=session`. Server gắn `sub` bằng `updateMany` với điều kiện `googleSub` = null. `sub` đã thuộc tài khoản khác, hoặc tài khoản đã có `googleSub`, nhận `google_error=taken` |
| R6 | Người dùng bấm "Gỡ liên kết Google" | Cho phép khi tài khoản có mật khẩu. Tài khoản chỉ có Google nhận 400 "Hãy đặt mật khẩu trước khi gỡ Google" |
| R7 | Email của Google trùng email của một tài khoản khác | Không làm gì. Server không dùng email để nhận diện, vì Google nói email có thể đổi và không duy nhất. Chỉ `sub` nhận diện tài khoản |
| R8 | Người dùng xóa tài khoản (BR-26) | Server đặt `googleSub` và `email` về null, cùng lúc với việc thay tên và số điện thoại. Người đó đăng ký lại được bằng Google |

Server chỉ lưu `email` khi `email_verified` = `true`. `email` chỉ để hiển thị. Lỗi unique `P2002` trên `googleSub` hoặc `phone` thành 409 hoặc `google_error=taken`, không thành 500.

## Acceptance criteria (nháp)

Coder viết lại các AC này với giá trị thật khi brief chuyển sang `accepted`. Test giả lập Google bằng một discovery document và một khóa ký JWT tạo trong test.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Không có `User` với `sub` "g-111" | Google trả `sub` "g-111", rồi người dùng gửi tên "Lan", số `0901112233`, `consent` = `true` | 201. `User` mới có `googleSub` = "g-111", `passwordHash` = null, `consentAt` khác null. Cookie `google_pending` bị xóa |
| AC-2 | Lan có `googleSub` "g-111" | Google trả `sub` "g-111" lần nữa | 302 về `/`, đã đăng nhập vào tài khoản của Lan |
| AC-3 | An có tài khoản `0901234567`, chưa có `googleSub` | Người chưa đăng nhập hoàn tất đăng ký Google với số `0901234567` | 409. Tài khoản của An không đổi |
| AC-4 | An đã đăng nhập bằng mật khẩu | An gửi `link-start` với đúng mật khẩu, rồi Google trả `sub` "g-222" | `googleSub` của An = "g-222" |
| AC-5 | An đã đăng nhập | An gửi `link-start` với sai mật khẩu | 401. Không có chuyển hướng tới Google |
| AC-6 | An bắt đầu liên kết, rồi đăng nhập tài khoản Chi ở tab khác | Google gọi lại callback với `mode` = `link` | 302 về `/?google_error=session`. Không tài khoản nào có `sub` mới |
| AC-7 | `sub` "g-222" thuộc An | Chi liên kết Google với `sub` "g-222" | 302 về `/?google_error=taken` |
| AC-8 | Hai request "Hoàn tất đăng ký" cùng `sub` gửi cùng lúc | Server xử lý cả hai | Đúng 1 request nhận 201. Request kia nhận 409 |
| AC-9 | `state` của callback khác `state` trong cookie | Google gọi lại callback | 302 về `/?google_error=state`. Không có phiên mới |
| AC-10 | `id_token` có `aud` khác `GOOGLE_CLIENT_ID`, hoặc `nonce` sai, hoặc đã hết hạn | Server kiểm `id_token` | 302 về `/?google_error=token`. Không có phiên mới |
| AC-11 | Google trả `error=access_denied` | Google gọi lại callback | 302 về `/?google_error=access_denied` |
| AC-12 | Lan có `googleSub` "g-111" và bị khóa | Google trả `sub` "g-111" | 302 về `/?google_error=locked` |
| AC-13 | `id_token` có `email_verified` = `false` | Lan hoàn tất đăng ký | `User.email` = null |
| AC-14 | Cookie `google_pending` hết hạn hoặc bị sửa | Người dùng gửi "Hoàn tất đăng ký" | 400. Không có tài khoản mới |
| AC-15 | Lan chỉ có Google, không có mật khẩu | Lan đăng nhập bằng số và một mật khẩu bất kỳ | 401 "Sai số điện thoại hoặc mật khẩu" |
| AC-16 | Lan chỉ có Google | Lan gỡ liên kết Google | 400 "Hãy đặt mật khẩu trước khi gỡ Google" |
| AC-17 | An có mật khẩu và `googleSub` "g-222" | An gỡ liên kết Google | 200. `googleSub` của An = null |
| AC-18 | Email Google của Chi trùng email đã lưu của An | Chi đăng nhập Google lần đầu | Chi đi tới R2. Tài khoản của An không đổi |
| AC-19 | `GOOGLE_CLIENT_ID` không có trong môi trường | Người dùng mở màn đăng nhập | Không có nút "Tiếp tục với Google". `GET /api/auth/google/start` trả 404 |
| AC-20 | Chỉ có `GOOGLE_CLIENT_ID`, thiếu `GOOGLE_CLIENT_SECRET` | API khởi động | API dừng với lỗi cấu hình, như `assertSessionSecret` |

## Contract (nháp)

| Endpoint | Change | Request | Response and errors |
|---|---|---|---|
| `GET /api/auth/providers` | new | — | 200 `{ google: boolean }` |
| `GET /api/auth/google/start` | new | — | 302 tới Google · 404 khi chưa cấu hình |
| `POST /api/auth/google/link-start` | new | `password`, cookie `session` | 200 `{ url }` tới Google · 401 |
| `GET /api/auth/google/callback` | new | `code`, `state` hoặc `error` | 302 về `/` (R1, R5), `/?google=complete` (R2), hoặc `/?google_error=<mã>` |
| `GET /api/auth/google/pending` | new | cookie `google_pending` | 200 `{ name, email }` · 404 |
| `POST /api/auth/google/complete` | new | `name`, `phone`, `consent` | 201 `{ id, name, role }` và cookie `session` · 400 · 409 |
| `POST /api/auth/google/unlink` | new | cookie `session` | 200 · 400 |

## Data (nháp)

| Table | Change | Migration step |
|---|---|---|
| `User` | mới: `googleSub` varchar(255), unique, null được. `email` varchar(254), null được | expand |
| `User` | `passwordHash` thành null được, cho tài khoản chỉ có Google. Đăng nhập bằng mật khẩu với `passwordHash` = null trả 401 như sai mật khẩu | expand |

Bản ghi quyết định: một ADR mới, vì thêm nhà cung cấp danh tính và cho mật khẩu null là quyết định khó đảo ngược. Intake, mục Data, phải thêm email và Google `sub` vào dữ liệu tài khoản.

## Môi trường và secret

Không file nào trong repo chứa giá trị của các biến này. `apps/api/.env.example` chỉ có tên biến, không có giá trị.

| Tên | Loại | Ở đâu | Giá trị |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | biến môi trường | Cloud Run, `apps/api/.env` khi chạy máy | Client ID của OAuth client "MONSPORT web" |
| `GOOGLE_CLIENT_SECRET` | secret | Secret Manager, secret `monsport-google-client-secret`. Cloud Run đọc bằng `--update-secrets`. Khi chạy máy: `apps/api/.env` | Client secret của client đó. Server gọi `trim()` khi đọc |
| `GOOGLE_REDIRECT_URI` | biến môi trường | Cloud Run, `apps/api/.env` | `https://monsport-774323404592.asia-southeast1.run.app/api/auth/google/callback` trên cloud. `http://localhost:5173/api/auth/google/callback` khi chạy máy |
| `SESSION_SECRET` | secret, đã có | Secret Manager `monsport-session-secret` | Ký thêm cookie `google_flow` và `google_pending` |

## Việc bạn làm trên Google Cloud console

Làm trong project Google Cloud đang chạy MONSPORT. Các bước 1 tới 7 nằm trong trang Google Auth Platform.

1. Mở "Google Auth Platform", chọn "Branding". Điền tên app "MONSPORT" và email hỗ trợ của bạn. Thêm link trang chủ và link chính sách quyền riêng tư.
2. Ở "Branding", thêm tên miền của app vào "Authorized domains". Xem rủi ro về `run.app` ở mục dưới.
3. Mở "Audience". Chọn "External". Giữ trạng thái "Testing", và thêm địa chỉ Gmail của bạn vào test users.
4. Mở "Data access". Thêm scope `openid`, `.../auth/userinfo.email` và `.../auth/userinfo.profile`. Không thêm scope khác.
5. Mở "Clients", bấm "Create client", chọn "Web application", đặt tên "MONSPORT web".
6. Thêm hai "Authorized redirect URIs": URL cloud và URL máy ở bảng trên. Để trống "Authorized JavaScript origins".
7. Bấm "Create". Chép client secret ngay, vì console chỉ hiện nó một lần.
8. Mở "Secret Manager" trên console, bấm "Create secret". Đặt tên `monsport-google-client-secret`, dán client secret vào ô "Secret value", rồi bấm "Create secret". Cách này tránh ký tự xuống dòng mà PowerShell thêm khi pipe.
9. Cho tài khoản dịch vụ của Cloud Run quyền `roles/secretmanager.secretAccessor` trên secret đó, như `docs/deploy-gcp.md` làm với `monsport-session-secret`.
10. Gửi client ID cho agent và nói "tiếp tục". Client ID không phải bí mật. Agent chạy `gcloud run services update` để thêm `GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI` và secret.
11. Khi mọi thứ chạy, quay lại "Audience" và bấm "Publish app".

## Build order (khi brief được chấp nhận)

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | ADR, intake và tài liệu yêu cầu, hợp đồng và schema | `docs/adr/`, `docs/requirements/` (intake mục Data, data dictionary, business rules cho R1 tới R8), `packages/shared/src/` (gồm thông báo bảo vệ dữ liệu cá nhân), `apps/api/prisma/` | Migration trên Postgres thật |
| 2 | Server: luồng OIDC, quy tắc R1 tới R8, kiểm cấu hình lúc khởi động | `apps/api/src/modules/auth/`, `apps/api/src/main.ts`, `apps/api/.env.example`, `apps/api/package.json`, `pnpm-lock.yaml`, `docs/deploy-gcp.md` | AC-1 tới AC-20, với Google giả lập |
| 3 | Màn hình: nút Google, form "Hoàn tất đăng ký", liên kết và gỡ liên kết, câu báo cho mỗi `google_error` | `apps/web/src/features/auth/`, `apps/web/src/app/` | AC-1, AC-19 trên màn hình |

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Chiếm tài khoản qua email hoặc số điện thoại trùng | Quy tắc liên kết | Chỉ `sub` nhận diện. Không tự liên kết (R4, R7). Review bằng phiên mới |
| Phiên bị đánh cắp dùng để gắn Google của kẻ khác | R5 | Liên kết đòi nhập lại mật khẩu. Callback kiểm `userId` trong cookie. AC-5, AC-6 |
| CSRF và replay ở callback | `state`, `nonce`, PKCE | Cookie `google_flow` ký, sống 10 phút, xóa sau một lần dùng. AC-9, AC-10 |
| Đồng thời: hai lần hoàn tất hoặc hai lần liên kết | R3, R5 | Unique index quyết định. `P2002` thành 409. AC-8 |
| Lộ `client_secret` | Secret Manager | Chỉ Cloud Run đọc secret. Không log, không commit |
| `run.app` không phải tên miền của bạn | Branding, Authorized domains | Google có thể không cho publish khi chưa xác minh tên miền. Khi đó cần một tên miền riêng trỏ tới Cloud Run |
| Schema: `passwordHash` null được | PR 1 | Đăng nhập mật khẩu kiểm null trước argon2. AC-15. Review bằng phiên mới |
| Dữ liệu cá nhân: lưu thêm email và `sub` | `User.email`, `User.googleSub` | Chỉ lưu email khi `email_verified`. Xóa cả hai khi xóa tài khoản (R8). Thông báo bảo vệ dữ liệu cá nhân thêm email và Google |

## Assumptions

- Mỗi tài khoản có nhiều nhất một tài khoản Google. Một tài khoản Google thuộc nhiều nhất một tài khoản MONSPORT.
- Tài khoản tạo bằng Google luôn có vai trò `USER`.
- Tài khoản chỉ có Google không gỡ liên kết được, cho tới khi có luồng đặt mật khẩu.
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
