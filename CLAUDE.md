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
