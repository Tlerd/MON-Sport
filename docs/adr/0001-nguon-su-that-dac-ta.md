# 0001: Đặc tả kỹ thuật nằm trong repo

Status: Superseded by 0002
Date: 2026-10-16

## Context

Đặc tả của MON-Sport nằm trong vault, ở file `9. ke-hoach-web-app-dat-san-ghep-nguoi-thanh-toan.md` (663 dòng). Coding agent chỉ thấy những gì nằm trong repo. CI và các bản chạy tự động trên máy khác không đọc được vault. `AGENTS.md` trỏ tới đường dẫn tuyệt đối `D:\projectMONSPORT\...`, nên chỉ máy này đọc được.

File `9.` trộn hai loại nội dung: phần kỹ thuật (kiến trúc, thiết kế, dữ liệu, API, nghiệm thu) và phần kế hoạch (quyết định chờ chốt, lộ trình, giờ công, chi phí, rủi ro). Agent chỉ cần phần kỹ thuật để code.

## Options

1. **Chép phần kỹ thuật vào repo.** Chép §3–§6 và §9 vào `docs/spec/`. Repo là nguồn sự thật cho phần kỹ thuật. Vault giữ phần kế hoạch. Chi phí: phải giữ hai nơi khớp nhau khi sửa.
2. **Giữ ở vault.** `AGENTS.md` trỏ tới đường dẫn tuyệt đối. Không tốn công chép. Rủi ro: CI, máy khác và người khác không đọc được. Thay đổi đặc tả không đi qua review.
3. **Chép toàn bộ file `9.` vào repo.** Một nguồn duy nhất. Rủi ro: agent đọc nhiều ngữ cảnh không cần cho code, như giờ công và chi phí.

## Decision

Chọn phương án 1. Lý do quyết định: agent, CI và người review cùng thấy một bản đặc tả, và mọi thay đổi đặc tả đi qua PR cùng với code.

## Consequences

- `docs/spec/dac-ta-ky-thuat.md` là nguồn sự thật cho phần kỹ thuật. Số mục giữ như bản gốc: `§4` thiết kế, `§5` dữ liệu, `§6` API, `§9` nghiệm thu.
- Sửa phần kỹ thuật ở repo trước, rồi mới sửa vault.
- Quyết định nào làm đặc tả đổi khác bản gốc thì ghi vào bảng "Quyết định khác bản gốc" ở đầu file đặc tả.
- Mỗi tính năng có một brief trong `docs/briefs/`. Brief trích các mục của đặc tả mà tính năng dùng.
- Các tham chiếu tới tài liệu khác (`7.`, `8.`, `4.2`) vẫn trỏ về vault. Khi một tham chiếu chặn việc code, chép mục đó vào `docs/spec/`.
