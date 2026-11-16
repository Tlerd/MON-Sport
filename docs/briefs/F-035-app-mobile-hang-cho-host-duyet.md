---
style: ste80
lang: vi
---

# F-035: Hàng chờ và host duyệt trên app mobile

Status: accepted
Source: `docs/briefs/F-028-hang-cho-host-duyet-vao-tran.md` (web và API đã xong, BR-49 đến BR-52, UC-15). `docs/design/ke-hoach-v2.md` (W1, "port sang app"). Người dùng, 16/11/2026: "Bắt đầu port app mobile cho W1".

## Goal

Trên app `/app/`, host chọn "Vào ngay" hoặc "Host duyệt" khi mở trận. Người chơi xin vào và hủy yêu cầu. Host duyệt hoặc từ chối trong hàng chờ.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| API, schema, `packages/shared` | F-028 đã xong. Hợp đồng đủ | Không đổi |
| W2 đến W5 trên app | Mỗi tính năng có brief riêng | Brief sau |
| Web | Đã xong ở F-028 và F-033 | Không đổi |
| Thiết kế lại app theo mẫu mobile | Người dùng chọn "Web: khớp mẫu" cho F-034 | Khi người dùng yêu cầu |

## Quy tắc

1. Dùng `packages/client` và `packages/shared`. Chữ giống web: "Host duyệt", "Vào ngay", "Xin vào", "Hủy yêu cầu", "Hàng chờ (n)", "Duyệt", "Từ chối", "Đã gửi yêu cầu. Chờ host duyệt".
2. Gọi `api()` với `json:` khi có body, để header `content-type` đúng.
3. Ô bấm cao ít nhất 44px. Trang không cuộn ngang ở 360px và 390px. Dùng `tokens.css` và component có sẵn (`Sheet`, `Chip`, `StatusBadge`).
4. SSE của phòng chờ đã có (`useLobbyStream`). Sheet chi tiết tải lại khi có sự kiện của trận đang mở.

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Host mở sheet "Mở trận" của một booking | Xem sheet, chọn "Host duyệt", gửi | Sheet có "Vào ngay" (chọn sẵn) và "Host duyệt". App gửi `POST /api/matches` với `joinMode: "APPROVAL"`. Không chọn thì gửi `joinMode: "INSTANT"` |
| AC-2 | Phòng chờ có trận `joinMode: "INSTANT"` và trận `"APPROVAL"` | Người dùng mở tab | Thẻ "Host duyệt" có nhãn "Host duyệt" và nút "Xin vào". Thẻ "Vào ngay" giữ "Vào trận" |
| AC-3 | Người dùng bấm "Xin vào" trên thẻ "Host duyệt" | Bấm | Gửi `POST /api/matches/:id/join`. Thẻ hiện "Đã gửi yêu cầu. Chờ host duyệt" và "Hủy yêu cầu". `joinedCount` không đổi |
| AC-4 | Người dùng đã xin vào | Bấm "Hủy yêu cầu" | Gửi `POST /api/matches/:id/leave`. Thẻ quay về "Xin vào" |
| AC-5 | `myRequest: "REJECTED"`. Một lần khác `join` trả 409 "Host đã từ chối yêu cầu của bạn" | Mở thẻ. Bấm "Xin vào" | Thẻ hiện "Host đã từ chối yêu cầu của bạn" và không có nút "Xin vào". Lỗi 409 hiện đúng chữ của API |
| AC-6 | Host mở sheet chi tiết trận "Host duyệt" có 2 yêu cầu chờ | Mở sheet | Gọi `GET /api/matches/:id/requests`. Sheet hiện "Hàng chờ (2)" với tên, số điện thoại (link `tel:`), nút "Duyệt" và "Từ chối" cho mỗi người |
| AC-7 | Hàng chờ có Lan | Host bấm "Duyệt". Một lần khác bấm "Từ chối" | Gửi `POST .../requests/:userId/approve` rồi `.../reject`. Lan rời hàng chờ. Duyệt thành công thì danh sách người chơi và `joinedCount` cập nhật |
| AC-8 | Duyệt trả 409 "Trận đã đủ người". Một lần khác 409 "Yêu cầu này đã hết hạn" | Host bấm "Duyệt" | Sheet hiện đúng chữ của API và tải lại chi tiết và hàng chờ |
| AC-9 | Sheet chi tiết của host đang mở. Luồng SSE gửi sự kiện `match` cho trận đó | Sự kiện tới | Chi tiết và hàng chờ tải lại một lần |
| AC-10 | Thông báo `MATCH_JOIN_REQUESTED`, `MATCH_JOIN_APPROVED`, `MATCH_JOIN_REJECTED` | Mở tab Thông báo | Mỗi thẻ hiện tiêu đề và nội dung từ `packages/shared`. Bấm thẻ mở trận hoặc danh sách như `MATCH_CANCELLED` |
| AC-11 | Màn 360px và 390px | Mở phòng chờ, sheet chi tiết và hàng chờ | Trang không cuộn ngang. Nút cao từ 44px |
| AC-12 | `verify-flow` luồng `mobile-lobby` (mở rộng) | Chạy local | Host mở trận "Host duyệt", người chơi xin vào, host duyệt, người chơi thấy suất. Pass ở 360px và 390px |

## Allowed paths

- `apps/mobile/src/features/lobby/**`
- `apps/mobile/src/features/my/**`
- `apps/mobile/src/features/notifications/**`
- `apps/mobile/src/components/**`
- `apps/mobile/src/app/mobile.css`
- `packages/client/src/lobby.ts` và test của nó
- `.agents/skills/verify-flow/scripts/mobile-lobby.mjs` và `references/flows/mobile-lobby.md`
- `docs/briefs/F-035-app-mobile-hang-cho-host-duyet.md`, `PROGRESS.md`, `@map.md`

## Steps

1. `feat/257-1-mobile-open-and-request`: AC-1 đến AC-5, AC-2 của thông báo (AC-10).
2. `feat/257-2-mobile-host-queue`: AC-6 đến AC-9, AC-11, AC-12.

## Review

Một Reviewer mới cho mỗi PR. Có đổi màn hình, nên chạy `verify-flow` local trước PR. Không đụng tiền, schema hay dữ liệu cá nhân mới: `rule-review` không bắt buộc, nhưng hàng chờ hiện số điện thoại, nên Reviewer kiểm BR-20.
