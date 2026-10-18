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
| "Mở trang của đơn vị" là đặt ô "Chọn đơn vị" của mục "Giờ trống" | App chưa có trang riêng cho từng đơn vị. Ô đó là chỗ người dùng xem các sân của đơn vị |
| Người dùng luôn bấm một kết quả, kể cả khi chỉ một đơn vị khớp | Tự mở đơn vị làm đổi màn hình khi người dùng còn đang gõ |
| Sau khi bấm kết quả, ô tìm và danh sách kết quả giữ nguyên | Người dùng thử đơn vị khác không phải gõ lại |

## Acceptance criteria

Dữ liệu chung: `GET /api/venues` trả ba đơn vị. "Cầu lông A" có "Sân 1" và "Sân 2". "Cầu lông B" có "Sân 1". "Bóng đá C" có "Sân Đông". Màn hình là mục "Giờ trống" của F-008.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Người chưa đăng nhập mở app | Gõ "Sân 1" vào ô "Tìm theo tên sân" | Danh sách kết quả có "Cầu lông A" và "Cầu lông B", mỗi mục kèm tên các sân khớp ("Sân 1"). Không có "Bóng đá C" |
| AC-2 | Như AC-1 | Gõ "san 1", rồi "SÂN 1", rồi "san dong" | "san 1" và "SÂN 1" cho kết quả như AC-1. "san dong" cho đúng một mục: "Bóng đá C" kèm "Sân Đông" |
| AC-3 | Kết quả của AC-1 đang hiện | Bấm "Cầu lông A" | Ô "Chọn đơn vị" có giá trị "Cầu lông A". Ô "Chọn sân" hiện "Sân 1" và "Sân 2" và chưa chọn sân nào. Focus chuyển tới ô "Chọn sân" (`document.activeElement` là ô đó). Ô tìm vẫn có "Sân 1" và danh sách kết quả vẫn hiện |
| AC-4 | Như AC-1 | Gõ "xyz" | Vùng `role="status"` hiện "Không có sân nào tên như vậy". Không có mục kết quả |
| AC-5 | Kết quả của AC-1 đang hiện | Xóa ô tìm, rồi gõ chỉ khoảng trắng | Không có mục kết quả. Không có câu "Không có sân nào tên như vậy" |
| AC-6 | Người dùng đã chọn "Cầu lông A", "Sân 1" và một ngày, và danh sách giờ trống đang hiện | Gõ "Sân Đông" và bấm "Bóng đá C" | Ô "Chọn đơn vị" là "Bóng đá C". Ô "Chọn sân" chưa chọn sân nào. Danh sách giờ trống cũ bị xóa. Ô "Chọn ngày" giữ ngày đã chọn. Không có `role="alert"`. Bấm đơn vị đang chọn cũng đặt lại ô "Chọn sân" |
| AC-7 | Người dùng vai trò `USER` đã đăng nhập | Mở app | Ô "Tìm theo tên sân" xuất hiện đúng một lần, trong mục "Giờ trống". Mục "Đặt sân" không có ô đó |

## Contract

Không đổi API và không đổi schema. Hàm thuần `normalizeName(text)` nằm trong `apps/web/src/features/venues/search.ts`. Nó chạy các bước theo đúng thứ tự này:

1. Chữ thường.
2. Tách dấu (NFD).
3. Bỏ dấu kết hợp (`\p{M}`).
4. Đổi `đ` thành `d`.
5. Gộp mọi dãy khoảng trắng thành một dấu cách.
6. Cắt khoảng trắng hai đầu.

NFD không tách `đ` và `Đ`, nên chữ thường phải đi trước. Hàm `findVenues(venues, query)` trả các đơn vị có ít nhất một sân khớp, kèm các sân khớp, theo thứ tự tên đơn vị.

Bấm một kết quả chạy cùng bước đặt lại với ô "Chọn đơn vị": đặt đơn vị, đặt lại sân, xóa danh sách giờ trống, xóa alert, giữ ngày. Sau đó web đặt focus vào ô "Chọn sân" sau khi ô đó render, bằng một ref và một `useEffect` chạy theo yêu cầu focus mà cú bấm đặt. Ô "Chọn sân" chỉ có khi đã chọn đơn vị, nên cú bấm không gọi `focus()` trực tiếp.

## Data

Không đổi.

## Build order

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Tìm theo tên sân | `apps/web/src/features/venues/search.ts`, `apps/web/src/features/venues/search.test.ts`, `apps/web/src/features/venues/VenueBrowser.tsx`, `apps/web/src/features/venues/VenueBrowser.test.tsx`, `apps/web/src/app/App.test.tsx`, `apps/web/src/app/styles.css`, `PROGRESS.md` | AC-1, AC-3 tới AC-6 trong `VenueBrowser.test.tsx`. AC-7 trong `App.test.tsx`. Các ca của AC-2 cũng ở `search.test.ts`: `Đ` viết hoa, `đ`, hai dấu cách, `ơ ư ă â ê ô` |

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
