---
name: Maintain finding
about: Phát hiện tự động từ vòng giám sát Maintain (CI hoặc live)
title: "[maintain] "
labels: maintain
---

## Vấn đề

<!-- Chỉ số nào vượt ngưỡng, giá trị đo được, và cửa sổ thời gian. -->

## Bằng chứng

<!-- Mã trạng thái, đường dẫn không có query string, số lần, tên test. Không ghi số điện thoại, tên người dùng, hay body request. -->

## Kết quả đề xuất

<!-- Mục tiêu cần đạt khi sửa xong. -->

## Phần bị ảnh hưởng

<!-- Module, file, hoặc dịch vụ bị ảnh hưởng. -->

## Ràng buộc

- Không thêm `.skip`, `.only`, `.todo` hoặc làm yếu `pnpm check`.
- Không sửa `.github/`, `scripts/`, `harness/` trong PR autofix.
- Không đưa số điện thoại, tên, query string hoặc body của request vào issue hay log.
- Sửa qua nhánh `fix/<slug>`, PR, Reviewer, và merge bằng `node scripts/merge.mjs <n>`.

## Câu hỏi mở

<!-- Quyết định cần chủ dự án chốt: sửa ngay, xếp lịch, hay đóng kèm nhãn `maintain-dismissed`. -->
