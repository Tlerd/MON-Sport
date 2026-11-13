---
style: ste80
lang: vi
---

# F-032: Điểm uy tín

Status: draft
Source: `docs/requirements/intake-monsport-v2.md` (mục W5, UC-19). `docs/design/ke-hoach-v2.md`. Người dùng ngày 12/11/2026: code hết các tính năng V2, dùng swarm của agy 3.8, không hỏi lại.

## Goal

Sau giờ bắt đầu của một trận, host chấm điểm từng người đã có suất trong trận: từ 1 đến 5 sao, và đánh dấu "Vắng mặt" khi người đó không tới. Host thấy điểm uy tín của người xin trong hàng chờ của trận "Host duyệt" (F-028). Kiểm tra bằng test API và test màn web.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Người chơi chấm host hoặc chấm nhau | Intake W5: host chấm | Khi bạn cần |
| Tự từ chối người có điểm thấp | Host quyết định. Luật tự động cần bạn chốt | Khi bạn cần |
| Điểm hiện công khai trong phòng chờ | Điểm là dữ liệu cá nhân. Chỉ host của trận "Host duyệt" thấy điểm của người xin | Khi bạn cần |
| Sửa hoặc xóa điểm sau 7 ngày | Giữ điểm ổn định | Khi bạn cần |
| App mobile | Làm web trước | Brief app của W5 |

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

- AC-1: `RatePlayerRequest` nhận `noShow` là boolean. Khi `noShow` là `false`, `stars` là số nguyên từ 1 đến 5. Khi `noShow` là `true`, `stars` là `null`. Giá trị 0, 6, 2.5 và các cặp sai bị từ chối. `PlayerReputation` có `ratingAvg` (số, một chữ số thập phân, hoặc `null`), `ratingCount` và `noShowCount`.
- AC-2: `PUT /api/matches/:id/ratings/:userId` của host lưu điểm cho một người có suất `ACTIVE` trong trận, sau giờ bắt đầu và trong 7 ngày sau giờ bắt đầu. Gửi lại thì sửa điểm cũ. Mỗi cặp (trận, người chơi) có nhiều nhất một điểm. Trả 200 với `PlayerRatingView`.
- AC-3: API từ chối, với thông báo của contract:
  - trước giờ bắt đầu: 400 `RATE_TOO_EARLY`.
  - sau 7 ngày: 400 `RATE_TOO_LATE`.
  - trận bị hủy, hoặc booking của trận không `CONFIRMED` (cả booking quá hạn xác nhận): 400 `RATE_CANCELLED`.
  - người không có suất `ACTIVE` hoặc chính host: 400 `RATE_NOT_PLAYER`.
  - người gọi không phải host: 403.
- AC-4: `GET /api/matches/:id/ratings` của host trả mỗi người có suất `ACTIVE` (trừ host), với tên và điểm hiện có (`null` khi chưa chấm). Người không phải host nhận 403.
- AC-5: Mỗi `MatchRequestView` của hàng chờ (F-028) có `reputation` của người xin. `ratingAvg` là trung bình số sao của các điểm có sao của người đó, làm tròn một chữ số thập phân. `ratingCount` đếm các điểm đó. `noShowCount` đếm các điểm có `noShow` = `true`. Người chưa có điểm có `ratingAvg` = `null` và hai số đếm bằng 0.
- AC-6: Migration chỉ thêm bảng `PlayerRating`. Dữ liệu đã có không đổi.
- AC-7: `PRIVACY_NOTICE` nêu rằng host chấm điểm người chơi sau trận, và rằng host của trận "Host duyệt" thấy điểm uy tín của người xin.
- AC-8: Web: trong "Booking của tôi", nút "Chấm điểm người chơi" hiện trên booking có trận do người dùng làm host. Trận đó không bị hủy, và đã qua giờ bắt đầu dưới 7 ngày. Bấm nút mở danh sách người chơi. Mỗi người có ô chọn 1 đến 5 sao, ô "Vắng mặt" và nút "Lưu". Lưu xong hiện "Đã lưu". Lỗi hiện thông báo của API.
- AC-9: Web: hàng chờ của host (F-028) hiện điểm uy tín của mỗi người xin, dạng "4,5 ★ (12) · 1 lần vắng". Người chưa có điểm hiện "Chưa có đánh giá".

## Contract

`packages/shared/src/rating.ts` (file mới, export qua `index.ts`):

```ts
export const RATE_WINDOW_DAYS = 7;
export const RATE_TOO_EARLY = 'Trận chưa bắt đầu, chưa chấm điểm được';
export const RATE_TOO_LATE = 'Đã quá 7 ngày sau trận, không chấm điểm được nữa';
export const RATE_CANCELLED = 'Trận đã hủy, không chấm điểm được';
export const RATE_NOT_PLAYER = 'Người này không có suất trong trận';

// A no-show has no stars, so it does not change the average (BR-56).
export const RatePlayerRequest = z
  .object({ stars: z.int().min(1).max(5).nullable(), noShow: z.boolean() })
  .strict()
  .refine((r) => (r.noShow ? r.stars === null : r.stars !== null), { message: 'Chọn số sao, hoặc chọn Vắng mặt' });
export type RatePlayerRequest = z.infer<typeof RatePlayerRequest>;

export const PlayerRatingView = z.object({
  userId: z.uuid(),
  name: z.string(),
  stars: z.int().min(1).max(5).nullable(),
  noShow: z.boolean().nullable(),
});
export type PlayerRatingView = z.infer<typeof PlayerRatingView>;

export const PlayerReputation = z.object({
  ratingAvg: z.number().nullable(),
  ratingCount: z.int().nonnegative(),
  noShowCount: z.int().nonnegative(),
});
export type PlayerReputation = z.infer<typeof PlayerReputation>;
```

`packages/shared/src/match.ts`: `MatchRequestView` thêm `reputation: PlayerReputation.optional()`. `optional` giữ app hiện có type-check được.

Route mới (người đăng nhập, vai trò `USER`): `GET /api/matches/:id/ratings`, `PUT /api/matches/:id/ratings/:userId`.

## Data

- Bảng mới `PlayerRating`: `matchId` (khóa ngoại `Match`), `raterId` (khóa ngoại `User`, là host), `playerId` (khóa ngoại `User`), `stars Int?`, `noShow Boolean`, `createdAt`, `updatedAt`. Khóa chính (`matchId`, `playerId`). Index trên `playerId`. Ràng buộc `CHECK (stars BETWEEN 1 AND 5)` và `CHECK (("noShow" AND "stars" IS NULL) OR (NOT "noShow" AND "stars" IS NOT NULL))` (tên cột có ngoặc kép, vì Postgres đổi tên không ngoặc sang chữ thường).
- Migration `20261112200000_f032_player_rating`. Chỉ thêm.
- Ghi vào `docs/requirements/data-dictionary.md`. Thêm BR-56 và BR-57 vào `business-rules.md` và UC-19 vào `use-cases.md`.

## Lock order

Không có khóa mới. Trước khi kiểm tra, route chấm điểm chạy `expireBookings` và `finishPastMatches` cho booking của trận, như `matches.service.ts` làm khi đọc (BR-8, BR-16). Lưu điểm là một upsert trên khóa chính (`matchId`, `playerId`). Hai lệnh lưu cùng lúc cho cùng người: lệnh sau ghi đè lệnh trước. Bước đồng bộ có thể ghi `Booking` và `Match`, như khi đọc hàng chờ. Lỗi 40P01 chạy lại bước đồng bộ một lần. Lỗi 40P01 lần hai trả 409 `BUSY`.

## Build order

One pull request for each row. Each pull request passes the check command on its own.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Contract, schema, server | `packages/shared/src/rating.ts`, `packages/shared/src/rating.test.ts`, `packages/shared/src/match.ts`, `packages/shared/src/match.test.ts`, `packages/shared/src/index.ts`, `packages/shared/src/account.ts`, `packages/shared/src/account.test.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `apps/api/prisma/migration.test.ts`, `apps/api/src/modules/matches/`, `docs/requirements/`, `HUMAN_DECISIONS.md`, `PROGRESS.md`, `@map.md` | AC-1 đến AC-7 |
| 2 | Screen | `apps/web/src/features/bookings/`, `apps/web/src/features/matches/`, `apps/web/src/styles.css`, `@map.md` | AC-8, AC-9 |

## Edit boundaries

- May edit: các đường dẫn trong "Build order", đúng bước của chúng.
- Leave unchanged without approval: `apps/mobile/`, `packages/client/`, `apps/api/src/modules/bookings/`, các migration đã có, `DESIGN.md`, `REVIEW.md`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Dữ liệu cá nhân: điểm gắn với người chơi | Bước 1 | Chỉ host của trận thấy điểm. AC-4, AC-5, AC-7. Review bằng model mạnh nhất và skill `rule-review` |
| Schema: bảng mới | Bước 1 | Chỉ thêm. AC-6 |
| Hồi quy: hàng chờ F-028 | Bước 1, 2 | `reputation` là `optional`. Các test hiện có của F-028 phải pass |

## Assumptions

| Assumption | Why |
|---|---|
| Điểm từ 1 đến 5 sao, hoặc "Vắng mặt" không có sao (BR-56) | Intake W5 để ngỏ luật tính điểm. Sao và vắng mặt là hai thứ khác nhau, nên tách ra |
| Điểm uy tín là trung bình số sao và số lần vắng, không có công thức gộp (BR-57) | Host đọc được ngay. Công thức gộp cần bạn chốt |
| Host chấm trong 7 ngày sau giờ bắt đầu | Đủ thời gian. Giữ điểm ổn định sau đó |
| Chỉ host thấy điểm, và chỉ trong hàng chờ | Điểm là dữ liệu cá nhân (Luật 91/2025) |

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Luật tính điểm và vắng mặt. Mặc định: sao 1 đến 5, đếm vắng mặt riêng | Bạn | none |
| Ai thấy điểm uy tín? Mặc định: chỉ host, trong hàng chờ | Bạn | none |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
