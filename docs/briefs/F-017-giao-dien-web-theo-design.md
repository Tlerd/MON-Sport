---
style: ste80
lang: vi
---

# F-017: Giao diện web theo DESIGN.md

Status: draft
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

Người dùng, chủ sân và admin dùng web với giao diện mới theo `DESIGN.md`, ở màn rộng 390px, 1024px và 1280px. Mọi chức năng cũ vẫn chạy như trước.

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
| AC-1 | Đơn vị mở 06:00–23:00 | Người dùng mở `SlotGrid` của một ngày khác hôm nay | Lưới hiện 3 nút buổi: Sáng 06–12, Chiều 12–17, Tối 17–23. Lưới chỉ hiện ô của một buổi |
| AC-2 | Hôm nay, lúc 10:33, đơn vị mở 06:00–23:00 | Người dùng mở `SlotGrid` | Buổi Sáng được chọn. Ô 06:00 đến 10:00 bị khóa (đã qua) |
| AC-3 | Đơn vị mở 06:00–23:00 | Người dùng chọn 16:30 ở buổi Chiều, rồi chọn 17:00 ở buổi Tối | Vùng chọn là 16:30–17:30, và giữ nguyên khi người dùng đổi buổi |
| AC-4 | Người dùng chọn một giờ trống của đơn vị có số 0912345678 | Màn Đặt sân hiện vùng chọn | Màn có liên kết `tel:0912345678` với chữ "Gọi chủ sân", và câu "App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt." đủ cả câu |
| AC-5 | Phòng chờ có trận giá 50.000 đ mỗi suất, booking chưa xác nhận, 4/4 suất | Người dùng mở Phòng chờ | Thẻ trận hiện giá "50.000" kèm "/suất", nhãn "Chưa xác nhận", và nhãn "Đầy" bên cạnh, không thay nhãn |
| AC-6 | Người dùng mở Phòng chờ | Màn hiện ra | Hàng chip lọc (môn, ngày) đứng trước danh sách và trước khung chi tiết trong DOM |
| AC-7 | Người dùng có 3 thông báo chưa đọc | Thanh trên cùng hiện ra | Chuông là icon Lucide (không emoji) với số 3 |

Kiểm tay bằng skill `verify-flow` ở 390px, 1024px và 1280px: không màn nào rộng hơn cửa sổ (`document.documentElement.scrollWidth <= innerWidth`). Các màn: `/`, `/san/:id`, `/phong-cho`, `/lich-cua-toi`, `/chu-san/yeu-cau`, `/chu-san/lich`. Báo cáo và ảnh đi kèm PR bước 2.

## Contract

Không đổi. `packages/shared` giữ nguyên.

## Data

Không đổi.

## Build order

One pull request for each row. Each pull request passes the check command on its own.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Token, icon và component nền | `apps/web/src/app/tokens.css`, `apps/web/src/components/`, `apps/web/src/main.tsx`, `apps/web/index.html`, `apps/web/package.json`, `pnpm-lock.yaml`, `scripts/design-tokens.mjs` | AC-1, AC-2, AC-3 trong `apps/web/src/components/SlotGrid.test.tsx` |
| 2 | Khung, router và các màn | `apps/web/src/app/`, `apps/web/src/features/`, `PROGRESS.md`, `docs/tien-do.md` | AC-4 đến AC-7, và mọi test cũ của `apps/web` |

## Edit boundaries

- May edit: the paths in "Build order".
- Leave unchanged without approval: `apps/api/`, `packages/shared/`, `apps/mobile/`, `DESIGN.md`, `docs/requirements/`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Một màn cũ mất chức năng khi đổi khung | Bước 2, `apps/web/src/app/router.tsx` | Mọi test cũ của `apps/web` phải pass không sửa assertion. Reviewer so tên test trước và sau |
| Lộ số điện thoại người dùng (BR-20) | Bước 2, thẻ trận | Thẻ trận chỉ hiện số của đơn vị. Reviewer kiểm |
| Tràn ngang ở 390px | Bước 2 | `verify-flow` ở 3 cỡ màn |

Không đổi tiền, khóa, schema. Bước 2 hiện dữ liệu cá nhân (tên người chơi), nên vòng review chạy thêm skill `rule-review`.

## Assumptions

1. Hai bước lớn hơn 400 dòng, vì phần lớn là CSS và màn có sẵn trên `exp/ui-c-web`. Tách nhỏ hơn làm hỏng màn giữa chừng.
2. Bước 1 và 2 lấy code từ `exp/ui-c-web`, rồi bỏ các thay đổi của nhánh đó lên `DESIGN.md` và `Notifications.tsx`, vì `main` đã có bản mới hơn (PR #98, #94, #101).
3. Thanh "Dùng app MONSPORT trên điện thoại" không hiện trên web khi ADR 0006 chưa Accepted.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Duyệt ADR 0006 (app mobile PWA) | Người dùng | none |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
- `verify-flow` passes at 390px, 1024px and 1280px.
