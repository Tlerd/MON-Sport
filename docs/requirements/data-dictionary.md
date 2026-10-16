---
ba_doc: data-dictionary
style: ste80
lang: vi
req_keyword: phải
---

# Từ điển dữ liệu

Nguồn: `intake-monsport-v1.md` (mục Data), `business-rules.md`, `use-cases.md`. Tên bảng và tên trường dùng trong code, theo `AGENTS.md`. Sơ đồ ERD và trạng thái nằm trong `models.md`.

| Data Element | Description | Composition or Data Type | Length | Values |
|---|---|---|---|---|
| Booking | Một khoảng giờ trên một sân | id + courtId + startAt + endAt + status + source + createdById + (customerName) + (customerPhone) + priceTotal + paidAtVenue + (confirmDeadline) + (confirmedAt) + (cancelledAt) + createdAt | — | `CHECK (endAt > startAt)`. Hai booking `PENDING` hoặc `CONFIRMED` trên cùng `courtId` không chồng khoảng `[startAt, endAt)` (BR-1) |
| Booking.cancelledAt | Lúc booking bị hủy | timestamptz(3) | — | Có khi `status` = `CANCELLED` |
| Booking.confirmDeadline | Hạn xác nhận | timestamptz(3) | — | Theo BR-7. Có khi `source` = `APP` |
| Booking.confirmedAt | Lúc chủ sân xác nhận | timestamptz(3) | — | Có khi `status` = `CONFIRMED` |
| Booking.courtId | Sân của booking | id của Court | 36 | — |
| Booking.createdById | Người tạo booking: người đặt, hoặc chủ sân khi khách gọi điện | id của User | 36 | — |
| Booking.customerName | Tên khách gọi điện | text | 1–100 ký tự | Chỉ khi `source` = `PHONE` |
| Booking.customerPhone | Số điện thoại khách gọi điện | phone | 10 | Chỉ khi `source` = `PHONE` |
| Booking.endAt | Giờ kết thúc | timestamptz(3) | — | Trên lưới 30 phút. Ít nhất 1 giờ sau `startAt` (BR-2, BR-3) |
| Booking.paidAtVenue | Chủ sân đã thu tiền tại sân | boolean | — | Mặc định `false` (BR-21) |
| Booking.priceTotal | Giá booking tính lúc đặt | money | — | Theo BR-5. Không đổi sau khi tạo (BR-6) |
| Booking.source | Booking đến từ đâu | BookingSource | — | — |
| Booking.startAt | Giờ bắt đầu | timestamptz(3) | — | Trên lưới 30 phút (BR-2) |
| Booking.status | Trạng thái booking | BookingStatus | — | Mặc định `PENDING` khi `source` = `APP`, `CONFIRMED` khi `source` = `PHONE` (BR-10) |
| BookingSource | Nguồn của booking | enum | — | `APP` (người dùng gửi trong app) · `PHONE` (chủ sân nhập cho khách gọi điện) |
| BookingStatus | Trạng thái của booking | enum | — | `PENDING` Chờ xác nhận · `CONFIRMED` Đã xác nhận · `REJECTED` Bị từ chối · `EXPIRED` Hết hạn · `CANCELLED` Đã hủy |
| Court | Một sân trong một đơn vị | id + venueId + name + sport + priceNormal + pricePeak | — | — |
| Court.name | Tên sân | text | 1–50 ký tự | Duy nhất trong một đơn vị |
| Court.priceNormal | Giá một giờ, giờ thường | money | — | Lớn hơn 0 |
| Court.pricePeak | Giá một giờ, giờ cao điểm | money | — | Lớn hơn 0 (BR-4) |
| Court.sport | Môn chơi của sân | Sport | — | — |
| Court.venueId | Đơn vị chứa sân | id của Venue | 36 | — |
| createdAt | Lúc tạo bản ghi | timestamptz(3) | — | Do hệ thống ghi |
| id | Khóa của một bản ghi | uuid | 36 | Do hệ thống sinh |
| Match | Một trận trong phòng chờ | id + bookingId + hostId + sport + capacity + pricePerSlot + status + joinedCount + createdAt | — | — |
| Match.bookingId | Booking của trận | id của Booking | 36 | Duy nhất (BR-13) |
| Match.capacity | Số suất, gồm cả host | integer | — | 2–30 |
| Match.hostId | Host của trận | id của User | 36 | Bằng `Booking.createdById` (BR-13) |
| Match.joinedCount | Số người đang có suất | integer | — | 0 tới `capacity`. Bằng số MatchPlayer `ACTIVE` |
| Match.pricePerSlot | Giá mỗi suất, chỉ để hiển thị | money | — | 0 trở lên |
| Match.sport | Môn của trận | Sport | — | Bằng `Court.sport` của sân |
| Match.status | Trạng thái trận | MatchStatus | — | Mặc định `OPEN` |
| MatchPlayer | Một người trong một trận | matchId + userId + status + joinedAt + (leftAt) | — | Duy nhất theo (`matchId`, `userId`). Vào lại thì cập nhật dòng cũ |
| MatchPlayer.joinedAt | Lúc vào trận gần nhất | timestamptz(3) | — | — |
| MatchPlayer.leftAt | Lúc rời trận | timestamptz(3) | — | Có khi `status` = `LEFT` |
| MatchPlayer.matchId | Trận | id của Match | 36 | — |
| MatchPlayer.status | Người đó còn suất hay không | MatchPlayerStatus | — | — |
| MatchPlayer.userId | Người trong trận | id của User | 36 | — |
| MatchPlayerStatus | Trạng thái của một người trong trận | enum | — | `ACTIVE` còn suất · `LEFT` đã rời |
| MatchStatus | Trạng thái của trận | enum | — | `OPEN` Mở · `FULL` Đầy · `CANCELLED` Đã hủy · `FINISHED` Đã đá xong |
| money | Số tiền | integer | — | Đơn vị VND, số nguyên (BR-25) |
| Notification | Một thông báo trong app | id + userId + type + bookingId + (matchId) + (readAt) + createdAt | — | — |
| Notification.bookingId | Booking của sự kiện | id của Booking | 36 | — |
| Notification.matchId | Trận của sự kiện | id của Match | 36 | Có khi `type` = `MATCH_CANCELLED` |
| Notification.readAt | Lúc người nhận đọc | timestamptz(3) | — | — |
| Notification.type | Loại sự kiện | NotificationType | — | — |
| Notification.userId | Người nhận | id của User | 36 | — |
| NotificationType | Loại thông báo | enum | — | `BOOKING_REQUESTED` · `BOOKING_CONFIRMED` · `BOOKING_REJECTED` · `MATCH_CANCELLED` |
| phone | Số điện thoại Việt Nam | text | 10 | 10 chữ số, bắt đầu bằng `0` |
| PushSubscription | Một thiết bị nhận Web Push | id + userId + endpoint + p256dh + auth + createdAt | — | — |
| PushSubscription.auth | Khóa xác thực Web Push | text | ≤ 100 | — |
| PushSubscription.endpoint | Địa chỉ push của trình duyệt | text | ≤ 1000 | Duy nhất |
| PushSubscription.p256dh | Khóa công khai Web Push | text | ≤ 200 | — |
| PushSubscription.userId | Chủ của thiết bị | id của User | 36 | — |
| Role | Vai trò tài khoản | enum | — | `ADMIN` · `OWNER` (chủ sân) · `USER` (người dùng) |
| Sport | Môn chơi | enum | — | `FOOTBALL` bóng đá · `BADMINTON` cầu lông |
| timestamptz(3) | Thời điểm | timestamp with time zone, mili giây | — | Lưu UTC. Hiển thị theo `Asia/Ho_Chi_Minh` (BR-27) |
| User | Một tài khoản | id + name + phone + passwordHash + role + (lockedAt) + (deletedAt) + createdAt | — | — |
| User.deletedAt | Lúc người dùng xóa tài khoản | timestamptz(3) | — | Khi có, `name` và `phone` đã được thay (BR-26) |
| User.lockedAt | Lúc admin khóa tài khoản | timestamptz(3) | — | Khi có, tài khoản không đăng nhập được (BR-28) |
| User.name | Tên hiển thị | text | 1–100 ký tự | — |
| User.passwordHash | Bản băm argon2 của mật khẩu | text | ≤ 200 | Không bao giờ trả về qua API |
| User.phone | Số điện thoại đăng nhập | phone | 10 | Duy nhất (BR-24) |
| User.role | Vai trò | Role | — | Mặc định `USER` |
| Venue | Một đơn vị | id + ownerId + name + address + phone + opensAt + closesAt | — | — |
| Venue.address | Địa chỉ | text | 1–200 ký tự | — |
| Venue.closesAt | Giờ đóng cửa, tính bằng phút từ 00:00 | integer | — | 30–1440, bội của 30. Lớn hơn `opensAt` |
| Venue.name | Tên đơn vị | text | 1–100 ký tự | — |
| Venue.opensAt | Giờ mở cửa, tính bằng phút từ 00:00 | integer | — | 0–1410, bội của 30 |
| Venue.ownerId | Chủ sân của đơn vị | id của User | 36 | `User.role` = `OWNER` |
| Venue.phone | Số điện thoại cho nút Gọi chủ sân | phone | 10 | — |

## Assumptions

- Mỗi đơn vị có một giờ mở cửa và một giờ đóng cửa chung cho mọi ngày. Đơn vị không mở qua nửa đêm.
- Giá đặt theo từng sân, vì sân bóng và sân cầu lông có giá khác nhau.
- Số suất của trận từ 2 tới 30.
