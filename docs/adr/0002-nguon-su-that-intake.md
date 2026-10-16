# 0002: Bản intake là nguồn sự thật cho yêu cầu

Status: Accepted
Date: 2026-10-16
Supersedes: 0001

## Context

ADR 0001 chọn `docs/spec/dac-ta-ky-thuat.md` làm nguồn sự thật. Đặc tả đó chép từ vault. Nó nhắm tới ghép trận và thanh toán VietQR, và có nhiều mục cho bản v0.3 và v0.4.

Ngày 16/10/2026, bạn quyết định làm lại yêu cầu từ đầu. Bản đầu cần phân quyền cho admin, chủ sân và người dùng. Người dùng đặt sân, và chủ sân xác nhận thủ công. App chưa thu tiền. Bản đầu chạy thử ở 3 đơn vị, và sau đó trở thành bản thật.

## Options

1. **Sửa đặc tả cũ.** Giữ cấu trúc §3–§9. Rủi ro: phần thanh toán, chế độ quorum và điểm uy tín vẫn nằm trong file và kéo agent theo.
2. **Phỏng vấn lại bằng `ba-kit`, và dùng tài liệu cũ chỉ để tham khảo.** Bản intake mới chỉ chứa những gì bạn đã trả lời. Chi phí: phải viết lại mô hình dữ liệu và API.

## Decision

Chọn phương án 2. Lý do quyết định: mỗi câu trong bản intake truy được về một câu trả lời của bạn, nên agent không code theo các quyết định cũ mà bạn đã bỏ.

## Consequences

- `docs/requirements/intake-monsport-v1.md` là nguồn sự thật cho yêu cầu.
- `docs/spec/dac-ta-ky-thuat.md` và `docs/briefs/F-001-tao-tran-kem-dat-san.md` chỉ dùng để tham khảo. Không code theo hai file đó.
- Các tài liệu yêu cầu sau (use case, mô hình dữ liệu, API) được viết bằng skill `ba-docs` từ bản intake, và nằm trong `docs/requirements/`.
- Mỗi brief mới trong `docs/briefs/` truy về bản intake.
- Bộ công nghệ không đổi: NestJS, React + Vite, PostgreSQL trên Supabase, Prisma 7, Zod.
