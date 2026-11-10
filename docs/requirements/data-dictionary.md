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
| AuthThrottle | Một bộ đếm số lần thử đăng nhập hoặc đăng ký trong một cửa sổ thời gian (BR-30) | key + count + windowStart | — | Mọi instance của API dùng chung. Một dòng cũ hơn 1 ngày bị xóa ở lần kế tiếp một bộ đếm mở cửa sổ mới (brief F-006) |
| AuthThrottle.count | Số lần thử trong cửa sổ | integer | ≥ 1 | — |
| AuthThrottle.key | Tên bộ đếm và HMAC-SHA256 của số điện thoại hoặc IP | text | ≤ 100 | Duy nhất. Không chứa số điện thoại hoặc IP đọc được |
| AuthThrottle.windowStart | Lúc cửa sổ bắt đầu | timestamptz(3) | — | — |
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
| Court.priceNormal | Giá một giờ, giờ thường | money | — | Lớn hơn 0, tối đa 10.000.000 (brief F-003) |
| Court.pricePeak | Giá một giờ, giờ cao điểm | money | — | Lớn hơn 0, tối đa 10.000.000 (BR-4, brief F-003) |
| Court.sport | Môn chơi của sân | Sport | — | — |
| Court.venueId | Đơn vị chứa sân | id của Venue | 36 | — |
| createdAt | Lúc tạo bản ghi | timestamptz(3) | — | Do hệ thống ghi |
| DevOtpOutbox | Hòm thư lưu mã OTP khi chạy môi trường dev (brief F-004) | id + phone + code + createdAt | — | Chỉ dùng khi `OTP_PROVIDER` = `dev`. Bảng trống trên production (AC-34) |
| DevOtpOutbox.code | Mã OTP | char(6) | 6 | 6 chữ số |
| DevOtpOutbox.createdAt | Lúc tạo mã | timestamptz(3) | — | Do hệ thống ghi |
| DevOtpOutbox.id | Khóa của bản ghi | uuid | 36 | Do hệ thống sinh |
| DevOtpOutbox.phone | Số điện thoại nhận mã | phone | 10 | — |
| id | Khóa của một bản ghi | uuid | 36 | Do hệ thống sinh |
| JoinMode | Chế độ vào trận (BR-49) | enum | — | `INSTANT` Vào ngay (mặc định) · `APPROVAL` Host duyệt |
| Match | Một trận trong phòng chờ | id + bookingId + hostId + sport + capacity + pricePerSlot + status + joinedCount + joinMode + createdAt | — | — |
| Match.bookingId | Booking của trận | id của Booking | 36 | Duy nhất (BR-13) |
| Match.capacity | Số suất, gồm cả host | integer | — | 2–30 |
| Match.hostId | Host của trận | id của User | 36 | Bằng `Booking.createdById` (BR-13) |
| Match.joinedCount | Số người đang có suất | integer | — | 0 tới `capacity`. Bằng số MatchPlayer `ACTIVE` |
| Match.joinMode | Chế độ vào trận. Host chọn lúc mở trận và không đổi sau đó (BR-49) | JoinMode | — | Mặc định `INSTANT` |
| Match.pricePerSlot | Giá mỗi suất, chỉ để hiển thị | money | — | 0 trở lên |
| Match.sport | Môn của trận | Sport | — | Bằng `Court.sport` của sân |
| Match.status | Trạng thái trận | MatchStatus | — | Mặc định `OPEN` |
| MatchPlayer | Một người trong một trận | matchId + userId + status + joinedAt + (leftAt) | — | Duy nhất theo (`matchId`, `userId`). Vào lại thì cập nhật dòng cũ |
| MatchPlayer.joinedAt | Lúc vào trận gần nhất, hoặc lúc gửi yêu cầu gần nhất khi `status` là `PENDING` | timestamptz(3) | — | Duyệt yêu cầu đặt `status` là `ACTIVE` và `joinedAt` là lúc duyệt. Người xin hủy yêu cầu thì dòng `PENDING` bị xóa |
| MatchPlayer.leftAt | Lúc rời trận | timestamptz(3) | — | Có khi `status` = `LEFT` |
| MatchPlayer.matchId | Trận | id của Match | 36 | — |
| MatchPlayer.status | Người đó còn suất hay không | MatchPlayerStatus | — | — |
| MatchPlayer.userId | Người trong trận | id của User | 36 | — |
| MatchPlayerStatus | Trạng thái của một người trong trận | enum | — | `ACTIVE` còn suất · `LEFT` đã rời · `PENDING` Chờ duyệt (chưa có suất, BR-50) · `REJECTED` Bị từ chối (BR-51) |
| MatchStatus | Trạng thái của trận | enum | — | `OPEN` Mở · `FULL` Đầy · `CANCELLED` Đã hủy · `FINISHED` Đã đá xong |
| money | Số tiền | integer | — | Đơn vị VND, số nguyên (BR-25) |
| Notification | Một thông báo trong app | id + userId + type + bookingId + (matchId) + (readAt) + (pushedAt) + createdAt | — | — |
| Notification.bookingId | Booking của sự kiện | id của Booking | 36 | — |
| Notification.matchId | Trận của sự kiện | id của Match | 36 | Có khi `type` = `MATCH_CANCELLED` |
| Notification.pushedAt | Lúc một instance API nhận gửi Web Push cho thông báo này | timestamptz(3) | — | Rỗng khi chưa gửi. Dòng có từ trước F-014 mang giá trị `createdAt` |
| Notification.readAt | Lúc người nhận đọc | timestamptz(3) | — | — |
| Notification.type | Loại sự kiện | NotificationType | — | — |
| Notification.userId | Người nhận | id của User | 36 | — |
| NotificationType | Loại thông báo | enum | — | `BOOKING_REQUESTED` · `BOOKING_CONFIRMED` · `BOOKING_REJECTED` · `MATCH_CANCELLED` · `MATCH_JOIN_REQUESTED` · `MATCH_JOIN_APPROVED` · `MATCH_JOIN_REJECTED` |
| phone | Số điện thoại Việt Nam | text | 10 | 10 chữ số, bắt đầu bằng `0` |
| PhoneOtp | Một mã OTP đang chờ xác minh số điện thoại (brief F-004) | phoneKey + purpose + codeHash + attempts + sentAt + expiresAt | — | Khóa chính (`phoneKey`, `purpose`). Index trên `expiresAt` cho O10 |
| PhoneOtp.attempts | Số lần nhập sai | integer | — | 0–5 |
| PhoneOtp.codeHash | Bản băm HMAC-SHA256 của số điện thoại và mã | char(64) | 64 | Không lưu mã dạng đọc được (O2) |
| PhoneOtp.expiresAt | Lúc mã hết hạn | timestamptz(3) | — | 5 phút sau `sentAt` |
| PhoneOtp.phoneKey | keyedDigest(phone) như AuthThrottle, không lưu số | varchar(64) | 64 | — |
| PhoneOtp.purpose | Mục đích tạo mã | varchar(30) | ≤ 30 | `google_signup` · `google_verify` |
| PhoneOtp.sentAt | Lúc gửi mã | timestamptz(3) | — | — |
| PushSubscription | Một thiết bị nhận Web Push | id + userId + endpoint + p256dh + auth + createdAt | — | — |
| PushSubscription.auth | Khóa xác thực Web Push | text | ≤ 100 | — |
| PushSubscription.endpoint | Địa chỉ push của trình duyệt | text | ≤ 2048 | Duy nhất |
| PushSubscription.p256dh | Khóa công khai Web Push | text | ≤ 200 | — |
| PushSubscription.userId | Chủ của thiết bị | id của User | 36 | — |
| Role | Vai trò tài khoản | enum | — | `ADMIN` · `OWNER` (chủ sân) · `USER` (người dùng) |
| Sport | Môn chơi | enum | — | `FOOTBALL` bóng đá · `BADMINTON` cầu lông |
| timestamptz(3) | Thời điểm | timestamp with time zone, mili giây | — | Lưu UTC. Hiển thị theo `Asia/Ho_Chi_Minh` (BR-27) |
| User | Một tài khoản | id + name + phone + (passwordHash) + role + (googleSub) + (email) + (phoneVerifiedAt) + (lockedAt) + (deletedAt) + (consentAt) + (sessionsValidFrom) + createdAt | — | — |
| User.consentAt | Lúc người dùng đồng ý với thông báo bảo vệ dữ liệu cá nhân khi đăng ký | timestamptz(3) | — | Có khi người dùng tự đăng ký. Null với tài khoản do admin hoặc seed tạo (brief F-003) |
| User.deletedAt | Lúc người dùng xóa tài khoản | timestamptz(3) | — | Khi có, `name` và `phone` đã được thay (BR-26) |
| User.email | Email lấy từ Google khi `email_verified` = true | varchar(254) | ≤ 254 | Null được. Chỉ dùng để hiển thị (brief F-004) |
| User.googleSub | Mã định danh người dùng từ Google (sub) | varchar(255) | ≤ 255 | Duy nhất, null được. Nhận diện tài khoản Google (brief F-004) |
| User.lockedAt | Lúc admin khóa tài khoản | timestamptz(3) | — | Khi có, tài khoản không đăng nhập được (BR-28) |
| User.name | Tên hiển thị | text | 1–100 ký tự | — |
| User.passwordHash | Bản băm argon2 của mật khẩu | text | ≤ 200 | Không bao giờ trả về qua API. Null được cho tài khoản chỉ có Google (brief F-004) |
| User.phone | Số điện thoại đăng nhập | phone | 10 | Duy nhất (BR-24) |
| User.phoneVerifiedAt | Lúc số điện thoại được xác minh bằng OTP | timestamptz(3) | — | Null được. Tài khoản cũ giữ null (brief F-004) |
| User.role | Vai trò | Role | — | Mặc định `USER` |
| User.sessionsValidFrom | Phiên tạo trước thời điểm này không còn hiệu lực | timestamptz(3) | — | Admin mở khóa tài khoản thì đặt bằng lúc mở khóa (BR-32). Null là không giới hạn (brief F-006) |
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
