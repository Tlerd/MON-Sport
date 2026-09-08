<!-- Nguon: projectMONSPORT/Plan Project/Markdown/Prompt/5. prompt-code-demo-nodejs.md
     Sua o vault truoc, roi copy lai sang day. Dung sua truc tiep file nay. -->

=== PROMPT ===` xuống cuối file, dán vào |
| 3 | Cho agent chạy **từng Mốc một** (M0 → M6). Hết mỗi mốc phải `git commit` và chạy được, mới sang mốc sau |
| 4 | Sau mỗi mốc, tự bấm thử theo bảng **Tiêu chí nghiệm thu** — không tin agent nói "đã xong" |

**Ba lựa chọn công nghệ đã chốt 08/09/2026** (trước đó tài liệu để trống, xem `4.8` tuần 2 "chốt stack"):

| Lớp | Chốt | Vì sao chọn cái này |
|---|---|---|
| Backend | **NestJS + TypeScript** | Có sẵn module / DI / validation / guard. Đội 5 người học chung một cấu trúc, người review ở xa vẫn đọc được. Gần Spring Boot nên ai học Java ở trường vào nhanh |
| Database | **PostgreSQL + Prisma**, chạy trên **Supabase free tier** | Đúng thứ `4.1` đã nhắm cho hạ tầng 0đ. Prisma tự sinh migration + type dùng chung với TypeScript. Dữ liệu giải đấu nhiều quan hệ → phải là SQL |
| Frontend | **React + Vite (SPA)** gọi REST API | Tách hẳn frontend/backend, đúng kiến trúc thật. Cùng bộ API sau này Zalo Mini App gọi lại được, không phải viết lần hai |

> ⚠️ Đổi lại: NestJS + SPA là **hai dốc học cùng lúc**. Nếu tới cuối 11/2026 mà v0.1 chưa chạy được một trận thật, hạ SPA xuống server-rendered trước, **giữ nguyên NestJS**.

---

=== PROMPT === *(copy từ dòng này xuống hết file)*

---

# Nhiệm vụ

Bạn dựng một **demo chạy được** cho MONSPORT — nền tảng thể thao ở cấp xã/huyện Việt Nam. Đây là bản Phase 0, dựng từ xa, **chưa có người dùng thật**, mục tiêu là chạy trọn một giải giả lập 8 đội trước 15/05/2027.

Bạn viết cho một đội **5 sinh viên**, không ai từng làm production. Ưu tiên theo đúng thứ tự này:

1. **Chạy được** — `git clone` → 3 lệnh → mở trình duyệt thấy app.
2. **Đọc hiểu được** — người trong đội đọc file lạ vẫn biết nó làm gì.
3. Đúng nghiệp vụ.
4. Đẹp.

Không tối ưu sớm. Không trừu tượng hóa trước khi có hai chỗ dùng.

---

# 1. Công nghệ (đã chốt — không đổi, không thêm)

## 1.1 Bắt buộc dùng

| Lớp | Chốt |
|---|---|
| Runtime | **Node.js 26 LTS** (ghi vào `.nvmrc` và `engines`) — chọn 26 vì nó được vá bảo mật tới 04/2029, phủ trọn Phase 1; Node 24 hết hạn 04/2028, giữa chừng dự án |
| Ngôn ngữ | **TypeScript**, `strict: true`, cấm `any` (dùng `unknown` + thu hẹp kiểu) |
| Backend | **NestJS** — module / controller / service / DTO |
| ORM | **Prisma** — schema-first, mọi thay đổi DB đi qua migration |
| Database | **PostgreSQL 16** — dev chạy Docker local, deploy dùng **Supabase free tier** |
| Frontend | **React + Vite + TypeScript** (SPA), **React Router**, **TanStack Query**, **Tailwind CSS** |
| Validate | **Zod** ở cả hai đầu; ở NestJS dùng `ZodValidationPipe` toàn cục |
| API docs | **Swagger** (`@nestjs/swagger`) tại `/api/docs` |
| Test | **Vitest** cho unit, **Supertest** cho e2e API |
| Lint | ESLint + Prettier, chạy trong CI |
| Repo | **monorepo pnpm workspaces** |
| CI | **GitHub Actions**: lint → typecheck → test → build. Đỏ là không merge |

**Pin phiên bản:** dùng bản mới nhất tại thời điểm khởi tạo, nhưng **ghi số phiên bản thực tế vào `README.md`** và commit `pnpm-lock.yaml`. Không dùng dải `^` mở cho Nest, Prisma, React.

## 1.2 Cấm dùng trong bản demo này

❌ Redis · ❌ hàng đợi (BullMQ…) · ❌ microservice · ❌ GraphQL · ❌ Docker cho app (chỉ Docker cho Postgres) · ❌ Kubernetes · ❌ thư viện UI component nặng (MUI, Ant) — chỉ Tailwind + component tự viết · ❌ state manager toàn cục (Redux, Zustand) — TanStack Query + `useState` là đủ · ❌ mọi SDK thanh toán.

## 1.3 Ba thứ phải viết dưới dạng cổng đổi được (port/adapter)

Chưa có tài khoản thật, nên **không gọi dịch vụ ngoài**, nhưng phải chừa sẵn chỗ cắm:

| Cổng | Bản dùng bây giờ | Bản sau này cắm vào |
|---|---|---|
| `AuthProvider` | `MockZaloProvider` — chọn user từ danh sách seed, cấp JWT | Zalo OAuth thật (Phase 1) |
| `NotificationPort` | `ConsoleNotificationAdapter` — ghi log + lưu bảng `Notification` để hiện trong app | Zalo OA ZNS |
| `FileStoragePort` | lưu local `./uploads` | Supabase Storage |

Mỗi cổng là một interface trong `packages/shared`, adapter chọn bằng biến môi trường. **Không rải `if (mock)` trong service.**

## 1.4 Cấu trúc repo

```
monsport/
├─ apps/
│  ├─ api/                 # NestJS
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma
│  │  │  ├─ migrations/
│  │  │  └─ seed.ts
│  │  └─ src/
│  │     ├─ common/        # pipe, filter, guard, decorator
│  │     ├─ auth/
│  │     ├─ users/
│  │     ├─ venues/
│  │     ├─ matches/
│  │     ├─ tournaments/   # to nhất — tách submodule bên trong
│  │     ├─ notifications/
│  │     └─ main.ts
│  └─ web/                 # React + Vite
│     └─ src/
│        ├─ api/           # client sinh từ type dùng chung
│        ├─ components/
│        ├─ pages/
│        ├─ hooks/
│        └─ routes.tsx
├─ packages/
│  └─ shared/              # Zod schema + type + port interface, DÙNG CHUNG hai bên
├─ docker-compose.yml      # chỉ postgres
├─ .github/workflows/ci.yml
├─ .env.example
└─ README.md
```

**Luật cứng:** mọi kiểu dữ liệu đi qua API phải định nghĩa **một lần** bằng Zod trong `packages/shared`, hai bên `import` lại. Cấm khai báo lại type ở `web/`.

---

# 2. Mô hình dữ liệu

Dựng đúng những bảng dưới đây, **không thêm bảng nào không có tính năng dùng tới**.

```prisma
// ---------- v0.1: người & sân & trận ----------

model User {
  id           String   @id @default(cuid())
  zaloId       String   @unique          // ở bản mock: "mock-<slug>"
  name         String
  phone        String?
  avatarUrl    String?
  role         Role     @default(PLAYER) // PLAYER | ORGANIZER | ADMIN
  createdAt    DateTime @default(now())
  skills       PlayerSkill[]
  hostedMatches Match[]      @relation("host")
  entries      MatchEntry[]
  notifications Notification[]
}

// Hồ sơ trình độ tách riêng vì MỘT người có nhiều môn, mỗi môn một trình độ.
// Bản demo chỉ có mức tự khai (4.2 §A2.3 — "host xác nhận" để v0.3).
model PlayerSkill {
  id       String @id @default(cuid())
  userId   String
  sport    Sport                          // FOOTBALL | BADMINTON | VOLLEYBALL | PICKLEBALL
  level    SkillLevel                     // NEW | AVERAGE | GOOD | STRONG
  user     User   @relation(fields: [userId], references: [id])
  @@unique([userId, sport])
}

// Sân do team nhập tay trong 3 tháng đầu (4.2 §A2.1) — chưa có tài khoản chủ sân.
model Venue {
  id        String  @id @default(cuid())
  name      String
  commune   String                        // xã — đơn vị nhân bản của dự án
  district  String
  address   String
  sports    Sport[]
  pricePerHour Int                        // VND, chỉ để hiển thị, KHÔNG thu tiền
  courts    Court[]
}

model Court {
  id      String @id @default(cuid())
  venueId String
  name    String                          // "Sân 1", "Sân cỏ A"
  sport   Sport
  venue   Venue  @relation(fields: [venueId], references: [id])
}

model Match {
  id          String      @id @default(cuid())
  courtId     String
  hostId      String
  sport       Sport
  startAt     DateTime
  endAt       DateTime
  capacity    Int                         // tổng số suất
  pricePerSlot Int                        // VND — CHỈ HIỂN THỊ, không có luồng trả tiền
  minLevel    SkillLevel?
  maxLevel    SkillLevel?
  note        String?
  status      MatchStatus @default(OPEN)  // OPEN | FULL | CANCELLED | FINISHED
  host        User        @relation("host", fields: [hostId], references: [id])
  court       Court       @relation(fields: [courtId], references: [id])
  entries     MatchEntry[]
  @@index([startAt, sport])
}

model MatchEntry {
  id       String   @id @default(cuid())
  matchId  String
  userId   String
  joinedAt DateTime @default(now())
  match    Match    @relation(fields: [matchId], references: [id])
  user     User     @relation(fields: [userId], references: [id])
  @@unique([matchId, userId])             // một người không vào trận hai lần
}

// ---------- v0.2: giải đấu ----------

model Tournament {
  id           String   @id @default(cuid())
  slug         String   @unique           // dùng cho trang công khai /giai/<slug>
  name         String
  sport        Sport
  commune      String
  organizerId  String
  format       Format                     // ROUND_ROBIN | KNOCKOUT | GROUP_KNOCKOUT
  teamLimit    Int
  groupCount   Int?                       // chỉ dùng khi có vòng bảng
  advancePerGroup Int?                    // mỗi bảng lấy mấy đội đi tiếp
  regOpenAt    DateTime
  regCloseAt   DateTime
  startAt      DateTime
  rules        String?                    // điều lệ, markdown
  drawSeed     Int?                       // seed dùng khi bốc thăm — lưu lại để bốc lại ra y hệt
  winPoints    Int      @default(3)       // BTC đổi được: giải phong trào hay dùng 2-1-0
  drawPoints   Int      @default(1)
  losePoints   Int      @default(0)
  status       TStatus  @default(DRAFT)   // DRAFT | REGISTERING | DRAWN | RUNNING | FINISHED
  teams        Team[]
  groups       Group[]
  fixtures     Fixture[]
}

model Team {
  id           String     @id @default(cuid())
  tournamentId String
  name         String
  logoUrl      String?
  captainName  String
  captainPhone String
  seed         Int?                       // hạt giống, BTC nhập tay
  status       TeamStatus @default(PENDING) // PENDING | APPROVED | REJECTED
  rejectReason String?                    // bắt buộc điền khi REJECTED
  groupId      String?
  players      Player[]
  tournament   Tournament @relation(fields: [tournamentId], references: [id])
  group        Group?     @relation(fields: [groupId], references: [id])
  @@unique([tournamentId, name])
}

model Player {
  id       String  @id @default(cuid())
  teamId   String
  name     String
  number   Int?
  birthYear Int?
  userId   String?                        // nối với User nếu VĐV có tài khoản
  team     Team    @relation(fields: [teamId], references: [id])
}

model Group {
  id           String @id @default(cuid())
  tournamentId String
  name         String                     // "Bảng A"
  teams        Team[]
  tournament   Tournament @relation(fields: [tournamentId], references: [id])
}

model Fixture {
  id           String       @id @default(cuid())
  tournamentId String
  groupId      String?                    // null nếu là trận loại trực tiếp
  round        Int                        // vòng 1,2,3… hoặc 1=tứ kết…
  stage        Stage                      // GROUP | KNOCKOUT
  order        Int                        // thứ tự trong vòng, để dựng nhánh
  homeTeamId   String?                    // null khi chưa biết đội thắng vòng trước
  awayTeamId   String?
  homeSourceFixtureId String?             // nhánh: đội thắng trận nào vào đây
  awaySourceFixtureId String?
  scheduledAt  DateTime?
  courtId      String?
  homeScore    Int?
  awayScore    Int?
  winnerTeamId String?                    // chỉ dùng ở vòng loại trực tiếp khi hoà: BTC chọn đội đi tiếp
  note         String?                    // "luân lưu 4-3", "hiệp phụ", ghi chú của BTC
  status       FixtureStatus @default(SCHEDULED) // SCHEDULED | LIVE | FINISHED
  events       MatchEvent[]
  tournament   Tournament   @relation(fields: [tournamentId], references: [id])
}

// Gộp bàn thắng và thẻ vào một bảng: cùng là "chuyện xảy ra trong trận",
// tách hai bảng chỉ để rồi join lại khi tính vua phá lưới.
model MatchEvent {
  id        String    @id @default(cuid())
  fixtureId String
  playerId  String
  teamId    String
  minute    Int?
  type      EventType                     // GOAL | OWN_GOAL | YELLOW | RED
  fixture   Fixture   @relation(fields: [fixtureId], references: [id])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  title     String
  body      String
  link      String?
  readAt    DateTime?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
```

Các `enum` (`Role`, `Sport`, `SkillLevel`, `MatchStatus`, `Format`, `TStatus`, `TeamStatus`, `Stage`, `FixtureStatus`, `EventType`) tự khai trong `schema.prisma` theo đúng các giá trị đã ghi ở cột chú thích. Vài quan hệ để dạng khóa trơn (`Tournament.organizerId`, `Fixture.courtId`) — nối `@relation` đầy đủ khi dựng thật.

**Không có bảng nào cho tiền.** Không `Payment`, không `Order`, không `Wallet`, không `Transaction`. Giải hè 2027 tài trợ 0đ; `pricePerSlot` và `pricePerHour` chỉ là con số hiển thị.

**Bảng xếp hạng không lưu thành bảng** — tính từ `Fixture` mỗi lần đọc. Ít dữ liệu, tính lại luôn đúng, không bao giờ lệch. Chỉ cache khi đo được là chậm.

---

# 3. Chức năng phải có — v0.1 xương sống

Đích kiểm chứng của v0.1: **một trận thật của chính đội chạy trọn qua app, không dùng nhóm Zalo.**

| # | Chức năng | Chi tiết bắt buộc |
|---|---|---|
| 1.1 | Đăng nhập | Trang chọn user từ danh sách seed (`MockZaloProvider`) → cấp JWT (access 7 ngày, để trong httpOnly cookie). Có nút đăng xuất |
| 1.2 | Hồ sơ người chơi | Tên, ảnh, số điện thoại, và **trình độ tự khai theo từng môn** (Mới / Trung bình / Khá / Tốt). Sửa được |
| 1.3 | Danh sách sân | Xem theo xã + môn. Trang chi tiết sân: các sân con, giá tham khảo, địa chỉ. **Nhập liệu bằng seed + trang admin đơn giản**, chưa có tài khoản chủ sân |
| 1.4 | Tạo trận | Host chọn sân con, giờ bắt đầu/kết thúc, số suất, giá/suất, dải trình độ, ghi chú. **Chặn trùng giờ trên cùng một sân con** |
| 1.5 | Danh sách trận | Mặc định: **hôm nay trước, gần trước, đúng trình độ trước** (4.2 §A2.2 L1). Lọc theo môn / xã / ngày |
| 1.6 | Vào trận | Một chạm. Hết suất thì `status` tự chuyển `FULL`. Rời trận được. **Không có nút "quan tâm"** |
| 1.7 | Thông báo | Khi có người vào/rời trận → thông báo cho host. Khi trận đủ người → thông báo cho cả trận. Hiện ở chuông trong app + ghi log |
| 1.8 | Hủy trận | Host hủy → thông báo mọi người đã vào, `status = CANCELLED` |

❌ **v0.1 không có:** thanh toán, điểm uy tín, quorum/giữ mềm, danh sách chờ, chuyển nhượng suất, trang sân công khai, L3/L4. Những thứ đó là v0.3–v0.5, đừng làm sớm.

---

# 4. Chức năng phải có — v0.2 module giải đấu

> Đây là **cổng chặn**, không phải cột mốc. Đích: **một giải giả lập 8 đội chạy trọn trên app**, từ mở đăng ký tới trao giải, không cần ai can thiệp vào database.

## 4.1 Trước giải

| # | Chức năng | Chi tiết bắt buộc |
|---|---|---|
| 2.1 | BTC tạo giải | Tên, môn, xã, thể thức, số đội, hạn đăng ký, ngày khai mạc, điều lệ (markdown) |
| 2.2 | Trang giải công khai | `/giai/<slug>` — **xem được không cần đăng nhập**. Có nút sinh **mã QR** trỏ về chính trang này (dán ở sân, in ra giấy) |
| 2.3 | Đội đăng ký | Form: tên đội, logo, đội trưởng + SĐT, danh sách VĐV (tên, số áo, năm sinh). Chặn trùng tên đội trong cùng giải. **Không thu phí** |
| 2.4 | BTC duyệt đội | Duyệt / từ chối kèm lý do (bắt buộc điền `rejectReason` khi từ chối). Chỉ đội `APPROVED` mới được bốc thăm |
| 2.5 | Hạt giống | BTC nhập tay số hạt giống cho từng đội trước khi bốc |

## 4.2 Bốc thăm — phần thuật toán, làm cho đúng

Hỗ trợ **ba thể thức**:

| Thể thức | Cách sinh |
|---|---|
| `ROUND_ROBIN` (vòng tròn) | Thuật toán **circle method**: cố định đội 1, xoay các đội còn lại. Số đội lẻ → chèn một đội ảo `BYE`, đội gặp `BYE` được nghỉ vòng đó. Mỗi cặp gặp nhau đúng **một** lần |
| `KNOCKOUT` (loại trực tiếp) | Nâng số đội lên lũy thừa của 2 gần nhất bằng **bye**; hạt giống 1 và 2 phải nằm **hai nửa nhánh khác nhau**. Sinh sẵn toàn bộ nhánh, trận vòng sau để `homeTeamId = null` và trỏ `homeSourceFixtureId` về trận vòng trước |
| `GROUP_KNOCKOUT` (hỗn hợp) | Rải hạt giống theo kiểu rắn (snake) vào `groupCount` bảng → mỗi bảng đá vòng tròn → lấy `advancePerGroup` đội đầu mỗi bảng vào nhánh loại trực tiếp, **nhất bảng A gặp nhì bảng B** |

**Bắt buộc:**

- Bốc thăm phải **tái lập được**: nhận một `seed` số nguyên, lưu vào `Tournament.drawSeed`, cùng seed cho ra cùng kết quả. Dùng PRNG tự viết (mulberry32), **không dùng `Math.random()`**.
- Viết **unit test** cho cả ba thể thức: 4, 5, 8, 9, 12, 16 đội. Kiểm: đúng số trận, không đội nào gặp chính mình, không cặp nào lặp, mọi đội đá đúng số trận.
- Bốc lại được **khi và chỉ khi** chưa có trận nào nhập tỉ số. Có tỉ số rồi thì API trả 409.

Số trận để tự kiểm: vòng tròn `n` đội = `n(n-1)/2`. Loại trực tiếp `n` đội = `n-1`.

## 4.3 Lịch thi đấu

| # | Chức năng | Chi tiết |
|---|---|---|
| 2.6 | Tự sinh lịch | BTC nhập: các ngày thi đấu, khung giờ mỗi ngày, số sân, thời lượng 1 trận + nghỉ giữa hai trận. App rải trận vào các ô trống theo thứ tự vòng |
| 2.7 | Ràng buộc | **Một đội không đá hai trận liền kề nhau** trong cùng ngày. Nếu không xếp nổi thì báo rõ "thiếu N ô, thêm ngày hoặc thêm sân" — **không tự nhét bừa** |
| 2.8 | Sửa tay | BTC kéo/đổi giờ và sân của từng trận. Sửa tay luôn thắng lịch tự sinh |

## 4.4 Trong giải

| # | Chức năng | Chi tiết |
|---|---|---|
| 2.9 | Nhập tỉ số | BTC nhập tỉ số + danh sách sự kiện (ai ghi bàn phút mấy, thẻ vàng/đỏ). Trận `FINISHED` → nếu là trận loại trực tiếp, **tự đẩy đội thắng lên trận sau** |
| 2.10 | Hòa ở vòng loại trực tiếp | Cho nhập kết quả luân lưu / hiệp phụ vào `Fixture.note`; đội đi tiếp do BTC chọn, ghi vào `Fixture.winnerTeamId`. Ở vòng bảng hoà là hoà, không có `winnerTeamId` |
| 2.11 | Bảng xếp hạng | Tính trực tiếp từ kết quả. Thứ tự so: **điểm → hiệu số → số bàn thắng → đối đầu trực tiếp → tên đội**. Điểm lấy từ `Tournament.winPoints/drawPoints/losePoints` (mặc định 3-1-0, giải phong trào hay dùng 2-1-0) — **cấm hardcode số 3 trong code tính BXH** |
| 2.12 | Vua phá lưới | Xếp theo số bàn (không tính phản lưới), hòa thì ít trận hơn xếp trên |
| 2.13 | Thẻ phạt | Bảng tổng hợp thẻ theo VĐV và theo đội. Cảnh báo VĐV đủ 2 thẻ vàng |

## 4.5 Sau giải

| # | Chức năng | Chi tiết |
|---|---|---|
| 2.14 | Trang kết quả | Vô địch, á quân, hạng ba, vua phá lưới, BXH cuối |
| 2.15 | Xuất báo cáo BTC | Xuất **CSV** (danh sách đội, danh sách VĐV, toàn bộ kết quả, BXH) và một **trang in được** (`@media print`) để BTC in danh sách và giấy chứng nhận |
| 2.16 | Phân quyền BTC | Vai `ORGANIZER` chỉ sửa được giải của chính mình. `ADMIN` sửa tất cả. `PLAYER` chỉ xem |

❌ **v0.2 không có:** thu phí đăng ký, VietQR, đối soát, livestream, ảnh/video, chấm trình độ từ kết quả giải (v1.0).

⚠️ **Một chỗ cắt so với `4.2` §A2.8:** bản này chỉ có **đăng ký theo đội**, chưa có đăng ký cá nhân (giải cầu lông/pickleball đơn). Cắt vì giải hè 2027 là bóng đá theo đội. Khi làm cá nhân sau này, coi mỗi VĐV là một `Team` 1 người — **đừng dựng nhánh dữ liệu thứ hai**, toàn bộ bốc thăm và BXH dùng lại được nguyên vẹn.

---

# 5. Danh sách KHÔNG LÀM — dán lên tường

❌ App native · ❌ Ví điện tử / nạp tiền / giữ số dư · ❌ Mọi cổng thanh toán · ❌ Livestream · ❌ AI phân tích trận · ❌ Bán đồ thể thao · ❌ Đặt HLV · ❌ Giao đồ ăn · ❌ Gọi xe · ❌ Bảo hiểm · ❌ Đa ngôn ngữ · ❌ Feed/story kiểu mạng xã hội · ❌ Cá cược, dự đoán tỉ số có thưởng · ❌ Bản đồ 3D · ❌ Ảnh 360° · ❌ Chat trong app · ❌ Đánh giá sao chi tiết.

Nếu bạn thấy một tính năng "làm luôn cho tiện" mà nó nằm trong danh sách này hoặc thuộc v0.3+, **dừng lại và hỏi**, đừng tự làm.

---

# 6. Chuẩn code

| Mục | Luật |
|---|---|
| Tiếng | Code, tên biến, tên hàm, commit: **tiếng Anh**. Chuỗi hiện ra màn hình: **tiếng Việt có dấu**. Không trộn |
| Chuỗi hiển thị | Gom vào `web/src/i18n/vi.ts`, không rải chuỗi tiếng Việt trong JSX |
| Comment | Chỉ viết comment cho **vì sao**, không viết cho *cái gì*. Comment bằng tiếng Việt được, vì đội đọc |
| Lỗi | Một `HttpExceptionFilter` toàn cục, trả `{ code, message, details }`. `message` là tiếng Việt, hiện thẳng cho người dùng được |
| Ngày giờ | Lưu UTC trong DB, hiển thị `Asia/Ho_Chi_Minh`. Dùng `date-fns` + `date-fns-tz`, **không dùng moment** |
| Tiền | Lưu **số nguyên VND**, không dùng float, không lưu xu |
| Migration | Không bao giờ `prisma db push` trên nhánh chính. Luôn `prisma migrate dev --name <ten>` |
| Commit | Conventional Commits: `feat(tournaments): sinh lich vong tron` |
| Test tối thiểu | Bốc thăm 3 thể thức · tính BXH (gồm ca đối đầu trực tiếp) · sinh lịch không xếp nổi thì báo lỗi · chặn trùng giờ sân · e2e: đăng nhập → tạo trận → vào trận |

**Cấm tuyệt đối:** commit `.env` thật · để chuỗi kết nối DB trong code · tắt `strict` của TypeScript · dùng `// @ts-ignore` · để `console.log` sót trong `api/src`.

---

# 7. Dữ liệu seed — phải giống đời thật

Seed (`apps/api/prisma/seed.ts`) chạy được nhiều lần, dữ liệu bằng **tiếng Việt có dấu**:

| Loại | Số lượng | Yêu cầu |
|---|---|---|
| User | 40 | Tên Việt thật (Nguyễn Văn A kiểu đầy đủ), trình độ rải đều 4 mức, có 1 `ADMIN` + 2 `ORGANIZER` |
| Venue | 6 | Trong 2 xã, tên kiểu "Sân bóng Đại Thắng", "Nhà thi đấu xã Hòa Bình". Giá 150k–400k/giờ |
| Court | 14 | Sân bóng 7 người, sân cầu lông, sân bóng chuyền |
| Match | 25 | Rải từ hôm qua tới 14 ngày tới, các trạng thái khác nhau, có trận đầy có trận thiếu người |
| Tournament | 3 | **(a)** `REGISTERING` 8 đội đang mở đăng ký · **(b)** `RUNNING` 8 đội thể thức `GROUP_KNOCKOUT` đã đá xong vòng bảng, đang tới bán kết · **(c)** `FINISHED` 12 đội vòng tròn có đủ BXH và vua phá lưới |

Giải **(b)** là bản demo chính để bấm thử — mở lên phải thấy ngay bảng đấu, lịch, BXH có số.

Thêm lệnh `pnpm db:reset` = drop → migrate → seed, chạy một phát.

---

# 8. Thứ tự thực hiện — làm từng mốc, không nhảy cóc

Hết mỗi mốc: chạy được + test xanh + `git commit`. **Chưa xong mốc trước thì không sang mốc sau.**

| Mốc | Nội dung | Xong là khi |
|---|---|---|
| **M0** | Dựng monorepo, Docker Postgres, Prisma schema + migration đầu, `.env.example`, CI GitHub Actions, `README.md` | `pnpm i && pnpm db:reset && pnpm dev` → API `/api/docs` mở được, web hiện trang trắng có tiêu đề. CI xanh |
| **M1** | Auth mock + JWT + guard + hồ sơ người chơi + trình độ tự khai | Đăng nhập bằng user seed, sửa hồ sơ, F5 vẫn còn đăng nhập |
| **M2** | Sân + sân con + tạo trận + chặn trùng giờ + danh sách trận có lọc/sắp xếp | Tạo được trận, thử tạo trùng giờ thì bị chặn với thông báo tiếng Việt |
| **M3** | Vào/rời trận + tự chuyển `FULL` + thông báo + hủy trận → **hết v0.1** | Hai tài khoản khác nhau vào cùng một trận, host thấy thông báo |
| **M4** | Giải: tạo giải, trang công khai + QR, đội đăng ký, BTC duyệt, hạt giống | Người chưa đăng nhập quét QR vẫn xem được trang giải |
| **M5** | **Bốc thăm + sinh lịch** — phần khó nhất, viết test trước khi viết UI | Test 3 thể thức × 6 mức số đội đều xanh |
| **M6** | Nhập tỉ số + sự kiện + đẩy đội thắng lên nhánh + BXH + vua phá lưới + thẻ + xuất CSV + trang in → **hết v0.2** | Chạy trọn giải 8 đội từ đăng ký tới trao giải, không đụng vào DB |

Ở M5, làm theo thứ tự: viết hàm thuần (`pure function`) sinh bảng đấu trong `packages/shared` → test → mới nối vào NestJS → mới làm UI. Hàm sinh bảng đấu **không được biết Prisma là gì**.

---

# 9. Tiêu chí nghiệm thu — người thật bấm thử, không tin lời agent

Chạy hết bảng này, mỗi dòng phải tự tay bấm được:

| # | Việc bấm | Kết quả phải thấy |
|---|---|---|
| 1 | `git clone` → `pnpm i` → `pnpm db:reset` → `pnpm dev` trên máy chưa từng chạy | Chạy được, **không phải sửa file nào** |
| 2 | Đăng nhập bằng user seed, mở hồ sơ, đổi trình độ cầu lông sang "Khá" | Lưu được, F5 vẫn đúng |
| 3 | Tạo trận bóng đá tối mai, 12 suất | Trận hiện đầu danh sách "sắp diễn ra" |
| 4 | Tạo trận thứ hai trùng sân con trùng giờ | Bị chặn, báo tiếng Việt rõ nghĩa, không phải "500 Internal Server Error" |
| 5 | Đăng nhập tài khoản khác, vào trận vừa tạo | Số suất còn lại giảm, host nhận thông báo |
| 6 | Cho đủ người vào trận | Trận tự chuyển `FULL`, không vào thêm được |
| 7 | Mở `/giai/<slug>` ở **cửa sổ ẩn danh** | Xem được lịch + BXH, không bị đá về trang đăng nhập |
| 8 | Tạo giải 8 đội `GROUP_KNOCKOUT`, 2 bảng, mỗi bảng lấy 2 | Bốc ra 2 bảng × 4 đội = 12 trận vòng bảng + 4 trận knockout |
| 9 | Bốc lại với cùng seed | Ra **y hệt** kết quả cũ |
| 10 | Nhập tỉ số hết vòng bảng | BXH tự cập nhật, hai đội đầu mỗi bảng tự vào bán kết |
| 11 | Có hai đội bằng điểm bằng hiệu số | Xếp trên theo đúng luật đối đầu trực tiếp ở §4.4 |
| 12 | Nhập tỉ số bán kết, chung kết | Trang kết quả hiện vô địch + vua phá lưới đúng |
| 13 | Bấm bốc lại khi đã có tỉ số | Bị từ chối, báo lý do |
| 14 | Xuất CSV, mở bằng Excel | Tiếng Việt **không bị lỗi font** (xuất UTF-8 có BOM) |
| 15 | Mở app trên màn hình điện thoại 390px | Dùng được, không tràn ngang |
| 16 | Chạy `pnpm lint && pnpm typecheck && pnpm test` | Xanh hết |

---

# 10. Bàn giao

Ngoài code, phải có:

1. **`README.md`** — mô tả 1 đoạn, phiên bản thực tế của Node/Nest/Prisma/React, cách chạy trong **đúng 3 lệnh**, cách chạy test, sơ đồ thư mục, danh sách tài khoản seed để đăng nhập thử.
2. **`docs/kien-truc.md`** — tiếng Việt, giải thích cho người trong đội chưa biết NestJS: một request đi từ đâu tới đâu (route → guard → pipe → controller → service → Prisma → DB), và vì sao ba cổng ở §1.3 tồn tại.
3. **`docs/thuat-toan-boc-tham.md`** — giải thích circle method và rải hạt giống bằng ví dụ 8 đội vẽ ra tay, để người sau sửa được.
4. **`.env.example`** đầy đủ, có ghi chú từng biến.

---

# 11. Cách bạn làm việc

- Trước khi code, **đọc lại mục 5 (KHÔNG LÀM)**. Đây là ràng buộc, không phải gợi ý.
- Gặp chỗ tài liệu này chưa nói rõ: chọn **cách đơn giản nhất chạy được**, ghi lại lựa chọn đó vào `docs/quyet-dinh.md` một dòng, rồi đi tiếp. Không dừng lại hỏi những thứ vặt.
- Gặp chỗ **ảnh hưởng tới mô hình dữ liệu hoặc luật nghiệp vụ**: dừng và hỏi.
- Không sinh 40 file rồi mới chạy thử. Cứ vài file lại chạy một lần.
- Khi bị lỗi: đọc log thật, đừng đoán. Sửa xong phải chạy lại đúng bước vừa lỗi.

Bắt đầu bằng **M0**. Trước khi gõ dòng code đầu tiên, in ra danh sách file bạn sẽ tạo ở M0 và chờ tôi xác nhận.

=== HẾT PROMPT ===

---

## Phụ lục — prompt ngắn dùng lại từng mốc

Khi mở phiên mới cho một mốc, dán đoạn này thay vì dán lại cả file:

> Đọc `README.md` và `docs/quyet-dinh.md` trong repo để nắm bối cảnh. Tiếp tục dự án MONSPORT ở **Mốc M<số>** theo file `5. prompt-code-demo-nodejs.md` mục 8. Ràng buộc không đổi: NestJS + Prisma + PostgreSQL + React/Vite, TypeScript strict, **không có bất kỳ chức năng thanh toán nào**, và danh sách KHÔNG LÀM ở mục 5 vẫn có hiệu lực. Chạy được rồi mới commit.

## Phụ lục — prompt kiểm tra chéo

Dùng ở một phiên **riêng**, sau mỗi mốc, để agent khác soi lại:

> Bạn là người review, không phải người viết. Đọc repo này và trả lời đúng 4 câu: (1) Có chức năng nào nằm trong danh sách KHÔNG LÀM ở `5. prompt-code-demo-nodejs.md` mục 5 đã lỡ được làm không? (2) Có chỗ nào lưu tiền, giữ số dư, hoặc gọi cổng thanh toán không? (3) Hàm sinh bảng đấu có phụ thuộc Prisma hay `Math.random()` không? (4) Bảng nghiệm thu mục 9, dòng nào **chưa** chạy được? Trả lời ngắn, mỗi câu kèm đường dẫn file cụ thể. Không sửa code.

## Phụ lục — `CLAUDE.md` để copy vào repo code

Claude Code **tự đọc file `CLAUDE.md` ở gốc repo mỗi lần mở phiên**, không cần nhắc. Đây là chỗ nhét ràng buộc cứng để nó không quên giữa chừng. Tạo file `CLAUDE.md` ở gốc repo code với nội dung dưới đây (không phải trong vault này):

```markdown
# MONSPORT — quy tắc cho agent

Đặc tả đầy đủ nằm ở `docs/PROMPT.md`. Đọc file đó trước khi làm bất cứ việc gì.

## Ràng buộc cứng — vi phạm là phải làm lại

- **KHÔNG có bất kỳ chức năng thanh toán nào.** Không bảng Payment/Order/Wallet/Transaction,
  không VietQR, không SDK cổng thanh toán. Giải hè 2027 tài trợ 0 đồng.
- Stack cố định: NestJS + Prisma + PostgreSQL + React/Vite. Không thêm Redis, hàng đợi,
  GraphQL, microservice, Redux, thư viện UI nặng (MUI/Ant).
- TypeScript `strict: true`. Cấm `any`, cấm `@ts-ignore`.
- Kiểu dữ liệu qua API khai **một lần** bằng Zod ở `packages/shared`. Cấm khai lại ở `apps/web`.
- Hàm sinh bảng đấu là hàm thuần ở `packages/shared`, **không biết Prisma là gì**,
  **không dùng `Math.random()`** — nhận seed, cùng seed cho cùng kết quả.
- Tiền lưu số nguyên VND. Thời gian lưu UTC, hiển thị Asia/Ho_Chi_Minh.
- Code/biến/commit bằng tiếng Anh. Chuỗi hiện ra màn hình bằng tiếng Việt có dấu,
  gom ở `apps/web/src/i18n/vi.ts`.
- Đổi DB chỉ qua `prisma migrate dev`. Cấm `prisma db push` trên nhánh chính.

## Danh sách KHÔNG LÀM

App native · ví điện tử · livestream · AI phân tích trận · bán đồ · đặt HLV · giao đồ ăn ·
gọi xe · bảo hiểm · đa ngôn ngữ · feed/story · cá cược · bản đồ 3D · ảnh 360° · chat trong app.

Thấy tính năng nào thuộc danh sách này hoặc thuộc v0.3+ → **dừng và hỏi**, đừng tự làm.

## Cách làm việc

- Làm theo mốc M0→M6 ở `docs/PROMPT.md` mục 8. Hết mỗi mốc phải chạy được + test xanh + commit.
- Chạy `pnpm lint && pnpm typecheck && pnpm test` trước mỗi lần commit.
- Chỗ chưa rõ mà nhỏ: chọn cách đơn giản nhất, ghi 1 dòng vào `docs/quyet-dinh.md`, đi tiếp.
- Chỗ chưa rõ mà đụng tới mô hình dữ liệu hoặc luật nghiệp vụ: **dừng và hỏi**.
- Không sinh 40 file rồi mới chạy thử.
- `README.md` và `.gitignore` đã có sẵn. M0 **bổ sung** vào cuối `README.md`
  (phần chạy dự án, phiên bản thực tế, tài khoản seed) — **không ghi đè file**.

## Lệnh hay dùng

- `pnpm dev` — chạy cả api và web
- `pnpm db:reset` — drop + migrate + seed
- `pnpm test` — Vitest
```

## Phụ lục — câu mở đầu khi bắt đầu phiên Claude Code

**Đừng dán cả file 31KB vào ô chat.** Copy file này vào repo thành `docs/PROMPT.md`, tạo `CLAUDE.md` như trên, rồi mở Claude Code ở gốc repo và gõ đúng chừng này:

> Đọc `CLAUDE.md` và `docs/PROMPT.md`. Tóm tắt lại cho tôi trong 10 dòng: phạm vi demo, stack, và 7 mốc — để tôi biết bạn đã đọc đúng. Chưa code gì cả.

Đọc bản tóm tắt đó. **Nếu nó tóm sai một chỗ nào, sửa ngay lúc này** — rẻ hơn sửa sau 20 file. Đúng rồi thì:

> Đúng rồi. Vào Plan Mode, lập kế hoạch cho **Mốc M0**: liệt kê từng file sẽ tạo và nội dung chính của mỗi file. Chưa viết code.

Duyệt kế hoạch xong mới cho chạy. Hết M0 thì:

> M0 xong. Chạy `pnpm lint && pnpm typecheck && pnpm test`, dán kết quả cho tôi, rồi commit với message theo Conventional Commits.

## Phụ lục — chuẩn bị máy trước khi chạy M0

Kiểm tra máy ngày 08/09/2026 (Windows 11, 15.7 GB RAM). Ai trong đội cũng chạy `kiem-tra-may.ps1` ở gốc vault rồi đối chiếu bảng này:

| Công cụ | Trạng thái | Việc cần làm |
|---|---|---|
| Node.js | có v24.15.0 | **Nâng lên 26 LTS.** Node 24 hết hỗ trợ chính 20/10/2026 và hết vá bảo mật 04/2028 — giữa Phase 1. Tải bản LTS ở nodejs.org, cài đè |
| npm | có 11.12.1 | — |
| git | có 2.54.0 | — |
| **pnpm** | **thiếu** | `npm install -g pnpm@latest`. **Đừng dùng `corepack enable`** — Node TSC đã bỏ phân phối kèm corepack, cách đó sẽ hỏng ở bản Node mới |
| Docker | có 29.5.3 | — đủ để chạy Postgres local như mục 1.1 |
| psql | thiếu | **Không cần cài.** Xem dữ liệu bằng `pnpm prisma studio`, cần SQL thô thì `docker exec -it <container> psql -U postgres` |
| GitHub CLI | có 2.92.0 | `gh auth login` một lần, rồi tạo repo bằng `gh repo create` |
| Claude Code | có 2.1.260 | — |
| VS Code | có 1.135.0 | — |
| WSL2 | **có** (distro `docker-desktop`) | Không cần cài distro Ubuntu. Claude Code chạy thẳng trên Windows |

**Tóm lại chỉ 2 việc:** nâng Node lên 26 LTS, và `npm install -g pnpm@latest`. Xong là chạy được M0.
