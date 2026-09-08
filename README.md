# MON-Sport

Demo Phase 0 của MONSPORT — nền tảng thể thao cấp xã/huyện. Phạm vi: **v0.1 xương sống + v0.2 module giải đấu**, **không có chức năng thanh toán**.

Đặc tả đầy đủ: [`docs/PROMPT.md`](docs/PROMPT.md). Ràng buộc cho AI coding agent: [`CLAUDE.md`](CLAUDE.md).
Kế hoạch kinh doanh nằm ở vault riêng `projectMONSPORT`, không nằm trong repo này.

---

## 1. Chuẩn bị máy (làm một lần)

| Cần | Kiểm tra | Nếu thiếu |
|---|---|---|
| Node.js **26 LTS** | `node -v` | Tải bản LTS ở [nodejs.org](https://nodejs.org), cài đè bản cũ |
| pnpm | `pnpm -v` | `npm install -g pnpm@latest` — **đừng dùng `corepack enable`** |
| Git | `git --version` | [git-scm.com](https://git-scm.com) |
| Docker Desktop | `docker --version` | [docker.com](https://docker.com) — chỉ để chạy Postgres |
| VS Code | | [code.visualstudio.com](https://code.visualstudio.com) |
| Claude Code | `claude --version` | Bản cài thẳng cho Windows, **không cần WSL** |

> Không cài được Docker? Không sao — tạo một project Supabase free của riêng mình rồi
> đổi `DATABASE_URL` trong `.env`. Code không đổi một dòng nào.
>
> Không cần cài `psql`. Xem dữ liệu bằng `pnpm prisma studio`.

## 2. Lấy code về

```bash
git clone https://github.com/Tlerd/MON-Sport.git
cd MON-Sport
```

## 3. Chạy dự án

**Mốc M0 đã xong.** Đúng 3 lệnh sau khi `git clone`:

```bash
pnpm install
docker compose up -d      # Postgres, doc bien tu .env — chay `cp .env.example .env` truoc neu chua co .env
pnpm db:reset             # migrate + seed
pnpm dev                  # api + web
```

Sau khi `pnpm dev` chạy: web ở `http://localhost:5173`, API ở `http://localhost:3000`,
Swagger tại `http://localhost:3000/api/docs`.

### Phiên bản thực tế (M0, 2026-09-08)

| Công cụ | Phiên bản | Ghi chú |
|---|---|---|
| Node.js | 26.7.0 | Đã nâng lên **26 LTS** đúng bản chốt ở mục 1 phía trên |
| pnpm | 12.3.4 | |
| TypeScript | 6.0.3 | Không dùng bản `latest` (7.x) — chưa tương thích `typescript-eslint`, xem `docs/quyet-dinh.md` mục 11 |
| NestJS | 12.0.1 | |
| Prisma | 6.19.3 | Không dùng bản `latest` — Prisma 7 đổi cách cấu hình kết nối DB, xem `docs/quyet-dinh.md` mục 12 |
| React | 19.2.8 | |
| Vite | 8.2.2 | |

### Sơ đồ thư mục (rút gọn)

```
apps/api/          # NestJS — prisma/schema.prisma, src/{common,main.ts}
apps/web/          # React + Vite — src/{pages,i18n,routes.tsx}
packages/shared/   # Zod schema + type + port interface dung chung (bat dau tu M1)
docker-compose.yml # chi Postgres
```

### Tài khoản seed để đăng nhập thử

Vào `http://localhost:5173/dang-nhap`, chọn 1 trong 10 tài khoản dưới đây — đăng nhập
mock không cần mật khẩu (`docs/PROMPT.md` mục 1.3).

| Tên | Vai | zaloId |
|---|---|---|
| Nguyễn Văn Quân | ADMIN | `mock-admin` |
| Lê Thị Hương | ORGANIZER | `mock-organizer-1` |
| Phạm Văn Tùng | ORGANIZER | `mock-organizer-2` |
| Trần Thị Bình | PLAYER | `mock-player-1` |
| Hoàng Văn Nam | PLAYER | `mock-player-2` |
| Vũ Thị Lan | PLAYER | `mock-player-3` |
| Đặng Văn Hùng | PLAYER | `mock-player-4` |
| Bùi Thị Mai | PLAYER | `mock-player-5` |
| Ngô Văn Sơn | PLAYER | `mock-player-6` |
| Đỗ Thị Thu | PLAYER | `mock-player-7` |

Bộ 40 user + Venue/Tournament đầy đủ ở `docs/PROMPT.md` mục 7 dựng dần ở các mốc
sau (M2 cần Venue thật, M4/M5 cần Tournament thật).

## 4. Quy trình git của đội

Đội 5 người, làm bán thời gian, không ai ngồi cùng chỗ. Giữ đúng ba luật này thì không ai đè code của ai:

1. **Không commit thẳng lên `main`.** Mỗi việc một nhánh: `feat/<mốc>-<việc>`, ví dụ `feat/m1-auth-mock`.
2. **Mở Pull Request**, để người khác đọc trước khi merge. CI đỏ là không merge.
3. **Kéo về trước khi bắt đầu:** `git pull --rebase origin main`.

```bash
git switch -c feat/m1-auth-mock
# ... code ...
git add .
git commit -m "feat(auth): mock zalo provider + jwt guard"
git push -u origin feat/m1-auth-mock
gh pr create --fill
```

Commit theo [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`.

## 5. Lộ trình

| Mốc | Nội dung | Xong khi |
|---|---|---|
| M0 | Monorepo, Docker Postgres, Prisma, CI | `pnpm dev` chạy, CI xanh |
| M1 | Auth mock + hồ sơ người chơi | Đăng nhập, sửa hồ sơ, F5 vẫn còn |
| M2 | Sân + tạo trận + chặn trùng giờ | Tạo trùng giờ bị chặn |
| M3 | Vào/rời trận + thông báo → **hết v0.1** | 2 tài khoản vào cùng 1 trận |
| M4 | Tạo giải + trang công khai + đăng ký đội | Quét QR xem được khi chưa đăng nhập |
| M5 | Bốc thăm + sinh lịch | Test 3 thể thức × 6 mức số đội xanh |
| M6 | Tỉ số + BXH + xuất báo cáo → **hết v0.2** | Chạy trọn 1 giải 8 đội |

Chi tiết từng mốc và **16 dòng tiêu chí nghiệm thu**: `docs/PROMPT.md` mục 8 và 9.

## 6. Luật cứng — đọc trước khi viết dòng code đầu tiên

- **Không có bất kỳ chức năng thanh toán nào.** Giải hè 2027 tài trợ 0 đồng.
- Stack cố định: NestJS · Prisma · PostgreSQL · React/Vite · TypeScript strict.
- Tháng 6–8 hằng năm **không đẩy tính năng mới lên production** — đó là mùa chạy giải.

Danh sách đầy đủ những thứ **không làm**: `docs/PROMPT.md` mục 5.
