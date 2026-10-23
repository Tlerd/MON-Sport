---
style: ste80
lang: vi
---

# F-017: Giao diện web theo DESIGN.md

Status: accepted
Source:

- `DESIGN.md` trên `main` (PR #98): token, component, `SlotGrid`, quy tắc 390px.
- Intake `docs/requirements/intake-monsport-v1.md`:
  - Inputs và Quality: "Web, dùng tốt ở màn rộng 390px".
  - UC-2: mỗi giờ còn trống có nút "Gọi chủ sân", và trang đặt có câu "App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt."
  - UC-7: trận hiện giá mỗi suất và nhãn "Đã xác nhận" hoặc "Chưa xác nhận".
  - Assumptions: booking tính theo từng 30 phút, và có thể vắt qua 17:00.
- `PROGRESS.md`, Next step (2): một brief đưa giao diện web mới lên `main`.
- Nhánh thử nghiệm `exp/ui-c-web`: bản dựng đã qua 5 vòng thử (agy và Claude Code, 2026-10-22 và 2026-10-23).

## Goal

Người dùng, chủ sân và admin dùng web với giao diện mới theo `DESIGN.md`, ở màn rộng 390px, 1024px và 1440px. Mọi chức năng cũ vẫn chạy như trước.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| App mobile trong `apps/mobile` | ADR 0006 còn Proposed, và intake để app Android, iOS ngoài phạm vi | Sau khi người dùng duyệt ADR 0006 |
| Đổi API, schema hoặc luật nghiệp vụ | Brief này chỉ đổi màn hình | Không có kế hoạch |
| Chế độ tối | `DESIGN.md` chưa có token tối | Khi `DESIGN.md` có token tối |

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Đơn vị mở 06:00–23:00 | Người dùng mở `SlotGrid` của ngày 2026-11-21, khác hôm nay | Lưới hiện 3 nút buổi: Sáng 06–12, Chiều 12–17, Tối 17–23. Lưới chỉ hiện ô của một buổi. Test: `apps/web/src/components/SlotGrid.test.tsx` |
| AC-2 | `now` = `2026-11-20T03:33:00Z` (10:33 Asia/Ho_Chi_Minh, BR-27), đơn vị mở 06:00–23:00 | Người dùng mở `SlotGrid` của ngày 2026-11-20 | Buổi Sáng được chọn. Ô 06:00 đến 10:30 bị khóa (đã qua). Ô 11:00 trống và bấm được. Test chạy đúng với `TZ=UTC`. Test: `apps/web/src/components/SlotGrid.test.tsx` |
| AC-3 | Đơn vị mở 06:00–23:00, sân 1 trống cả ngày | Người dùng chọn ô 16:30 của sân 1 ở buổi Chiều, chọn thời lượng "1 giờ" (giá trị `60`), rồi bấm nút buổi Tối | Phần tóm tắt ghi "16:30–17:30". Ở buổi Tối, ô 17:00 của sân 1 có trạng thái đã chọn. Test: `apps/web/src/app/BookPage.test.tsx` (new) |
| AC-4 | Đơn vị có số 0912345678, chưa có ô nào được chọn | Người dùng mở màn Đặt sân của đơn vị đó | Màn hiện đủ câu "App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt." Test: `apps/web/src/app/BookPage.test.tsx` |
| AC-5 | Như AC-4 | Người dùng chọn một ô trống | Cạnh nút gửi yêu cầu có liên kết `tel:0912345678` với chữ "Gọi chủ sân". Test: `apps/web/src/app/BookPage.test.tsx` |
| AC-6 | Phòng chờ có trận giá 50.000 đ mỗi suất, booking chưa xác nhận, 4/4 suất | Người dùng mở Phòng chờ | Thẻ trận hiện giá "50.000" kèm "/suất", nhãn "Chưa xác nhận", và nhãn "Đầy" bên cạnh, không thay nhãn. Test: `apps/web/src/features/matches/Lobby.test.tsx` |
| AC-7 | Người dùng mở Phòng chờ | Màn hiện ra | Hàng chip lọc (môn, ngày) đứng trước danh sách và trước khung chi tiết trong DOM. Test: `apps/web/src/features/matches/Lobby.test.tsx` |
| AC-8 | Người dùng có 3 thông báo chưa đọc | Thanh trên cùng hiện ra | Chuông là icon Lucide `Bell` (một `svg`, không emoji). Nút có tên "Thông báo, 3 chưa đọc" và số 3. Test: `apps/web/src/features/notifications/Notifications.test.tsx` |

Kiểm bằng skill `verify-flow` ở 390px, 1024px và 1440px (`DESIGN.md`): không màn nào rộng hơn cửa sổ (`document.documentElement.scrollWidth <= innerWidth`). Các màn: `/`, `/phong-cho`, `/lich-cua-toi`, `/dang-nhap`, `/chu-san/yeu-cau`, `/chu-san/lich`, `/chu-san/doanh-thu`, `/chu-san/don-vi`, `/admin`. Báo cáo và ảnh đi kèm PR bước 2.

## Contract

Không đổi. `packages/shared` giữ nguyên.

## Data

Không đổi.

## Build order

One pull request for each row. Each pull request passes the check command on its own.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Token, icon và component nền | `apps/web/src/app/tokens.css`, `apps/web/src/components/`, `apps/web/src/main.tsx`, `apps/web/index.html`, `apps/web/package.json`, `pnpm-lock.yaml`, `scripts/design-tokens.mjs` | AC-1, AC-2 trong `apps/web/src/components/SlotGrid.test.tsx` |
| 2 | Khung, router và các màn | `apps/web/src/app/`, `apps/web/src/features/`, `.agents/skills/verify-flow/`, `PROGRESS.md`, `docs/tien-do.md` | AC-3 đến AC-5 trong `apps/web/src/app/BookPage.test.tsx`, AC-6 và AC-7 trong `Lobby.test.tsx`, AC-8 trong `Notifications.test.tsx`, và mọi test cũ của `apps/web` |

## Edit boundaries

- May edit: the paths in "Build order".
- Leave unchanged without approval: `apps/api/`, `packages/shared/`, `apps/mobile/`, `DESIGN.md`, `docs/requirements/`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Một màn cũ mất chức năng khi đổi khung | Bước 2, `apps/web/src/app/router.tsx` | Tên test và số test `AC-n` của `apps/web` giữ nguyên trước và sau. Chỉ các test trong danh sách "Test được đổi bộ chọn" được đổi bộ chọn, không đổi điều chúng kiểm. Reviewer so tên test và danh sách đó |
| Lộ số điện thoại người dùng (BR-20) | Bước 2, thẻ trận | Thẻ trận chỉ hiện số của đơn vị. Reviewer kiểm |
| Tràn ngang ở 390px | Bước 2 | `verify-flow` ở 3 cỡ màn |

Không đổi tiền, khóa, schema. Bước 2 hiện dữ liệu cá nhân (tên người chơi), nên vòng review chạy thêm skill `rule-review`.

## Test được đổi bộ chọn

CI chạy `verify-flow` trên mỗi PR (check `image`), nên bước 2 sửa các flow cho khung mới trong cùng PR. Flow vẫn kiểm cùng trạng thái booking.


Khung mới đổi chữ và vai trò của vài phần tử, nên các test sau được đổi bộ chọn. Coder grep mọi `*.test.tsx` dưới `apps/web/src` cho mỗi nhãn bị đổi. Một bộ chọn khác cần đổi thì thêm một hàng ở đây trong cùng PR, và Reviewer kiểm hàng đó. Mỗi test vẫn kiểm cùng một chức năng.

| Test | Bộ chọn cũ | Bộ chọn mới | Lý do |
|---|---|---|---|
| `apps/web/src/app/App.test.tsx` | `findByText('Chào Bình')` | `findByRole('heading', { name: 'Chủ sân' })` | Thanh bên của chủ sân thay lời chào |
| `apps/web/src/app/App.test.tsx` | nút `'Doanh thu'` | liên kết `/Doanh thu/` | Tab thành mục điều hướng có đường dẫn |
| `apps/web/src/features/matches/Lobby.test.tsx` | `getByLabelText(/^Môn thể thao/)`, `/^Ngày chơi/` | bấm chip môn và chip ngày | Ô chọn thành hàng chip |
| `apps/web/src/features/notifications/Notifications.test.tsx` | tên nút `'Thông báo'` | `/Thông báo/` | Tên nút có thêm số chưa đọc (AC-8) |
| `apps/web/src/app/App.test.tsx` | nút chuông `name: 'Thông báo'` | `name: /Thông báo/` | Tên nút có thêm số chưa đọc (AC-8) |

## Assumptions

1. Hai bước lớn hơn 400 dòng, vì phần lớn là CSS và màn có sẵn trên `exp/ui-c-web`. Tách nhỏ hơn làm hỏng màn giữa chừng.
2. Bước 1 và 2 lấy code từ `exp/ui-c-web`, trừ `DESIGN.md` và logic tải lại của `Notifications.tsx`, vì `main` đã có bản mới hơn (PR #98, #94, #101). Từ nhánh đó, `Notifications.tsx` chỉ lấy icon `Bell`, tên nút có số chưa đọc, và các class `icon-button`, `count-badge`.
3. Thanh "Dùng app MONSPORT trên điện thoại" không hiện trên web khi ADR 0006 chưa Accepted.
4. AC-3 dùng cách chọn của `exp/ui-c-web`: một ô bắt đầu và một ô chọn thời lượng (30 phút mỗi bước). Giá vẫn do API tính (giờ thường và giờ cao điểm từ 17:00). Đây không phải luật mới.
5. Giờ "hôm nay" và ô đã qua tính theo `Asia/Ho_Chi_Minh` (BR-27), không theo múi giờ của máy.
6. `scripts/design-tokens.mjs` chạy bằng tay khi `DESIGN.md` đổi, và ghim phiên bản của gói `@google/design.md`. Nó không nằm trong `pnpm check`.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Duyệt ADR 0006 (app mobile PWA) | Người dùng | none |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
- `verify-flow` passes at 390px, 1024px and 1440px.
