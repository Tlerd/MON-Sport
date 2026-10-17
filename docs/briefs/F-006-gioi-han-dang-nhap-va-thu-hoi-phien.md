---
style: ste80
lang: vi
---

# F-006: Giới hạn số lần thử đăng nhập và đăng ký, chặn mật khẩu dễ đoán, thu hồi phiên khi mở khóa

Status: draft
Source: `PROGRESS.md`, Next step 1 và 2 (ngày 17/10/2026). Intake, mục Quality ("Bảo mật") và mục Phân quyền (admin khóa tài khoản). `docs/requirements/business-rules.md` BR-24, BR-28. Brief F-003, mục "Risks and reviews" và "Assumptions" (giới hạn số lần thử và danh sách mật khẩu phổ biến quay lại trước ngày chạy thử). Brief F-004, rủi ro R5 (`link-start` dùng cùng giới hạn với đăng nhập).

## Goal

Hệ thống chặn người đoán mật khẩu và người đăng ký hàng loạt, và admin mở khóa một tài khoản mà không làm phiên cũ sống lại. Kiểm tra bằng cách đăng nhập sai 11 lần vào một số: lần thứ 11 nhận 429 mà server không băm mật khẩu.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| CAPTCHA | Cần dịch vụ bên ngoài và làm khó người dùng điện thoại. Mức chạy thử là 300 người dùng | Khi log có nhiều lần bị chặn từ nhiều IP |
| So mật khẩu với kho mật khẩu đã lộ (ví dụ Have I Been Pwned) | Gửi một phần bản băm ra dịch vụ bên ngoài. Cần quyết định về dữ liệu cá nhân | Khi bạn quyết định dùng dịch vụ đó |
| Thu hồi phiên khi đăng xuất, và danh sách phiên đang mở | Phiên là cookie HMAC không lưu trong DB. Cần bảng phiên | Brief đổi mật khẩu (BR-26 và các luồng xác minh) |
| Thu hồi phiên khi đổi mật khẩu | Chưa có luồng đổi mật khẩu | Brief đổi mật khẩu. Brief đó đặt `sessionsValidFrom` như ở đây |
| Giới hạn route `link-start` của Google | F-004 chưa được chấp nhận (open decision 7). Chưa có route | F-004. Route gọi `consumeLogin` của slice này, với số của người đang đăng nhập |
| Giới hạn tổng số lần băm trên toàn hệ thống | `@node-rs/argon2` chạy mỗi lần băm trong thread pool của libuv, mặc định 4 thread. Một instance băm tối đa 4 mật khẩu cùng lúc, khoảng 76 MB | Khi tải thật vượt mức chạy thử |
| Màn hình admin xem bộ đếm hoặc mở chặn | Bộ đếm tự hết hạn sau 15 phút hoặc 1 giờ | Khi có yêu cầu |

## Acceptance criteria

Dữ liệu chung: mỗi test tạo lại dữ liệu này trước khi chạy, và xóa bảng `AuthThrottle`. Test đổi giờ bằng `Clock` có thể đổi, như `bookings.e2e.test.ts`. Test đếm số lần gọi `hash` và `verify` qua provider `Passwords`. Admin (`0900000000`). Người dùng "An" (`0901234567`, mật khẩu `test-password`). Bây giờ là 17/10/2026 10:00 `Asia/Ho_Chi_Minh`. Request của test đặt IP bằng header `X-Forwarded-For`. Request không có header này có IP `127.0.0.1`.

Câu 429: "Bạn đã thử quá nhiều lần. Hãy thử lại sau ít phút". Câu mật khẩu dễ đoán: "Mật khẩu này quá dễ đoán. Hãy chọn mật khẩu khác".

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | An chưa đăng nhập sai lần nào | Lần lượt 10 request đăng nhập số `0901234567` với mật khẩu `sai-mat-khau`, mỗi request từ một IP khác (`203.0.113.1` tới `203.0.113.10`). Rồi request thứ 11 từ `203.0.113.11` với đúng mật khẩu | 10 request đầu nhận 401. Request thứ 11 nhận 429 với câu 429 và header `Retry-After` = `900`. Không có cookie `session`. `verify` chạy đúng 10 lần |
| AC-2 | Như AC-1, sau request thứ 11 | Bây giờ là 10:15. An đăng nhập với đúng mật khẩu | 200 và cookie `session` |
| AC-3 | An chưa đăng nhập sai lần nào | An đăng nhập sai 9 lần, rồi đúng 1 lần, rồi sai 10 lần nữa, mỗi lần từ một IP khác | Mọi lần sai nhận 401. Lần đúng nhận 200. Đăng nhập đúng xóa bộ đếm của số đó |
| AC-4 | IP `203.0.113.7` chưa gửi request nào | IP đó gửi 30 request đăng nhập, mỗi request một số chưa có tài khoản (`0911000000` tới `0911000029`). Rồi IP đó gửi đăng nhập của An với đúng mật khẩu. Rồi IP `203.0.113.8` gửi đăng nhập của An với đúng mật khẩu | 30 request đầu nhận 401. Request của An từ `203.0.113.7` nhận 429. Request từ `203.0.113.8` nhận 200 |
| AC-5 | An chưa đăng nhập sai lần nào | 20 request đăng nhập số `0901234567` với mật khẩu `sai-mat-khau` gửi cùng lúc, mỗi request từ một IP khác | Đúng 10 request nhận 401. Đúng 10 request nhận 429 |
| AC-6 | IP `203.0.113.9` chưa đăng ký lần nào | IP đó gửi 20 request đăng ký, số `0902000000` tới `0902000019`, mật khẩu `san-cau-long-2026`. Rồi IP đó gửi request thứ 21 với số `0902000020`. Rồi IP `203.0.113.10` đăng ký số `0902000020` | 20 request đầu nhận 201. Request thứ 21 nhận 429 với header `Retry-After` = `3600`, và không tạo tài khoản `0902000020`. `hash` chạy đúng 20 lần trước request từ `203.0.113.10`. Request từ `203.0.113.10` nhận 201 |
| AC-7 | IP `203.0.113.7` đã gửi 30 request đăng nhập trong 15 phút qua | Một request đăng nhập của An với đúng mật khẩu có header `X-Forwarded-For: 198.51.100.1, 203.0.113.7` | 429. Server chỉ tin địa chỉ cuối cùng trong header, vì Cloud Run thêm IP thật vào cuối |
| AC-8 | IP `2001:db8:1:2::a` đã gửi 30 request đăng nhập trong 15 phút qua | IP `2001:db8:1:2::b` gửi đăng nhập của An với đúng mật khẩu. Rồi IP `2001:db8:1:3::a` gửi request đó | Request từ `2001:db8:1:2::b` nhận 429, vì hai địa chỉ cùng khối `/64`. Request từ `2001:db8:1:3::a` nhận 200 |
| AC-9 | Như AC-1, sau request thứ 11 | Đọc mọi dòng của bảng `AuthThrottle` | Không cột nào chứa `0901234567` hoặc `203.0.113.1` |
| AC-10 | Số `0901112233` chưa có tài khoản | Người chưa đăng nhập đăng ký số `0901112233` với lần lượt các mật khẩu `matkhau123`, `PASSWORD123`, `12345678`, `aaaaaaaaaa`, `0901112233x` | Mỗi request nhận 400 với câu mật khẩu dễ đoán. Không có tài khoản mới |
| AC-11 | Admin đã đăng nhập | Admin tạo chủ sân số `0912345681` với mật khẩu `matkhau123`, rồi với mật khẩu `san-cau-long-2026` | Lần đầu nhận 400 với câu mật khẩu dễ đoán. Lần sau nhận 201 |
| AC-12 | Tài khoản "Bình" (`0912345678`) có mật khẩu `matkhau123` từ trước F-006 | Bình đăng nhập bằng `matkhau123` | 200. Danh sách chỉ áp dụng cho mật khẩu mới |
| AC-13 | An đăng nhập lúc 09:00 và có cookie `session` | Admin khóa An lúc 10:00 và mở khóa lúc 10:05. Rồi An gọi `GET /api/auth/me` bằng cookie cũ lúc 10:06. Rồi An đăng nhập lúc 10:06 và gọi `GET /api/auth/me` bằng cookie mới | Mở khóa trả 200. `User.sessionsValidFrom` của An = 17/10/2026 10:05. Cookie cũ nhận 401. Cookie mới nhận 200. Một cookie tạo đúng lúc 10:05 nhận 200. Một cookie tạo lúc 10:04:59.999 nhận 401 |
| AC-14 | An không bị khóa, `sessionsValidFrom` = null, An có cookie từ 09:00 | Admin mở khóa An lúc 10:05. Rồi An gọi `GET /api/auth/me` bằng cookie cũ | Mở khóa trả 200. `sessionsValidFrom` vẫn null. Cookie cũ nhận 200 |
| AC-15 | Migration của F-006 đã chạy | Một lệnh SQL chèn `User` không có `sessionsValidFrom` | Dòng mới có `sessionsValidFrom` = null |
| AC-16 | Người chưa đăng nhập mở web | API trả 429 với câu 429 cho đăng nhập | Form đăng nhập hiện câu 429 |
| AC-17 | IP `203.0.113.7` đã gửi 30 request đăng nhập trong 15 phút qua | IP đó gửi đăng nhập của An với mật khẩu `sai-mat-khau` | 429. Bảng `AuthThrottle` không có dòng `login-phone` của số `0901234567`. Một IP đã bị chặn không làm tăng bộ đếm của số điện thoại |

## Contract

Zod trong `packages/shared/src/` là nguồn duy nhất.

| Endpoint or schema | Change | Request | Response and errors |
|---|---|---|---|
| `Messages.tooManyAttempts` | new | Câu 429 | — |
| `Messages.weakPassword` | new | Câu mật khẩu dễ đoán | — |
| `isWeakPassword(password, phone)` | new | Mật khẩu và số điện thoại | `true` khi mật khẩu (viết thường) nằm trong `COMMON_PASSWORDS`, chứa số điện thoại, hoặc chỉ có một ký tự lặp lại |
| `COMMON_PASSWORDS` | new | Danh sách mật khẩu phổ biến, 8 ký tự trở lên, viết thường. Có mật khẩu tiếng Việt phổ biến (ví dụ `matkhau123`, `anhyeuem`) và tên dịch vụ `monsport` | — |
| `RegisterRequest` | changed | Thêm kiểm tra: `isWeakPassword(password, phone)` sai thì báo câu mật khẩu dễ đoán ở trường `password` | — |
| `CreateOwnerRequest` | changed | Như `RegisterRequest` | — |
| `LoginRequest` | unchanged | Không kiểm danh sách, vì mật khẩu cũ vẫn dùng được | — |
| `POST /api/auth/login` | changed | — | Thêm 429 với câu 429 và header `Retry-After` (giây tới cuối cửa sổ) |
| `POST /api/auth/register` | changed | — | Thêm 400 với câu mật khẩu dễ đoán. Thêm 429 với câu 429 và header `Retry-After` |
| `POST /api/admin/owners` | changed | — | Thêm 400 với câu mật khẩu dễ đoán |
| `POST /api/admin/users/:id/unlock` | changed | — | Khi tài khoản đang khóa: đặt `lockedAt` = null và `sessionsValidFrom` = bây giờ trong một lệnh ghi. Khi tài khoản không khóa: không đổi gì. Response không đổi |
| `GET /api/auth/me` và mọi route có `SessionGuard` | changed | — | 401 khi cookie được tạo trước `sessionsValidFrom` của tài khoản |

### Giới hạn

| Bộ đếm | Đếm gì | Giới hạn | Cửa sổ | Xóa khi |
|---|---|---|---|---|
| `login-phone` | Mỗi request đăng nhập hợp lệ (qua Zod) với số đó | 10 | 15 phút | Đăng nhập đúng mật khẩu |
| `login-ip` | Mỗi request đăng nhập hợp lệ từ IP đó | 30 | 15 phút | Hết cửa sổ |
| `register-ip` | Mỗi request đăng ký hợp lệ từ IP đó | 20 | 1 giờ | Hết cửa sổ |

Request thứ (giới hạn + 1) trong cửa sổ nhận 429. Server tăng bộ đếm trước khi băm hoặc kiểm mật khẩu. Vì vậy request bị chặn không chạy argon2.

Thứ tự ở `POST /api/auth/login`:

1. Kiểm Zod.
2. Tăng `login-ip`. Khi vượt giới hạn, trả 429 ngay. Không tăng `login-phone` (AC-17).
3. Tăng `login-phone`. Khi vượt giới hạn, trả 429.
4. Kiểm mật khẩu. Khi đúng, xóa dòng `login-phone` của số đó bằng một lệnh `DELETE` theo khóa.

Thứ tự ở `POST /api/auth/register`: kiểm Zod (gồm mật khẩu dễ đoán), tăng `register-ip`, băm, tạo tài khoản.

`Retry-After` là số giây tới cuối cửa sổ của bộ đếm đã chặn request: `ceil((windowStart + cửa sổ − bây giờ) / 1000)`.

Mỗi bộ đếm là một cửa sổ cố định. Lần tăng đầu tiên mở cửa sổ. Cửa sổ hết khi bây giờ ≥ `windowStart` + cửa sổ. Bộ đếm lấy giờ từ `Clock.now()` và gửi giờ đó vào SQL như một tham số. SQL không dùng `now()` của Postgres.

Một lệnh SQL vừa tăng bộ đếm vừa mở lại cửa sổ đã hết. Vì vậy hai instance Cloud Run dùng chung một bộ đếm, và không đếm sót khi chạy đồng thời:

```sql
INSERT INTO "AuthThrottle" (key, count, "windowStart") VALUES ($key, 1, $now)
ON CONFLICT (key) DO UPDATE SET
  count = CASE WHEN "AuthThrottle"."windowStart" <= $now - $window THEN 1 ELSE LEAST("AuthThrottle".count + 1, 1000000) END,
  "windowStart" = CASE WHEN "AuthThrottle"."windowStart" <= $now - $window THEN $now ELSE "AuthThrottle"."windowStart" END
RETURNING count, "windowStart"
```

`hash` và `verify` của argon2 nằm sau một provider `Passwords` trong `apps/api/src/modules/auth/`. Test đếm số lần gọi qua provider này.

IP là `req.ip` của Express với `trust proxy` = 1: địa chỉ cuối cùng của `X-Forwarded-For`. Địa chỉ IPv4 dạng `::ffff:a.b.c.d` đổi thành `a.b.c.d`. Địa chỉ IPv6 dùng khối `/64`.

Khóa của bộ đếm là `<tên bộ đếm>:<HMAC-SHA256 của số hoặc IP>`. Khóa bí mật của HMAC là `HMAC-SHA256(SESSION_SECRET, "auth-throttle")`, khác với khóa ký cookie. Bảng không lưu số điện thoại hoặc IP ở dạng đọc được.

### Phiên

Cookie giữ thời điểm hết hạn. Thời điểm tạo cookie = hết hạn − 30 ngày. `readSession` trả `{ userId, issuedAt }`. Guard từ chối cookie khi thời điểm tạo < `sessionsValidFrom`. Cookie tạo đúng lúc `sessionsValidFrom` vẫn dùng được. Định dạng cookie không đổi, nên các phiên đang có vẫn dùng được sau khi deploy. Đổi `SESSION_MS` sau này thì phải đổi định dạng cookie, vì thời điểm tạo tính từ `SESSION_MS`.

## Data

| Table | Change | Migration step |
|---|---|---|
| `User` | mới: `sessionsValidFrom` timestamptz(3), có thể null. Server từ chối cookie tạo trước thời điểm này. Null là không giới hạn | expand. Cột null được, nên phiên đang có vẫn dùng được |
| `AuthThrottle` | bảng mới: `key` varchar(100) khóa chính, `count` int, `windowStart` timestamptz(3). Index trên `windowStart` | expand. Bảng mới, không có dữ liệu cũ |
| `docs/requirements/data-dictionary.md` | thêm `User.sessionsValidFrom`, thêm `AuthThrottle` và các trường | — |
| `docs/requirements/business-rules.md` | thêm BR-30: hệ thống giới hạn số lần thử đăng nhập và đăng ký theo bảng "Giới hạn". Thêm BR-31: mật khẩu mới không được dễ đoán. Thêm BR-32: mở khóa tài khoản làm mất hiệu lực các phiên tạo trước lúc mở khóa | — |

Khi một bộ đếm mở cửa sổ mới, server xóa các dòng có `windowStart` cũ hơn 1 ngày. Vì vậy một dòng cũ hơn 1 ngày bị xóa ở lần ghi bộ đếm kế tiếp. Data dictionary ghi quy tắc này.

## Build order

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Hợp đồng, schema và thu hồi phiên: `Messages`, `COMMON_PASSWORDS`, `isWeakPassword`, kiểm tra trong `RegisterRequest` và `CreateOwnerRequest`, cột `sessionsValidFrom`, bảng `AuthThrottle`, guard và route mở khóa, BR-30 tới BR-32, data dictionary. Đổi mật khẩu `matkhau123` trong test cũ của API và trong `packages/shared/src/account.test.ts` thành `san-cau-long-2026`. Test web gọi `fetch` giả và không kiểm Zod, nên không đổi. `PROGRESS.md`: Next step 2 xong | `packages/shared/src/`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/` (thư mục mới), `apps/api/prisma/migration.test.ts`, `apps/api/src/modules/auth/`, `apps/api/src/modules/admin/accounts.controller.ts`, `apps/api/src/modules/admin/accounts.e2e.test.ts`, `docs/requirements/data-dictionary.md`, `docs/requirements/business-rules.md`, `PROGRESS.md`, file brief này | Test Zod cho AC-10. AC-11 tới AC-15. `session.test.ts` cho `readSession` |
| 2 | Giới hạn số lần thử: provider `Passwords`, service bộ đếm, đăng nhập, đăng ký, `trust proxy`, xóa `AuthThrottle` trong các test e2e, câu 429 trên web, `PROGRESS.md`. Sau deploy: kiểm IP trên dịch vụ thật (xem dưới bảng) | `apps/api/src/modules/auth/`, `apps/api/src/setup-app.ts`, các file `*.e2e.test.ts` trong `apps/api/src/modules/`, `apps/web/src/features/auth/`, `PROGRESS.md` | AC-1 tới AC-9, AC-16, AC-17 |

Sau khi PR 2 deploy, kiểm IP trên dịch vụ thật. Bước này không tạo tài khoản:

1. Gửi 30 request đăng nhập tới dịch vụ thật, số `0911999999` (chưa có tài khoản), mỗi request một header `X-Forwarded-For` giả khác nhau.
2. Gửi request thứ 31 với một header giả mới. Kết quả phải là 429. Header giả không đổi được IP mà server đếm.
3. Ghi kết quả vào pull request. Nếu request thứ 31 nhận 401, mở một fix trước mọi việc khác.

## Edit boundaries

- May edit: các path trong bảng Build order, `pnpm-lock.yaml` khi cần.
- Leave unchanged without approval: `AGENTS.md`, `.dependency-cruiser.cjs`, `scripts/check.mjs`, `.github/workflows/`, `apps/api/src/modules/bookings/` (trừ file test e2e), `apps/api/src/modules/database/`, `apps/api/src/modules/health/` (trừ file test e2e), migration đã merge, `apps/api/prisma/seed.ts`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Schema: cột mới trên `User`, bảng mới `AuthThrottle` | PR 1 | Cột null được. Bảng mới. AC-15 chạy trên Postgres thật. Review bằng phiên mới |
| Đồng thời: hai instance và nhiều request cùng lúc tăng một bộ đếm | PR 2 | Một lệnh upsert nguyên tử trong Postgres. AC-5 gửi 20 request cùng lúc. Review bằng phiên mới |
| Bảo mật: giả IP bằng `X-Forwarded-For` | PR 2 | `trust proxy` = 1 chỉ tin địa chỉ cuối cùng, do Cloud Run thêm. AC-7. Kiểm trên dịch vụ thật sau deploy. Review bằng phiên mới |
| Bảo mật: có proxy đứng trước Cloud Run, nên mọi người dùng chung một IP | `trust proxy` | Hiện không có proxy: trình duyệt gọi thẳng URL `run.app`. Thêm load balancer, CDN hoặc Firebase Hosting thì phải đổi `trust proxy` |
| Bảo mật: kẻ xấu cố ý đăng nhập sai để chặn số của người khác trong 15 phút | `login-phone` | Rủi ro đã chấp nhận ở mức chạy thử. Chặn chỉ kéo dài 15 phút. Ghi trong Assumptions |
| Bảo mật: một IP chặn hàng loạt số điện thoại | `login-ip`, `login-phone` | IP đã bị chặn không tăng `login-phone` (AC-17). Một khối `/64` chặn được tối đa 3 số mỗi 15 phút. Kẻ có nhiều khối `/64` (ví dụ một `/48`) vẫn chặn được nhiều số. Rủi ro đã chấp nhận ở mức chạy thử. CAPTCHA quay lại khi việc này xảy ra |
| Bảo mật: kẻ xấu đổi IP liên tục (nhiều IPv6) | `login-ip`, `register-ip` | IPv6 tính theo khối `/64` (AC-8). `login-phone` vẫn giới hạn số lần đoán mỗi số. Thread pool giới hạn số lần băm cùng lúc |
| Dữ liệu cá nhân: bảng bộ đếm giữ số điện thoại và IP | `AuthThrottle` | Khóa là HMAC, không lưu số và IP đọc được (AC-9). Dòng cũ hơn 1 ngày bị xóa. Review bằng phiên mới |
| Người dùng thật bị chặn vì dùng chung IP (Wi-Fi của sân, NAT của nhà mạng) | `login-ip`, `register-ip` | Giới hạn IP cao hơn giới hạn số: 30 lần đăng nhập mỗi 15 phút, 20 lần đăng ký mỗi giờ |
| Phiên bị đánh cắp sống lại sau khi mở khóa | `SessionGuard` | `sessionsValidFrom` (AC-13). Review bằng phiên mới |
| Đồng hồ của hai instance lệch nhau vài mili giây | `sessionsValidFrom` | Một cookie tạo trên instance khác ngay sau lúc mở khóa có thể bị từ chối. Người dùng đăng nhập lại. Rủi ro đã chấp nhận |
| Đăng xuất mọi người khi deploy | Migration, guard | Cột null được, và định dạng cookie không đổi (AC-14) |

## Assumptions

- Giới hạn trong bảng "Giới hạn" là quyết định của slice này. Intake không ghi con số. NIST SP 800-63B cho phép tối đa 100 lần sai liên tiếp cho một tài khoản. Slice này chặt hơn: 10 lần mỗi 15 phút.
- Bộ đếm `login-phone` đếm mọi lần thử, và đăng nhập đúng xóa nó. Vì vậy nó đếm số lần sai liên tiếp, và 20 request cùng lúc không vượt qua được giới hạn (AC-5).
- Kẻ xấu có thể chặn đăng nhập của một số trong 15 phút. Đây là rủi ro đã chấp nhận ở mức chạy thử. Người dùng bị chặn chờ 15 phút.
- Cloud Run thêm đúng một địa chỉ, là IP của người gửi, vào cuối `X-Forwarded-For`. Tài liệu của Google chưa ghi rõ điều này cho Cloud Run. Vì vậy PR 2 kiểm nó trên dịch vụ thật sau deploy. Server dùng `trust proxy` = 1. Nếu sau này có proxy đứng trước Cloud Run, số này phải đổi.
- Bộ đếm lưu trong Postgres, không dùng Redis. Cloud Run chạy tối đa 2 instance, nên bộ đếm phải dùng chung. Postgres đã có. Redis tốn thêm tiền và vượt ngân sách 500.000đ mỗi tháng.
- Slice này tự soạn danh sách mật khẩu phổ biến, khoảng 200 mật khẩu. Danh sách có các mật khẩu phổ biến nhất trên thế giới và ở Việt Nam, 8 ký tự trở lên. Đây không phải kho mật khẩu đã lộ.
- `matkhau123` là mật khẩu phổ biến ở Việt Nam, nên danh sách chặn nó. Test của F-003 dùng `matkhau123` cho tài khoản mới. PR 1 đổi các test đó sang `san-cau-long-2026`. Brief F-003 giữ nguyên, vì nó ghi lại lúc giao.
- Mở khóa chỉ đặt `sessionsValidFrom` khi tài khoản đang khóa. Bấm "Mở khóa" hai lần không đăng xuất người dùng.
- Khóa tài khoản không đặt `sessionsValidFrom`. Guard đã từ chối mọi phiên của tài khoản đang khóa.
- Đồng hồ của test e2e chỉ đổi khi test đổi nó, nên cửa sổ không tự hết hạn trong lúc test. Mỗi test e2e xóa bảng `AuthThrottle` trước khi chạy, vì các file test dùng chung một DB.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Các con số trong bảng "Giới hạn" có hợp với cách sân dùng Wi-Fi chung không? | Bạn, sau tuần chạy thử đầu | không |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
