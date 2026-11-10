---
style: ste80
lang: vi
---

# F-029: Trình độ người chơi

Status: draft
Source: `docs/requirements/intake-monsport-v2.md` (mục W4, UC-18). `docs/design/ke-hoach-v2.md`. Người dùng ngày 10/11/2026: làm một tính năng V2 thật để thử thang sửa lỗi (PR 218), hai bản build, chưa merge.

## Goal

Người chơi chọn trình độ khi đăng ký trên web, và phòng chờ lọc trận theo trình độ của host. Kiểm tra bằng test API và test màn web.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Sửa trình độ sau khi đăng ký | Cần màn hồ sơ mới | Brief sau, khi bạn cần |
| Trình độ cho tài khoản Google và tài khoản app | Làm web trước. Hai luồng này không gửi trình độ, nên giá trị là `null` | Brief app của W4 |
| Trình độ riêng cho từng trận | Intake W4 lọc theo trình độ người chơi. Trận lấy trình độ của host | Khi bạn cần |
| Cập nhật `verify-flow` | Bản thử chưa merge. Chạy `verify-flow` trên bản được giữ | Trước khi merge |

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

- AC-1: `RegisterRequest` nhận `skillLevel` là `BEGINNER`, `INTERMEDIATE` hoặc `ADVANCED`, và nhận khi không có trường này. Giá trị khác bị từ chối. `MatchLobbyQuery` nhận `level` với cùng ba giá trị.
- AC-2: `POST /api/auth/register` có `skillLevel` lưu giá trị đó vào `User.skillLevel`. Khi không có `skillLevel`, giá trị là `null`.
- AC-3: `GET /api/matches?level=<mức>` chỉ trả trận có host ở mức đó. Khi không có `level`, kết quả có mọi trận, cả trận có host chưa chọn mức.
- AC-4: Mỗi `MatchView` của phòng chờ và của chi tiết trận có `hostSkillLevel`. Giá trị là `null` khi host chưa chọn mức.
- AC-5: `GET /api/matches?level=EXPERT` trả 400 với `Messages.invalid`.
- AC-6: Migration chỉ thêm. Người dùng đã có giữ `skillLevel` là `null`, và đăng nhập vẫn chạy.
- AC-10: `PRIVACY_NOTICE` nêu "trình độ" trong dữ liệu thu thập, và nói rằng mọi người dùng thấy trình độ của host trong phòng chờ (Luật 91/2025).
- AC-7: Form đăng ký web có ô chọn "Trình độ" với ba mức "Mới chơi", "Trung bình", "Khá". Gửi form khi chưa chọn hiện "Chọn trình độ" và không gửi request. Khi đã chọn, request có `skillLevel`.
- AC-8: Phòng chờ web có bộ lọc "Trình độ" với "Tất cả" và ba mức. "Tất cả" là mặc định và không gửi `level`. Chọn một mức thì gửi `level` của mức đó. Khi phòng chờ tải lại vì một sự kiện SSE, request vẫn giữ `level`.
- AC-9: Mỗi thẻ trận trong phòng chờ web hiện nhãn trình độ của host. Thẻ không hiện nhãn khi `hostSkillLevel` là `null`.

## Contract

`packages/shared/src/account.ts`:

```ts
export const SkillLevel = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
export const SKILL_LEVEL_LABELS = { BEGINNER: 'Mới chơi', INTERMEDIATE: 'Trung bình', ADVANCED: 'Khá' } as const;
export const SKILL_LEVEL_REQUIRED_MESSAGE = 'Chọn trình độ';
// RegisterRequest: thêm skillLevel: SkillLevel.optional(). App gửi request không có trường này.
```

`packages/shared/src/match.ts`:

- `MatchLobbyQuery`: thêm `level: SkillLevel.optional()`.
- `MatchView`: thêm `hostSkillLevel: SkillLevel.nullable().optional()`. `optional` giữ app hiện có type-check được.

Không có route mới. `GET /api/matches` nhận thêm query `level`.

## Data

- Enum mới `SkillLevel` (`BEGINNER`, `INTERMEDIATE`, `ADVANCED`).
- Cột mới `User.skillLevel SkillLevel?`. Không có mặc định. Không có index: phòng chờ lọc qua join với `User`, và số trận mở nhỏ.
- Ghi `SkillLevel` và `User.skillLevel` vào `docs/requirements/data-dictionary.md`.

## Lock order

Không có khóa mới. Đăng ký và phòng chờ không chạm `Venue`, `Court` hay `Booking`.

## Build order

One pull request for each row. Each pull request passes the check command on its own.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Contract, schema, server | `packages/shared/src/account.ts`, `packages/shared/src/account.test.ts`, `packages/shared/src/match.ts`, `packages/shared/src/match.test.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `apps/api/prisma/migration.test.ts`, `apps/api/prisma/seed.ts`, `apps/api/src/modules/auth/`, `apps/api/src/modules/matches/`, `docs/requirements/data-dictionary.md`, `docs/requirements/business-rules.md`, `HUMAN_DECISIONS.md`, `PROGRESS.md` | AC-1 đến AC-6, AC-10 |
| 2 | Screen | `apps/web/src/features/auth/RegisterForm.tsx`, `apps/web/src/features/auth/RegisterForm.test.tsx`, `apps/web/src/features/matches/` | AC-7 đến AC-9 |

## Edit boundaries

- May edit: các đường dẫn trong "Build order", đúng bước của chúng.
- Leave unchanged without approval: `apps/mobile/`, `packages/client/`, `apps/api/src/modules/bookings/`, `apps/api/src/modules/finance/`, các migration đã có, `DESIGN.md`, `REVIEW.md`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Schema: thêm enum và cột | Bước 1 | Chỉ thêm, cột cho phép `null`. Test AC-6. Review ở phiên mới |
| Dữ liệu cá nhân: trình độ gắn với tên host và hiện công khai | Bước 1, `MatchView`, `PRIVACY_NOTICE` | AC-10: thông báo khi đăng ký nêu trình độ và việc hiện công khai. Không đưa số điện thoại vào view (BR-20) |
| Hồi quy: đăng ký của app và của Google | Bước 1 | `skillLevel` là `optional`. Các test đăng ký hiện có phải pass |

## Assumptions

| Assumption | Why |
|---|---|
| Ba mức: "Mới chơi", "Trung bình", "Khá" | Intake W4 ghi ba mức. Tên mức là câu hỏi mở cho bạn |
| Trận lấy trình độ của host. Ghi thành BR-53 trong `business-rules.md` | Intake W4 lọc theo trình độ người chơi, và không thêm cột cho trận |
| Seed gán trình độ cho các host mẫu | Không có seed thì mọi bộ lọc trên dữ liệu demo cho phòng chờ trống |
| Web bắt buộc chọn, API không bắt buộc | App và Google chưa có ô chọn |

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Tên ba mức. Mặc định: "Mới chơi", "Trung bình", "Khá". Bước 1 thêm dòng này vào `HUMAN_DECISIONS.md` | Bạn | none |
| Luồng Google có bắt chọn trình độ khi đăng ký không? Mặc định: không (non-goal) | Bạn | none |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
