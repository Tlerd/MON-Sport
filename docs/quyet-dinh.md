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
