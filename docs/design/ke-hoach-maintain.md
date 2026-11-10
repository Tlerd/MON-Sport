---
style: ste80
lang: vi
---

# Kế hoạch: giai đoạn Maintain (vòng giám sát tự chạy)

Status: draft, 2026-11-10. Chờ Reviewer và chủ dự án. Agent chưa code phần nào của kế hoạch này tới khi chủ dự án duyệt.

Source: người dùng, 2026-11-10 ("Lập kế hoạch"), sau khi so repo với 6 giai đoạn của playbook. Tài liệu: [The AI-native SDLC playbook](https://claude.com/blog/the-ai-native-sdlc-playbook), mục "Stage 6 – Maintain" và "Recurring codebase scans".

## Mục tiêu

Repo đã có Plan, Design, Build, Test và Deploy. Maintain còn thiếu: không có gì theo dõi CI và live sau khi deploy.

Kết quả cần có:

- Một lỗi trong CI hoặc trên live tự sinh một phát hiện có bằng chứng. Không ai phải khởi động việc này.
- Phát hiện vào một hàng chờ triage. Chủ dự án chọn: sửa ngay, xếp lịch, hoặc bỏ qua.
- Một phát hiện được chọn đi qua quy trình như mọi việc khác: nhánh `fix/<slug>`, PR, Reviewer, `node scripts/merge.mjs <n>`.

## Hiện trạng (2026-11-10)

| Nguồn | Số liệu |
|---|---|
| CI (`gh run list --workflow ci --limit 200`) | 182 pass, 6 fail, 12 cancel. 5 trong 6 lần fail ở nhánh PR. 7 lần chạy cần rerun |
| Commit hook | `AC-31` (`google-auth.e2e.test.ts`) và `AC-9` (`VenueScreen.test.tsx`) fail nhiều lần ngày 2026-11-10. `scripts/check.mjs` không lưu kết quả, nên không có số liệu |
| Live | `deploy.yml` kiểm `/api/health` ngay sau deploy và rollback khi lỗi. Sau đó không có gì theo dõi. `gcloud logging read` trên máy dev đọc được log Cloud Run. 7 ngày qua không có response 5xx |
| Mẫu sẵn có | `scripts/ci-autofix.mjs` sửa CI đỏ của PR có nhãn `agent-autofix`. Nó chạy agent trong worktree riêng, xóa token khỏi môi trường, cấm `.skip` và cấm sửa `.github/`, `scripts/`, `harness/` |
| Quyền | GitHub chỉ có biến GCP, không có secret Anthropic. Máy dev có `claude`, `gh` và `gcloud` đã đăng nhập |

## Quyết định (Assumptions)

| Mục | Quyết định | Lý do |
|---|---|---|
| Nơi chạy | Task Scheduler trên máy dev, như `ci-autofix` và usage guard | Không cần secret mới trên GitHub. `claude`, `gh` và `gcloud` đã đăng nhập. Khi có `ANTHROPIC_API_KEY` trên GitHub, chuyển sang workflow `schedule` |
| Phát hiện | Script cố định `scripts/maintain.mjs`. Script không gọi model | Playbook: phát hiện luôn cố định. Model chỉ chạy sau khi vượt ngưỡng |
| Ngưỡng | Ngưỡng tuyệt đối trong `scripts/maintain-bands.json`. Sau 30 ngày có số liệu, xét dùng trung bình và độ lệch chuẩn (σ) | Số liệu nhỏ: 6 lần fail trên 200, và live chỉ có dữ liệu demo. σ trên số nhỏ cho nhiều báo động sai |
| Định dạng ngưỡng | JSON, không dùng YAML | Repo không có thư viện đọc YAML. Không thêm dependency |
| Hàng chờ triage | GitHub issue nhãn `maintain`, theo mẫu `.github/ISSUE_TEMPLATE/maintain-finding.md` | Intake là nguồn sự thật (ADR 0002). Một phát hiện nhỏ hơn một intake. Issue đã là nơi bắt đầu một brief |
| Mẫu issue | Các mục của `intent.md` trong playbook: Vấn đề, Bằng chứng, Kết quả đề xuất, Phần bị ảnh hưởng, Ràng buộc, Câu hỏi mở | Agent và người cùng đọc được một mẫu |
| Chống trùng | Mỗi khóa (chỉ số + tên test hoặc đường dẫn) chỉ có một issue mở. Lần vượt sau thêm comment vào issue đó | Một test chập chờn không được mở 10 issue |
| Model | Phát hiện: không có model. Chẩn đoán: Sonnet ở `--permission-mode plan` (chỉ đọc). Sửa: thứ tự coder của `agent-workflow`. Một phát hiện về tiền, đồng thời, schema hoặc dữ liệu cá nhân: Opus lập kế hoạch và review | Theo cách chia model của người dùng ngày 2026-11-10 và theo `AGENTS.md` |
| Thông báo | GitHub gửi email khi có issue mới. Không thêm kênh khác ở pha 1 | Không cần cấu hình mới |

Agent không bao giờ làm các việc sau trong vòng Maintain:

- Thêm `.skip`, `.only` hoặc `.todo` vào test để "cách ly" một test chập chờn. Việc này làm yếu `pnpm check`.
- Sửa CI, hook, `scripts/` hoặc `harness/` trong một PR tự động.
- Rollback live, đổi traffic Cloud Run, hoặc push lên `main`.
- Đưa số điện thoại, tên, query string hoặc body của request vào issue hay log (`REVIEW.md`, Luật 91/2025).

## Chỉ số và mức xử lý

| Chỉ số | Đo gì | Nguồn |
|---|---|---|
| `main_fail` | Số lần chạy `ci` bị fail trên `main` (sự kiện `push`) trong 7 ngày. Không tính PR: một PR đỏ là việc bình thường. Không tính lần chạy bị cancel | `gh run list --workflow ci --branch main --event push --json conclusion,createdAt` |
| `flaky_test` | Số lần một test fail rồi pass trên cùng nội dung code, trong 7 ngày | CI: lần chạy có `attempt > 1` và kết quả cuối là pass. Đọc tên test của lần đầu bằng `gh run view <id> --attempt 1 --log-failed`. Hook: file log của `scripts/check-log.mjs`. Khóa của mỗi lần chạy là hash của cây code (index tạm, `git add -A`, `git write-tree`), không phải HEAD. Chỉ đếm khi một lần fail và một lần pass có cùng hash |
| `live_5xx` | Số response 5xx của service `monsport` trong 1 giờ | Cloud Logging REST API (`entries:list`) qua `fetch`, với token từ `gcloud auth print-access-token`. Không đưa bộ lọc có `>` qua dòng lệnh: trên Windows `gcloud` là `gcloud.cmd`, và cmd.exe đọc `>` là chuyển hướng |
| `live_health` | `/api/health` không trả 200 trong 2 lần kiểm liền nhau, cách nhau 30 giây, trong cùng một lần chạy | `fetch` tới URL service. URL đọc từ `gcloud run services describe monsport --region asia-southeast1 --format="value(status.url)"` |

Mỗi chỉ số có ba mức:

1. **log**: script ghi một dòng JSON vào `%LOCALAPPDATA%/monsport/maintain.jsonl`.
2. **diagnose**: script mở issue, hoặc thêm comment vào issue đang mở có cùng khóa. Từ pha 2, Sonnet chẩn đoán trước khi script mở issue.
3. **propose**: chỉ có ở pha 3 và chỉ cho `flaky_test`. Agent mở PR `fix/<slug>` sửa nguyên nhân. PR đi qua Reviewer như mọi PR khác.

`scripts/maintain-bands.json` ban đầu (`null` nghĩa là chỉ số không có mức đó):

```json
{
  "main_fail": { "window": "7d", "log": 1, "diagnose": 2, "propose": null },
  "flaky_test": { "window": "7d", "log": 1, "diagnose": 2, "propose": 3 },
  "live_5xx": { "window": "1h", "log": 1, "diagnose": 5, "propose": null },
  "live_health": { "window": "2 checks", "log": null, "diagnose": 1, "propose": null }
}
```

## Các pha

Mỗi pha là một PR `chore/<slug>` riêng, có Reviewer. Viết test trước code.

### Pha 1: phát hiện và mở issue (`chore/maintain-detect`)

| File | Thay đổi |
|---|---|
| `harness/maintain.test.mjs` | Test mới. Mức đúng theo giá trị và ngưỡng. Khóa chống trùng. Body issue có đủ 6 mục và không có số điện thoại hay query string. `--dry-run` không gọi `gh issue create`. Trên Windows, không đối số nào đi qua cmd.exe |
| `scripts/maintain.mjs` | Script mới. Cờ `--dry-run` và `--once`. Lần chạy đầu tạo nhãn `maintain`, `maintain-dismissed` và `maintain-fix` bằng `gh label create <nhãn> --force`. Đọc 4 chỉ số, so với ngưỡng, ghi log, mở hoặc comment issue |
| `scripts/maintain-bands.json` | File mới, nội dung ở trên |
| `harness/check-log.test.mjs` | Test mới cho `scripts/check-log.mjs`: dòng log đúng, khóa là hash của cây code, không ghi khi `CI` có giá trị, lỗi ghi file không đổi kết quả |
| `scripts/check-log.mjs` | Module mới. Tạo và ghi một dòng JSON: thời gian, hash cây code, bước fail, tên test fail. Không ghi khi `CI` có giá trị. Đường dẫn: biến `MONSPORT_CHECK_LOG`, nếu không có thì `LOCALAPPDATA`, rồi `HOME`, như `ci-autofix.mjs`. Mọi lỗi ghi file nằm trong try/catch |
| `scripts/check.mjs` | Gọi `check-log.mjs` một lần ở cuối. Kết quả và mã thoát của check không đổi |
| `.github/ISSUE_TEMPLATE/maintain-finding.md` | Mẫu mới, 6 mục |
| `package.json` | Thêm `"maintain": "node scripts/maintain.mjs"` |
| `AGENTS.md` | Thêm một dòng `pnpm maintain` vào mục Commands |
| `.agents/skills/agent-workflow/SKILL.md` | Thêm mục "Maintain": cách triage một issue `maintain`. Khi sửa xong, thêm một test hồi quy có số issue trong tên |
| `PROGRESS.md`, `HUMAN_DECISIONS.md` | Thêm bước tiếp theo, và dòng "cài tác vụ Task Scheduler" vào mục "Việc chỉ người dùng làm được" |

Bước của người dùng sau khi PR merge: tạo tác vụ Task Scheduler `MONSPORT-Maintain`, chạy mỗi 30 phút: `node D:\MON-Sport\scripts\maintain.mjs --once`. Agent không tạo tác vụ này, vì nó là cấu hình lâu dài trên máy của người dùng.

### Pha 2: chẩn đoán bằng Sonnet (`chore/maintain-diagnose`)

- Ở mức diagnose, script chạy `claude -p --model sonnet --permission-mode plan` với bằng chứng của chỉ số.
- Prompt nằm trong `scripts/maintain-prompt.md`. Câu trả lời theo 6 mục của mẫu issue.
- Mỗi khóa chẩn đoán tối đa một lần mỗi ngày, để giữ chi phí thấp.
- Môi trường của `claude` không có `GH_TOKEN` và `GOOGLE_APPLICATION_CREDENTIALS`. Script dùng lại `agentEnv` của `ci-autofix.mjs`. Script mở issue, model thì không.
- Model chỉ nhận bằng chứng mà script đã lọc: mã trạng thái, đường dẫn không có query string, số lần, tên test. Model không nhận `jsonPayload` thô của Cloud Logging.
- Script chạy lại bộ lọc số điện thoại và query string của pha 1 trên câu trả lời của model, trước khi đăng.
- Kiểm trước khi merge: `claude -p --permission-mode plan` kết thúc sạch mà không cần bước `ExitPlanMode`.

### Pha 3: đề xuất sửa test chập chờn (`chore/maintain-propose`)

- Mức propose của `flaky_test` gắn nhãn `maintain-fix` cho issue.
- Một chế độ mới của `ci-autofix.mjs` đọc nhãn đó. Nó dùng lại worktree riêng, `PROTECTED`, `CHEATS` và giới hạn 2 lần thử.
- Agent mở PR `fix/<slug>`. PR đi qua Reviewer và `node scripts/merge.mjs <n>`. Không có merge tự động.

### Pha 4: quét định kỳ hằng tuần (`chore/maintain-weekly-scan`)

Mỗi tuần một lần, script mở một issue `maintain` tổng hợp:

- `pnpm audit --prod`: lỗ hổng mức high trở lên.
- `@map.md` trên `main` đã cũ (`pnpm map` cho kết quả khác).
- Số finding mức low còn hoãn trong `PROGRESS.md` và `docs/qa/`.

## Đo kết quả

| Chỉ báo | Cách đo |
|---|---|
| Sớm | Thời gian từ lúc vượt ngưỡng (`maintain.jsonl`) tới lúc issue được mở |
| Muộn | Tỷ lệ issue `maintain` đóng bằng một PR đã merge. Số issue mới có cùng khóa với issue đã đóng: con số này phải giảm |

Khi chủ dự án đóng issue với nhãn `maintain-dismissed`, agent xem lại ngưỡng của chỉ số đó ở lần sửa sau.

## Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| Máy dev tắt hoặc ngủ: không có giám sát | Chấp nhận ở pha 1. Chuyển sang workflow `schedule` trên GitHub khi có `ANTHROPIC_API_KEY` |
| Báo động sai nhiều | Ngưỡng tuyệt đối, khóa chống trùng, nhãn `maintain-dismissed` |
| Log Cloud Run có dữ liệu cá nhân | Issue chỉ ghi mã trạng thái, đường dẫn không có query string, và số lần. Không ghi body. Test của pha 1 kiểm điều này |
| Agent làm yếu check để "sửa" test chập chờn | `CHEATS` và `PROTECTED` của `ci-autofix.mjs`, cộng với Reviewer |
| Chi phí model | Không có model ở mức log. Chẩn đoán tối đa một lần mỗi khóa mỗi ngày |
| Xung đột với các PR F-028 chưa merge | Thứ tự: merge chuỗi PR F-028 trước, rồi mới bắt đầu pha 1 |

## Còn mở

| Câu hỏi | Chủ | Chặn |
|---|---|---|
| Duyệt kế hoạch này và thứ tự 4 pha | Chủ dự án | Pha 1 |
| Cài tác vụ Task Scheduler `MONSPORT-Maintain` sau khi pha 1 merge. Chọn "Run only when user is logged on", vì token của `gh` nằm trong keyring của người dùng | Chủ dự án | Pha 1 chạy thật |
| Thêm `ANTHROPIC_API_KEY` vào GitHub để chạy trên cloud | Chủ dự án | Không. Mặc định chạy trên máy dev |
| Ngoài email của GitHub, có cần báo qua Telegram không | Chủ dự án | Không |

Khi pha 1 bắt đầu, các câu hỏi này chuyển vào `HUMAN_DECISIONS.md`. Chúng không vào ngay bây giờ, vì các PR F-028 chưa merge cũng thêm dòng vào file đó.
