---
style: ste80
lang: vi
---

# F-019: Khung app mobile (PWA ở `/app/`)

Status: draft, chờ review
Source: ADR 0006 (Accepted ngày 23/10/2026: "ADR 0006 theo đề xuất"). Intake đổi ngày 23/10/2026: Out of scope, Inputs and outputs, Quality "Thiết bị". `DESIGN.md` mục "Mobile app shell". `docs/design/ke-hoach-app-mobile.md` bước 2, 3 và 7. Bản thử trên nhánh `exp/ui-d-mobile` (commit `e2120b3`).

## Goal

Người dùng mở `https://<service>/app/` trên điện thoại và thấy khung app mobile: thanh trên, thanh tab theo vai trò, và các thanh ẩn hoặc hiện khi cuộn như bảng của `DESIGN.md`. Kiểm tra bằng `verify-flow --app mobile` ở 390px.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Nội dung các tab: Đặt sân, Phòng chờ, Lịch của tôi, Thông báo, màn chủ sân | Mỗi nhóm màn là một brief, theo bước 4 tới 6 của kế hoạch | Brief F-020 trở đi |
| Web Push trong app | Cần service worker của app và màn Thông báo | Brief của tab Thông báo |
| App native, phát hành qua store | Intake: ngoài phạm vi | Không có kế hoạch |
| Admin trên app | `DESIGN.md`: admin dùng web | Không có kế hoạch |
| Đổi giao diện web | F-017 đã xong. Brief này chỉ chuyển code dùng chung | Không có kế hoạch |
| Chạy offline | Intake không yêu cầu | Không có kế hoạch |

## Acceptance criteria

Mỗi AC có một test. Tên test bắt đầu bằng nhãn, ví dụ `AC-1`. Test của hook dùng `window.scrollY` giả lập và `requestAnimationFrame` giả lập.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | `packages/client` có `api.ts`, `format.ts`, `push.ts` chuyển từ `apps/web/src/lib/` | Test import `formatVnd` từ `@monsport/client` | `formatVnd(240000)` = `240.000đ`. `apps/web/src/lib/` không còn ba file đó. Mọi test của `apps/web` vẫn qua |
| AC-2 | Một file tạm trong `apps/mobile/src/` import từ `apps/web/src/` | Test chạy `depcruise` trên file đó | Rule `mobile-imports-web` báo lỗi. Rule `web-imports-mobile` và `client-imports-app` cũng có test như vậy |
| AC-3 | Trang ở `scrollY` = 300 | Cuộn xuống tới 309 | `useHideOnScroll` trả `hidden` = `true`: thanh trên và thanh tab ẩn |
| AC-4 | `hidden` = `true` ở `scrollY` = 600 | Cuộn lên tới 591 | `hidden` = `false` |
| AC-5 | `hidden` = `true` | Cuộn lên tới `scrollY` = 40 | `hidden` = `false`, vì 40 < 52 |
| AC-6 | `hidden` = `true`, trang dài 2000px, khung cao 812px | Cuộn tới cuối trang (`scrollY` = 1188) | Thanh tab hiện. Thanh trên giữ nguyên |
| AC-7 | Một sheet đang mở | Cuộn xuống 200px | Thanh trên không đổi. Thanh tab ẩn |
| AC-8 | `prefers-reduced-motion: reduce` | Cuộn xuống 200px | `hidden` = `false`. Các thanh không trượt |
| AC-9 | Khách chưa đăng nhập | Mở `/app/` | Thanh tab có 5 tab theo thứ tự: Đặt sân, Phòng chờ, Lịch của tôi, Thông báo, Tôi |
| AC-10 | Chủ sân Bình đã đăng nhập | Mở `/app/` | Thanh tab có: Yêu cầu, Lịch sân, Doanh thu, Thông báo, Tôi. Tab Yêu cầu hiện số yêu cầu "Chờ xác nhận" từ API |
| AC-11 | Admin đã đăng nhập | Mở `/app/` | App hiện "Dùng web để quản trị" và link tới `/`. Không có thanh tab |
| AC-12 | Khách ở tab Tôi | Đăng nhập bằng `0901234567` và đúng mật khẩu trong sheet đăng nhập | Sheet đóng. App gọi `GET /api/auth/me` và hiện tab của người dùng. Cookie `session` dùng chung với web |
| AC-13 | Một sheet đang mở | Người dùng bấm Escape, hoặc bấm nền tối | Sheet đóng. Focus về nút đã mở sheet |
| AC-14 | Container chạy với `WEB_DIST` và `MOBILE_DIST` | Trình duyệt mở `GET /app/lich-cua-toi` với `Accept: text/html` | 200, `index.html` của `apps/mobile`. `GET /lich-cua-toi` vẫn trả `index.html` của web. `GET /app/assets/<file>.js` trả file JS. `GET /api/health` không đổi |
| AC-15 | Build của `apps/mobile` | Đọc `manifest.webmanifest` | `start_url` = `/app/`, `scope` = `/app/`, `display` = `standalone`, có icon 192px và 512px |
| AC-16 | Không có `MOBILE_DIST` | API khởi động | API chạy như cũ. `GET /app/` trả `index.html` của web, như trước brief này |
| AC-17 | `verify-flow --app mobile --target local` | Mở `/app/` ở 390px và 360px, cuộn xuống rồi lên | PASS: không có cuộn ngang, thanh tab ẩn rồi hiện lại. Ảnh chụp ở report |

## Contract

Brief này không thêm endpoint. App gọi các endpoint đã có: `GET /api/auth/me`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/owner/bookings?status=PENDING` (số đếm của tab Yêu cầu).

| Thứ | Change | Chi tiết |
|---|---|---|
| `@monsport/client` | new package | `api.ts` (fetch có cookie, lỗi thành `ApiError`), `format.ts`, `push.ts`. Chỉ import từ `@monsport/shared` và trình duyệt |
| `MOBILE_DIST` | biến môi trường mới | Thư mục build của `apps/mobile`. `Dockerfile` đặt `/app/apps/mobile/dist` |

## Data

Không đổi bảng nào.

## Build order

Mỗi dòng là một PR. Mỗi PR qua `pnpm check`. Coder được chép code từ nhánh `exp/ui-d-mobile`, nhưng phải sửa cho đúng AC và `DESIGN.md`.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | `packages/client`, đổi import của web, rule import | `packages/client/`, `apps/web/src/` (chỉ đổi import và xóa `lib/api.ts`, `lib/format.ts`, `lib/push.ts`), `apps/web/package.json`, `pnpm-lock.yaml`, `.dependency-cruiser.cjs`, `scripts/` (test của rule) | AC-1, AC-2 |
| 2 | Khung `apps/mobile`: Vite với `base: '/app/'`, router, `TopBar`, `ContextBar`, `ActionBar`, `TabBar`, `Sheet`, `useHideOnScroll`, sheet đăng nhập, màn trống cho mỗi tab, manifest và icon | `apps/mobile/`, `package.json` (script `dev:mobile`), `pnpm-lock.yaml`, `DESIGN.md` (bỏ câu "Valid only after ADR 0006") | AC-3 tới AC-13, AC-15 |
| 3 | Phục vụ ở `/app/`, deploy, verify-flow | `apps/api/src/serve-web.ts`, `apps/api/src/serve-web.e2e.test.ts`, `apps/api/src/main.ts`, `Dockerfile`, `.github/workflows/`, `.agents/skills/verify-flow/`, `docs/deploy-gcp.md`, `PROGRESS.md` | AC-14, AC-16, AC-17 |

## Edit boundaries

- Được sửa: các path ở Build order.
- Không sửa: `apps/api/src/modules/`, `apps/api/prisma/`, `packages/shared/src/`, giao diện của `apps/web` (chỉ đổi dòng import).

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Service worker của web (`/sw.js`, scope `/`) điều khiển cả `/app/` | PR 3 | Brief này chưa đăng ký service worker cho app. Brief Thông báo đăng ký `/app/sw.js` với scope `/app/`, scope dài hơn thắng. Test kiểm `navigator.serviceWorker` của web không chặn `GET /app/` |
| Đổi import làm hỏng web | PR 1 | Mọi test của `apps/web` qua. `verify-flow --target local` qua trước khi mở PR |
| Đường dẫn `/app/` trùng route của web | PR 3 | Web không có route bắt đầu bằng `/app`. AC-14 kiểm cả hai |
| Cookie phiên | AC-12 | Cùng origin, cùng cookie `session`. Không đổi `SameSite` |

Brief này không chạm tiền, đồng thời, schema hay dữ liệu cá nhân mới. Một Reviewer mỗi PR là đủ.

## Assumptions

- Tên route của app bằng tiếng Việt không dấu, như web: `/app/`, `/app/phong-cho`, `/app/lich-cua-toi`, `/app/thong-bao`, `/app/toi`, `/app/chu-san/yeu-cau`, `/app/chu-san/lich`, `/app/chu-san/doanh-thu`.
- Tab mở màn trống có câu "Sắp có" cho tới khi brief của tab đó xong. Tab Tôi có đăng nhập và đăng xuất ngay trong brief này, vì vai trò quyết định thanh tab.
- Web không tự chuyển điện thoại sang `/app/`. Brief của tab Đặt sân quyết định việc này.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Web có nên tự chuyển điện thoại sang `/app/` không, và khi nào | Bạn | Không. Brief Đặt sân |

## Done when

- Mọi AC có test qua, tên test có nhãn.
- `pnpm check` qua ở PR cuối.
- Deploy chạy, và `verify-flow --app mobile --target live` qua (bạn chạy với tài khoản `VERIFY_*`).
