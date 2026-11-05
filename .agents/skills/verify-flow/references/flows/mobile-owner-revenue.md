# Flow mobile-owner-revenue

Mobile owner "Doanh thu" tab (UC-12, brief F-026, AC-14). Script: `scripts/mobile-owner-revenue.mjs`. Screen: `/app/chu-san/doanh-thu`.

The flow is read-only. It sends no PATCH or POST and creates no booking, so it needs no test court and has no `SKIP` on `live`. At 390x812 and 360x800, the owner opens `/app/chu-san/doanh-thu`, selects the target venue (when the owner has more than one and the venue exists), picks "Tháng", and checks the metric cards and the "Chưa thu tiền" section.

| Step | Asserts |
|---|---|
| log in as owner | Signed in with `role OWNER` |
| owner opens Doanh thu | The group "Kỳ" is visible. The chip of `VERIFY_VENUE` is pressed in the group "Đơn vị" when it exists |
| owner picks Tháng | `GET /api/owner/venues/:id/financials?period=month` answers 200. The chip "Tháng" has `aria-pressed="true"`. Six `article` cards are visible: "Doanh thu", "Giờ đã đặt", "Lấp đầy", "Hủy", "Từ chối", "Khách quay lại". The chart ("Biểu đồ doanh thu") is visible. The heading matches `Tháng MM/YYYY` |
| owner sees Chưa thu tiền loaded | The region "Chưa thu tiền" shows its list or "Không có booking cần thu tiền", and not "Không tải được". The page sent no request with a method other than GET to `/api/` |
| no sideways scroll | `document.documentElement.scrollWidth <= innerWidth` |

## When it fails

- No financials answer: check `GET /api/owner/venues/:id/financials` and `pickPeriod` in `RevenueScreen.tsx`.
- A card is missing: check the `article[aria-label]` cards in `RevenueScreen.tsx`.
- "Chưa thu tiền" is missing: check the unpaid section and `GET /api/owner/bookings?status=CONFIRMED`.
- A write request (PATCH, POST): the flow must stay read-only. Find what sends it.
- "Không tải được" in Chưa thu tiền: check `GET /api/owner/bookings?status=CONFIRMED` and `loadBookings` in `RevenueScreen.tsx`.
- Sideways scroll: a flex or grid ancestor is missing `min-width: 0`, or an element overflows 360px/390px.
