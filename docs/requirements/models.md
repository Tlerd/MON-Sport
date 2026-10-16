---
ba_doc: models
style: ste80
lang: vi
req_keyword: phải
---

# Mô hình

Nguồn: `data-dictionary.md`, `business-rules.md`, `use-cases.md`.

## ERD

```mermaid
erDiagram
  User ||--o{ Venue : "quản lý"
  Venue ||--|{ Court : "có"
  Court ||--o{ Booking : "có"
  User ||--o{ Booking : "tạo"
  Booking ||--o| Match : "có tối đa một"
  User ||--o{ Match : "là host"
  Match ||--|{ MatchPlayer : "gồm"
  User ||--o{ MatchPlayer : "vào"
  User ||--o{ Notification : "nhận"
  User ||--o{ PushSubscription : "đăng ký"
```

Figure 1. Quan hệ giữa các bảng

## Trạng thái của booking

```mermaid
stateDiagram-v2
  [*] --> PENDING : người dùng gửi yêu cầu (UC-3)
  [*] --> CONFIRMED : chủ sân nhập booking (UC-5)
  PENDING --> CONFIRMED : chủ sân xác nhận (UC-4)
  PENDING --> REJECTED : chủ sân từ chối (UC-4)
  PENDING --> EXPIRED : qua hạn xác nhận (BR-8)
  PENDING --> CANCELLED : người dùng hoặc host hủy (BR-12)
  CONFIRMED --> CANCELLED : hủy khi còn từ 6 giờ (BR-11)
  REJECTED --> [*]
  EXPIRED --> [*]
  CANCELLED --> [*]
```

Figure 2. Trạng thái của booking

`PENDING` và `CONFIRMED` giữ giờ trên sân (BR-1). Ba trạng thái còn lại trả giờ đó về trống.

## Trạng thái của trận

```mermaid
stateDiagram-v2
  [*] --> OPEN : host mở trận (UC-7)
  OPEN --> FULL : hết suất (BR-15)
  FULL --> OPEN : có người rời (BR-15)
  OPEN --> CANCELLED : host hủy, hoặc booking bị từ chối hay hết hạn
  FULL --> CANCELLED : host hủy, hoặc booking bị từ chối hay hết hạn
  OPEN --> FINISHED : qua giờ kết thúc (BR-19)
  FULL --> FINISHED : qua giờ kết thúc (BR-19)
  CANCELLED --> [*]
  FINISHED --> [*]
```

Figure 3. Trạng thái của trận
