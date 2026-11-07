---
style: ste80
lang: vi
---

# Kế hoạch: GitHub Actions runner tự host

Status: runner `monsport-wsl` cài ngày 2026-11-07 (Ubuntu trong WSL2, ổ D, service, online). Workflow đổi trong PR `chore/runner-tu-host`. Lần chạy đầu pass cả bốn job. Runner dùng Docker Engine trong Ubuntu, không dùng Docker Desktop. Ubuntu không nhận PATH của Windows (`/etc/wsl.conf`). Bước 8 chưa kiểm chứng.

Source: người dùng, 2026-11-06. Tài liệu GitHub: [Adding self-hosted runners](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/adding-self-hosted-runners) và [chạy runner như service](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/configuring-the-self-hosted-runner-application-as-a-service).

## Mục tiêu

CI không tốn phút Actions của GitHub. Ngày 2026-11-06 repo đã dùng $6,18 trên $12 compute đã gồm trong gói. Chi phí phải trả vẫn là $0. Mới 5 ngày đã hết một nửa, nên tháng này có thể vượt hạn mức.

## Quyết định đã có

| Mục | Quyết định |
|---|---|
| Repo | Ngày 2026-11-06 `Tlerd/MON-Sport` là PRIVATE. Kiểm tra lại trước khi cài. Runner tự host an toàn với repo private. Không bao giờ dùng với repo public |
| Hệ điều hành runner | Linux x64. Job `check` dùng `services: postgres:18`. Job `image` dùng `docker build` và `docker run --network host`. Cả hai cần Docker trên Linux |
| Cách cài ưu tiên | Một distro Ubuntu trong WSL2 với Docker Engine cài trong Ubuntu. Không dùng Docker Desktop: `--network host` của nó không mở cổng tới Ubuntu, và cổng 5432 của Windows bị chiếm |
| Cách thay thế | Runner trong container Docker, mount `/var/run/docker.sock`. Dễ lỗi mạng với `services` và `--network host`. Chỉ thử khi người dùng muốn. Lỗi mạng thì quay về cách ưu tiên |
| Nhãn | `monsport-local` |
| Job chuyển sang runner mới | `changes`, `check`, `image`, `gates` |
| Job giữ trên `ubuntu-latest` | `deploy` (giữ secret GCP) |

## Việc người dùng làm trên máy (đã làm ngày 2026-11-07, trừ bước 8 chưa kiểm chứng)

1. Cài Ubuntu trong WSL2: `wsl --install -d Ubuntu` (PowerShell, quyền Admin). Khởi động lại máy nếu được yêu cầu.
2. Tắt công tắc `Ubuntu` ở Docker Desktop, Settings, Resources, WSL integration. Cài Docker Engine trong Ubuntu: tải `https://get.docker.com` thành `get-docker.sh`, rồi chạy `sudo sh get-docker.sh`. Chạy `sudo usermod -aG docker <user>`. Tắt PATH của Windows: thêm `[interop]` và `appendWindowsPath=false` vào `/etc/wsl.conf`. Cài Node cho `pnpm/action-setup` bằng `sudo apt install -y nodejs npm`. Chạy `wsl --shutdown`. Kiểm tra trong Ubuntu: `docker run --rm hello-world` và `which npm` (phải ra `/usr/bin/npm`).
3. Vào Settings, Actions, Runners, "New self-hosted runner", chọn Linux x64. Chạy các lệnh tải và giải nén trên trang đó trong Ubuntu.
4. Đăng ký: `./config.sh --url https://github.com/Tlerd/MON-Sport --token <TOKEN> --labels monsport-local --name monsport-wsl`. Token hết hạn sau 1 giờ. Không dán token vào chat hay vào file.
5. Chạy thử: `./run.sh`. Terminal ghi "Connected to GitHub" và "Listening for Jobs".
6. Cài service: `sudo ./svc.sh install`, `sudo ./svc.sh start`, `sudo ./svc.sh status`.
7. Cài Google Chrome trong Ubuntu (job `image` cần nó) và kiểm tra `curl` và `git`: `sudo apt update && sudo apt install -y curl git`, rồi tải và cài gói `.deb` của Google Chrome.
8. Giữ WSL sống: tác vụ Task Scheduler `WSL-KeepAlive` ("At log on") chạy `wsl -d Ubuntu --exec sleep infinity`. Docker Engine và service runner tự khởi động bằng systemd. Không có tác vụ này, WSL tắt Ubuntu khi không còn cửa sổ nào mở, và job đang chạy bị hủy (xảy ra ngày 2026-11-07). Chạy tác vụ ngay bằng `schtasks /run /tn "WSL-KeepAlive"` trong PowerShell. Kiểm tra sau khi khởi động lại máy chưa làm. Windows không được ngủ.

## Việc agent làm sau khi runner Idle

1. Đổi `runs-on` của `changes`, `check`, `image` trong `.github/workflows/ci.yml` và của `gates` trong `.github/workflows/pr-gates.yml` thành `[self-hosted, monsport-local]`. Không đổi `deploy.yml`.
2. Trong cùng PR, thêm `docker rm --force monsport-ci-app || true` trước bước khởi động image, và một bước dọn `if: always()` sau bước chạy `verify-flow`. Bước dọn cũng chạy `docker image prune`. Runner tự host giữ container và cổng 8080 khi một lần chạy bị hủy. Cổng Postgres của các `services` là 55442, vì Windows dùng 5432.
3. Chạy một PR nhỏ để thử. Đọc log: `services` và `--network host` chạy đúng, và `image` tìm thấy Chrome.
4. Một PR `chore/` có Reviewer. Không làm yếu `pnpm check`, CI hay hook.

## Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| Máy tắt hoặc ngủ: CI treo, `scripts/merge.mjs` chờ mãi | Giữ máy bật. Nếu cần, đổi `runs-on` về `ubuntu-latest` bằng một PR nhỏ |
| Mã của PR chạy trên máy cá nhân | Repo private, chỉ agent và chủ dự án tạo PR. Không mở quyền fork PR |
| Quyền Cloud Run trên máy cá nhân | `deploy` giữ trên `ubuntu-latest`. Job này dùng token OIDC và quyền `gcloud` (Workload Identity Federation). Không đưa chúng vào runner tự host |
| Job `image` cần Google Chrome (`VERIFY_BROWSER: chrome`). Ubuntu mới trong WSL không có Chrome | Thêm bước người dùng: cài Google Chrome (`.deb`) trong Ubuntu, và kiểm tra `curl` và `git` |
| Container `monsport-ci-app` và cổng 8080 còn lại sau một lần chạy bị hủy. Image cũ chiếm đĩa | Việc agent bước 2: `docker rm --force monsport-ci-app \|\| true`, bước dọn `if: always()`, và `docker image prune` |
| WSL tắt Ubuntu giữa job (runner "received a shutdown signal") | Tác vụ `WSL-KeepAlive` (bước 8 của người dùng). Chạy lại job bị hủy bằng `gh run rerun <id> --failed` |
| Phút đã dùng nhiều trước khi cài | Giảm phút trước: gộp commit trước khi push, không chạy `image` khi chỉ sửa test. Đặt budget $0 ở "Manage budgets" |

## Còn mở

| Câu hỏi | Chủ | Chặn |
|---|---|---|
| Khởi động lại máy: runner có `online` khi chưa mở Ubuntu không | Chủ dự án | Bước 8 |
