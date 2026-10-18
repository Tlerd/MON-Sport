---
style: ste80
lang: vi
---

# F-010: Tìm theo tên sân

Status: draft
Source: intake `docs/requirements/intake-monsport-v1.md`: UC-2 (bảng use case: "Tìm theo tên sân thì mở trang của đơn vị chứa sân đó", ví dụ UC-2: bạn tìm "Sân 1" và app mở trang "Cầu lông A"). `docs/requirements/use-cases.md` UC-2 (2.1). Phần còn lại của UC-2 đã xong ở F-008.

## Goal

Người dùng, kể cả người chưa đăng nhập, gõ tên sân vào ô tìm và mở đơn vị chứa sân đó. Kiểm tra bằng ví dụ của intake: gõ "Sân 1", bấm "Cầu lông A", và thấy các sân của "Cầu lông A".

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Tìm theo tên đơn vị, địa chỉ hay môn thể thao | Intake chỉ cho tìm theo tên sân (2.1) | Khi danh sách đơn vị dài hơn 10 |
| API tìm kiếm | `GET /api/venues` đã trả mọi sân. Mức 200 lần xem mỗi ngày và vài đơn vị không cần tìm phía server | Khi danh sách đơn vị chậm hơn mục tiêu 300 ms |
| Chọn sẵn sân khớp sau khi mở đơn vị | Use case 2.1 nói "mở trang của đơn vị", rồi người dùng chọn sân ở bước 4 | Khi người dùng yêu cầu |

## Assumptions

| Assumption | Reason |
|---|---|
| Ô tìm không phân biệt hoa thường và dấu. Chữ `đ` khớp với `d` | Người dùng gõ trên điện thoại hay bỏ dấu. Intake không nêu quy tắc. Chọn quy tắc ít gây bỏ sót nhất |
| Ô tìm cắt khoảng trắng hai đầu. Chuỗi rỗng không hiện kết quả | Một ô trống không tìm gì |
| Tên sân khớp khi chứa chuỗi tìm | "san 1" khớp "Sân 1" và "Sân 10" |

## Acceptance criteria

Dữ liệu chung: `GET /api/venues` trả ba đơn vị. "Cầu lông A" có "Sân 1" và "Sân 2". "Cầu lông B" có "Sân 1". "Bóng đá C" có "Sân Đông". Màn hình là mục "Giờ trống" của F-008.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Người chưa đăng nhập mở app | Gõ "Sân 1" vào ô "Tìm theo tên sân" | Danh sách kết quả có "Cầu lông A" và "Cầu lông B", mỗi mục kèm tên các sân khớp ("Sân 1"). Không có "Bóng đá C" |
| AC-2 | Như AC-1 | Gõ "san 1", rồi "SÂN 1", rồi "san dong" | "san 1" và "SÂN 1" cho kết quả như AC-1. "san dong" cho đúng một mục: "Bóng đá C" kèm "Sân Đông" |
| AC-3 | Kết quả của AC-1 đang hiện | Bấm "Cầu lông A" | Ô "Chọn đơn vị" có giá trị "Cầu lông A". Ô "Chọn sân" hiện "Sân 1" và "Sân 2" và chưa chọn sân nào. Focus chuyển tới ô "Chọn sân" |
| AC-4 | Như AC-1 | Gõ "xyz" | Vùng `role="status"` hiện "Không có sân nào tên như vậy". Không có mục kết quả |
| AC-5 | Kết quả của AC-1 đang hiện | Xóa ô tìm, rồi gõ chỉ khoảng trắng | Không có mục kết quả. Không có câu "Không có sân nào tên như vậy" |
| AC-6 | Người dùng đã chọn "Cầu lông A", "Sân 1" và một ngày, và danh sách giờ trống đang hiện | Gõ "Sân Đông" và bấm "Bóng đá C" | Ô "Chọn đơn vị" là "Bóng đá C". Ô "Chọn sân" chưa chọn sân nào. Danh sách giờ trống cũ bị xóa |
| AC-7 | Người dùng vai trò `USER` đã đăng nhập | Mở app | Mục "Giờ trống" có ô "Tìm theo tên sân". Form "Đặt sân" không đổi |

## Contract

Không đổi API và không đổi schema. Hàm thuần `normalizeName(text)` trong `apps/web/src/features/venues/search.ts`: chữ thường, tách dấu (NFD), bỏ dấu kết hợp (`\p{M}`), đổi `đ` thành `d`, cắt khoảng trắng hai đầu. Hàm `findVenues(venues, query)` trả các đơn vị có ít nhất một sân khớp, kèm các sân khớp, theo thứ tự tên đơn vị.

## Data

Không đổi.

## Build order

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Tìm theo tên sân | `apps/web/src/features/venues/search.ts`, `apps/web/src/features/venues/search.test.ts`, `apps/web/src/features/venues/VenueBrowser.tsx`, `apps/web/src/features/venues/VenueBrowser.test.tsx`, `apps/web/src/app/App.test.tsx`, `apps/web/src/app/styles.css`, `PROGRESS.md` | AC-1 tới AC-7 |

## Edit boundaries

- May edit: các path trong "Build order".
- Leave unchanged without approval: `apps/api/`, `packages/shared/`, `apps/web/src/features/bookings/`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Quy tắc khớp bỏ sót tên sân có dấu đặc biệt | `normalizeName` | AC-2 và test hàm thuần với `Đ`, `đ`, dấu kết hợp |
| Focus mất khi mở đơn vị | `VenueBrowser.tsx` | AC-3 kiểm focus |

Slice này không đổi tiền, khóa, schema hay dữ liệu cá nhân. Nó cần một Reviewer trong phiên mới. Nó không cần `rule-review`.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Có chọn sẵn sân khi chỉ một sân khớp không? Slice này không chọn sẵn | Người dùng | Không |

## Done when

- Every AC has a passing test with its label in the name.
- `pnpm check` passes.
- A Reviewer in a fresh session reviewed the pull request.
