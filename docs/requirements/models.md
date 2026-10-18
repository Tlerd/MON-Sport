---
ba_doc: models
style: ste80
lang: vi
req_keyword: phải
---

# Mô hình hệ thống

Tài liệu này tổng hợp các mô hình trực quan cho hệ thống MONSPORT bản đầu. Nguồn dữ liệu xuất phát từ `intake-monsport-v1.md`, `use-cases.md`, `business-rules.md` và `data-dictionary.md`.

## Sơ đồ ngữ cảnh

Sơ đồ ngữ cảnh thể hiện ranh giới của hệ thống MONSPORT và các luồng thông tin với tác nhân bên ngoài (xem Figure 1).

```mermaid
flowchart LR
    NguoiDung[Người dùng / Host]
    ChuSan[Chủ sân]
    Admin[Admin]
    PushService[Trình duyệt Web Push]
    MS((MONSPORT))
    NguoiDung -- yêu cầu đặt sân, mở trận, vào trận --> MS
    MS -- giờ trống, phòng chờ --> NguoiDung
    ChuSan -- xác nhận booking, sửa giá --> MS
    MS -- danh sách yêu cầu, doanh thu --> ChuSan
    Admin -- tài khoản, đơn vị, sân --> MS
    MS -- số liệu toàn trang --> Admin
    MS -- sự kiện cần báo --> PushService
    PushService -- thông báo tức thì --> NguoiDung
    PushService -- thông báo tức thì --> ChuSan
```

Figure 1. Sơ đồ ngữ cảnh của MONSPORT bản đầu

Ý nghĩa: hình tròn = hệ thống. Hình chữ nhật = tác nhân bên ngoài. Mũi tên = luồng dữ liệu.

## Sơ đồ use case

Hệ thống phục vụ người dùng, chủ sân và admin, và có một nhóm tác vụ tự động. Sơ đồ phân chia thành hai phần để đảm bảo độ rõ ràng (xem Figure 2 và Figure 3).

```mermaid
flowchart LR
    Khach([Người chưa đăng nhập])
    NguoiDung([Người dùng])
    ChuSan([Chủ sân])
    Admin([Admin])
    subgraph MS1[MONSPORT: Đặt sân và quản trị]
        UC1(UC-1 Đăng ký và đăng nhập)
        UC2(UC-2 Chọn sân và xem giờ trống)
        UC3(UC-3 Gửi yêu cầu đặt sân)
        UC4(UC-4 Xác nhận hoặc từ chối booking)
        UC5(UC-5 Nhập booking của khách gọi điện)
        UC6(UC-6 Xem và hủy booking)
        UC10(UC-10 Quản lý tài khoản và đơn vị)
        UC11(UC-11 Sửa giá và giờ mở cửa)
    end
    NguoiDung --- UC1
    Khach --- UC2
    NguoiDung --- UC2
    NguoiDung --- UC3
    NguoiDung --- UC6
    ChuSan --- UC1
    ChuSan --- UC4
    ChuSan --- UC5
    ChuSan --- UC11
    Admin --- UC1
    Admin --- UC10
    Admin --- UC11
```

Figure 2. Sơ đồ use case: đặt sân và quản trị

Ý nghĩa: hình elip = vai trò người dùng. Khung viền tròn = use case. Khung chữ nhật = ranh giới hệ thống.

```mermaid
flowchart LR
    NguoiDung([Người dùng])
    Host([Host])
    NguoiGhep([Người ghép trận])
    ChuSan([Chủ sân])
    Admin([Admin])
    HeThong([Hệ thống])
    subgraph MS2[MONSPORT: Ghép trận và báo cáo]
        UC7(UC-7 Mở trận)
        UC8(UC-8 Vào và rời trận)
        UC9(UC-9 Hủy trận)
        UC12(UC-12 Xem dashboard tài chính)
        UC13(UC-13 Xem dashboard toàn trang)
        UC14(UC-14 Gửi thông báo)
    end
    Host --- UC7
    Host --- UC9
    NguoiGhep --- UC8
    ChuSan --- UC12
    Admin --- UC13
    HeThong --- UC14
    UC14 --- ChuSan
    UC14 --- NguoiDung
    UC14 --- Host
    UC14 --- NguoiGhep
```

Figure 3. Sơ đồ use case: ghép trận và báo cáo

Ý nghĩa: Host và Người ghép trận là vai trò của Người dùng. Hình elip = vai trò người dùng. Khung viền tròn = use case. Khung chữ nhật = ranh giới hệ thống.

## Quy trình nghiệp vụ

### Quy trình đặt sân và xác nhận booking

Quy trình đặt sân diễn ra giữa người dùng, hệ thống và chủ sân (xem Figure 4). Hệ thống khóa sân tức thì để ngăn chặn hai người cùng đặt một giờ (BR-1).

```mermaid
flowchart TB
    subgraph P[Người dùng]
        p1[Chọn sân và khung giờ] --> p2[Gửi yêu cầu đặt sân]
        p3[Nhận thông báo xác nhận]
        p4[Nhận thông báo từ chối]
    end
    subgraph S[Hệ thống MONSPORT]
        s0{Giờ hợp lệ và hạn xác nhận chưa qua?}
        s0x[Từ chối yêu cầu: BR-2, BR-3, BR-9]
        s1{Khung giờ còn trống?}
        s2[Tạo booking Chờ xác nhận]
        s3[Báo lỗi trùng giờ]
        s4{Quá hạn xác nhận?}
        s5[Chuyển sang Hết hạn]
        s8[Hủy trận của booking, nếu có: BR-16]
        s6a{Hạn xác nhận chưa qua?}
        s6[Chuyển sang Đã xác nhận]
        s7[Chuyển sang Bị từ chối]
    end
    subgraph O[Chủ sân]
        o1[Xem danh sách chờ]
        o2{Xác nhận hay từ chối?}
    end
    p2 --> s0
    s0 -- Có --> s1
    s0 -- Không --> s0x
    s1 -- Có --> s2 --> o1
    s1 -- Không --> s3
    o1 --> o2
    o2 -- Xác nhận --> s6a
    s6a -- Còn hạn --> s6 --> p3
    s6a -- Hết hạn --> s5
    o2 -- Từ chối --> s7 --> p4
    s7 --> s8
    s2 --> s4
    s4 -- Quá hạn --> s5
    s5 --> s8
```

Figure 4. Sơ đồ luồng bơi: quy trình đặt sân và xác nhận booking

Ý nghĩa: khung lớn = vai trò tham gia. Hình chữ nhật = bước thực hiện. Hình thoi = quyết định rẽ nhánh.

### Quy trình mở trận và ghép người chơi

Host có một booking hợp lệ được phép mở trận để tìm người chơi ghép trong phòng chờ (xem Figure 5). Người ghép trận tham gia trực tiếp mà không cần host phê duyệt.

```mermaid
flowchart TB
    subgraph H[Host]
        h1[Chọn booking của mình] --> h2[Nhập số suất và giá]
        h3[Hủy trận khi bận]
        h3a{Booking Đã xác nhận còn dưới 6 giờ?}
        h3x[Từ chối: host gọi chủ sân, BR-11]
    end
    subgraph S[Hệ thống MONSPORT]
        s1[Tạo trận Mở kèm 1 suất cho host]
        s2[Đẩy cập nhật phòng chờ qua SSE]
        s3{Đã đủ số suất?}
        s4[Chuyển sang Đầy]
        s5[Chuyển về Mở nếu trận đang Đầy]
        s3a{Còn suất?}
        s6[Chuyển sang Đã hủy và hủy booking]
    end
    subgraph G[Người ghép trận]
        g1[Lọc phòng chờ] --> g2[Bấm xác nhận vào trận]
        g3[Rời trận]
        g3a{Trước giờ bắt đầu?}
        g3x[Từ chối: BR-18]
        g2x[Báo trận đã đủ người]
    end
    h2 --> s1 --> s2
    s2 --> g1
    g2 --> s3a
    s3a -- Hết suất --> g2x
    s3a -- Còn --> s3
    s3 -- Đủ --> s4
    g3 --> g3a
    g3a -- Đúng --> s5
    g3a -- Sai --> g3x
    h3 --> h3a
    h3a -- Không --> s6
    h3a -- Có --> h3x
```

Figure 5. Sơ đồ luồng bơi: quy trình mở và ghép trận

Ý nghĩa: khung lớn = vai trò tham gia. Hình chữ nhật = bước thực hiện. Hình thoi = quyết định rẽ nhánh.

## Sơ đồ quan hệ thực thể

Cơ sở dữ liệu gồm tám thực thể chính phục vụ đặt sân, ghép trận và thông báo (xem Figure 6). Bảng `AuthThrottle` đứng riêng và không có quan hệ với bảng nào.

```mermaid
erDiagram
    User ||--o{ Venue : "quản lý"
    Venue ||--o{ Court : "có"
    Court ||--o{ Booking : "có"
    User ||--o{ Booking : "tạo"
    Booking ||--o| Match : "có tối đa một"
    User ||--o{ Match : "là host"
    Match ||--|{ MatchPlayer : "gồm"
    User ||--o{ MatchPlayer : "vào"
    User ||--o{ Notification : "nhận"
    Booking ||--o{ Notification : "gây ra"
    Match |o--o{ Notification : "liên quan"
    User ||--o{ PushSubscription : "đăng ký"
```

Figure 6. Quan hệ giữa các bảng dữ liệu

Ý nghĩa: thể hiện các quan hệ 1-1, 1-n giữa các bảng. Chi tiết các cột nằm trong Từ điển dữ liệu.

## Vòng đời trạng thái

### Trạng thái của booking

Một booking chuyển đổi giữa năm trạng thái trong suốt vòng đời của mình (xem Figure 7). Chỉ có trạng thái `PENDING` và `CONFIRMED` là chiếm giữ khung giờ trên sân (BR-1).

```mermaid
stateDiagram-v2
    [*] --> PENDING : người dùng gửi yêu cầu (UC-3)
    [*] --> CONFIRMED : chủ sân nhập booking (UC-5)
    PENDING --> CONFIRMED : chủ sân xác nhận (UC-4)
    PENDING --> REJECTED : chủ sân từ chối (UC-4)
    PENDING --> EXPIRED : qua hạn xác nhận (BR-8)
    PENDING --> CANCELLED : người đặt hủy trước giờ đá (BR-12)
    CONFIRMED --> CANCELLED : người đặt hủy khi còn từ 6 giờ trở lên (BR-11)
    REJECTED --> [*]
    EXPIRED --> [*]
    CANCELLED --> [*]
```

Figure 7. Vòng đời trạng thái của booking

Ý nghĩa: hình hộp bo góc = trạng thái. Mũi tên kèm nhãn = hành động hoặc điều kiện gây đổi trạng thái.

Bảng chuyển đổi trạng thái của booking:

| Trạng thái hiện tại | PENDING | CONFIRMED | REJECTED | EXPIRED | CANCELLED |
|---|---|---|---|---|---|
| **Chờ xác nhận (PENDING)** | — | Chủ sân xác nhận (UC-4) | Chủ sân từ chối (UC-4) | Qua hạn xác nhận (BR-8) | Người đặt tự hủy (BR-12) |
| **Đã xác nhận (CONFIRMED)** | — | — | — | — | Hủy khi còn từ 6 giờ trở lên (BR-11) |
| **Bị từ chối (REJECTED)** | — | — | — | — | — |
| **Hết hạn (EXPIRED)** | — | — | — | — | — |
| **Đã hủy (CANCELLED)** | — | — | — | — | — |

### Trạng thái của trận

Một trận trong phòng chờ chuyển đổi giữa bốn trạng thái tùy theo số suất và thời gian (xem Figure 8).

```mermaid
stateDiagram-v2
    [*] --> OPEN : host mở trận (UC-7)
    OPEN --> FULL : đủ số suất (BR-15)
    FULL --> OPEN : người chơi rời trận (BR-15)
    OPEN --> CANCELLED : host hủy trận (BR-17), booking bị từ chối hoặc hết hạn (BR-16), người đặt hủy booking (UC-6)
    FULL --> CANCELLED : host hủy trận (BR-17), booking bị từ chối hoặc hết hạn (BR-16), người đặt hủy booking (UC-6)
    OPEN --> FINISHED : qua giờ kết thúc (BR-19)
    FULL --> FINISHED : qua giờ kết thúc (BR-19)
    CANCELLED --> [*]
    FINISHED --> [*]
```

Figure 8. Vòng đời trạng thái của trận

Ý nghĩa: hình hộp bo góc = trạng thái. Mũi tên kèm nhãn = nguyên nhân đổi trạng thái.

Bảng chuyển đổi trạng thái của trận:

| Trạng thái hiện tại | OPEN | FULL | CANCELLED | FINISHED |
|---|---|---|---|---|
| **Mở (OPEN)** | — | Người chơi vào đủ suất (BR-15) | Host hủy trận (BR-17), booking bị từ chối hoặc hết hạn (BR-16), người đặt hủy booking (UC-6) | Quá giờ kết thúc (BR-19) |
| **Đầy (FULL)** | Người chơi rời trận (BR-15) | — | Host hủy trận (BR-17), booking bị từ chối hoặc hết hạn (BR-16), người đặt hủy booking (UC-6) | Quá giờ kết thúc (BR-19) |
| **Đã hủy (CANCELLED)** | — | — | — | — |
| **Đã đá xong (FINISHED)** | — | — | — | — |

## Cây quyết định xử lý hủy booking

Khi người dùng muốn hủy booking, hệ thống kiểm tra trạng thái và thời gian còn lại (xem Figure 9). Quy tắc BR-11 và BR-12 quyết định booking được tự hủy hay phải gọi điện cho chủ sân.

```mermaid
flowchart TD
    A{Trạng thái booking?}
    A -- PENDING --> P{Trước giờ bắt đầu?}
    P -- Đúng --> B[Hủy ngay trong app, BR-12]
    P -- Sai --> D
    A -- CONFIRMED --> C{Còn cách giờ đá từ 6 giờ trở lên?}
    A -- Trạng thái khác --> D[Không thể hủy]
    C -- Đúng --> E[Hủy ngay trong app, BR-11]
    C -- Sai --> F[Báo lỗi: người dùng phải gọi điện cho chủ sân]
```

Figure 9. Cây quyết định: xử lý yêu cầu hủy booking

Ý nghĩa: hình thoi = điều kiện rẽ nhánh. Hình chữ nhật = kết quả xử lý của hệ thống.

## Ma trận CRUD

Ma trận CRUD liên kết các use case với các thực thể trong cơ sở dữ liệu. Cột `PushSubscription` chỉ có UC-14 đọc và xóa. Chưa có use case nào tạo bảng này. Việc chuyển booking sang "Hết hạn" (BR-8) không thuộc use case nào. Việc đó ghi `Booking` và `Match` như UC-4 từ chối.

| Use case | User | Venue | Court | Booking | Match | MatchPlayer | Notification | PushSubscription |
|---|---|---|---|---|---|---|---|---|
| **UC-1 Đăng ký và đăng nhập** | C, R | — | — | — | — | — | — | — |
| **UC-2 Chọn sân và xem giờ trống** | — | R | R | R | — | — | — | — |
| **UC-3 Gửi yêu cầu đặt sân** | R | R | R | C | — | — | C | — |
| **UC-4 Xác nhận hoặc từ chối booking** | R | R | R | R, U | U | R | C | — |
| **UC-5 Nhập booking của khách gọi điện** | R | R | R | C, R | — | — | — | — |
| **UC-6 Xem và hủy booking** | R | R | R | R, U | U | R | C | — |
| **UC-7 Mở trận** | R | — | — | R | C | C | — | — |
| **UC-8 Vào và rời trận** | R | — | — | R | R, U | C, U | — | — |
| **UC-9 Hủy trận** | R | — | — | R, U | U | R | C | — |
| **UC-10 Quản lý tài khoản và đơn vị** | C, R, U | C, R, U | C, R, U | — | — | — | — | — |
| **UC-11 Sửa giá và giờ mở cửa** | R | R, U | R, U | — | — | — | — | — |
| **UC-12 Xem dashboard tài chính** | R | R | R | R, U | — | — | — | — |
| **UC-13 Xem dashboard toàn trang** | R | R | R | R | R | — | — | — |
| **UC-14 Gửi thông báo** | R | — | — | R | R | R | C, R | R, D |
