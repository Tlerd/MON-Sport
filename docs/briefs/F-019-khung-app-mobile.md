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
| Đăng ký, đăng nhập Google, Zalo, và bước OTP trong app | Intake UC-1 có các cách này. Brief này chỉ cần đăng nhập bằng số và mật khẩu để biết vai trò, vì vai trò quyết định thanh tab | Brief của tab Tôi, sau F-004 và F-018 |
| Service worker của app | Chưa có màn Thông báo. Kế hoạch bước 3 có service worker, brief này dời nó | Brief của tab Thông báo |

## Acceptance criteria

Mỗi AC có một test. Tên test bắt đầu bằng nhãn, ví dụ `AC-1`. Test của hook dùng `window.scrollY` giả lập và `requestAnimationFrame` giả lập. Hook có hợp đồng sau, ở `apps/mobile/src/hooks/useHideOnScroll.ts`:

```ts
useHideOnScroll({ locked }: { locked: boolean }): { topHidden: boolean; tabHidden: boolean }
```

`locked` = `true` khi một sheet, menu hoặc bàn phím đang mở. Hook đo quãng cuộn từ lần đổi hướng gần nhất, không đo từng event. Cuối trang là `scrollY + innerHeight >= scrollHeight - 1`. Khi `locked` đổi từ `true` sang `false`, hook đặt điểm mốc đo quãng cuộn về `scrollY` hiện tại. `ContextBar` đọc `topHidden`. `ActionBar` đọc `tabHidden`.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | `packages/client` có `api.ts`, `format.ts`, `push.ts` chuyển từ `apps/web/src/lib/` | Test import `formatVnd` từ `@monsport/client` | `formatVnd(240000)` = `240.000đ`. `apps/web/src/lib/` không còn ba file đó. Mọi test của `apps/web` vẫn qua |
| AC-2 | Fixture `harness/fixtures/bad/apps/mobile/src/x.ts` import `apps/web/src/y.ts`, và `harness/fixtures/bad/packages/client/src/x.ts` import `apps/mobile/src/y.ts` | `harness/boundaries.test.mjs` chạy `depcruise` | Fixture có cả hai file đích. Test kiểm `violation.from` của từng file mới, không chỉ tên rule. Rule có sẵn `app-imports-app` báo file thứ nhất. Rule có sẵn `package-imports-app` báo file thứ hai. Câu "Fix:" của `app-imports-app` nêu `packages/client` |
| AC-3 | `scrollY` = 300, hai thanh hiện | Cuộn xuống 309 trong một event | `topHidden` = `true`, `tabHidden` = `true` |
| AC-4 | `scrollY` = 300, hai thanh hiện | 9 event, mỗi event xuống 1px, tới 309 | `topHidden` = `true`, `tabHidden` = `true` |
| AC-5 | Hai thanh ẩn ở `scrollY` = 600 | Cuộn lên tới 591 | `topHidden` = `false`, `tabHidden` = `false` |
| AC-6 | Hai thanh ẩn ở `scrollY` = 56 | Cuộn lên tới 50 (6px, dưới ngưỡng 8px) | `topHidden` = `false`, `tabHidden` = `false`, vì 50 < 52 |
| AC-7 | Hai thanh ẩn ở `scrollY` = 1100, trang dài 2000px, khung cao 812px | Cuộn xuống tới cuối trang (`scrollY` = 1187.5) | `tabHidden` = `false`. `topHidden` = `true` |
| AC-8 | Hai thanh ẩn ở `scrollY` = 300, rồi `locked` = `true` | Cuộn lên tới 100 | `topHidden` = `true` (đứng yên). `tabHidden` = `true`. `ActionBar` vẫn hiện. Sau đó `locked` = `false`: hai thanh giữ trạng thái tới lần cuộn tiếp theo quá 8px |
| AC-8b | Hai thanh hiện ở `scrollY` = 300 | Đặt `locked` = `true`, không cuộn | `tabHidden` = `true`. `topHidden` = `false` |
| AC-9 | `prefers-reduced-motion: reduce`, `scrollY` = 0 | Cuộn xuống tới 200 | `topHidden` = `false`, `tabHidden` = `false` |
| AC-10 | Màn có `ContextBar` và `ActionBar`, `scrollY` = 300 | Cuộn xuống tới 400 | `ContextBar` có class `at-top` (dính `top: 0`). `ActionBar` có class `at-bottom` (sát vùng an toàn dưới). Cuộn lên 9px thì hai class mất |
| AC-11 | Khách chưa đăng nhập | Mở `/app/` | Thanh tab có 5 tab theo thứ tự: Đặt sân, Phòng chờ, Lịch của tôi, Thông báo, Tôi |
| AC-12 | Chủ sân Bình đã đăng nhập, có 2 booking `PENDING` | Mở `/app/` | Thanh tab có: Yêu cầu, Lịch sân, Doanh thu, Thông báo, Tôi. Tab Yêu cầu hiện `2`. Với 0 booking `PENDING` thì không có số |
| AC-13 | Admin đã đăng nhập | Mở `/app/` | App hiện "Dùng web để quản trị" và link tới `/admin`. Không có thanh tab |
| AC-14 | Khách ở tab Tôi | Đăng nhập bằng `0901234567` và đúng mật khẩu trong sheet đăng nhập | Sheet đóng. App gọi `GET /api/auth/me` và hiện tab của người dùng |
| AC-15 | Khách ở tab Tôi | Đăng nhập bằng `0901234567` và sai mật khẩu | Sheet vẫn mở và hiện "Sai số điện thoại hoặc mật khẩu". Câu báo của 403 và 429 là câu API trả về |
| AC-16 | Một sheet đang mở | Người dùng bấm Escape, hoặc bấm nền tối | Sheet đóng. Focus về nút đã mở sheet |
| AC-17 | Container chạy với `WEB_DIST` và `MOBILE_DIST` (e2e như `serve-web.e2e.test.ts`) | Gửi các request: `GET /app/lich-cua-toi` và `GET /app/` với `Accept: text/html`, `GET /app`, `GET /app/assets/<file>.js`, `GET /app/missing.js`, `GET /lich-cua-toi`, `GET /api/health`, rồi `POST /api/auth/login` và `GET /api/auth/me` với cookie vừa nhận | Hai trang `/app/...` trả 200 với `index.html` của `apps/mobile`, không có `max-age` dài. `GET /app` trả 301 tới `/app/`. File JS trả 200. `/app/missing.js` trả 404. `/lich-cua-toi` trả `index.html` của web. Health không đổi. Cookie `session` dùng được cho `/api/auth/me` |
| AC-18 | Build của `apps/mobile` | Đọc `manifest.webmanifest` | `id` = `/app/`, `name` = "MONSPORT", `start_url` = `/app/`, `scope` = `/app/`, `display` = `standalone`, có icon 192px và 512px |
| AC-19 | Không có `MOBILE_DIST` | API khởi động, rồi trình duyệt mở `GET /app/` | API chạy như cũ. `GET /app/` trả `index.html` của web, như trước brief này |

`verify-flow --app mobile` không phải AC, vì `ac-check` chỉ đọc test. Nó nằm ở "Done when" và ở cột Tests của PR 3.

## Contract

Brief này không thêm endpoint. App gọi các endpoint đã có: `GET /api/auth/me`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/owner/bookings?status=PENDING` (số đếm của tab Yêu cầu).

| Thứ | Change | Chi tiết |
|---|---|---|
| `@monsport/client` | new package | `api.ts` (fetch có cookie, lỗi thành `ApiError`), `format.ts`, `push.ts`. Chỉ import từ `@monsport/shared` và trình duyệt |
| `MOBILE_DIST` | biến môi trường mới | Thư mục build của `apps/mobile`. `Dockerfile` đặt `/app/apps/mobile/dist` |

## Data

Không đổi bảng nào.

## Build order

Mỗi dòng là một PR. Mỗi PR qua `pnpm check`. Coder chỉ được chép file trong `apps/mobile/` của nhánh `exp/ui-d-mobile`, rồi sửa cho đúng AC và `DESIGN.md`. Không chép, không merge file nào khác của nhánh đó: nhánh này cũ hơn `main`, và nó bỏ `serveWeb` của `main.ts` và AC-24 của F-013.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | `packages/client`, đổi import của web, fixture của rule import | `packages/client/`, `apps/web/src/` (chỉ đổi import và xóa `lib/api.ts`, `lib/format.ts`, `lib/push.ts`), `apps/web/package.json`, `pnpm-lock.yaml`, `.dependency-cruiser.cjs` (chỉ câu "Fix:"), `harness/` | AC-1, AC-2 |
| 2 | Khung `apps/mobile`: Vite với `base: '/app/'`, router, `TopBar`, `ContextBar`, `ActionBar`, `TabBar`, `Sheet`, `useHideOnScroll`, sheet đăng nhập, màn trống cho mỗi tab, manifest và icon | `apps/mobile/`, `package.json` (script `dev:mobile`), `pnpm-lock.yaml`, `DESIGN.md` (bỏ câu "Valid only after ADR 0006") | AC-3 tới AC-16, AC-18 |
| 3 | Phục vụ ở `/app/`, deploy, verify-flow | `apps/api/src/serve-web.ts`, `apps/api/src/serve-web.e2e.test.ts`, `apps/api/src/main.ts`, `Dockerfile`, `.github/workflows/`, `.agents/skills/verify-flow/`, `docs/deploy-gcp.md`, `PROGRESS.md` | AC-17, AC-19. `verify-flow --app mobile` qua trong check `image` |

## Edit boundaries

- Được sửa: các path ở Build order.
- Không sửa: `apps/api/src/modules/`, `apps/api/prisma/`, `packages/shared/src/`, giao diện của `apps/web` (chỉ đổi dòng import).

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Service worker và manifest của web có scope `/`, nên bao cả `/app/` | PR 1, PR 2 | `sw.js` của web không có fetch handler, nên không chặn `GET /app/`. Manifest của app có `id` và `scope` riêng (AC-18). `push.ts` của `packages/client` hiện ghi cứng `register('/sw.js')`. Trước khi app dùng push, brief Thông báo thêm tham số `swUrl` và `scope` |
| Đổi import làm hỏng web | PR 1 | Mọi test của `apps/web` qua. `verify-flow --target local` qua trước khi mở PR |
| Đường dẫn `/app/` trùng route của web | PR 3 | Web không có route bắt đầu bằng `/app`. AC-17 kiểm cả hai |
| Cookie phiên | AC-14, AC-17 | Cùng origin, cùng cookie `session`. Không đổi `SameSite` |

Brief này không chạm tiền, đồng thời, schema hay dữ liệu cá nhân mới. Một Reviewer mỗi PR là đủ.

## Assumptions

- Tên route của app bằng tiếng Việt không dấu, như web: `/app/`, `/app/phong-cho`, `/app/lich-cua-toi`, `/app/thong-bao`, `/app/toi`, `/app/chu-san/yeu-cau`, `/app/chu-san/lich`, `/app/chu-san/doanh-thu`.
- Tab mở màn trống có câu "Sắp có" cho tới khi brief của tab đó xong. Tab Tôi có đăng nhập và đăng xuất ngay trong brief này, vì vai trò quyết định thanh tab.
- Web không tự chuyển điện thoại sang `/app/`. Brief của tab Đặt sân quyết định việc này.
- Brief này không có service worker cho app, khác bước 3 của `docs/design/ke-hoach-app-mobile.md`. Lý do: chưa có push và chưa cần offline.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Web có nên tự chuyển điện thoại sang `/app/` không, và khi nào | Bạn | Không. Brief Đặt sân |

## Done when

- Mọi AC có test qua, tên test có nhãn.
- `pnpm check` qua ở PR cuối.
- `verify-flow --app mobile --target local` qua ở 390px và 360px: không có cuộn ngang, thanh tab ẩn rồi hiện lại. Report có ảnh chụp.
- Deploy chạy, và `verify-flow --app mobile --target live` qua (bạn chạy với tài khoản `VERIFY_*`).
