# Kiến trúc — giải thích cho người chưa biết NestJS

Tài liệu này dùng ví dụ **thật** trong repo (đăng nhập, sửa hồ sơ) để giải thích một
request đi qua những đâu, và vì sao có 3 "cổng đổi được" ở `docs/PROMPT.md` mục 1.3.
Viết ở Mốc M1 — mốc đầu tiên có guard/pipe/cổng thật để lấy ví dụ.

## 1. Một request đi từ đâu tới đâu

Ví dụ: trình duyệt gửi `PATCH /api/users/me` để lưu trình độ cầu lông mới.

```
Trình duyệt
   │  fetch('/api/users/me', { method: 'PATCH', body: {...} })
   ▼
Vite dev proxy (apps/web/vite.config.ts)          — chỉ chuyển tiếp "/api/*" sang API,
   │                                                 không đổi gì trong request
   ▼
NestJS nhận request tại route đã đăng ký
   │
   ├─ 1. Global prefix "api" (app.setGlobalPrefix, apps/api/src/bootstrap.ts)
   │     → route thật trong code là "/users/me", cộng "api" thành "/api/users/me"
   │
   ├─ 2. Guard: JwtAuthGuard (apps/api/src/common/guards/jwt-auth.guard.ts)
   │     → đọc cookie httpOnly "monsport_token", xác thực JWT
   │     → sai/thiếu cookie: dừng ở đây, trả 401 luôn, KHÔNG chạy tới controller
   │     → đúng: gắn { sub, role } vào request.user
   │
   ├─ 3. Pipe: ZodValidationPipe (apps/api/src/common/pipes/zod-validation.pipe.ts)
   │     → đăng ký toàn cục qua APP_PIPE (không phải chỉ gọi app.useGlobalPipes()
   │       ở main.ts — lý do ở mục 3 bên dưới)
   │     → so khớp body request với `UpdateProfileDto.schema` (Zod)
   │     → sai: dừng ở đây, trả 400 với message tiếng Việt
   │     → đúng: body đã được parse, kiểu dữ liệu chắc chắn khớp
   │
   ├─ 4. Controller: UsersController.updateMe (apps/api/src/users/users.controller.ts)
   │     → chỉ nhận dữ liệu đã sạch (guard + pipe đã lo xong), gọi thẳng service
   │
   ├─ 5. Service: UsersService.updateProfile (apps/api/src/users/users.service.ts)
   │     → luật nghiệp vụ: cập nhật User, upsert từng PlayerSkill theo môn
   │
   ├─ 6. Prisma: PrismaService (apps/api/src/common/prisma/prisma.service.ts)
   │     → sinh câu SQL thật, chạy trong $transaction
   │
   ▼
PostgreSQL (docker-compose.yml)
```

Lỗi ở bất kỳ bước 2/3/5/6 đều rơi vào `HttpExceptionFilter`
(`apps/api/src/common/filters/http-exception.filter.ts`, dựng ở M0) — nơi DUY NHẤT
quyết định hình dạng lỗi trả về `{code, message, details}`, message luôn tiếng Việt.

## 2. Điểm dễ sai với ZodValidationPipe

Pipe chỉ validate được tham số nào có kiểu là **class DTO thật** (vd.
`@Body() dto: UpdateProfileDto`). Nó nhận diện bằng cách tìm thuộc tính tĩnh
`schema` trên class đó (`apps/api/src/users/dto/update-profile.dto.ts`). Nếu bạn
viết `@Body() dto: unknown` hoặc quên khai kiểu, pipe thấy không có `.schema` và
**cho qua nguyên trạng, không báo lỗi gì cả** — dữ liệu bẩn sẽ chạy thẳng xuống
service. Luôn khai `@Body() dto: <TenDto>` đúng class có `static schema = ...`.

DTO là một class rỗng cộng một interface cùng tên (declaration merging) lấy field
từ kiểu suy ra bởi Zod ở `packages/shared` — xem `docs/quyet-dinh.md` mục M1 để biết
vì sao viết vậy thay vì dùng thư viện `nestjs-zod`.

## 3. Vì sao pipe/filter phải đăng ký ở `AppModule`, không chỉ ở `main.ts`

`main.ts` chỉ chạy khi app khởi động thật (`nest start`/`node dist/main.js`). Test
e2e (`apps/api/test/*.spec.ts`) dựng app qua `Test.createTestingModule(...)`,
**không đi qua `main.ts`**. Nếu `ZodValidationPipe` chỉ được gắn bằng
`app.useGlobalPipes()` trong `main.ts`, test sẽ chạy mà không hề validate gì —
xanh giả. Vì vậy:

- `ZodValidationPipe` đăng ký qua `{ provide: APP_PIPE, ... }` trong `app.module.ts`.
- `cookie-parser`, `HttpExceptionFilter`, và `app.setGlobalPrefix('api')` gom vào
  hàm `configureApp()` (`apps/api/src/bootstrap.ts`), gọi từ **cả** `main.ts`
  **và** phần dựng app của test e2e — hai nơi luôn chạy giống hệt nhau.

## 4. Vì sao có 3 "cổng đổi được" (`docs/PROMPT.md` mục 1.3)

Bản demo này chưa có tài khoản Zalo thật, chưa có Zalo OA, chưa dùng Supabase
Storage — nhưng luật nghiệp vụ (đăng nhập, thông báo, lưu file) vẫn phải viết như
thể các dịch vụ đó tồn tại, để sau này cắm bản thật vào **mà không phải sửa lại
service**. Cách làm: khai một `interface` (cổng) ở `packages/shared` — nơi không
biết Nest hay Prisma là gì — rồi viết bản cài đặt cụ thể (adapter) trong `apps/api`,
nơi có đủ Nest DI và Prisma để làm việc thật.

Ví dụ đã có ở M1 — `AuthProvider`:

```
packages/shared/src/auth/auth-provider.port.ts
  interface AuthProvider { resolveIdentity(credential): Promise<ExternalIdentity> }
        ▲
        │ implements
        │
apps/api/src/auth/providers/mock-zalo.provider.ts
  class MockZaloProvider implements AuthProvider {
    constructor(private prisma: PrismaService) {}   // cần Prisma → phải ở apps/api,
    async resolveIdentity({ externalId }) {          // không phải packages/shared
      // tra bang User theo zaloId, tra ve ExternalIdentity
    }
  }
```

`AuthService` (`apps/api/src/auth/auth.service.ts`) chỉ biết `AuthProvider` (qua
`@Inject(AUTH_PROVIDER)`), **không** viết `if (process.env.AUTH_PROVIDER === 'mock')`
ở bất cứ đâu trong service. Việc chọn `MockZaloProvider` nằm gọn một chỗ duy nhất:
`apps/api/src/auth/auth.module.ts`. Khi có Zalo OAuth thật, chỉ cần thêm một class
mới cùng implement `AuthProvider`, đổi một dòng binding ở `auth.module.ts` — service
không đổi.

`NotificationPort` và `FileStoragePort` sẽ đi theo đúng khuôn này ở các mốc sau
(M3, M3+) — interface trước ở `packages/shared`, adapter mock trước, chưa cần binding
theo biến môi trường tới khi thật sự có adapter thứ hai (xem `docs/quyet-dinh.md`).

## 5. Một điểm vận hành cần nhớ: build `packages/shared` trước

`packages/shared` build ra CommonJS vào `dist/` (để `apps/api` có thể `require()`
thẳng lúc chạy thật, không qua bước biên dịch nào khác). Khác với Turborepo/Nx (dự
án này cố tình không dùng — `docs/quyet-dinh.md` mục M0 #4), pnpm **không** tự biết
phải build `packages/shared` trước khi chạy `apps/api`/`apps/web`. Vì vậy các lệnh
gốc `pnpm dev` / `pnpm build` / `pnpm typecheck` / `pnpm test` đều tự build
`packages/shared` trước một bước (xem `package.json` gốc). Nếu bạn sửa code trong
`packages/shared` rồi chạy trực tiếp `pnpm --filter api run dev` (bỏ qua lệnh gốc),
`apps/api` sẽ thấy bản `dist/` **cũ** — chạy `pnpm --filter @monsport/shared run build`
tay, hoặc đơn giản nhất là luôn chạy `pnpm dev`/`pnpm build` ở gốc repo.
