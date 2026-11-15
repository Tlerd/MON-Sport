---
style: ste80
lang: vi
---

# F-034: Web khớp mẫu "Ra Sân" từng màn

Status: accepted
Source:

- Người dùng, 16/11/2026: giao diện web "quá xấu và không đúng tư duy thiết kế". Mẫu là `D:\websosanh\claude-fable-5.2-web`, trùng `docs/design/web-ui-v3/`. Dùng Sonnet để code lại. Chỉ sửa web.
- `docs/briefs/F-033-giao-dien-web-moi.md` và `docs/adr/0009-giao-dien-web-theo-mau-ra-san.md`: khung và luật "Sắp ra mắt" giữ nguyên.

## Goal

Mỗi màn web có bố cục, thứ bậc chữ, khoảng cách, thẻ, nút và trạng thái giống mẫu khi chạy với dữ liệu demo. Chức năng không đổi.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| `apps/mobile` | Người dùng chọn "Web: khớp mẫu từng màn" | Khi người dùng yêu cầu |
| API, schema, `packages/shared`, luật nghiệp vụ | Brief này chỉ đổi màn hình và dữ liệu demo | Không có kế hoạch |
| Chức năng của mẫu mà intake chưa có (đội, trò chuyện, khoảng cách) | Luật "Sắp ra mắt" của F-033 | Khi intake có |
| Dữ liệu demo trên live | Seed chỉ chạy với database local | Không có kế hoạch |

## Steps

1. `feat/<issue>-1-demo-seed`: `apps/api/prisma/seed.ts` thêm dữ liệu demo: booking trong 7 ngày tới, 8 trận mở đủ cả hai môn, vài trận cần host duyệt, yêu cầu chờ của chủ sân, vài người chơi. Seed vẫn chỉ chạy với `localhost`.
2. `feat/<issue>-2-web-fidelity`: người code so từng cặp màn bằng ảnh chụp (xem "So sánh") và sửa `apps/web/src`.

## So sánh

Script chụp: `.agents/skills/verify-flow/scripts/ui-compare.mjs <thư mục ảnh>`. Nó chụp mẫu và web ở 1440 và 390 px, cho người chơi, chủ sân và admin. Tên ảnh: `<d|m>-<màn>-<ref|web>.png`. Sửa tới khi mỗi cặp khớp về bố cục, cỡ chữ, khoảng cách, màu và thẻ. Dữ liệu khác nhau thì không tính là lệch.

## Acceptance criteria

- AC-1: Sau `pnpm db:seed` local, `GET /api/matches` trả ít nhất 8 trận, đủ cả hai môn (cầu lông và bóng đá).
- AC-2: Seed chạy hai lần liên tiếp không lỗi.
- AC-3: Phòng chờ web dùng một hàng bộ lọc (chuyển Tất cả/Trận đơn/Trận đội, Trình độ, Ngày) như mẫu. Chip môn nằm hàng riêng.
- AC-4: Thẻ trận (`mc`) có cuống vé trái với hình sân, giờ lớn, ngày, nhãn môn. Thân thẻ có nhãn loại, tiêu đề, địa điểm, hàng avatar, giá và nút hành động.
- AC-5: Chi tiết trận có hero, hàng `facts`, thanh tiến độ người chơi và lưới người chơi như mẫu.
- AC-6: Trang chủ có đủ ba cột như mẫu khi có dữ liệu: thẻ người dùng, ô tạo trận, danh sách trận, "Sắp ra sân", "Đơn vị".
- AC-7: Các trang `/san`, `/san/:id`, `/lich-cua-toi`, `/ho-so`, `/chu-san/*`, `/admin/*` khớp mẫu cùng màn ở 1440 px.
- AC-8: Từ 360 px, trang không cuộn ngang và không có chữ bị cắt ngoài ý muốn. `web-responsive` của `verify-flow` pass.
- AC-9: `pnpm check` pass. Mọi test cũ vẫn pass, chữ của nút giữ nguyên.

Test của AC-3 đến AC-6: `apps/web/src/features/matches/Lobby.test.tsx`, `apps/web/src/app/HomePage.test.tsx`, `apps/web/src/components/MatchCard.test.tsx` (new). AC-1, AC-2: `apps/api/prisma/seed.test.ts` (new). AC-7, AC-8: `verify-flow`.

## Allowed paths

- `apps/web/src/**`
- `apps/api/prisma/seed.ts`
- `apps/api/prisma/seed.test.ts`
- `.agents/skills/verify-flow/scripts/ui-compare.mjs`
- `docs/briefs/F-034-web-khop-mau-tung-man.md`
- `PROGRESS.md`
- `@map.md`

## Review

Một Reviewer mới cho mỗi PR. Màn hình thay đổi, nên chạy `verify-flow` local trước PR.
