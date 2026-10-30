---
style: ste80
lang: vi
---

# F-021: Tab Lịch của tôi trên app mobile

Status: accepted
Source: `docs/design/ke-hoach-app-mobile.md` (bước 5, tách đôi), UC-6, UC-8 luồng 8.2, BR-11, BR-12, BR-20. `docs/briefs/F-020-app-mobile-dat-san.md` giao việc xem và hủy booking cho tab này. Quyết định tách F-021 (Lịch của tôi) khỏi F-022 (Phòng chờ): xem "Assumptions" mục 1.

## Goal

Người dùng đã đăng nhập mở tab "Lịch của tôi" trên `/app/`, xem booking và trận đã vào chia theo Sắp tới, Trận đã vào, Lịch sử, và hủy một booking còn được hủy. Kiểm tra bằng `verify-flow --app mobile` ở 360px và 390px.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Tab Phòng chờ: feed trận, vào trận, SSE | Việc thời gian thực có rủi ro riêng. Tab này không cần API mới và không cần SSE | F-022 |
| Rời trận và hủy trận của host (UC-8 luồng 8.1, UC-9) | Đây là hành động trên trận. Hành động ở lại cùng tab Phòng chờ để một chỗ giữ luật của trận | F-022 |
| Sửa API hoặc schema | `GET /api/bookings/mine`, `POST /api/bookings/:id/cancel`, `GET /api/matches/joined` đã đủ | Không cần |
| Đổi `apps/web` để dùng hàm mới của `packages/client` | Web chạy đúng. Giữ thay đổi nhỏ | Một brief `chore` sau |
| Gộp bảng nhãn trạng thái vào `packages/shared` | Web giữ bản riêng. Gộp là việc dọn, không đổi hành vi | Một brief `chore` sau |
| Cập nhật tức thì bằng SSE hoặc thăm dò định kỳ | Tránh tốn kết nối và request (giới hạn 40 luồng SSE mỗi instance). App tải lại khi mở tab, khi quay lại màn hình, và sau khi hủy | Khi người dùng thật yêu cầu |
| Trận đã vào đã qua giờ bắt đầu | Danh sách chỉ giữ trận sắp diễn ra. Booking đã qua nằm ở Lịch sử | Câu hỏi mở 1 |
| Thông báo trong app (tab Thông báo) | Thuộc F-013 trên web và một brief riêng cho app | Brief tab Thông báo |

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Khách chưa đăng nhập mở `/app/lich-cua-toi` | Màn hình tải xong | Thấy "Đăng nhập để xem lịch của bạn" và nút "Đăng nhập". Bấm nút mở sheet đăng nhập. Sau khi đăng nhập, danh sách tải và không mở lại trang |
| AC-2 | Người dùng đã đăng nhập, `GET /api/bookings/mine` và `GET /api/matches/joined` trả dữ liệu | Mở tab | Thấy 3 chip: "Sắp tới", "Trận đã vào", "Lịch sử". "Sắp tới" được chọn. Bấm chip khác đổi danh sách và giữ chip đó được chọn |
| AC-3 | `now` = 02/11/2026 10:00 (UTC+7). Booking A `PENDING` bắt đầu 20:00 cùng ngày. B `CONFIRMED` bắt đầu 08:00 cùng ngày. C `CANCELLED` bắt đầu ngày mai. D `REJECTED` bắt đầu ngày mai. E `EXPIRED` bắt đầu ngày mai | Hàm `splitMine(rows, now)` chạy, trong `TZ=UTC` và `TZ=Asia/Bangkok` | Sắp tới có đúng A. Lịch sử có B, C, D, E. Kết quả giống nhau ở cả hai múi giờ |
| AC-4 | Sắp tới có 3 booking bắt đầu 18:00, 07:00, 12:00 cùng ngày. Lịch sử có 3 booking ở 3 ngày khác nhau | Danh sách hiện | Sắp tới theo giờ bắt đầu tăng dần: 07:00, 12:00, 18:00. Lịch sử theo giờ bắt đầu giảm dần |
| AC-5 | Booking `PENDING` của "Sân 1", đơn vị "Cầu lông An Phú", 20:00–21:00 ngày 03/11/2026, `priceTotal` 120000, có trận `joinedCount` 3, `capacity` 10 | Thẻ hiện | Thẻ có tên đơn vị, "Sân 1", ngày, "20:00–21:00", "120.000đ", nhãn trạng thái "Chờ xác nhận", và dòng "Trận mở: 3/10 suất". Thẻ không hiện số điện thoại của người chơi (BR-20) |
| AC-6 | Người dùng không có booking sắp tới | Mở chip "Sắp tới" | Thấy "Chưa có booking sắp tới" và nút "Đặt sân". Bấm nút đi tới `/app/`. Chip "Trận đã vào" và "Lịch sử" có câu rỗng riêng: "Bạn chưa vào trận nào", "Chưa có lịch sử" |
| AC-7 | Booking `PENDING` bắt đầu sau 3 giờ | Bấm "Hủy", rồi "Hủy booking" trong sheet xác nhận | Sheet "Hủy booking này?" hiện sân, giờ và giá. Bấm xác nhận gửi `POST /api/bookings/:id/cancel`. Thẻ chuyển sang Lịch sử với nhãn "Đã hủy" |
| AC-8 | `now` = 10:00. Booking `CONFIRMED` bắt đầu 17:00 cùng ngày (7 giờ). Booking `CONFIRMED` bắt đầu 15:00 cùng ngày (5 giờ) | Hai thẻ hiện | Thẻ 17:00 có nút "Hủy". Thẻ 15:00 không có nút "Hủy", có link "Gọi chủ sân để hủy" tới `tel:` của đơn vị (BR-11, BR-12) |
| AC-9 | Hủy trả 409 "Booking đã được xử lý". Một lần khác hủy trả 401 | Xác nhận hủy | Với 409: sheet hiện thông báo của API và danh sách tải lại. Với 401: sheet đóng, sheet đăng nhập mở và hiện "Phiên đăng nhập đã hết. Hãy đăng nhập lại." |
| AC-10 | `GET /api/matches/joined` trả 3 trận. T1 có `hostId` là người dùng. T2 do người khác làm host, `joinedCount` 4 trên `capacity` 10. T3 do người khác làm host, `joinedCount` 10 trên 10, bắt đầu sau 2 ngày | Mở chip "Trận đã vào" | Chỉ thấy T2 và T3. T1 không hiện (host thấy trận ở thẻ booking). T2 có "4/10 suất". T3 có "10/10 suất" và nhãn "Đầy". Mỗi thẻ có tên host, tên đơn vị, sân, giờ và một trong "Đã xác nhận" hoặc "Chưa xác nhận" theo `bookingStatus`. Không có số điện thoại |
| AC-11 | Người dùng có vai trò `OWNER` | Mở `/app/lich-cua-toi` | Ứng dụng chuyển tới `/app/chu-san/yeu-cau` |
| AC-12 | Danh sách đã tải. Tab ẩn rồi hiện lại (`visibilitychange`). Một lần khác API lỗi mạng | Tab hiện lại. Lần khác tải lần đầu | Lần tab hiện lại: danh sách tải lại một lần. Lần lỗi: thấy "Không tải được" và nút "Thử lại". Bấm nút tải lại |
| AC-13 | Luồng `mobile-history` của `verify-flow`: người chơi seed đăng nhập, mở "Lịch của tôi" ở 360px và 390px | Luồng chạy | Trang không cuộn ngang. Các ô bấm cao ít nhất 44px |
| AC-14 | Cùng luồng: người chơi đã có một booking `PENDING` sắp tới | Bấm "Hủy" và xác nhận | Thẻ rời "Sắp tới" và nằm ở "Lịch sử" với nhãn "Đã hủy". Báo cáo `verify-flow` ghi 0 bước lỗi |

## Contract

Không đổi `packages/shared` và không đổi API.

| Endpoint or schema | Change | Request | Response and errors |
|---|---|---|---|
| `GET /api/bookings/mine` | unchanged | không | 200 `MyBookingView[]` (sắp theo `createdAt` giảm dần, nên app tự sắp lại). 401 |
| `POST /api/bookings/:id/cancel` | unchanged | không | 200 `MyBookingView`. 400 · 403 · 404 · 409 với thông báo tiếng Việt. 401 |
| `GET /api/matches/joined` | unchanged | không | 200 `MatchView[]` (gồm cả trận do người dùng làm host, và trận đã qua). 401 |
| `splitMine`, `canCancel`, `sortUpcoming`, `sortHistory` trong `packages/client/src/my-bookings.ts` | new | `rows`, `now` | Hàm thuần, có test chạy ở `TZ=UTC` và `TZ=Asia/Bangkok`. `canCancel` theo BR-11 và BR-12. Server vẫn là nơi kiểm cuối |

## Data

Không đổi bảng nào.

## Build order

One pull request for each row. Each pull request passes the check command on its own.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Hàm thuần của app: `splitMine`, `canCancel`, hai hàm sắp xếp | `packages/client/src/my-bookings.ts`, `packages/client/src/my-bookings.test.ts`, `packages/client/src/index.ts` | AC-3, AC-4, phần tính toán của AC-8 |
| 2 | Màn Lịch của tôi: chip, thẻ, trạng thái rỗng, khách, chủ sân, tải lại | `apps/mobile/src/features/my/`, `apps/mobile/src/app/router.tsx` | AC-1, AC-2, AC-5, AC-6, AC-10, AC-11, AC-12 |
| 3 | Hủy booking và luồng `verify-flow` | `apps/mobile/src/features/my/`, `.agents/skills/verify-flow/flows/mobile-history.md`, `.agents/skills/verify-flow/scripts/mobile-history.mjs`, `.agents/skills/verify-flow/scripts/run.mjs` | AC-7, AC-8, AC-9, AC-13, AC-14 |

## Edit boundaries

- May edit: các đường dẫn trong bảng "Build order", và `PROGRESS.md` ở bước cuối.
- Leave unchanged without approval: `apps/web/`, `apps/api/`, `packages/shared/`, `prisma/`, và `apps/mobile/src/features/venues/`, `apps/mobile/src/features/bookings/`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Dữ liệu cá nhân: số điện thoại người chơi lộ cho người không có quyền (BR-20) | Thẻ trận ở bước 2 | Test AC-5 và AC-10 kiểm DOM không có số điện thoại. Chỉ `venuePhone` (công khai) xuất hiện |
| Luật hủy sai giữa app và server (BR-11, BR-12) | `canCancel` ở bước 1 và nút ở bước 3 | Server giữ quyền quyết định. Test AC-8 ở hai phía ngưỡng 6 giờ. Lỗi 409 hiện thông báo của server |
| Hai nơi chia "Sắp tới" và "Lịch sử" lệch nhau | `splitMine` ở bước 1 | Một hàm duy nhất và test ở hai múi giờ (AC-3) |
| Phiên hết hạn khi hủy | Bước 3 | AC-9 mở lại đăng nhập và giữ danh sách |

## Assumptions

1. Tách F-021 (Lịch của tôi) khỏi F-022 (Phòng chờ). Lý do: Lịch của tôi không cần API mới và không cần SSE, nên làm trước và đỡ rủi ro. Phòng chờ cần SSE và chạm giới hạn 40 luồng mỗi instance. Sửa lại bằng cách gộp hai brief.
2. Booking có trận (người dùng là host) hiện ở thẻ booking với dòng "Trận mở". Chip "Trận đã vào" không liệt kê trận do chính người dùng làm host. Lý do: `GET /api/matches/joined` trả cả trận của host, nên cùng một trận sẽ hiện hai lần.
3. Chip "Trận đã vào" chỉ giữ trận chưa bắt đầu và chưa hủy. Lý do: Lịch sử chỉ nói về booking, và danh sách trận quá khứ làm danh sách dài.
4. Hạn xác nhận hiện ở thẻ là hạn do server tính, nếu `MyBookingView.confirmDeadline` có giá trị. Không có thì không hiện dòng hạn.
5. Hủy booking dùng sheet xác nhận, vì hủy không đảo ngược được. Rời trận không có trong brief này nên chưa cần xác nhận.
6. Chủ sân mở tab này đi tới `chu-san/yeu-cau`, giống F-020. Admin thấy màn "Dùng web để quản trị" của `App`.
7. Khi người dùng đăng nhập từ tab này, danh sách tải ngay mà không rời trang.

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Trận đã vào đã qua giờ bắt đầu có hiện ở Lịch sử không? Mặc định: không (Assumptions 3) | Người dùng | none |
| Host muốn thấy trận của mình ở chip "Trận đã vào" hay ở thẻ booking như hiện tại? Mặc định: thẻ booking (Assumptions 2) | Người dùng | AC-5, AC-10 |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
