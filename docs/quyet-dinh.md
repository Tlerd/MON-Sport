# Nhật ký quyết định nhỏ

Theo `CLAUDE.md`: chỗ nào đặc tả chưa nói rõ mà nhỏ (không đụng mô hình dữ liệu
hay luật nghiệp vụ) thì chọn cách đơn giản nhất chạy được, ghi một dòng ở đây
rồi đi tiếp, không dừng lại hỏi.

## Mốc M0 — 2026-09-08

1. **`packages/shared` tối giản ở M0** — chỉ 1 export placeholder, chưa khai
   3 port interface (`AuthProvider`, `NotificationPort`, `FileStoragePort`)
   vì chưa có nơi dùng tới (M1/M3/về sau).
2. **`apps/api/prisma/seed.ts` tối giản ở M0** — vài dòng mỗi bảng (2 user, 1
   sân, 1 trận) để chứng minh `prisma migrate reset` chạy lại được nhiều lần.
   Bộ dữ liệu đầy đủ ở `docs/PROMPT.md` mục 7 dựng dần theo mốc cần tới nó.
3. **`ZodValidationPipe` hoãn sang M1** — chưa có DTO nào để validate ở M0,
   gắn pipe rỗng là code chết không kiểm chứng được. `HttpExceptionFilter`
   làm ngay vì không phụ thuộc DTO nào.
4. **Không dùng Turborepo/Nx** — chỉ dùng script pnpm workspace thuần
   (`pnpm -r`, `pnpm --parallel -r --filter "./apps/*" run dev`), vì các
   công cụ đó không nằm trong bảng stack đã chốt ở `docs/PROMPT.md` mục 1.1.
5. **`db:reset` dùng `prisma migrate reset --force`** (lệnh gốc của Prisma:
   drop + migrate + seed một lần) thay vì tự ghép 3 lệnh rời rạc.
6. **`docs/kien-truc.md` và `docs/thuat-toan-boc-tham.md` hoãn sang M1/M5** —
   nội dung cần guard/pipe/3 cổng thật (M1) hoặc thuật toán bốc thăm thật
   (M5) mới giải thích trung thực được; viết stub rỗng ở M0 sẽ lỗi thời ngay.
7. **`.gitignore` thêm `pnpm-debug.log*`** — pnpm ghi log riêng, khác với
   `npm-debug.log*` đã có sẵn.
8. **ESLint: một file `eslint.config.mjs` gốc** dùng chung cho cả hai app
   (block riêng theo `files:` cho quy tắc Node/Nest vs React-hooks). Đặt
   đuôi `.mjs` (không phải `.js`) để tránh phải đổi `"type"` của
   `package.json` gốc — file này dùng cú pháp `import`/`export` ESM.
9. **Không tạo trước các thư mục module rỗng** (`apps/api/src/{auth,users,
   venues,matches,tournaments,notifications}`,
   `apps/web/src/{api,components,hooks}`) — Git không track thư mục rỗng,
   mỗi thư mục sinh ra đúng lúc mốc cần tới nó.
10. **Chạy lệnh `lint` một lần từ thư mục gốc** (`eslint .`), không lặp qua
    từng package bằng `pnpm -r run lint`. ESLint flat config chỉ tự tìm
    `eslint.config.mjs` trong thư mục làm việc hiện tại (không tự đi lên như
    `.eslintrc` cũ) — chạy từ gốc để các pattern `files:`/`ignores:` trong
    config (vốn viết theo đường dẫn tương đối gốc) khớp đúng.
11. **TypeScript pin 6.0.3, không dùng 7.0.2 dù đó là bản `latest` trên
    npm.** TypeScript 7 (bản viết lại bằng native code) chưa được
    `typescript-eslint@8.70.0` hỗ trợ (peer dependency yêu cầu `<6.1.0`) —
    dùng TS7 sẽ làm hỏng phần lint kiểu dữ liệu (`strictTypeChecked`). Thêm
    `"ignoreDeprecations": "6.0"` vào `tsconfig.base.json` vì TS 6.0.3 đã
    cảnh báo `moduleResolution: "Node"` (node10) sẽ bị bỏ ở TS 7 — chưa cần
    đổi sang `Node16`/`NodeNext` (phức tạp hơn nhiều, không cần ở quy mô demo
    này) khi chưa thật sự nâng cấp lên TS 7.
12. **Prisma pin 6.19.3, không dùng bản `latest` (8.0.0-rc, còn là release
    candidate) lẫn 7.10.0 (bản ổn định nhưng đổi kiến trúc lớn).** Prisma 7
    bỏ hẳn `datasource { url = env("DATABASE_URL") }` trong `schema.prisma`
    — bắt buộc chuyển sang `prisma.config.ts` + driver adapter
    (`@prisma/adapter-pg`) mới kết nối được. Đặc tả `docs/PROMPT.md` viết
    theo giả định kiểu Prisma cũ (schema có `url`), và đội là sinh viên mới
    học — mọi tài liệu/hướng dẫn Prisma phổ biến hiện tại vẫn theo kiểu này.
    Prisma 6.19.3 là bản ổn định mới nhất còn giữ cách cấu hình đơn giản đó.
13. **Giữ `package.json#prisma.seed`** (không chuyển sang `prisma.config.ts`)
    dù CLI cảnh báo deprecated — vẫn hoạt động đúng ở Prisma 6.19.3, đơn
    giản hơn cho M0. Cân nhắc chuyển khi nâng lên Prisma 7 (xem mục 12).
14. **`@typescript-eslint/no-extraneous-class` tắt cho `apps/api`** — module
    NestJS thường là class rỗng chỉ mang decorator `@Module()`/`@Global()`,
    đúng chuẩn framework chứ không phải code thừa.
15. **`apps/api/prisma/tsconfig.json` riêng cho thư mục `prisma/`** — để
    `typescript-eslint` (projectService) có ngữ cảnh kiểu dữ liệu chính xác
    khi lint `seed.ts`, vì file này nằm ngoài `rootDir: "./src"` của
    `apps/api/tsconfig.json` nên không thể gộp chung.
16. **`apps/web` khai `"type": "module"`** trong `package.json` — khớp với
    cú pháp `import`/`export` trong `vite.config.ts`, tránh cảnh báo của
    trình tải cấu hình "native" mới của Vite.
17. **Tailwind CSS v4 dùng plugin `@tailwindcss/vite`**, không có
    `tailwind.config.ts`/`postcss.config.js`/`autoprefixer` — v4 cấu hình
    thẳng trong CSS (`@import "tailwindcss";`), không cần các file đó nữa.

## Mốc M0 — cập nhật 2026-09-08 (sau khi nâng Node)

- Nâng `engines.node`/`.nvmrc` lên **Node 26 LTS** — quyết định "dùng Node
  24 tạm thời" ở trên (mục cũ #1) hết hiệu lực và đã bị xoá khỏi log này.

## Mốc M1 — 2026-09-08

1. **`AuthProvider.resolveIdentity({externalId})`** — `MockZaloProvider` tự tra
   Prisma theo `zaloId` để trả về "danh tính bên ngoài", rồi `AuthService` tra
   Prisma **lần nữa** theo `identity.externalId` để lấy tài khoản nội bộ. Đây
   là mô phỏng trung thực "provider trả về danh tính, app tự ánh xạ sang tài
   khoản nội bộ" — không gộp làm một lần tra để tránh nhầm là dư thừa.
2. **Danh sách chọn user để đăng nhập (`GET /auth/candidates`) không thuộc về
   cổng `AuthProvider`** — nó là dữ liệu gốc của app (bảng `User`), Zalo OAuth
   thật không có khái niệm "liệt kê tài khoản". `AuthController` query thẳng
   Prisma cho endpoint này.
3. **DI token `AUTH_PROVIDER` bind thẳng `useClass: MockZaloProvider`**, chưa
   dùng factory theo `env`, vì mới có đúng 1 adapter — cùng nguyên tắc "chưa
   có 2 nơi dùng thì chưa trừu tượng hoá" đã áp dụng cho `packages/shared` ở M0.
4. **`ZodValidationPipe` tự viết** (DTO = class rỗng + interface cùng tên nhờ
   declaration merging, xem `docs/kien-truc.md` mục 2), không dùng `nestjs-zod`.
   Tắt 2 rule ESLint (`no-unsafe-declaration-merging`,
   `no-empty-object-type`) riêng cho `apps/api/src/**/dto/*.dto.ts` vì đây là
   kỹ thuật cố ý, không phải lỗi.
5. **Pipe/filter/global-prefix đăng ký qua `AppModule` (`APP_PIPE`) và hàm
   `configureApp()` dùng chung**, không chỉ gọi rời trong `main.ts` — test e2e
   dựng app qua `Test.createTestingModule` không chạy `main.ts`, nếu chỉ gắn ở
   đó thì test xanh giả (không hề validate/lọc lỗi gì). Chi tiết ở
   `docs/kien-truc.md` mục 3.
6. **`JwtAuthGuard` đặt ở `common/guards/`, `JwtModule` bọc riêng ở
   `common/jwt/`** (không nằm trong `auth/`) — cả `AuthModule` lẫn `UsersModule`
   đều cần, giống cách `common/prisma` đã dùng chung từ M0.
7. **`JWT_EXPIRES_IN` đổi sang số giây** (`604800`, không phải chuỗi `"7d"`) —
   kiểu `expiresIn` của `@nestjs/jwt` là `number | StringValue`, một chuỗi
   thường không khớp `StringValue` (kiểu riêng của thư viện `ms`) mà không ép
   kiểu; dùng số giây tránh hẳn việc ép kiểu.
8. **Cookie phiên đăng nhập**: `httpOnly: true, sameSite: 'lax', secure`
   chỉ bật khi `NODE_ENV === 'production'`, `path: '/'`, hạn 7 ngày. Web gọi
   API qua proxy `/api` của Vite (cùng-origin ở dev) nên `sameSite: 'lax'` là
   đủ, không cần `'none'` (thứ đó bắt buộc `secure: true`, cần https).
9. **Seed mở rộng 2 → 10 user** (1 ADMIN + 2 ORGANIZER + 7 PLAYER, rải 4 mức
   trình độ), giữ nguyên 2 user cũ để README/tài liệu trỏ tên không bị sai.
10. **File test e2e đặt tên `apps/api/test/auth.spec.ts`**, không phải
    `auth.e2e-spec.ts` mặc định của Nest — repo chưa có `vitest.config.ts` nên
    glob mặc định của Vitest không khớp `*-spec.ts` có gạch ngang; đặt sai tên
    thì CI xanh nhưng test không hề chạy.
11. **Thêm `apps/api/test/tsconfig.json`** (cùng kiểu với
    `apps/api/prisma/tsconfig.json` đã có từ M0) — `typescript-eslint`
    (projectService) cần một tsconfig phủ tới `test/` vì thư mục này nằm
    ngoài `rootDir: "./src"` của `apps/api/tsconfig.json`.
12. **`apps/api` script `test` bọc qua `dotenv-cli`** giống `dev`/`db:reset`
    (`dotenv -e ../../.env -- vitest run`) — phát hiện `dotenv-cli` tự bỏ qua
    êm re (exit 0, không đụng biến env đã có sẵn) khi file `.env` không tồn
    tại, nên cách này an toàn cho cả CI (chỉ có biến môi trường đặt trực tiếp
    ở job, không có file `.env`) lẫn máy dev (có file `.env` thật).
13. **`packages/shared` build ra CommonJS vào `dist/`, `package.json#main`
    trỏ `./dist/index.js`** (không phải thẳng `src/index.ts` như lúc để
    trống ở M0) — trỏ thẳng source `.ts` làm `apps/api` (chạy Node CJS thật,
    qua `nest start`/`node dist/main.js`) báo `ERR_MODULE_NOT_FOUND`, dù
    `tsc --noEmit` và Vitest (đều tự transpile TS on-the-fly) không hề phát
    hiện ra lỗi này. Thêm `"declaration": true` vào
    `packages/shared/tsconfig.build.json` để sinh kèm `.d.ts`. Vì không dùng
    Turborepo/Nx, pnpm không tự biết build `packages/shared` trước — các
    script gốc `dev`/`typecheck`/`test`/`build` đều tự build `packages/shared`
    trước một bước (xem `docs/kien-truc.md` mục 5).
14. **`apps/web/vite.config.ts` thêm `optimizeDeps.include: ['@monsport/shared']`**
    — Vite không tự "pre-bundle" package workspace liên kết qua filesystem,
    nên import ESM thô báo thiếu export dù package có xuất đúng (barrel
    `export * from` của TypeScript biên dịch ra `__exportStar` — chỉ gán
    thuộc tính lúc chạy, không phân tích tĩnh được).
15. **`ProfilePage` tách thành `ProfilePage` (gác cổng loading/đăng nhập) +
    `ProfileForm` (key theo `profile.id`)** — tránh gọi `setState` trong
    `useEffect` để "đồng bộ" dữ liệu vừa fetch (bị ESLint
    `react-hooks/set-state-in-effect` chặn, đúng khuyến nghị chính thức của
    React: khởi tạo state cục bộ ngay trong `useState`, remount bằng `key`
    khi dữ liệu gốc đổi, không dùng effect).
16. **Gộp header bằng `Headers` API, không spread `init?.headers`** trong
    `apps/web/src/api/http.ts` — spread một `Headers`/mảng cặp key-value vào
    object literal không gộp đúng như tưởng (ESLint `no-misused-spread` bắt
    được).
17. **Dùng `SyntheticEvent<HTMLFormElement>` thay vì `FormEvent`** cho handler
    `onSubmit` — kiểu `FormEvent` (không tham số) bị đánh dấu deprecated ở
    bản `@types/react` đang dùng.
18. **Ảnh đại diện ở M1 chỉ là ô nhập link (URL) thô**, chưa có upload file
    thật — `FileStoragePort` chưa dựng (đúng lịch, xem mục 1.3 đặc tả), làm
    upload thật ở đây là vượt phạm vi mốc.
