# Đặc tả kỹ thuật MON-Sport

Nguồn: §3–§6 và §9 của tài liệu `9. ke-hoach-web-app-dat-san-ghep-nguoi-thanh-toan.md` trong vault (bản ngày 12/10/2026), chép nguyên văn ngày 16/10/2026. Số mục giữ nguyên như bản gốc, nên `§4`, `§5`, `§6`, `§9` trỏ đúng chỗ.

Từ ngày 16/10/2026, file này là nguồn sự thật cho phần kỹ thuật (ADR 0001). Sửa ở đây trước, rồi mới sửa vault. Các mục khác của tài liệu `9.` (quyết định chờ chốt, lộ trình, giờ công, chi phí, rủi ro) vẫn nằm ở vault. Các tham chiếu như `7.`, `8.`, `4.2 §A2.1`, `§1.3`, `§2`, `§8.3` trỏ tới vault.

## Quyết định khác bản gốc

| Ngày | Quyết định | Thay cho |
|---|---|---|
| 16/10/2026 | Tách bảng `Booking` ngay ở F-001 (D2 chốt "có") | §2 D2 đang chờ chốt |
| 16/10/2026 | Dùng Prisma 7.10.1 | Các chỗ ghi Prisma 6 ở §4.1 |
| 16/10/2026 | `Match` không có `courtId`, `startAt`, `endAt`. Sân và giờ chỉ nằm ở `Booking` | Mô tả `Match` của tài liệu `7.` |

---

## 3. Kiến trúc tổng thể

```
 [App Flutter — Android v0.3, iOS v0.4]   [Web React/Vite]
 người chơi · host                        link chia sẻ Zalo · chủ sân · đội vận hành · người dùng iPhone
     │ Authorization: Bearer + refresh          │ cookie httpOnly (app.<domain> + api.<domain> cùng site)
     └───────────────┬──────────────────────────┘
                     ▼
         NestJS API (modular monolith)  ◀── webhook SePay (HMAC) — từ v0.3
  auth · users · venues · bookings · matches · payments · reputation · notifications
  ports: AuthProvider · NotificationPort · PaymentReconciliationPort · FileStoragePort
                     │
          PostgreSQL 16 (Supabase)  ◀──  worker pg-boss (cùng image, từ v0.3)
  EXCLUDE chống trùng giờ ·            quét hạn chót mỗi phút · hết hạn trả tiền · nhắc trước giờ đá
  UPDATE có điều kiện cho suất cuối ·  outbox → FCM (app) · Web Push · ZNS (tin quan trọng)
  OutboxEvent · IdempotencyKey (v0.3)
```

**Hợp đồng API cho hai client:** Zod ở `packages/shared` vẫn là nguồn duy nhất → sinh `openapi.json` → sinh client Dart (`openapi-generator`, `dart-dio`). CI sinh lại và **fail nếu khác bản đã commit**. Zod 4 có sẵn `z.toJSONSchema()`; chọn thư viện OpenAPI tương thích Zod 4 qua một buổi thử nhanh (spike).

### 3.1 Chia vai web và app

| Chức năng                                                               | Web                                                                    | App Flutter                 | Ghi chú                                                                                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Xem trận đang mở, lọc (hôm nay → gần → đúng trình độ)                   | v0.1                                                                   | v0.3                        |                                                                                                                          |
| Tạo trận (host)                                                         | v0.1                                                                   | v0.3                        |                                                                                                                          |
| Vào / rời trận, hàng chờ                                                | v0.1 / v0.3                                                            | v0.3                        |                                                                                                                          |
| Trả tiền VietQR                                                         | v0.3                                                                   | v0.3                        | App: nút **lưu ảnh QR** + **sao chép STK / số tiền / nội dung** (không quét được QR trên chính điện thoại đang hiển thị) |
| Host xác nhận "đã nhận" (gom nhiều người), điểm danh, xác nhận trình độ | v0.3                                                                   | v0.3                        |                                                                                                                          |
| Kết nối SePay cho người nhận tiền                                       | v0.3                                                                   | —                           | Màn OAuth làm trên web                                                                                                   |
| Thông báo                                                               | trong app + Web Push (iPhone cần "Thêm vào Màn hình chính", iOS 16.4+) | **FCM push**                | ZNS chỉ cho tin quan trọng                                                                                               |
| Trang trận/sân công khai, thẻ OG khi dán vào Zalo                       | v0.1 (trận) · D6 (sân tối giản) · v0.4 (sân đầy đủ)                    | deep link mở app nếu đã cài |                                                                                                                          |
| Lịch trống, đặt sân trực tiếp, đặt cố định                              | v0.4                                                                   | v0.4                        |                                                                                                                          |
| Dashboard chủ sân                                                       | v0.4                                                                   | —                           | Chủ sân không phải cài app (4.4 §A8 #4)                                                                                  |
| Nhập sân (đội vận hành)                                                 | v0.1                                                                   | —                           | Trang admin                                                                                                              |

---

## 4. Thiết kế bốn phần

### 4.1 Đặt sân và khung giờ

**Sự thật cần nói rõ với đội:** tới v0.4, chủ sân chưa nhập lịch vào hệ thống. Trong v0.1–v0.3, "đặt sân" trên app là **bản ghi của một cuộc đặt đã chốt qua điện thoại**. `EXCLUDE` chỉ chặn trùng **giữa các booking trong MONSPORT**, không chặn được khách vãng lai ở sân. Vì vậy:
- Mỗi `Booking` có `source` = `PHONE` (host/đội gọi chủ sân) · `APP` (v0.4, chủ sân xác nhận trên web) · `WALK_IN` (chủ sân tự chặn giờ, v0.4) · `TOURNAMENT` (trận giải đấu dùng sân).
- Màn tạo trận có nút **gọi chủ sân** và ô bắt buộc "đã xác nhận với chủ sân".
- Chính sách "đặt trùng do lỗi hệ thống" (4.2 §A2.7) chỉ áp dụng cho trùng **trong hệ thống** (§4.3.4).

**Chống trùng giờ** (migration viết tay bằng `prisma migrate dev --create-only`):

```sql
-- Cho phép cột thường (courtId) đi chung chỉ mục gist với khoảng thời gian
CREATE EXTENSION IF NOT EXISTS btree_gist;
-- Giờ kết thúc phải sau giờ bắt đầu, chặn dữ liệu rác từ form
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_end_after_start" CHECK ("endAt" > "startAt");
-- Hai booking còn sống trên cùng sân con không được chồng giờ; '[)' cho phép liền kề 19–20h rồi 20–21h
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_no_overlap"
  EXCLUDE USING gist ("courtId" WITH =, tstzrange("startAt","endAt",'[)') WITH &&)
  WHERE ("status" IN ('HOLD','CONFIRMED'));
```

| Quy tắc | Cách làm |
|---|---|
| Lỗi trùng | `HttpExceptionFilter` bắt mã `23P01` → **409** "Khung giờ này vừa có người đặt" (tiếng Việt, không 500). Cách Prisma 6 báo mã này chưa kiểm — viết test cho nó đầu tiên |
| HOLD hết hạn | Chỉ xuất hiện từ v0.3 (M2 chỉ có `CONFIRMED`). Ràng buộc không đọc được `now()` nên trước khi chèn, trong cùng transaction, đổi các `HOLD` quá hạn **của đúng sân đó** sang `EXPIRED`; job quét mỗi phút làm phần còn lại và ghi outbox để trận liên quan được cập nhật + báo host |
| Lưới giờ | DB cho giờ lẻ; UI chọn theo bước 30 phút |
| Múi giờ | Lưu `Timestamptz(3)`; hiển thị `Asia/Ho_Chi_Minh` (`date-fns-tz` — chưa cài trong repo) |
| Sân đa năng | `Court.sports Sport[]` thay `sport` (P2 của `7.` §10) — làm luôn ở M2 vì đang sửa bảng |
| Sân ghép (1 sân 11 = 2 sân 7) | **Không làm ở Phase 1.** Mỗi `Court` là một đơn vị đặt độc lập |
| Trận giải đấu | Đề xuất cho v0.2: khi xếp `Fixture` vào một sân thì tạo `Booking` `source = TOURNAMENT`, nếu không kèo thường có thể đè lên giờ đang đá giải (~3h) |
| Supabase | Kiểm tra bật được `btree_gist` trên project thật ngay khi tạo; với Prisma 6 cần `directUrl` cho migration (app đi qua pooler) |

**Lịch trống (v0.4):** `OpeningRule` (sân, thứ, giờ mở, giờ đóng) + `PriceRule` (sân, thứ, khung giờ, giá/giờ). Lịch trống = lưới sinh từ giờ mở cửa **trừ** booking còn sống. Cache CDN 30–60s cho trang công khai; **không bao giờ** cache quyết định "còn chỗ để đặt".

**Đặt cố định hằng tuần (v0.4):** `BookingSeries` sinh sẵn 8 tuần thành `Booking` thật; job hằng đêm sinh thêm; buổi nào đụng `EXCLUDE` thì báo chủ sân và host (`7.` §5.1). Hủy cả chuỗi = hủy các buổi tương lai, giữ lịch sử.

### 4.2 Ghép người

#### Hai trục trạng thái của trận — đừng trộn

| Trục | Lưu ở đâu | Giá trị |
|---|---|---|
| **Đầy hay chưa** | `Match.status` (enum đã có) | `OPEN` (còn suất) ↔ `FULL` (hết suất) · `CANCELLED` · `FINISHED` |
| **Đã chốt sân chưa** | `Match.confirmedAt` (cột mới v0.3) | Chế độ A: bằng lúc tạo trận. Chế độ B: null cho tới khi đủ người đã trả |

`FULL` chỉ nghĩa là hết suất: có người rời thì quay về `OPEN`, `confirmedAt` không đổi. Nhờ vậy trận chế độ B đã chốt mà còn suất vẫn nhận thêm người, và trận có `quorumMin = capacity` không bị nhảy qua bước chốt.

#### Người tham gia — một nguồn sự thật cho chỗ ngồi, một cho tiền

| `MatchEntry.status` | Giữ chỗ? | Nghĩa |
|---|---|---|
| `REQUESTED` | không | Người lạ xin vào trận cần duyệt (môn đối kháng, 4.2 §A2.2 L2) |
| `ACTIVE` | **có** | Đang có suất. Chế độ B trước khi mở cửa trả tiền = "giữ suất" |
| `LEFT` · `EXPIRED` · `REJECTED` | không | Rời trận · hết hạn trả tiền · bị từ chối |

**Bất biến:** `Match.joinedCount` = số dòng `ACTIVE`. Chỉ hai chỗ được đổi số này: chuyển **vào** `ACTIVE` (chạy câu UPDATE có điều kiện bên dưới) và chuyển **ra** từ `ACTIVE` (`joinedCount - 1`, `FULL → OPEN`, đẩy người chờ đầu tiên trong **cùng transaction**). `REQUESTED → REJECTED` không đụng tới `joinedCount`. Có test so `joinedCount` với `COUNT(*)` sau mỗi kịch bản.

Tình trạng tiền **chỉ** nằm ở `PaymentRequest` (§4.3), không lặp lại ở `MatchEntry`. Điểm danh sau trận lưu ở cột riêng `attendance` = `ATTENDED` / `NO_SHOW`.

`UNIQUE(matchId, userId)` giữ nguyên, nên người đã rời mà vào lại thì **cập nhật dòng cũ về `ACTIVE`**, không chèn dòng mới (nếu chèn, transaction đẩy người chờ sẽ hỏng theo).

**Tranh suất cuối (làm ở M3):**

```sql
-- Tăng chỗ chỉ khi còn chỗ: điều kiện và phép tăng nằm trong một câu nên hai người không cùng lấy được suất cuối
UPDATE "Match" SET "joinedCount" = "joinedCount" + 1,
  -- Lấy đúng suất cuối thì chuyển FULL ngay trong cùng câu, không cần câu thứ hai
  "status" = CASE WHEN "joinedCount" + 1 = "capacity" THEN 'FULL' ELSE "status" END
-- Chỉ trận còn suất mới bị đổi; 0 dòng → 409 "Trận đã đủ người"
WHERE "id" = $1 AND "status" = 'OPEN' AND "joinedCount" < "capacity";
```

Sau đó ghi `MatchEntry` (`ACTIVE`) trong cùng transaction. Cách sai cần tránh: đếm rồi mới chèn.

#### Bảng chuyển trạng thái trận

| Lúc | Sự kiện | Kết quả | Chế độ |
|---|---|---|---|
| Tạo | Host tạo trận, sân đã chốt qua điện thoại | `OPEN`, `confirmedAt = now`, `Booking CONFIRMED` | A |
| Tạo | Host mở kèo quorum | `OPEN`, chưa có booking. App ghi "chưa giữ sân — sân có thể bị đặt mất" | B |
| Trước hạn chót | Host/đội gọi chủ sân, chủ sân đồng ý giữ mềm | `Booking HOLD`, `expiresAt` = hạn chót, giữ **tối đa 4h** (4.2 §A2.4 cách 1). App ghi "đã giữ sân tới 17:00" | B |
| Trước hạn chót | Số người `ACTIVE` đạt `quorumMin` | **Mở cửa trả tiền:** mọi người `ACTIVE` chưa có yêu cầu trả tiền nhận một cái; cửa đóng ở hạn chót, tối thiểu 30 phút kể từ lúc mở | B |
| Trước hạn chót | Số yêu cầu trả tiền `CLAIMED`/`CONFIRMED` đạt `quorumMin` | **Chốt:** `confirmedAt = now`. Có giữ mềm → `HOLD → CONFIRMED` (câu dưới). Không có giữ mềm hoặc giữ mềm đã hết → chèn `Booking CONFIRMED`; nếu dính `23P01` → nhánh **"đủ người, mất sân"**: báo host tìm sân/giờ khác, người chơi rời không bị trừ điểm, quá `startAt − 60'` chưa xong thì hủy | B |
| Hạn chót | Chưa đủ người đã trả | `CANCELLED` (`QUORUM_FAILED`), `Booking HOLD → EXPIRED`. Ai **đã** trả → host có nghĩa vụ hoàn 100%. Ai giữ suất mà không trả → −5 điểm. Còn lại không ai bị trừ | B |
| Bất kỳ | `joinedCount` chạm `capacity` / có người rời | `FULL` / về `OPEN` | A, B |
| Bất kỳ | Host hủy | `CANCELLED`, nghĩa vụ hoàn 100% cho mọi người đã trả; host hủy dưới 6h → −5 như người chơi | A, B |
| Sau giờ đá | Host điểm danh | `FINISHED` (từ `OPEN` hoặc `FULL`), sinh sự kiện uy tín | A, B |
| `endAt` + 12h | Host không điểm danh | Job tự `FINISHED`, **không** sinh sự kiện uy tín | A, B |

```sql
-- Chỉ chốt khi giữ mềm còn hạn; 0 dòng nghĩa là giữ mềm đã hết hoặc đã bị dọn → đi nhánh chèn booking mới
UPDATE "Booking" SET "status" = 'CONFIRMED', "expiresAt" = NULL
WHERE "id" = $1 AND "status" = 'HOLD' AND "expiresAt" > now();
```

**Câu hiển thị chế độ B (thay câu ở 4.2 §A2.4):**
- `Cần 8 người trả tiền trước 17:00 hôm nay. Hiện 5 người giữ suất.`
- `Giữ suất miễn phí. Đủ 8 người giữ suất thì bạn mới phải trả. Không đủ người trả thì kèo tự hủy và host chuyển lại 100%.`

Người **dưới 60 điểm** uy tín: giữ suất là phải trả ngay (yêu cầu trả tiền hạn 10 phút), đúng luật "dưới 60đ phải trả trước 100%" (4.2 §A2.5).

**App tự chọn chế độ (4.2 §A2.4 "đừng bắt người dùng chọn"):** bản đầu dùng luật cứng, host đổi được — bóng đá 7, bóng chuyền, hoặc giờ trước 17h → B; còn lại → A. Đo % kèo đạt quorum (mục tiêu > 65%, 4.4 §A7.2) để chỉnh luật.

**Hạ giá phút chót (4.2 §A2.4):** hiểu "còn 60 phút" là **60 phút trước hạn chót**. Ai gánh phần giảm chưa có trong tài liệu → đề xuất: host bật/tắt, phần giảm trừ vào phần của host.

**Việc nền:** `pg-boss` không chung transaction với Prisma, nên ngoài job hẹn giờ (`startAfter`) phải có **job quét mỗi phút** tìm hạn chót đã qua. Mọi job đọc lại trạng thái trước khi làm, vì job có thể chạy trễ hoặc hai lần.

**Uy tín (4.2 §A2.5):** bảng `ReputationEvent` + điểm cache trên `User` (bắt đầu 100). No-show −20 · hủy dưới 6h −5 · đá đủ +2 · host đánh giá tốt +3. Dưới 60: phải trả trước 100%. Dưới 40: khóa 30 ngày — kiểm khóa **trong DB** ở mọi thao tác ghi, vì JWT web 7 ngày không thu hồi được. Thêm luật tài liệu còn thiếu (đề xuất): hết khóa thì về 60; **host có nghĩa vụ hoàn quá 7 ngày chưa xong thì không tạo được trận có thu tiền**.

**Trình độ (4.2 §A2.3):** v0.1 tự khai 4 mức (đã có `PlayerSkill`). v0.3 thêm host xác nhận 1 chạm sau trận. Nhập trình độ từ kết quả giải và OpenSkill/Elo ở **v1.0** (4.2 §A3; `7.` §5.3).

**Bốn luồng:** v0.3 làm L1 (vào trận có sẵn) + L2 (đội thiếu người: gợi ý theo môn, trình độ, từng chơi ở sân đó, uy tín; mời hàng loạt; thông báo có nút "Vào"). L3, L4 thuộc v0.5 — schema chỉ cần không chặn đường (trận có thể gắn `teamId` sau).

### 4.3 Thanh toán

#### 4.3.1 Nguyên tắc (4.2 §A2.6 + tra cứu pháp lý)

- Tiền **không bao giờ** đi qua tài khoản của MONSPORT. Không ví, không số dư, không giữ cọc.
- Nghị định 52/2024/NĐ-CP xếp **hỗ trợ thu hộ chi hộ** và **cổng thanh toán điện tử** vào dịch vụ trung gian thanh toán phải có giấy phép NHNN (Điều 22 khoản 1 — theo bản tóm tắt, chưa đọc nguyên văn); Điều 8 khoản 7 cấm cung ứng khi chưa có phép. Mô hình "chỉ hiện QR của người nhận + đọc biến động để đối soát" **có vẻ** nằm ngoài, nhưng **chưa có văn bản xác nhận** → hỏi luật sư trước 09/2027.
- Ba điểm hỏi luật sư thêm: (1) 3 tháng đầu đội tự làm host 100% trận (4.4 §A8 #2), tức tiền người lạ vào tài khoản cá nhân thành viên; (2) Luật TMĐT + NĐ 248/2026 (hiệu lực 01/07/2026): app cho host bán suất cho người lạ có phải đăng ký là sàn TMĐT không (cần pháp nhân); (3) lưu dữ liệu giao dịch ngân hàng của host theo Luật 91/2025 (§4.3.5).
- Đối thủ Datsan247 cho chuyển khoản vào tài khoản công ty của họ (tức là giữ tiền) — **không bắt chước**.

#### 4.3.2 Luồng tiền theo chế độ

| | Chế độ A (chốt sân trước) | Chế độ B (đủ người mới đặt) |
|---|---|---|
| Khi nào trả | Ngay khi vào trận (hạn 10 phút, như hold 10 phút ở 4.2 §A2.1) | Khi mở cửa trả tiền (D3); người < 60 điểm trả ngay khi giữ suất |
| Trả cho ai | Host | Host (D4) |
| Không trả kịp | Yêu cầu `EXPIRED`, người chơi `EXPIRED`, nhả chỗ cho hàng chờ | Như bên trái, cộng −5 điểm |
| Host cho "trả tại sân" | Được, với người ≥ 60 điểm (không tạo yêu cầu trả tiền) | Không |
| Không đủ người | Host chịu (4.2 §A2.4) | Hủy; chỉ ai đã trả mới cần hoàn |

#### 4.3.3 VietQR

- **Tự sinh payload** theo chuẩn EMVCo/NAPAS ở server (hàm thuần trong `packages/shared`, có test CRC16 với bộ mẫu): trường 38 (BIN ngân hàng + số tài khoản, dịch vụ `QRIBFTTA`), 53 = `704`, 54 = số tiền (số nguyên VND), 62.08 = nội dung, 63 = CRC16/CCITT-FALSE. API trả chuỗi `qrPayload` + từng trường; web vẽ bằng thư viện `qrcode`, Flutter bằng `qr_flutter`. `img.vietqr.io` chỉ là dự phòng (nội dung tối đa 50 ký tự, không ký tự đặc biệt).
- **Mã thanh toán** trong nội dung: `MS` + 6 ký tự base32 bỏ ký tự dễ nhầm (0/O, 1/I), `UNIQUE`. Giữ nội dung ngắn vì mỗi ngân hàng cắt khác nhau.
- Lưu ý từ SePay: VietinBank cá nhân/HKD phải có chuỗi `SEVQR` trong nội dung; BIDV (cá nhân/HKD), OCB, MSB bắt buộc tài khoản ảo — kiểm ngân hàng của người nhận tiền lúc họ kết nối.
- **Nghiệm thu:** quét thành công bằng ít nhất 5 app ngân hàng phổ biến ở địa bàn (chọn theo phỏng vấn tháng 12).

#### 4.3.4 Xác nhận tiền và nghĩa vụ hoàn

**`PaymentRequest.status`** — nguồn sự thật duy nhất về tiền: `PENDING` (chờ trả) → `CLAIMED` (người chơi bấm "tôi đã chuyển" — **giữ chỗ dù host chưa xác nhận**) → `CONFIRMED` (host xác nhận hoặc webhook khớp) · `DISPUTED` · `EXPIRED` (quá hạn khi còn `PENDING`) · `CANCELLED`.

| Cấp | Cách | Khi nào |
|---|---|---|
| 0 — thủ công (mặc định) | Host thấy danh sách `CLAIMED`, tích nhiều người rồi bấm "đã nhận" một lần | v0.3, mọi người nhận tiền |
| 1 — SePay OAuth2 | Người nhận tiền đồng ý trên màn SePay (scope `bank-account:read`, `transaction:read`, `webhook:write`), app tự tạo webhook trên tài khoản của họ; mỗi người dùng gói Free riêng | v0.3 S5, tùy chọn |
| 2 — Bank Hub (SePay) | Nhúng màn liên kết ngân hàng trong app | Chỉ khi SePay báo giá/điều kiện đối tác; chưa lên kế hoạch |

**Webhook SePay** (`POST /api/webhooks/sepay/:connectionId`):
1. Bật `rawBody: true` khi tạo app NestJS — kiểm chữ ký cần body gốc, hiện body đã bị parse.
2. Kiểm HMAC-SHA256: header `X-SePay-Signature` (`sha256=…`) + `X-SePay-Timestamp`, ký chuỗi `{timestamp}.{raw_body}`. Mẫu của SePay từ chối lệch quá 300 giây — kiểm xem lần gửi lại có ký lại timestamp không trước khi đặt ngưỡng.
3. Lưu `BankTransaction` với `UNIQUE(provider, providerTxnId)` — đây là cách chống trùng của webhook (SePay không gửi `Idempotency-Key`), rồi trả `{"success": true}` ngay; xử lý tiếp qua outbox.
4. Khớp **mã trước, số tiền sau**; thiếu/thừa/sai mã → hàng "chờ xác nhận tay" của người nhận tiền. SePay gửi lại tối đa 7 lần nên xử lý hai lần phải ra cùng kết quả.

**Hủy/hoàn (4.2 §A2.7) trong mô hình không giữ tiền:**

| Tình huống | Chính sách gốc | Ai chịu (gốc) | App làm gì |
|---|---|---|---|
| Hủy trước 24h | Hoàn 100% | — | `RefundObligation` 100% host → người chơi; nhắc host tới khi người chơi bấm "đã nhận lại" |
| Hủy 6–24h | Hoàn 50% hoặc đổi giờ | Chia đôi với sân | Nghĩa vụ 50% host → người chơi, hoặc chuyển suất sang trận khác cùng host. Phần "chia với sân" là chuyện host ↔ chủ sân: từ v0.4 ghi nghĩa vụ sân → host nếu sân có trong hệ thống |
| Hủy dưới 6h | Không hoàn, được chuyển nhượng | Người đặt | Rời trận; nếu hàng chờ lấp được chỗ → nghĩa vụ hoàn 100% từ host (D7); −5 điểm |
| Không đủ quorum | Hoàn 100%, không trừ điểm | — | Chỉ ai **đã** trả mới có nghĩa vụ hoàn (D3); không trừ điểm người đã trả |
| No-show | Mất tiền, −20 | Người đặt | Ghi `ReputationEvent`, không hoàn |
| Sân hủy (mưa, sự cố) | Hoàn 100% + voucher | Sân | Chuỗi hoàn: sân → host (ghi nghĩa vụ từ v0.4; trước đó host tự lo) → người chơi (nghĩa vụ 100%). **Voucher không làm** (là giá trị lưu trữ, gần với số dư) → thay bằng ưu tiên hàng chờ kèo sau — cần đội đồng ý |
| Đặt trùng do lỗi hệ thống | Hoàn 100% + tìm sân thay trong 3km trong 5 phút | **MONSPORT** | `EXCLUDE` chặn trùng trong hệ thống; nếu vẫn xảy ra (lỗi code) thì đội bồi từ quỹ chung. "Tìm sân thay trong 5 phút" chưa làm được khi chưa có lịch trống (v0.4) → trước v0.4 chỉ hứa "báo ngay + gợi ý sân khác trong danh sách" |
| Host hủy | (tài liệu không có) | Host | Nghĩa vụ 100% cho mọi người đã trả; host hủy dưới 6h → −5 |

Tranh chấp ("tôi đã chuyển" mà host nói chưa nhận): `DISPUTED`, người chơi tải ảnh biên lai, đội vận hành xem. Không có tiền nào nằm ở MONSPORT nên app chỉ phân xử bằng uy tín.

#### 4.3.5 Vì sao không bật đối soát tự động cho tất cả

- Tra cứu 12/10/2026: một tài khoản SePay **không** theo dõi được tài khoản ngân hàng của người khác nếu chủ tài khoản không tự xác thực (ví dụ VPBank phải OTP trên app ngân hàng, tên + CCCD phải khớp).
- Gói Free 50 giao dịch/tháng tính **mọi** giao dịch của tài khoản đó, không riêng tiền kèo; vượt gói vẫn chạy và tính phí sau. Host 3 kèo/tuần × 10 người ≈ 120 giao dịch/tháng (tự tính) sẽ vượt → khuyên host dùng **một tài khoản ngân hàng riêng để thu tiền kèo**, và báo trước về phí.
- **Dữ liệu cá nhân:** webhook đẩy mọi biến động của tài khoản host về (tên người gửi, nội dung). Chỉ lưu đầy đủ giao dịch **khớp mã**; giao dịch không khớp giữ `providerTxnId` + số tiền để chống trùng, xóa nội dung sau 30 ngày; xin đồng ý rõ ràng lúc kết nối.
- Casso tính phí theo năm và có kiểu kết nối RPA (đăng nhập ngân hàng thay chủ tài khoản) — tránh.

#### 4.3.6 Kênh phân phối và thanh toán

| Kênh | Quy định | Hệ quả |
|---|---|---|
| App Store | Guideline 3.1.3(e): hàng hóa/dịch vụ thể chất dùng ngoài app **phải dùng phương thức khác IAP** | VietQR hợp lệ; ghi trong review notes rằng QR chỉ để trả tiền thuê sân (3.1.1 nhắc cấm dùng QR mở khóa nội dung số). Thêm: 4.8 (đăng nhập bên thứ ba) và 5.1.1(v) (xóa tài khoản) — D10 |
| Google Play | Ngoại lệ Play Billing gồm "physical services"; tài khoản cá nhân phải thử kín 12 người × 14 ngày; phải có xóa tài khoản | VietQR hợp lệ |
| Zalo Mini App | "Mini App có tính năng thanh toán bắt buộc phải tích hợp Checkout SDK"; hiện VietQR trực tiếp có được không thì chưa rõ | Lý do thứ hai để gác Mini App; nếu làm lại, email `hotrodoitac@zaloplatforms.com` trước |

### 4.4 Đăng nhập và thông báo

| | Web | App Flutter |
|---|---|---|
| Phiên | Cookie httpOnly hiện có | `POST /auth/login` trả `accessToken` (15 phút) + `refreshToken` (30 ngày, xoay vòng, lưu `DeviceSession`); lưu bằng `flutter_secure_storage` |
| Guard | `JwtAuthGuard` nhận cả hai: **có header `Authorization: Bearer` thì chỉ dùng header**, không thì đọc cookie | |
| Nhà cung cấp | `AuthProvider` giả tới v0.3; sau đó Zalo OAuth v4 | Như web, qua trình duyệt hệ thống + PKCE (D10, chưa xác minh) |
| Gộp tài khoản | Số điện thoại là khóa gộp (`7.` §6) | Như web |
| Buộc cập nhật | — | API trả `minSupportedVersion`; app cũ hơn thì chặn và mở trang store (`8.` §7.3) |
| Thông báo | Bảng `Notification` + Web Push | **FCM** (Android v0.3; iOS qua APNs ở v0.4), 0đ |
| Tin quan trọng | ZNS 200–300đ/tin (template yêu cầu chuyển khoản/OTP: 300đ), cần OA + tài khoản ZBS có số dư | Như web |
| Chống gửi trùng khi mạng yếu | Header `Idempotency-Key` bắt buộc cho: vào trận, giữ suất, đặt sân, "tôi đã chuyển", "đã nhận". **Webhook không dùng header này** (§4.3.4) | Như web; app **không** có hàng đợi offline cho đặt sân/trả tiền (phải online) |

---

## 5. Mô hình dữ liệu

| Bảng | Thêm/đổi | Bản |
|---|---|---|
| (mọi `DateTime`) | → `@db.Timestamptz(3)` | **M2 (ngay)** |
| `Court` | `sport` → `sports Sport[]` | M2 |
| `Booking` *(mới)* | courtId, startAt, endAt, status `HOLD/CONFIRMED/CANCELLED/EXPIRED`, expiresAt?, source `PHONE/APP/WALK_IN/TOURNAMENT`, createdById, priceTotal Int?; `CHECK` + `EXCLUDE` | M2 |
| `Match` | + bookingId? (unique), + joinedCount (0) | M2–M3 |
| `Match` | + mode `HOST_FIRST/QUORUM`, quorumMin?, quorumDeadline?, confirmedAt?, paymentWindowEndsAt?, cancelReason?, requireApproval, payeeAccountId?, allowPayAtVenue | v0.3 |
| `MatchEntry` | + status (`ACTIVE`, `LEFT` ở M3; thêm `REQUESTED`, `EXPIRED`, `REJECTED` ở v0.3), attendance?, leftAt? | M3 · v0.3 |
| `WaitlistEntry` *(mới)* | matchId, userId, createdAt; `UNIQUE(matchId,userId)` | v0.3 |
| `ReputationEvent` *(mới)* + `User.reputation`, `User.lockedUntil` | userId, type, delta, matchId? | v0.3 |
| `SkillConfirmation` *(mới)* | matchId, raterId, userId, sport, verdict | v0.3 |
| `PayoutAccount` *(mới)* | ownerType `USER/VENUE`, ownerId, bankBin, accountNumber, accountName, reconcileMode `MANUAL/SEPAY`, sepayConnectionId? | v0.3 |
| `PaymentRequest` *(mới)* | code `UNIQUE`, matchEntryId?/bookingId?, payeeAccountId, payerId, amount Int, status (§4.3.4), expiresAt, claimedAt?, confirmedAt?, confirmedBy `HOST/WEBHOOK`, receiptUrl? | v0.3 |
| `BankTransaction` *(mới)* | provider, providerTxnId, payeeAccountId, amount, content? (xóa sau 30 ngày nếu không khớp), occurredAt, matchedRequestId?; `UNIQUE(provider, providerTxnId)` | v0.3 |
| `RefundObligation` *(mới)* | paymentRequestId, fromAccountId, toUserId, amount, reason, status `OPEN/DONE/DISPUTED`, dueAt | v0.3 |
| `IdempotencyKey` *(mới)* | userId, endpoint, key, requestHash, responseJson, expiresAt; `UNIQUE(userId, endpoint, key)` | v0.3 |
| `OutboxEvent` *(mới)* | type, payload Json, nextAttemptAt, attempts, sentAt? (worker lấy 50 dòng `FOR UPDATE SKIP LOCKED`) | v0.3 — M3 vẫn ghi `Notification` trong cùng transaction như prompt 5 |
| `DeviceSession` *(mới)* | userId, refreshTokenHash, deviceName, pushToken?, appVersion, expiresAt, revokedAt? | v0.3 |
| `AuditLog` *(mới)* | actorId, action, entity, entityId, before/after Json | v0.3 (mọi thao tác tiền) |
| `OpeningRule`, `PriceRule`, `BookingSeries` *(mới)* | §4.1 | v0.4 |

Tiền: số nguyên VND ở mọi bảng. `Match.pricePerSlot` thôi là "chỉ hiển thị" từ v0.3 — số tiền thật nằm ở `PaymentRequest.amount`.

**Lưu ý migration:** thêm giá trị enum (`ALTER TYPE … ADD VALUE`) rồi dùng ngay trong cùng migration sẽ báo lỗi "unsafe use of new value" — tách thành hai migration.

---

## 6. API (REST, tiền tố `/api`)

| Bản | Endpoint chính |
|---|---|
| M2 | `GET/POST /venues`, `POST /venues/:id/courts` (admin) · `POST /matches` (tạo `Booking` + `Match` trong 1 transaction) · `GET /matches?sport&date&near&level` · `GET /matches/:id` |
| M3 | `POST /matches/:id/join` · `POST /matches/:id/leave` · `POST /matches/:id/cancel` · `GET /notifications`, `POST /notifications/:id/read` |
| v0.3 — trận | `POST /matches/:id/soft-hold` (ghi giữ mềm) · `POST /matches/:id/requests/:entryId/approve` · `…/reject` · `POST /matches/:id/waitlist` · `POST /matches/:id/attendance` · `POST /matches/:id/skill-confirmations` · `POST /matches/:id/invites` (mời hàng loạt) |
| v0.3 — tiền | `GET/POST /payout-accounts` · `GET /payment-requests/:id` (trả `qrPayload`) · `POST /payment-requests/:id/claim` · `…/dispute` · `GET /payee/pending` (danh sách chờ xác nhận) · `POST /payment-requests/confirm-batch` · `GET /refund-obligations` · `POST /refund-obligations/:id/done` · `POST /webhooks/sepay/:connectionId` · `GET /oauth/sepay/callback` |
| v0.3 — tài khoản | `POST /auth/refresh` · `POST /devices` (push token) · `DELETE /users/me` (xóa tài khoản) · `GET /app-config` (`minSupportedVersion`) |
| v0.4 | `GET /courts/:id/availability?date` · `POST /bookings` (đặt trực tiếp) · `POST /bookings/:id/confirm` · `…/cancel` (chủ sân) · `POST /booking-series` · `GET /venues/:slug` (công khai) · `GET /owner/reports/daily` |


---

## 9. Kiểm thử và nghiệm thu

| # | Tiêu chí | Bản |
|---|---|---|
| 1 | 50 request song song đặt cùng sân, cùng giờ → đúng 1 thành công, 49 nhận 409 tiếng Việt (CI, Postgres thật) | M2 |
| 2 | Liền kề 19–20h và 20–21h đặt được; khác sân đặt được; hủy rồi đặt lại được | M2 |
| 3 | Hai người tranh suất cuối → 1 vào, 1 nhận "Trận đã đủ người"; trận tự `FULL`; rời thì về `OPEN` | M3 |
| 4 | Sau mọi kịch bản vào/rời/duyệt/từ chối/hết hạn: `joinedCount` = số dòng `ACTIVE` | M3 · v0.3 |
| 5 | Người đã rời vào lại được (cập nhật dòng cũ, không lỗi UNIQUE) | M3 |
| 6 | Giờ hiển thị đúng `Asia/Ho_Chi_Minh` trên web và app | M2 |
| 7 | Web dùng được ở màn 390px | M3 |
| 8 | Chế độ B, `quorumMin = capacity`: vẫn đi qua cửa trả tiền và chốt đúng; trận đã chốt còn suất vẫn nhận người | v0.3 |
| 9 | Job hạn chót chạy hai lần, hoặc chạy cùng lúc với câu chốt → cùng một kết quả | v0.3 |
| 10 | Người rời trận → người chờ đầu tiên được đẩy vào trong cùng transaction, nhận thông báo | v0.3 |
| 11 | Người đã bấm "tôi đã chuyển" không mất suất dù host chưa xác nhận | v0.3 |
| 12 | Webhook gửi lặp 7 lần → 1 `BankTransaction`; chữ ký sai → 401; sai mã → vào hàng xác nhận tay | v0.3 |
| 13 | Gửi lại cùng `Idempotency-Key` → cùng phản hồi, không tạo bản ghi thứ hai | v0.3 |
| 14 | VietQR quét được bằng ≥ 5 app ngân hàng; CRC khớp bộ mẫu | v0.3 |
| 15 | App Android chạy trên máy giá rẻ, mạng 3G giả lập; push tới trong 30 giây | v0.3 |
| 16 | Lịch trống = giờ mở cửa trừ booking còn sống, đúng cả qua nửa đêm | v0.4 |
| 17 | Chuỗi đặt cố định gặp trùng → báo chủ sân + host, không hỏng cả chuỗi | v0.4 |

