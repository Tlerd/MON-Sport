---
style: ste80
lang: vi
---

# F-027: Tab Tôi trên app mobile: đăng ký, hồ sơ, đăng xuất

Status: accepted
Source: `docs/design/ke-hoach-app-mobile.md` (bảng "Tab theo vai trò", cột "Tôi"), UC-1 (flow 1.0), BR-28, BR-29, BR-30, BR-31. `docs/briefs/F-003-*` (API đăng ký và văn bản `PRIVACY_NOTICE`). `docs/briefs/F-019-khung-app-mobile.md` (tab Tôi chỉ có đăng nhập và đăng xuất). Quyết định theo "Autonomy" của `AGENTS.md`: xem "Assumptions".

## Goal

Khách mở tab "Tôi" trên `/app/toi`, đăng ký tài khoản bằng tên, số điện thoại, mật khẩu và ô đồng ý, rồi vào app đã đăng nhập. Người đã đăng nhập thấy tên, số điện thoại và vai trò của mình. Kiểm tra bằng `verify-flow --app mobile` ở 360px và 390px.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Đăng nhập Google, OTP SMS, Zalo | Chờ F-004 bước 4 và F-018. `HUMAN_DECISIONS.md` mục 11 | Sau F-004 và F-018 |
| Sửa tên, đổi mật khẩu, xóa tài khoản | Chưa có API. Admin xóa tay (mục 6) | Không có kế hoạch |
| Nút bật Web Push trên app | `sw.js` của web giữ phạm vi `/`. `HUMAN_DECISIONS.md` mục 15 | Brief sau |
| Sửa API, schema hoặc `packages/shared` | `POST /api/auth/register` và `GET /api/auth/me` đã đủ (F-003) | Không cần |
| Đổi `apps/web` | Web chạy đúng | Không cần |

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Khách chưa đăng nhập | Mở `/app/toi` | Thấy nút "Đăng nhập" và nút "Tạo tài khoản" |
| AC-2 | Khách ở tab Tôi | Bấm "Tạo tài khoản" | Sheet "Tạo tài khoản" mở. Sheet có ô "Tên", "Số điện thoại", "Mật khẩu". Sheet có đủ 5 đoạn của `PRIVACY_NOTICE` từ `@monsport/shared`. Ô "Tôi đồng ý với thông báo bảo vệ dữ liệu cá nhân" chưa chọn |
| AC-3 | Sheet của AC-2 với tên "Lan", số `0912345678`, mật khẩu `Sanbong#2026`, ô đồng ý đã chọn | Bấm "Tạo tài khoản" | App gửi một lần `POST /api/auth/register` với `{ name: "Lan", phone: "0912345678", password: "Sanbong#2026", consent: true }`. Nút khóa trong lúc chờ. Thành công: sheet đóng và app gọi `GET /api/auth/me` |
| AC-4 | Sheet của AC-2, ô đồng ý chưa chọn | Bấm "Tạo tài khoản" | App không gọi API. Sheet hiện `Messages.consent` ("Bạn cần đồng ý với thông báo bảo vệ dữ liệu cá nhân") |
| AC-5 | Sheet của AC-3. API trả lần lượt: 409 "Số điện thoại đã có tài khoản". 400 `Messages.weakPassword`. 429 `Messages.tooManyAttempts`. Lỗi mạng | Bấm "Tạo tài khoản" | Sheet ở lại, nút mở lại, dữ liệu đã nhập ở lại. Sheet hiện văn bản của API. Lỗi mạng: "Không kết nối được. Thử lại sau" |
| AC-6 | Người dùng Lan (`USER`) đã đăng nhập | Mở `/app/toi` | Thấy tên "Lan", số điện thoại, nhãn vai trò "Người chơi", và nút "Đăng xuất". Không thấy nút "Đăng nhập" |
| AC-7 | Chủ sân Bình (`OWNER`) đã đăng nhập | Mở `/app/toi` | Nhãn vai trò là "Chủ sân" |
| AC-8 | Người dùng đã đăng nhập ở tab Tôi | Bấm "Đăng xuất" | App gọi `POST /api/auth/logout`, rồi hiện lại nút "Đăng nhập" và "Tạo tài khoản" |
| AC-9 | Khách mở sheet "Đăng nhập" | Bấm "Tạo tài khoản" trong sheet đăng nhập | Sheet đăng nhập đóng và sheet "Tạo tài khoản" mở. Sheet "Tạo tài khoản" có nút "Đã có tài khoản? Đăng nhập" làm điều ngược lại |
| AC-10 | Màn 360px | Mở sheet "Tạo tài khoản" | Trang không rộng hơn cửa sổ. Mọi nút cao ít nhất 44px. Sheet cuộn được khi bàn phím mở |

## Contract

Không đổi. App dùng `POST /api/auth/register` (201 `SessionUser` · 400 văn bản của `Messages` · 409 trùng số · 429 `tooManyAttempts`), `GET /api/auth/me` và `POST /api/auth/logout`.

## Data

Không đổi.

## Build order

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Sheet "Tạo tài khoản" | `apps/mobile/src/features/auth/RegisterSheet.tsx`, `apps/mobile/src/features/auth/RegisterSheet.test.tsx` | AC-2 đến AC-5, AC-10 |
| 2 | Tab Tôi: hồ sơ, nút đăng ký, chuyển giữa hai sheet | `apps/mobile/src/features/auth/ToiScreen.tsx`, `apps/mobile/src/features/auth/ToiScreen.test.tsx`, `apps/mobile/src/features/auth/LoginSheet.tsx` | AC-1, AC-6 đến AC-9 |
| 3 | Luồng live `mobile-account` (đăng nhập, xem hồ sơ, đăng xuất) và `PROGRESS.md` | `scripts/verify-flow/**` | Luồng chạy trong CI `image` |

## Edit boundaries

- May edit: các path trong "Build order", `PROGRESS.md`, `HUMAN_DECISIONS.md`, `@map.md`.
- Leave unchanged without approval: `apps/api/**`, `packages/shared/**`, `apps/web/**`, `.dependency-cruiser.cjs`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Dữ liệu cá nhân và đồng ý (BR-29) | `RegisterSheet.tsx` | App chỉ gửi `consent: true` khi người dùng chọn ô. Test AC-4 chặn gửi khi chưa chọn. Reviewer đọc ở phiên mới |
| Mật khẩu | `RegisterSheet.tsx` | `type="password"`, `autoComplete="new-password"`. App không ghi mật khẩu vào log, URL hay `localStorage` |
| Ảnh live lộ số điện thoại | luồng `mobile-account` | Che số điện thoại và tên trong ảnh live (như F-025 D-1). Luồng dùng tài khoản thử, không tạo tài khoản mới trên live |

## Assumptions

- Nhãn vai trò: `USER` là "Người chơi", `OWNER` là "Chủ sân". `ADMIN` không tới tab này vì app chặn admin (F-019 AC-13).
- Sheet đăng ký dùng chung `Sheet` và kiểu của `LoginSheet`. Không có màn đăng ký riêng.
- Luồng `mobile-account` chỉ đăng nhập bằng tài khoản thử, vì đăng ký trên live tạo dữ liệu thật.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Không có | | |

## Done when

- Every AC has a passing test with its label in the name.
- `pnpm check` passes on the last pull request.
- The Reviewer round of "Risks and reviews" is complete.
