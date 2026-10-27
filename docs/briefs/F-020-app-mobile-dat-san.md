---
style: ste80
lang: vi
---

# F-020: App mobile, tab Đặt sân

Status: draft, chờ review

Source:

- Intake: UC-2, UC-3, BR-2 tới BR-5, BR-7, BR-9, BR-27, và phần "Kiểm tra" (dòng UC-2 và hai dòng UC-3).
- ADR 0006.
- `docs/design/ke-hoach-app-mobile.md`: bước 4 và bảng "Màn chính" (Đặt sân, Đơn vị, Gửi yêu cầu).
- `DESIGN.md`: mục "Mobile app shell", "Time windows", "Words", và các dòng `SlotGrid`, `ActionBar`, `Sheet`.
- Brief F-019 (khung app).

## Goal

Người dùng mở `/app/` trên điện thoại, chọn một đơn vị, chọn ô giờ trống của một sân, và gửi yêu cầu đặt sân trong một sheet. Kiểm tra bằng `verify-flow --app mobile` ở 390px.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Tìm theo tên sân trong app (UC-2, F-010) | Nút tìm của `TopBar` cần một màn riêng. Web đã có tìm theo tên | Brief của nút tìm trên app |
| Mở trận sau khi gửi yêu cầu (UC-7) | Thuộc tab Phòng chờ | Brief Lịch của tôi và Phòng chờ (bước 5 của kế hoạch) |
| Xem và hủy booking đã gửi (UC-4, F-009) | Thuộc tab Lịch của tôi | Brief bước 5 |
| Đổi `apps/web` để dùng các hàm mới của `packages/client` | Web đang chạy đúng. Đổi web làm brief này lớn hơn và có rủi ro | Một brief `chore` sau, khi cần |
| Chọn giờ kết thúc bằng cách bấm ô thứ hai trên hàng | Sheet đã có chip thời lượng. Một cách chọn là đủ cho bản đầu | Khi người dùng thử thật yêu cầu |
| Web tự chuyển điện thoại sang `/app/` | Câu hỏi mở của F-019. Brief này không đổi web | Câu hỏi mở bên dưới |
| Ngày xa hơn 6 ngày tới | Web cũng chỉ có 7 chip ngày. Intake không yêu cầu | Khi chủ sân yêu cầu |

## Acceptance criteria

Mỗi AC có một test. Tên test bắt đầu bằng nhãn, ví dụ `AC-1`. Test của màn dùng `fetch` giả lập và giờ hiện tại giả lập: `now` = `2026-10-29T10:00:00+07:00` (Thứ Năm). Dữ liệu giả lập theo seed: đơn vị "Cầu lông A" có điện thoại `0912345678`, mở `360` (06:00), đóng `1380` (23:00), và "Sân 1" có `priceNormal` = 80000, `pricePeak` = 120000. Giờ cao điểm là 17:00–22:00 (BR-4).

Test của AC-1 đặt `process.env.TZ = 'America/New_York'` trước khi gọi hàm, rồi trả lại giá trị cũ. Test của AC-9 thay `HTMLElement.prototype.scrollTo` bằng một hàm giả lập, vì jsdom không tính bố cục.

Hàm mới ở `packages/client/src/booking.ts`:

```ts
DURATIONS: number[]                                          // [60, 90, 120, 150, 180]
slotAt(date: string, minute: number): string                 // như apps/web/src/features/bookings/slot.ts
dayChipLabel(ymd: string): string                           // "T6 30/10"
dayHeading(ymd: string): string                             // "Thứ Sáu, 30/10/2026"
priceRangeK(courts: CourtView[]): string                    // "80k–120k"
startableMinutes(date: string, free: FreeRange[], now: Date): number[] // ô có ít nhất 60 phút trống liền sau, và bắt đầu sau now + 60 phút (BR-9)
durationsAt(date: string, start: number, free: FreeRange[], now: Date): number[] // DURATIONS vừa trong khoảng trống chứa start. [] khi start không có trong startableMinutes
```

| Label | Given | When | Then |
|---|---|---|---|
| AC-1 | Không có | Test gọi các hàm định dạng | `dayChipLabel('2026-10-30')` = `T6 30/10`. `dayHeading('2026-10-30')` = `Thứ Sáu, 30/10/2026`. `priceRangeK` của hai sân 80000/120000 và 70000/100000 = `70k–120k`. Với một sân 100000/100000 thì = `100k`. Kết quả không đổi khi `TZ` của máy là `America/New_York` |
| AC-2 | `date` = `2026-10-30`, `free` = 18:00–20:00 và 21:00–23:00 (giờ Việt Nam), `now` như trên | Test gọi `startableMinutes` | Kết quả = `[1080, 1110, 1140, 1260, 1290, 1320]`. 19:30 và 22:30 không có, vì sau chúng còn dưới 60 phút trống (BR-3) |
| AC-3 | `free` và `now` như AC-2 | Test gọi `durationsAt` với `start` = 1080, rồi 1140, rồi 1200 | `[60, 90, 120]`, rồi `[60]`, rồi `[]` |
| AC-4 | Khách chưa đăng nhập. `GET /api/venues` trả 3 đơn vị của seed | Mở `/app/` | Màn hiện thông báo UC-2 đầy đủ: "App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt." Có 3 thẻ. Thẻ "Cầu lông A" có 3 dòng. Dòng 1 là tên. Dòng 2 là icon môn, "Cầu lông" và "<n> sân", với `n` = số sân trong dữ liệu giả lập. Dòng 3 là `80k–120k · 06:00–23:00` |
| AC-5 | Màn như AC-4 | Bấm chip "Bóng đá", rồi chip "Tất cả" | Chỉ còn thẻ "Bóng đá A", rồi lại có 3 thẻ. Chip đang chọn có `aria-pressed="true"` |
| AC-6 | `GET /api/venues` trả 500 | Mở `/app/` | Màn hiện "Không tải được danh sách đơn vị" và nút "Thử lại". Bấm nút thì app gọi lại `GET /api/venues` |
| AC-7 | Màn như AC-4 | Bấm thẻ "Cầu lông A" | URL là `/app/don-vi/<venueId>`. `TopBar` có tiêu đề "Cầu lông A" và mũi tên quay lại. Không có `TabBar`. Màn có thông báo UC-2 đầy đủ. `ContextBar` có 7 chip ngày: "Hôm nay", "T6 30/10", … "T4 04/11". "Hôm nay" đang chọn. Bấm mũi tên quay lại thì URL là `/app/` và `TabBar` hiện lại |
| AC-8 | Màn Đơn vị, chọn chip "T6 30/10". `availability` của "Sân 1" trả `free` như AC-2 | Màn hiện hàng giờ | App gọi `GET /api/courts/<id>/availability?date=2026-10-30` một lần cho mỗi sân. Mỗi sân có một hàng 34 ô, từ 06:00 tới 22:30. Ô 18:00, 18:30, 19:00, 21:00, 21:30, 22:00 là nút. Ô khác có `aria-disabled="true"` và không nhận focus. Ô từ 17:00 tới 21:30 có class `peak-marker` |
| AC-9 | Màn như AC-8, ngày không phải hôm nay | Màn mở xong, rồi bấm chip cửa sổ "Sáng 6–12" | Lúc mở, mỗi hàng gọi `scrollTo` với `left` = `offsetLeft` của ô `data-minute="1020"` (17:00, cửa sổ Tối). Sau khi bấm "Sáng 6–12", mỗi hàng gọi `scrollTo` với `left` = `offsetLeft` của ô `data-minute="360"`. Chip cửa sổ không lọc ô: hàng vẫn có 34 ô |
| AC-10 | Màn như AC-8 | Bấm ô 18:00 của "Sân 1" | Ô có class `slot-selected`. `ActionBar` hiện "Sân 1 · 18:00–19:00", giá `120k`, nút "Gửi yêu cầu", và link "Gọi chủ sân" có `href="tel:0912345678"`. `TopBar` có nút "Gọi chủ sân" với cùng `href`. Đổi chip ngày thì bỏ chọn ô và ẩn `ActionBar` |
| AC-11 | Mọi `availability` trả `free` = `[]` | Màn Đơn vị hiện | Màn hiện "Hết giờ trống trong ngày này. Hãy chọn ngày khác." và không có nút ô giờ |
| AC-12 | Chọn "T6 30/10", rồi chọn "T7 31/10" trước khi câu trả lời của ngày 30/10 về | Câu trả lời của ngày 31/10 về trước, rồi câu trả lời của ngày 30/10 về | Hàng giờ theo ngày 31/10. Câu trả lời trễ không thay hàng giờ |
| AC-13 | `GET /api/venues` không có `<venueId>` của URL | Mở `/app/don-vi/<venueId>` | Màn hiện "Không tìm thấy đơn vị" và nút "Về danh sách" mở `/app/` |
| AC-14 | Khách chưa đăng nhập, ô 18:00 đã chọn | Bấm "Gửi yêu cầu", rồi đăng nhập đúng bằng `0901234567` trong sheet đăng nhập | Sheet đăng nhập của F-019 mở. Sau khi đăng nhập, sheet đăng nhập đóng, sheet "Gửi yêu cầu" mở với ô 18:00 vẫn chọn |
| AC-15 | Người dùng An đã đăng nhập, ô 18:00 ngày 30/10 đã chọn | Bấm "Gửi yêu cầu" | Sheet "Gửi yêu cầu" hiện "Sân 1", "Thứ Sáu, 30/10/2026", `18:00–19:00`, chip thời lượng "1 giờ", "1,5 giờ", "2 giờ" ("1 giờ" đang chọn), giá `120.000đ`, và câu "Chủ sân xác nhận trước 12:00 hôm nay. Bạn trả tiền tại sân." (BR-7: 10:00 + 2 giờ) |
| AC-16 | Sheet như AC-15 | Bấm chip "1,5 giờ" | Sheet hiện `18:00–19:30` và giá `180.000đ` (BR-4, BR-5). `ActionBar` hiện cùng khoảng giờ và giá `180k` |
| AC-17 | Sheet như AC-15 | Bấm nút chính "Gửi yêu cầu" và API trả 201 với `status` = `PENDING` | App gửi `POST /api/bookings` với `{"courtId":"<Sân 1>","startAt":"2026-10-30T18:00:00+07:00","endAt":"2026-10-30T19:00:00+07:00"}`. Sheet hiện "Đã gửi yêu cầu" và `StatusBadge` "Chờ xác nhận" có icon. Nút chính bị khóa khi đang gửi. Đóng sheet thì ô bỏ chọn và app gọi lại `availability` của ngày đó |
| AC-18 | Sheet như AC-15 | API trả 409 | Sheet vẫn mở và hiện "Khung giờ này vừa có người đặt". App gọi lại `availability`. Với 400 hoặc 403, sheet hiện câu `message` của API |
| AC-19 | Màn như AC-8, với 2 sân. `free` của "Sân 2" = 17:00–19:00, nên ô nút của "Sân 2" là 17:00, 17:30, 18:00 | Focus ở ô 18:00 của "Sân 1". Bấm mũi tên phải, rồi mũi tên xuống | Mũi tên phải: focus tới ô nút kế tiếp trên hàng (18:30). Mũi tên xuống: focus tới ô nút của sân kế tiếp có cùng phút. Khi phút đó không là nút, focus tới ô nút gần nhất theo phút, và ô sớm hơn khi hai ô cách bằng nhau. Ở đây focus tới ô 18:00 của "Sân 2". Ô `aria-disabled` bị bỏ qua |
| AC-20 | `date` = `2026-10-29`, `now` = 10:00 ngày đó, `free` = 10:30–13:00 | Test gọi `startableMinutes`, rồi `durationsAt` với `start` = 690 và 660 | `startableMinutes` = `[690, 720]`. 10:30 và 11:00 không có, vì hạn xác nhận của chúng không sau `now` (BR-9). `durationsAt(…, 690, …)` = `[60, 90]`. `durationsAt(…, 660, …)` = `[]` |
| AC-21 | Sheet như AC-15, nhưng ô đã chọn là 21:30 ngày 30/10 (`free` như AC-2) | Bấm chip "1,5 giờ" | Sheet hiện `21:30–23:00` và giá `140.000đ`: 60.000 + 40.000 + 40.000, vì 22:00 hết giờ cao điểm (BR-4, BR-5). `ActionBar` hiện giá `140k` |
| AC-22 | `availability` của "Sân 1" trả 500 | Màn Đơn vị hiện | Hàng của "Sân 1" hiện "Không tải được giờ trống" và nút "Thử lại". Câu "Hết giờ trống trong ngày này" không hiện. Bấm "Thử lại" thì app gọi lại `availability` của sân đó |

`verify-flow --app mobile` không phải AC, vì `ac-check` chỉ đọc test. Nó nằm ở "Done when" và ở cột Tests của PR 3.

## Contract

Brief này không thêm endpoint và không đổi `packages/shared`. App gọi các endpoint đã có:

- `GET /api/venues`: trả `VenueView[]`.
- `GET /api/courts/:id/availability?date=YYYY-MM-DD`: trả `Availability` (brief F-008).
- `POST /api/bookings`: nhận `CreateBookingRequest`, trả `BookingView`. 409 khi khung giờ vừa có người đặt (BR-1).
- `POST /api/auth/login`, `GET /api/auth/me`: qua sheet đăng nhập của F-019.

| Thứ | Change | Chi tiết |
|---|---|---|
| `packages/client/src/booking.ts` | new | Các hàm ở phần Acceptance criteria. Chỉ import từ `@monsport/shared`. `index.ts` export file này |
| `ActionBar` (`apps/mobile/src/components/`) | thêm prop | `secondary?: { label: string; href: string }`: một link phụ bên cạnh nút chính, ví dụ "Gọi chủ sân" |
| Route của app | thêm | `/app/` là danh sách đơn vị. `/app/don-vi/:id` là màn Đơn vị, một màn chi tiết của tab Đặt sân |

## Data

Không đổi bảng nào. Giá trên màn chỉ để xem. Server tính `priceTotal` khi nhận yêu cầu (BR-5), và sheet hiện `priceTotal` của câu trả lời sau khi gửi.

## Build order

Mỗi dòng là một PR. Mỗi PR qua `pnpm check`. Coder đọc `apps/web/src/app/BookPage.tsx` để biết cách web tính ô và hạn xác nhận, nhưng không import từ `apps/web`.

`setOnBack` và `setTopBarActions` của `App.tsx` là setter của `useState`. Màn Đơn vị gọi `setOnBack(() => () => navigate('/'))`, vì một hàm truyền thẳng chạy như updater. Màn đặt lại `undefined` cho cả hai khi unmount.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Hàm của `packages/client`, danh sách đơn vị, chip môn | `packages/client/src/`, `apps/mobile/src/features/venues/`, `apps/mobile/src/components/` (chỉ thêm `Chip.tsx`, `SportIcon.tsx` và test của chúng), `apps/mobile/src/app/router.tsx`, `apps/mobile/src/app/mobile.css` | AC-1 tới AC-6, AC-20 |
| 2 | Màn Đơn vị: chip ngày, hàng giờ, chip cửa sổ, `ActionBar` có "Gọi chủ sân" | `apps/mobile/src/features/venues/`, `apps/mobile/src/components/` (chỉ thêm `SlotRow.tsx` và test của nó, và thêm prop `secondary` cho `ActionBar.tsx` và test của nó), `apps/mobile/src/app/router.tsx`, `apps/mobile/src/app/mobile.css` | AC-7 tới AC-13, AC-19, AC-22 |
| 3 | Sheet "Gửi yêu cầu", đăng nhập khi cần, flow `mobile-book` của verify-flow | `apps/mobile/src/features/bookings/`, `apps/mobile/src/features/venues/`, `apps/mobile/src/features/auth/LoginSheet.tsx` (chỉ thêm prop `onLoggedIn`), `apps/mobile/src/components/` (chỉ thêm `StatusBadge.tsx` và test của nó), `apps/mobile/src/app/mobile.css`, `.agents/skills/verify-flow/`, `PROGRESS.md` | AC-14 tới AC-18, AC-21. `verify-flow --app mobile` qua trong check `image` |

## Edit boundaries

- Được sửa: các path ở Build order.
- Không sửa: `apps/web/`, `apps/api/`, `packages/shared/`, `apps/mobile/src/hooks/`, `apps/mobile/src/app/App.tsx`, `apps/mobile/src/app/session.tsx`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Ngày và giờ sai khi máy không ở múi giờ Việt Nam | PR 1 | Mọi hàm tính theo `Asia/Ho_Chi_Minh` (BR-27), như `startOfDayVN`. AC-1 chạy với `TZ` = `America/New_York` |
| Giá trên app khác giá server tính | PR 2, PR 3 | App dùng `bookingPrice` của `@monsport/shared`, cùng hàm với server. Sau khi gửi, sheet hiện `priceTotal` của server |
| Hai người gửi cùng khung giờ | PR 3 | Server khóa và trả 409 (BR-1, đã có). App chỉ hiện câu của intake và tải lại giờ trống (AC-18) |
| Hàng giờ làm trang cuộn ngang | PR 2 | Chỉ hàng cuộn ngang. Cha của hàng có `min-width: 0`. verify-flow kiểm ở 360px và 390px |
| Câu trả lời trễ ghi đè ngày mới | PR 2 | AC-12 |

Brief này không đổi tiền, schema hay dữ liệu cá nhân, và không thêm code đồng thời ở server. Một Reviewer mỗi PR là đủ.

## Assumptions

- Ô giờ là nút khi sau ô đó còn ít nhất 60 phút trống liền nhau (BR-3), và khi giờ bắt đầu sau `now` + 60 phút (BR-9). Web hiện mọi ô trong khoảng trống là nút. App chặt hơn, để người dùng không chọn một ô không đặt được.
- Bấm một ô là chọn giờ bắt đầu với 1 giờ. Người dùng đổi thời lượng bằng chip trong sheet. Lý do: một cách chọn, dễ bấm trên điện thoại.
- "Gọi chủ sân" nằm trong `ActionBar` khi đã chọn ô, và là nút icon trên `TopBar` của màn Đơn vị. Kế hoạch nói "menu ⋯". `TopBar` có chỗ cho 3 nút, nên một nút icon thay cho menu có một mục.
- Chip ngày gồm hôm nay và 6 ngày sau, như web.
- Thẻ đơn vị dòng 2 hiện môn của sân đầu tiên. Đơn vị có hai môn thì hiện cả hai icon. Seed hiện chỉ có đơn vị một môn.
- Chủ sân không có tab Đặt sân. Khi chủ sân mở `/app/don-vi/:id` và gửi yêu cầu, sheet hiện câu 403 của API (AC-18).

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Web có nên tự chuyển điện thoại sang `/app/` không, và khi nào (từ F-019) | Bạn | Không |

## Done when

- Mọi AC có test qua, tên test có nhãn.
- `pnpm check` qua ở PR cuối.
- `verify-flow --app mobile --target local` qua flow `mobile-book` ở 390px và 360px: An chọn "Cầu lông A", chọn một ô trống ngày mai, gửi yêu cầu, và thấy "Đã gửi yêu cầu". Không có cuộn ngang. Report có ảnh chụp.
- Deploy chạy, và `/api/health` trả lời trên URL của service.
