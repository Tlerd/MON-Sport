---
style: ste80
lang: vi
---

# F-004: Đăng nhập và đăng ký bằng Google, xác minh số điện thoại bằng OTP

Status: accepted (phạm vi), chờ review. Bạn yêu cầu kế hoạch này ngày 17/10/2026. Ngày 23/10/2026 bạn chấp nhận và mở rộng: "accept F-004 (Thêm đề xuất gửi mã OTP để xác minh sdt, dù đăng nhập hoặc đăng kí bằng gmail thì phải xác minh sdt hoặc nếu đăng nhập bằng Zalo thì xác minh bằng zalo)".

Source: intake UC-1 và mục Assumptions (đổi ngày 23/10/2026), Open items 5 và 6. `docs/requirements/use-cases.md` UC-1. `docs/requirements/business-rules.md` BR-20, BR-24, BR-26, BR-28, BR-29. Brief F-003.

Đăng nhập Zalo nằm ở brief riêng F-018. Brief đó dùng lại dịch vụ OTP của brief này, và gửi mã qua tin Zalo (ZNS), vì Zalo Social API không trả số điện thoại.

Agent code PR 1 tới PR 3 khi Reviewer duyệt brief. Test giả lập Google và nhà cung cấp OTP, nên các PR này không cần tài khoản thật. PR 4 bật tính năng trên live, và chỉ chạy khi bạn làm xong các mục "Việc bạn làm" và chọn nhà cung cấp tin nhắn.

## Goal

Người dùng đăng nhập hoặc tạo tài khoản bằng tài khoản Google. Lần đầu, người dùng nhập số điện thoại và mã OTP gửi qua SMS tới số đó. Kiểm tra bằng cách đăng xuất, bấm "Tiếp tục với Google" lần nữa: app mở đúng tài khoản cũ, không hỏi OTP lần nữa.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Đăng nhập Zalo | Cần app Zalo và Official Account riêng. Dùng lại OTP của brief này | Brief F-018 |
| Đăng nhập Facebook, Apple | Intake không có | Khi bạn thêm vào intake |
| OTP cho đăng ký bằng số điện thoại và mật khẩu | Intake Open item 6 chờ bạn | Khi bạn trả lời Open item 6 |
| Đăng nhập bằng OTP thay cho mật khẩu | Bạn chỉ yêu cầu OTP để xác minh số | Không có kế hoạch |
| Bỏ số điện thoại khỏi tài khoản | Chủ sân cần số của người đặt (UC-4, BR-20). Google không trả số điện thoại, nên người dùng nhập số và xác minh bằng OTP | Không có kế hoạch |
| Tự liên kết theo email hoặc theo số điện thoại | Xem "Quy tắc liên kết" | Không có kế hoạch |
| Đọc lịch, Drive hoặc dữ liệu Google khác | Chỉ cần scope `openid`, `email`, `profile` | Không có kế hoạch |
| Chủ sân và admin tạo tài khoản bằng Google | Admin tạo tài khoản chủ sân (UC-10). Chủ sân chỉ liên kết Google sau khi đăng nhập | Không có kế hoạch |
| Đặt mật khẩu cho tài khoản chỉ có Google | Cần luồng đổi mật khẩu (non-goal của F-003) | Cùng brief đổi mật khẩu |

## Luồng

Server làm luồng authorization code của OpenID Connect. Trình duyệt không thấy `client_secret` và không thấy token của Google.

1. Người dùng bấm "Tiếp tục với Google". Trình duyệt mở `GET /api/auth/google/start`. Khi liên kết, người dùng đã đăng nhập gửi `POST /api/auth/google/link-start` với mật khẩu của mình (R5).
2. Server sinh `state`, `nonce` và `code_verifier` (PKCE, `S256`). Server lưu ba giá trị này, `mode` (`login` hoặc `link`) và `userId` (chỉ khi `mode` = `link`) trong cookie `google_flow`.
3. Cookie `google_flow` có httpOnly, `SameSite=Lax`, `Secure` khi production, `Path=/api/auth/google`, và sống 10 phút. Xem "Ký cookie" về khóa ký. Server chuyển hướng tới `authorization_endpoint` với scope `openid email profile`.
4. Google gọi lại `GET /api/auth/google/callback`. Server so `state` với cookie, rồi xóa cookie. Khi Google trả `error`, server chuyển hướng về `/?google_error=<mã>`. Mã là một trong `access_denied`, `state`, `token`, `taken`, `session`, `locked`, `config`. Mã lạ thành `unknown`.
5. Server đổi `code` lấy `id_token` tại `token_endpoint`. Server kiểm chữ ký theo `jwks_uri`, `iss` (`https://accounts.google.com` hoặc `accounts.google.com`), `aud` = `GOOGLE_CLIENT_ID`, `exp` và `nonce`.
6. Server làm theo "Quy tắc liên kết" với `mode` lấy từ cookie, không lấy từ phiên. Mọi lỗi ở callback chuyển hướng về `/?google_error=<mã>`, không trả JSON, vì callback là một lần trình duyệt chuyển trang.

Server đọc các endpoint từ discovery document `https://accounts.google.com/.well-known/openid-configuration`. Server không ghi cứng các endpoint đó. Khi chưa cấu hình Google, mọi route `/api/auth/google/*` trả 404.

## Ký cookie

Mỗi cookie ký bằng một khóa riêng: `HMAC-SHA256(SESSION_SECRET, "<tên cookie>")`. Payload của `google_flow` và `google_pending` là JSON mã hóa base64url, có trường `typ` bằng tên cookie. Server từ chối cookie có `typ` sai. Vì vậy, một giá trị `google_pending` đặt vào cookie `session` không qua được `readSession`. PR 2 đổi `session.ts` để cookie `session` cũng dùng khóa riêng của nó.

## Quy tắc liên kết

| # | Tình huống | Server làm gì |
|---|---|---|
| R1 | `mode` = `login`, và có `User` với `googleSub` = `sub` | Đăng nhập tài khoản đó, thay phiên đang có. Tài khoản bị khóa hoặc đã xóa nhận `google_error=locked` (BR-28) |
| R2 | `mode` = `login`, và không có `User` với `sub` đó | Lưu `sub`, `email` và `name` trong cookie `google_pending` (ký, 30 phút, cùng cờ như `google_flow`). Màn hình hiện form "Hoàn tất đăng ký": tên, số điện thoại, ô đồng ý (BR-29) |
| R3 | Form "Hoàn tất đăng ký" gửi một số chưa có tài khoản và một mã OTP đúng của số đó (xem "Xác minh số điện thoại") | Tạo `User` vai trò `USER`, có `googleSub`, `email`, `consentAt`, `phoneVerifiedAt`, không có mật khẩu. Xóa cookie `google_pending`. Rồi đăng nhập. Mã sai hoặc hết hạn trả 400, không tạo tài khoản |
| R4 | Form "Hoàn tất đăng ký" gửi một số đã có tài khoản | 409 "Số này đã có tài khoản. Hãy đăng nhập bằng mật khẩu, rồi liên kết Google". Server kiểm điều này trước khi gửi OTP, nên không tốn tin SMS. Không liên kết tự động: số điện thoại có thể đã đổi chủ |
| R5 | `mode` = `link` | Người dùng đã nhập lại đúng mật khẩu ở `link-start`. Phiên hiện tại phải là `userId` trong cookie, nếu không thì `google_error=session`. Server gắn `sub` bằng `updateMany` với điều kiện `googleSub` = null. `sub` đã thuộc tài khoản khác, hoặc tài khoản đã có `googleSub`, nhận `google_error=taken` |
| R6 | Người dùng bấm "Gỡ liên kết Google" | Cho phép khi tài khoản có mật khẩu. Tài khoản chỉ có Google nhận 400 "Hãy đặt mật khẩu trước khi gỡ Google" |
| R7 | Email của Google trùng email của một tài khoản khác | Không làm gì. Server không dùng email để nhận diện, vì Google nói email có thể đổi và không duy nhất. Chỉ `sub` nhận diện tài khoản |
| R8 | Người dùng xóa tài khoản (BR-26) | Server đặt `googleSub` và `email` về null, cùng lúc với việc thay tên và số điện thoại. Người đó đăng ký lại được bằng Google. R8 là AC bắt buộc của brief xóa tài khoản |

## Xác minh số điện thoại

Server gửi mã OTP tới số mà người dùng nhập ở form "Hoàn tất đăng ký". Dịch vụ OTP nằm ở `apps/api/src/modules/otp/`, để brief F-018 dùng lại.

| # | Quy tắc |
|---|---|
| O1 | Mã có 6 chữ số, sinh bằng `crypto.randomInt`. Mã sống 5 phút |
| O2 | Server chỉ lưu `HMAC-SHA256(khóa riêng "otp" từ SESSION_SECRET, phone + ":" + mã)`, không lưu mã. Server không ghi mã vào log |
| O3 | Mỗi số có nhiều nhất 1 mã còn hiệu lực cho mỗi `purpose`. Gửi lại thay mã cũ. Gửi lại chỉ được sau 60 giây |
| O4 | Mỗi mã cho nhập sai 5 lần. Lần sai thứ 5 hủy mã. Người dùng phải xin mã mới |
| O5 | Giới hạn gửi trong bảng `AuthThrottle`: 5 tin mỗi số và 10 tin mỗi IP trong 1 giờ. Quá giới hạn trả 429, như BR-30 |
| O6 | Mã đúng chỉ dùng một lần. Server xóa mã bằng `deleteMany` có điều kiện `codeHash`, nên hai request cùng mã chỉ một request thành công |
| O7 | Mã gắn với `purpose` (`google_signup`). Mã của mục đích này không dùng cho mục đích khác |
| O8 | Nhà cung cấp tin nhắn lỗi trả 503 "Không gửi được mã. Thử lại sau". Server không giữ mã của lần đó |

Server gửi mã qua interface `OtpSender` có một hàm `send(phone, code, channel)`. `channel` là `sms` ở brief này, và `zalo` ở brief F-018.

| `OTP_PROVIDER` | Dùng ở đâu | Làm gì |
|---|---|---|
| `esms` | Cloud Run | Gọi API của nhà cung cấp tin nhắn. Xem Open questions về việc chọn nhà cung cấp |
| `dev` | Chỉ máy local. API dừng khi `NODE_ENV` = `production` mà `OTP_PROVIDER` = `dev` | Ghi mã vào bảng `DevOtpOutbox` để test và `verify-flow` đọc. Không ghi ra console |
| không đặt | | Không có nút Google, như AC-19, vì tài khoản Google không xác minh số được |

Server chỉ lưu `email` khi `email_verified` = `true`. `email` chỉ để hiển thị. Lỗi unique trên `googleSub` hoặc `phone` thành 409 hoặc `google_error=taken`, không thành 500. Server dùng lại `isUniqueViolation` của `accounts.service.ts`, vì Prisma 7 với driver adapter có thể trả `23505` thay cho `P2002`.

## Acceptance criteria (nháp)

Coder viết lại các AC này với giá trị thật khi brief chuyển sang `accepted`. Test giả lập Google bằng một discovery document và một khóa ký JWT tạo trong test.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Không có `User` với `sub` "g-111" | Google trả `sub` "g-111". Người dùng xin mã cho `0901112233`, rồi gửi tên "Lan", số đó, mã đúng, `consent` = `true` | 201. `User` mới có `googleSub` = "g-111", `passwordHash` = null, `consentAt` và `phoneVerifiedAt` khác null. Cookie `google_pending` bị xóa |
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
| AC-19 | `GOOGLE_CLIENT_ID` không có trong môi trường | Người dùng mở màn đăng nhập | Không có nút "Tiếp tục với Google". Mọi route `/api/auth/google/*` trả 404 |
| AC-20 | Có một trong ba biến `GOOGLE_*`, thiếu `GOOGLE_CLIENT_SECRET` hoặc `GOOGLE_REDIRECT_URI` | API khởi động | API dừng với lỗi cấu hình, như `assertSessionSecret` |
| AC-21 | Một giá trị `google_pending` hoặc `google_flow` hợp lệ | Ai đó đặt giá trị đó vào cookie `session` và gọi `GET /api/auth/me` | 401 |
| AC-22 | An có `googleSub` "g-222" | An liên kết Google với `sub` "g-333" | 302 về `/?google_error=taken`. `googleSub` của An vẫn là "g-222" |
| AC-23 | Hai request liên kết cùng `sub` "g-444" từ hai tài khoản gửi cùng lúc | Server xử lý cả hai | Đúng một tài khoản có `sub` đó. Request kia nhận `google_error=taken` |
| AC-24 | Hai lần "Hoàn tất đăng ký" khác `sub`, cùng số `0901112233`, gửi cùng lúc | Server xử lý cả hai | Đúng 1 request nhận 201. Request kia nhận 409 |
| AC-25 | Lan có cookie `google_pending` | Lan xin mã cho `0901112233` | 200. `OtpSender.send` nhận `0901112233`, một mã 6 chữ số và `sms`. Bảng `PhoneOtp` có `codeHash`, không có mã |
| AC-26 | Lan có mã đúng `123456` | Lan gửi "Hoàn tất đăng ký" với `654321` | 400 "Mã không đúng". Không có tài khoản mới. `attempts` = 1 |
| AC-27 | Lan đã nhập sai 4 lần | Lan nhập sai lần thứ 5, rồi nhập mã đúng | Lần 5 trả 400 và hủy mã. Lần nhập mã đúng sau đó trả 400 "Mã đã hết hạn. Hãy xin mã mới" |
| AC-28 | Mã được tạo lúc 10:00:00 | Lan gửi mã đúng lúc 10:05:01 | 400 "Mã đã hết hạn. Hãy xin mã mới" |
| AC-29 | Lan xin mã lúc 10:00:00 | Lan xin lại lúc 10:00:30, rồi lúc 10:01:01 | Lần 10:00:30 trả 429. Lần 10:01:01 trả 200, và mã cũ không còn dùng được |
| AC-30 | Số `0901112233` đã nhận 5 mã trong giờ này | Ai đó xin mã thứ 6 cho số đó | 429. `OtpSender.send` không được gọi |
| AC-31 | Hai request "Hoàn tất đăng ký" cùng `sub`, cùng mã đúng, gửi cùng lúc | Server xử lý cả hai | Đúng 1 request nhận 201 |
| AC-32 | Số `0901234567` đã có tài khoản của An | Người có cookie `google_pending` xin mã cho số đó | 409. `OtpSender.send` không được gọi |
| AC-33 | `OtpSender.send` ném lỗi | Lan xin mã | 503 "Không gửi được mã. Thử lại sau". `PhoneOtp` không có mã mới cho số đó |
| AC-34 | `NODE_ENV` = `production` và `OTP_PROVIDER` = `dev` | API khởi động | API dừng với lỗi cấu hình |
| AC-35 | Lan không có cookie `google_pending` | Lan xin mã | 400. `OtpSender.send` không được gọi |

## Contract (nháp)

| Endpoint | Change | Request | Response and errors |
|---|---|---|---|
| `GET /api/auth/providers` | new | — | 200 `{ google: boolean }` |
| `GET /api/auth/google/start` | new | — | 302 tới Google · 404 khi chưa cấu hình |
| `POST /api/auth/google/link-start` | new | `password`, cookie `session` | 200 `{ url }` tới Google · 401 |
| `GET /api/auth/google/callback` | new | `code`, `state` hoặc `error` | 302 về `/` (R1, R5), `/?google=complete` (R2), hoặc `/?google_error=<mã>` |
| `GET /api/auth/google/pending` | new | cookie `google_pending` | 200 `{ name, email }` · 404 |
| `POST /api/auth/google/otp` | new | `phone`, cookie `google_pending` | 200 `{ resendAfter: 60 }` · 400 · 409 · 429 · 503 |
| `POST /api/auth/google/complete` | new | `name`, `phone`, `code`, `consent` | 201 `{ id, name, role }` và cookie `session` · 400 · 409 |
| `POST /api/auth/google/unlink` | new | cookie `session` | 200 · 400 |

## Data (nháp)

| Table | Change | Migration step |
|---|---|---|
| `User` | mới: `googleSub` varchar(255), unique, null được. `email` varchar(254), null được | expand |
| `User` | `passwordHash` thành null được, cho tài khoản chỉ có Google. Đăng nhập bằng mật khẩu với `passwordHash` = null trả 401 như sai mật khẩu | expand |
| `User` | mới: `phoneVerifiedAt` timestamptz, null được. Tài khoản cũ giữ null | expand |
| `PhoneOtp` | mới: `phone` varchar(15), `purpose` varchar(30), `codeHash` char(64), `attempts` int, `sentAt`, `expiresAt` timestamptz. Khóa chính (`phone`, `purpose`). Job dọn mã hết hạn mỗi giờ | expand |
| `DevOtpOutbox` | mới, chỉ dùng khi `OTP_PROVIDER` = `dev`: `phone`, `code`, `createdAt` | expand |

Bản ghi quyết định: một ADR mới, vì thêm nhà cung cấp danh tính và cho mật khẩu null là quyết định khó đảo ngược. Intake, mục Data, phải thêm email và Google `sub` vào dữ liệu tài khoản.

## Môi trường và secret

Không file nào trong repo chứa giá trị của các biến này. `apps/api/.env.example` chỉ có tên biến, không có giá trị.

| Tên | Loại | Ở đâu | Giá trị |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | biến môi trường | Cloud Run, `apps/api/.env` khi chạy máy | Client ID của OAuth client "MONSPORT web" |
| `GOOGLE_CLIENT_SECRET` | secret | Secret Manager, secret `monsport-google-client-secret`. Cloud Run đọc bằng `--update-secrets`. Khi chạy máy: `apps/api/.env` | Client secret của client đó. Server gọi `trim()` khi đọc |
| `GOOGLE_REDIRECT_URI` | biến môi trường | Cloud Run, `apps/api/.env` | `https://monsport-774323404592.asia-southeast1.run.app/api/auth/google/callback` trên cloud. `http://localhost:5173/api/auth/google/callback` khi chạy máy |
| `SESSION_SECRET` | secret, đã có | Secret Manager `monsport-session-secret` | Ký thêm cookie `google_flow` và `google_pending`, và băm mã OTP (O2) |
| `OTP_PROVIDER` | biến môi trường | Cloud Run, `apps/api/.env` | `esms` trên cloud, `dev` khi chạy máy |
| `ESMS_API_KEY`, `ESMS_SECRET_KEY` | secret | Secret Manager `monsport-esms-api-key`, `monsport-esms-secret-key` | Từ tài khoản của nhà cung cấp tin nhắn |
| `ESMS_BRANDNAME` | biến môi trường | Cloud Run | Brandname đã đăng ký với nhà mạng |

## Việc bạn làm với nhà cung cấp tin nhắn

Agent không được tạo tài khoản. Bạn làm các bước này. Tên biến ở trên giả định bạn chọn eSMS. Với nhà cung cấp khác, agent đổi adapter và tên biến.

1. Chọn nhà cung cấp (Open questions). Tạo tài khoản và nạp tiền.
2. Đăng ký brandname SMS, ví dụ "MONSPORT", cho tin OTP. Bước này cần giấy tờ và có thể mất vài ngày.
3. Tạo hai secret trong Secret Manager như bước 8 ở mục dưới, và cấp quyền như bước 9.
4. Báo agent tên brandname. Brandname không phải bí mật.

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
10. Gửi client ID cho agent. Client ID không phải bí mật. Agent chạy `gcloud run services update` để thêm `GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI` và secret.
11. Khi mọi thứ chạy, quay lại "Audience" và bấm "Publish app".

## Build order (khi brief được chấp nhận)

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | ADR, intake và tài liệu yêu cầu, hợp đồng và schema | `docs/adr/`, `docs/requirements/` (intake mục Data, data dictionary, business rules cho R1 tới R8), `packages/shared/src/` (gồm thông báo bảo vệ dữ liệu cá nhân), `apps/api/prisma/` | Migration trên Postgres thật |
| 2 | Server: dịch vụ OTP (O1 tới O8, `OtpSender`, adapter `dev` và `esms`), luồng OIDC, quy tắc R1 tới R7, khóa ký riêng cho mỗi cookie (gồm `session.ts`), kiểm cấu hình lúc khởi động | `apps/api/src/modules/otp/`, `apps/api/src/modules/auth/`, `apps/api/src/app.module.ts`, `apps/api/src/main.ts`, `apps/api/.env.example`, `apps/api/package.json`, `pnpm-lock.yaml`, `docs/deploy-gcp.md` | AC-1 tới AC-35, với Google và `OtpSender` giả lập |
| 3 | Màn hình: nút Google, form "Hoàn tất đăng ký" có ô số điện thoại, nút "Gửi mã", ô mã và đếm ngược 60 giây, liên kết và gỡ liên kết, câu báo cho mỗi `google_error` | `apps/web/src/features/auth/`, `apps/web/src/app/`, `.agents/skills/verify-flow/` | AC-1, AC-19, AC-26 trên màn hình |
| 4 | Bật trên live, sau các mục "Việc bạn làm" | Cloud Run (biến và secret), `docs/deploy-gcp.md`, `PROGRESS.md` | Bạn đăng ký bằng Google trên điện thoại thật và nhận SMS |

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Chiếm tài khoản qua email hoặc số điện thoại trùng | Quy tắc liên kết | Chỉ `sub` nhận diện. Không tự liên kết (R4, R7). Review bằng phiên mới |
| Phiên bị đánh cắp dùng để gắn Google của kẻ khác | R5 | Liên kết đòi nhập lại mật khẩu. Callback kiểm `userId` trong cookie. AC-5, AC-6. `link-start` dùng cùng giới hạn đăng nhập sai với `POST /api/auth/login` (`PROGRESS.md`, Next step 1) |
| Giả cookie `session` bằng một cookie Google | Ký cookie | Mỗi cookie một khóa riêng, payload có `typ`. AC-21. Review bằng phiên mới |
| CSRF và replay ở callback | `state`, `nonce`, PKCE | Cookie `google_flow` ký, sống 10 phút, xóa sau một lần dùng. AC-9, AC-10 |
| Đồng thời: hai lần hoàn tất hoặc hai lần liên kết | R3, R5 | Unique index quyết định. `P2002` thành 409. AC-8 |
| Lộ `client_secret` | Secret Manager | Chỉ Cloud Run đọc secret. Không log, không commit |
| `run.app` không phải tên miền của bạn | Branding, Authorized domains | Google có thể không cho publish khi chưa xác minh tên miền. Khi đó cần một tên miền riêng trỏ tới Cloud Run |
| Schema: `passwordHash` null được | PR 1 | Đăng nhập mật khẩu kiểm null trước argon2. AC-15. Review bằng phiên mới |
| Dữ liệu cá nhân: lưu thêm email và `sub` | `User.email`, `User.googleSub` | Chỉ lưu email khi `email_verified`. Xóa cả hai khi xóa tài khoản (R8). Thông báo bảo vệ dữ liệu cá nhân thêm email, Google, và việc gửi số điện thoại cho nhà cung cấp tin nhắn |
| Đoán mã OTP | O4, O5 | 5 lần sai mỗi mã, 5 mã mỗi số mỗi giờ: tối đa 25 lần đoán trong 10^6 mã mỗi giờ. AC-27, AC-30 |
| Tốn tiền SMS do bị spam gửi mã | O3, O5, R4 | Chỉ người có cookie `google_pending` hợp lệ xin được mã (AC-35). Giới hạn theo số và theo IP. Số đã có tài khoản không nhận tin (AC-32) |
| Lộ mã qua log | O2, adapter `dev` | Chỉ lưu bản băm. Adapter `dev` ghi vào bảng, không ra console, và không chạy ở production (AC-34) |

## Assumptions

- Mỗi tài khoản có nhiều nhất một tài khoản Google. Một tài khoản Google thuộc nhiều nhất một tài khoản MONSPORT.
- Tài khoản tạo bằng Google luôn có vai trò `USER`.
- Tài khoản đã có trước F-004 giữ `phoneVerifiedAt` = null, và vẫn dùng được như cũ. Bạn chỉ yêu cầu xác minh cho tài khoản Google.
- Tài khoản Google đã xác minh số lúc đăng ký. Lần đăng nhập sau (R1) không hỏi OTP nữa.
- Liên kết Google vào tài khoản có mật khẩu (R5) không hỏi OTP, vì người dùng đã nhập lại mật khẩu.
- Số phút, số lần sai và giới hạn gửi ở O1 tới O5 là giá trị agent chọn. Bạn đổi được.
- Tài khoản chỉ có Google không gỡ liên kết được, cho tới khi có luồng đặt mật khẩu.
- Thư viện: `openid-client` (dependency mới), vì nó làm discovery, PKCE và kiểm `id_token`. Coder đọc tài liệu qua Context7 trước khi code.
- Cookie `google_flow` dùng `SameSite=Lax`, vì Google gọi lại bằng một lần chuyển hướng GET từ site khác.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Chọn nhà cung cấp tin nhắn: eSMS (SMS và Zalo ZNS cùng một tài khoản), một nhà cung cấp Việt Nam khác, hay Firebase Phone Auth của Google. Giá mỗi tin bao nhiêu (intake Open item 5) | Bạn | Có, chặn PR 4. Không chặn PR 1 tới 3 |
| Dùng tên miền riêng cho MONSPORT không? | Bạn | Có, chặn bước "Publish app" nếu Google đòi xác minh tên miền |
| Người dùng chỉ có Google có cần đặt mật khẩu không? | Bạn | Không |

## Nguồn

- Google, OpenID Connect: https://developers.google.com/identity/openid-connect/openid-connect
- Google Cloud, quản lý OAuth client: https://support.google.com/cloud/answer/15549257
- Google Cloud, Audience và test users: https://support.google.com/cloud/answer/15549945
- Zalo, Social API (`graph.zalo.me/v2.0/me` không có số điện thoại): https://docs.zaloplatforms.com/docs/Social
- eSMS, gửi đa kênh Zalo rồi SMS: https://developers.esms.vn/esms-api/ham-gui-tin-nhan-zns/ham-gui-tin-nhan-multichanel
- Google Identity Platform, giá SMS theo nước: https://cloud.google.com/identity-platform/pricing

## Done when

- Reviewer duyệt brief. Bạn trả lời các câu hỏi chặn PR 4.
- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
