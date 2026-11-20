---
style: ste80
lang: vi
---

# F-039: Trình độ người chơi trên app mobile

Status: accepted
Source: `docs/briefs/F-029-trinh-do-nguoi-choi.md` (web và API đã xong, W4, UC-18, BR-53). `docs/design/ke-hoach-v2.md` ("port sang app"). `PROGRESS.md`, bước 1. Issue #307.

## Goal

Trên app `/app/`, người chơi chọn trình độ khi đăng ký. Phòng chờ lọc trận theo trình độ của host. Thẻ trận và sheet chi tiết hiện trình độ của host.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| API, schema, `packages/shared` | F-029 đã xong. Hợp đồng đủ | Không đổi |
| Sửa trình độ sau khi đăng ký | Web cũng chưa có | Brief sau, khi người dùng cần |
| Trình độ cho tài khoản Google | Non-goal của F-029 | Khi người dùng cần |
| F-030, F-031, F-032 trên app | Mỗi tính năng có brief riêng | Brief sau |

## Quy tắc

1. Dùng `SKILL_LEVEL_LABELS` và `SKILL_LEVEL_REQUIRED_MESSAGE` của `packages/shared`. Chữ giống web: "Trình độ", "Mọi trình độ", "Trình độ: <mức>".
2. Gọi `api()` với `json:` khi có body.
3. Ô bấm cao ít nhất 44px. Trang không cuộn ngang ở 360px và 390px. Dùng `tokens.css` và component có sẵn (`Chip`, `ContextBar`).

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Sheet "Tạo tài khoản" mở | Xem sheet | Sheet có ô chọn "Trình độ" với ba mức "Mới chơi", "Trung bình", "Khá", chưa chọn mức nào |
| AC-2 | Người dùng điền đủ, đồng ý, chưa chọn trình độ | Bấm "Tạo tài khoản" | Sheet hiện "Chọn trình độ" và không gửi request |
| AC-3 | Người dùng chọn "Khá" | Bấm "Tạo tài khoản" | App gửi `POST /api/auth/register` với `skillLevel: "ADVANCED"` |
| AC-4 | Phòng chờ mở | Xem bộ lọc | Bộ lọc có chip "Mọi trình độ" (chọn sẵn) và ba mức. Request đầu không có `level` |
| AC-5 | Phòng chờ mở | Chọn chip "Khá". Chọn lại "Khá" | Gửi `GET /api/matches?level=ADVANCED`. Trận người dùng đã vào cũng lọc theo trình độ, như môn và ngày. Chọn lại thì về "Mọi trình độ" và request không có `level` |
| AC-6 | Bộ lọc "Khá" đang chọn | Luồng SSE gửi sự kiện, phòng chờ tải lại | Request tải lại vẫn có `level=ADVANCED` |
| AC-7 | Trận có `hostSkillLevel: "INTERMEDIATE"` và trận có `hostSkillLevel: null` | Mở phòng chờ | Thẻ thứ nhất hiện "Trình độ: Trung bình". Thẻ thứ hai không có nhãn trình độ |
| AC-8 | Sheet chi tiết của trận có `hostSkillLevel: "BEGINNER"` | Mở sheet | Sheet hiện "Trình độ: Mới chơi". Khi `null`, sheet không có dòng này |
| AC-9 | Màn 390x812 và 360x800 | Mở phòng chờ và sheet đăng ký | Trang không cuộn ngang. `verify-flow` `mobile-lobby` kiểm tra bộ lọc trình độ ở hai cỡ màn |

## Allowed paths

- `apps/mobile/src/features/auth/RegisterSheet.tsx` và test của nó
- `apps/mobile/src/features/lobby/**`
- `packages/client/src/lobby.ts` và test của nó
- `.agents/skills/verify-flow/scripts/mobile-lobby.mjs`, `scripts/mobile-account.mjs` và `references/flows/mobile-lobby.md`
- `docs/briefs/F-039-app-mobile-trinh-do.md`, `PROGRESS.md`, `COMPLETED.md`, `@map.md`

## Steps

1. `feat/307-1-mobile-skill-level`: AC-1 đến AC-9. Một PR: tính năng nhỏ, chỉ đổi màn hình.

## Review

Một Reviewer mới cho PR. Có đổi màn hình, nên chạy `verify-flow` local trước PR. App bắt đầu gửi `skillLevel`, một dữ liệu cá nhân hiện công khai. `PRIVACY_NOTICE` đã nêu điều này (F-029 AC-10), và sheet đăng ký của app đã hiện thông báo đó. Reviewer kiểm BR-20 và BR-53.

## Assumptions

| Assumption | Why |
|---|---|
| App bắt buộc chọn trình độ, như web | F-029 để app không bắt buộc chỉ vì app chưa có ô chọn |
| Bộ lọc trình độ là một nhóm chip trong cùng `ContextBar` | Phòng chờ của app lọc môn và ngày bằng chip. Một kiểu điều khiển cho mọi bộ lọc |
